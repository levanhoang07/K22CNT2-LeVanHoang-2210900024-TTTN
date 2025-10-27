// ==============================
// CẤU HÌNH CƠ BẢN
// ==============================
const API_BASE = "http://127.0.0.1:5000";
const socket = io(API_BASE);

let allOrders = [];
let selectedOrder = null;
let currentFilter = 'all';
let paymentMethod = 'cash'; // 'cash' hoặc 'transfer'

// ==============================
// ĐỒNG HỒ THỜI GIAN
// ==============================
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
  document.getElementById("current-time").textContent = timeStr;
}

setInterval(updateClock, 1000);
updateClock();

// ==============================
// SOCKETIO SỰ KIỆN
// ==============================
socket.on("connect", () => {
  console.log("✅ Thu ngân connected:", socket.id);
  loadOrders();
});

socket.on("new_order", data => {
  showNotification(`🆕 Có đơn mới: #${data.IDDonHang} — Bàn ${data.IDBan}`, "info");
  loadOrders();
});

socket.on("bep_status_update", data => {
  console.log("👨‍🍳 Cập nhật bếp:", data);
  loadOrders();
});

socket.on("payment_done", data => {
  console.log("💳 Đã thanh toán:", data);
  loadOrders();
});

// ==============================
// TẢI DANH SÁCH ĐƠN HÀNG
// ==============================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không tải được danh sách đơn");
    
    allOrders = await res.json();
    renderOrders();
    updateStats();
  } catch (err) {
    console.error(err);
    document.getElementById("order-list").innerHTML = 
      `<p class="error-message">❌ ${err.message}</p>`;
  }
}

// ==============================
// LỌC ĐƠN HÀNG
// ==============================
function filterOrders(filter) {
  currentFilter = filter;
  
  // Cập nhật active state cho tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.tab-btn').classList.add('active');
  
  renderOrders();
}

function getFilteredOrders() {
  if (currentFilter === 'all') return allOrders;
  if (currentFilter === 'pending') return allOrders.filter(o => !o.TrangThaiThanhToan);
  if (currentFilter === 'paid') return allOrders.filter(o => o.TrangThaiThanhToan);
  return allOrders;
}

// ==============================
// HIỂN THỊ DANH SÁCH ĐƠN
// ==============================
function renderOrders() {
  const orderList = document.getElementById("order-list");
  const orders = getFilteredOrders();

  if (!orders || orders.length === 0) {
    orderList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>Không có đơn hàng nào</p>
      </div>
    `;
    return;
  }

  // Sắp xếp: chưa thanh toán lên trước, mới nhất lên đầu
  orders.sort((a, b) => {
    if (a.TrangThaiThanhToan !== b.TrangThaiThanhToan) {
      return a.TrangThaiThanhToan ? 1 : -1;
    }
    return new Date(b.NgayTao) - new Date(a.NgayTao);
  });

  orderList.innerHTML = orders.map(order => {
    const isSelected = selectedOrder && selectedOrder.IDDonHang === order.IDDonHang;
    const statusClass = order.TrangThaiThanhToan ? 'status-paid' : 'status-pending';
    const statusText = order.TrangThaiThanhToan ? '✅ Đã thanh toán' : '⏳ Chờ thanh toán';

    return `
      <div class="order-item ${isSelected ? 'selected' : ''}" 
           onclick="selectOrder(${order.IDDonHang})">
        <div class="order-item-header">
          <div class="order-table">
            <i class="fas fa-utensils"></i>
            Bàn ${order.IDBan}
          </div>
          <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-item-body">
          <div class="order-item-info">
            <p><i class="fas fa-hashtag"></i> Đơn #${order.IDDonHang}</p>
            <p><i class="fas fa-clock"></i> ${formatTime(order.NgayTao)}</p>
            <p class="price"><i class="fas fa-coins"></i> ${formatMoney(order.TongTien)}</p>
          </div>
          <div class="order-item-actions">
            <button class="btn-view" onclick="event.stopPropagation(); viewOrderDetail(${order.IDDonHang})">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Cập nhật số lượng đơn
  document.getElementById("order-count").textContent = orders.length;
}

// ==============================
// CHỌN ĐƠN HÀNG
// ==============================
async function selectOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/donhang/${orderId}`);
    if (!res.ok) throw new Error("Không tải được chi tiết đơn");
    
    selectedOrder = await res.json();
    renderPaymentPanel();
    renderOrders(); // Cập nhật highlight
  } catch (err) {
    console.error(err);
    showNotification("Không thể tải chi tiết đơn hàng", "error");
  }
}

// ==============================
// HIỂN THỊ PANEL THANH TOÁN
// ==============================
function renderPaymentPanel() {
  if (!selectedOrder) {
    document.getElementById("selected-order-info").innerHTML = `
      <p class="no-selection">
        <i class="fas fa-hand-pointer"></i>
        Chọn một đơn hàng để thanh toán
      </p>
    `;
    document.getElementById("order-items").innerHTML = '';
    resetCalculation();
    return;
  }

  // Thông tin đơn hàng
  const statusClass = selectedOrder.TrangThaiThanhToan ? 'status-paid' : 'status-pending';
  const statusText = selectedOrder.TrangThaiThanhToan ? '✅ Đã thanh toán' : '⏳ Chờ thanh toán';

  document.getElementById("selected-order-info").innerHTML = `
    <div class="info-row">
      <span><i class="fas fa-utensils"></i> Bàn:</span>
      <strong>Bàn ${selectedOrder.IDBan}</strong>
    </div>
    <div class="info-row">
      <span><i class="fas fa-hashtag"></i> Đơn hàng:</span>
      <strong>#${selectedOrder.IDDonHang}</strong>
    </div>
    <div class="info-row">
      <span><i class="fas fa-clock"></i> Thời gian:</span>
      <strong>${formatDateTime(selectedOrder.NgayTao)}</strong>
    </div>
    <div class="info-row">
      <span><i class="fas fa-info-circle"></i> Trạng thái:</span>
      <span class="order-status ${statusClass}">${statusText}</span>
    </div>
  `;

  // Chi tiết món ăn
  const items = selectedOrder.Items || [];
  if (items.length === 0) {
    document.getElementById("order-items").innerHTML = '<p class="no-items">Không có món nào</p>';
  } else {
    document.getElementById("order-items").innerHTML = items.map(item => `
      <div class="item-row">
        <div>
          <div class="item-name">${item.TenMon}</div>
          <div class="item-qty">x${item.SoLuong}</div>
        </div>
        <div class="item-price">${formatMoney(item.Gia * item.SoLuong)}</div>
      </div>
    `).join('');
  }

  // Cập nhật tính tiền
  updateCalculation();
}

// ==============================
// TÍNH TIỀN
// ==============================
function updateCalculation() {
  if (!selectedOrder) return;

  const totalAmount = selectedOrder.TongTien || 0;
  const discount = parseFloat(document.getElementById("discount-input")?.value || 0);
  const finalAmount = Math.max(0, totalAmount - discount);

  document.getElementById("total-amount").textContent = formatMoney(totalAmount);
  document.getElementById("final-amount").textContent = formatMoney(finalAmount);

  // Cập nhật tiền thừa nếu là tiền mặt
  if (paymentMethod === 'cash') {
    updateChange(finalAmount);
  }
}

function resetCalculation() {
  document.getElementById("total-amount").textContent = '0 ₫';
  document.getElementById("final-amount").textContent = '0 ₫';
  if (document.getElementById("discount-input")) {
    document.getElementById("discount-input").value = 0;
  }
  if (document.getElementById("customer-cash")) {
    document.getElementById("customer-cash").value = '';
  }
  if (document.getElementById("change-amount")) {
    document.getElementById("change-amount").textContent = '0 ₫';
  }
}

// ==============================
// TIỀN THỪA
// ==============================
function updateChange(finalAmount) {
  const customerCash = parseFloat(document.getElementById("customer-cash")?.value || 0);
  const change = Math.max(0, customerCash - finalAmount);
  
  const changeEl = document.getElementById("change-amount");
  if (changeEl) {
    changeEl.textContent = formatMoney(change);
    
    // Highlight nếu thiếu tiền
    if (customerCash > 0 && customerCash < finalAmount) {
      changeEl.style.color = '#ef4444';
    } else {
      changeEl.style.color = 'white';
    }
  }
}

// ==============================
// PHƯƠNG THỨC THANH TOÁN
// ==============================
function selectPaymentMethod(method) {
  paymentMethod = method;
  
  // Cập nhật UI
  document.querySelectorAll('.method-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-method="${method}"]`).classList.add('active');
  
  // Hiển thị/ẩn phần tiền mặt
  const cashSection = document.getElementById('cash-payment-section');
  if (cashSection) {
    cashSection.style.display = method === 'cash' ? 'block' : 'none';
  }
}

// ==============================
// NHẬP NHANH TIỀN MẶT
// ==============================
function setQuickCash(amount) {
  const input = document.getElementById("customer-cash");
  if (input) {
    input.value = amount;
    const finalAmount = parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g, ''));
    updateChange(finalAmount);
  }
}

// ==============================
// THANH TOÁN
// ==============================
async function processPayment() {
  if (!selectedOrder) {
    showNotification("Vui lòng chọn đơn hàng để thanh toán", "warning");
    return;
  }

  if (selectedOrder.TrangThaiThanhToan) {
    showNotification("Đơn hàng này đã được thanh toán", "warning");
    return;
  }

  // Kiểm tra tiền mặt
  if (paymentMethod === 'cash') {
    const finalAmount = parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g, ''));
    const customerCash = parseFloat(document.getElementById("customer-cash")?.value || 0);
    
    if (customerCash < finalAmount) {
      showNotification("Số tiền khách đưa không đủ!", "error");
      return;
    }
  }

  if (!confirm(`Xác nhận thanh toán đơn #${selectedOrder.IDDonHang}?\nPhương thức: ${paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/donhang/thanh-toan/${selectedOrder.IDDonHang}`, {
      method: "PUT",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        PhuongThuc: paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Lỗi server");

    showNotification(`💳 Thanh toán thành công — ${formatMoney(data.TongTien)}`, "success");
    
    // Reset
    selectedOrder = null;
    renderPaymentPanel();
    loadOrders();
    
  } catch (err) {
    console.error(err);
    showNotification("Lỗi thanh toán: " + err.message, "error");
  }
}

// ==============================
// HÚY THANH TOÁN
// ==============================
function cancelPayment() {
  selectedOrder = null;
  renderPaymentPanel();
  renderOrders();
}

// ==============================
// XEM CHI TIẾT ĐƠN (MODAL)
// ==============================
async function viewOrderDetail(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/donhang/${orderId}`);
    if (!res.ok) throw new Error("Không tải được chi tiết đơn");
    
    const order = await res.json();
    const items = order.Items || [];
    
    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML = `
      <div class="modal-order-info">
        <h4><i class="fas fa-utensils"></i> Bàn ${order.IDBan} - Đơn #${order.IDDonHang}</h4>
        <p><i class="fas fa-clock"></i> ${formatDateTime(order.NgayTao)}</p>
        <p><i class="fas fa-fire"></i> Trạng thái bếp: <strong>${order.TrangThaiBep || 'Chưa có'}</strong></p>
        <p><i class="fas fa-wallet"></i> Thanh toán: <strong>${order.TrangThaiThanhToan ? '✅ Đã thanh toán' : '❌ Chưa thanh toán'}</strong></p>
      </div>
      
      <div class="modal-items">
        <h4><i class="fas fa-list"></i> Chi tiết món</h4>
        <table class="modal-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên món</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.TenMon}</td>
                <td>${item.SoLuong}</td>
                <td>${formatMoney(item.Gia)}</td>
                <td><strong>${formatMoney(item.Gia * item.SoLuong)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="modal-total">
        <h3>Tổng cộng: <span>${formatMoney(order.TongTien)}</span></h3>
      </div>
    `;
    
    document.getElementById("order-detail-modal").classList.add("show");
  } catch (err) {
    console.error(err);
    showNotification("Không thể xem chi tiết đơn hàng", "error");
  }
}

function closeModal() {
  document.getElementById("order-detail-modal").classList.remove("show");
}

// ==============================
// CẬP NHẬT THỐNG KÊ
// ==============================
function formatMoney(amount) {
  const num = parseFloat(amount) || 0; // ép chuỗi thành số, xử lý null/undefined
  return num.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " ₫";
}

function updateStats() {
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders
    .filter(o => o.TrangThaiThanhToan)
    .reduce((sum, o) => sum + parseFloat(o.TongTien || 0), 0); // ép kiểu đúng

  document.getElementById("stat-orders").textContent = totalOrders;
  document.getElementById("stat-revenue").textContent = formatMoney(totalRevenue);
}

// ==============================
// HÀM TIỆN ÍCH
// ==============================
function formatMoney(v) {
  return (v || 0).toLocaleString("vi-VN") + " ₫";
}

function formatTime(dateStr) {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function showNotification(message, type = 'info') {
  // Xóa notification cũ
  const oldNotif = document.querySelector('.notification');
  if (oldNotif) oldNotif.remove();

  const div = document.createElement('div');
  div.className = `notification ${type}`;
  
  const icon = {
    'success': 'fa-check-circle',
    'error': 'fa-exclamation-circle',
    'warning': 'fa-exclamation-triangle',
    'info': 'fa-info-circle'
  }[type] || 'fa-info-circle';
  
  div.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  document.body.appendChild(div);
  
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

// ==============================
// EVENT LISTENERS
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  // Load dữ liệu ban đầu
  loadOrders();
  
  // Lắng nghe thay đổi giảm giá
  const discountInput = document.getElementById('discount-input');
  if (discountInput) {
    discountInput.addEventListener('input', updateCalculation);
  }
  
  // Lắng nghe thay đổi tiền khách đưa
  const customerCashInput = document.getElementById('customer-cash');
  if (customerCashInput) {
    customerCashInput.addEventListener('input', () => {
      const finalAmount = parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g, ''));
      updateChange(finalAmount);
    });
  }
  
  // Đóng modal khi click bên ngoài
  document.getElementById('order-detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'order-detail-modal') {
      closeModal();
    }
  });
  
  // Auto refresh mỗi 30 giây
  setInterval(loadOrders, 30000);
});

// ==============================
// KHỞI TẠO
// ==============================
console.log("💵 Thu ngân system initialized");