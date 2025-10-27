// static/js/bep.js - Quản lý đơn hàng bếp (Đơn giản, dễ hiểu)

const API_BASE = "http://127.0.0.1:5000/api";
const socket = io("http://127.0.0.1:5000");

let allOrders = [];
let currentFilter = 'all';

// ==============================
// 🔌 KẾT NỐI SOCKET
// ==============================
socket.on("connect", () => {
  console.log("✅ Kết nối thành công");
  loadOrders();
});

socket.on("new_order", (data) => {
  console.log("🔔 Đơn mới:", data);
  showNotification(`Đơn mới từ bàn ${data.IDBan}!`, 'new');
  loadOrders();
});

socket.on("bep_status_update", () => {
  loadOrders();
});

// ==============================
// 📋 LẤY DANH SÁCH ĐƠN HÀNG
// ==============================
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/donhang`);
    if (!res.ok) throw new Error("Lỗi tải đơn");
    
    allOrders = await res.json();
    renderOrders(getFilteredOrders());
    updateStats();
  } catch (err) {
    console.error("❌ Lỗi:", err);
  }
}

// ==============================
// 🔍 LỌC ĐƠN HÀNG
// ==============================
function filterOrders(filter) {
  currentFilter = filter;
  
  // Cập nhật nút active
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.filter-btn').classList.add('active');
  
  renderOrders(getFilteredOrders());
}

function getFilteredOrders() {
  if (currentFilter === 'all') return allOrders;
  if (currentFilter === 'pending') return allOrders.filter(o => o.TrangThaiBep === 'Đang xử lý');
  if (currentFilter === 'completed') return allOrders.filter(o => o.TrangThaiBep === 'Hoàn tất');
  return allOrders;
}

// ==============================
// 🎨 HIỂN THỊ DANH SÁCH ĐƠN
// ==============================
function renderOrders(orders) {
  const container = document.getElementById("order-list");
  
  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="empty-list">
        <i class="fas fa-inbox"></i>
        <div>Không có đơn hàng nào</div>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => `
    <div class="order-card ${getStatusClass(order.TrangThaiBep)}">
      <div class="card-body">
        <div class="order-header">
          <div class="order-title">
            <div class="table-icon">${order.IDBan}</div>
            <div>
              <h3>Bàn ${order.IDBan}</h3>
              <small>#${order.IDDonHang}</small>
            </div>
          </div>
          <span class="status-badge ${getStatusClass(order.TrangThaiBep)}">
            <i class="fas ${getStatusIcon(order.TrangThaiBep)}"></i>
            ${order.TrangThaiBep}
          </span>
        </div>
        
        <div class="order-info">
          <div class="info-item">
            <span class="info-label">Giờ đặt</span>
            <span class="info-value">${formatTime(order.NgayTao)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Tổng tiền</span>
            <span class="info-value price">${formatMoney(order.TongTien)}</span>
          </div>
        </div>

        <div class="order-items" id="items-${order.IDDonHang}">
          <button class="btn-view-items" onclick="toggleItems(${order.IDDonHang})">
            <i class="fas fa-utensils"></i>
            <span>Xem chi tiết món</span>
          </button>
          <div class="items-detail" style="display: none;"></div>
        </div>

        <div class="order-actions">
          ${order.TrangThaiBep === 'Đang xử lý' ? `
            <button class="btn-complete" onclick="completeOrder(${order.IDDonHang})">
              <i class="fas fa-check-circle"></i>
              Hoàn tất
            </button>
          ` : `
            <button class="btn-completed" disabled>
              <i class="fas fa-check-double"></i>
              Đã xong
            </button>
          `}
        </div>
      </div>
    </div>
  `).join('');
}

// ==============================
// 👁️ XEM CHI TIẾT MÓN
// ==============================
async function toggleItems(iddon) {
  const itemsContainer = document.querySelector(`#items-${iddon} .items-detail`);
  const button = document.querySelector(`#items-${iddon} .btn-view-items`);
  const icon = button.querySelector('i');
  const text = button.querySelector('span');
  
  // Nếu đang hiển thị thì ẩn
  if (itemsContainer.style.display !== 'none') {
    itemsContainer.style.display = 'none';
    icon.className = 'fas fa-utensils';
    text.textContent = 'Xem chi tiết món';
    return;
  }

  // Nếu đã load thì chỉ hiển thị
  if (itemsContainer.innerHTML.trim() !== '') {
    itemsContainer.style.display = 'block';
    icon.className = 'fas fa-chevron-up';
    text.textContent = 'Ẩn chi tiết';
    return;
  }

  // Load dữ liệu lần đầu
  icon.className = 'fas fa-spinner fa-spin';
  text.textContent = 'Đang tải...';
  button.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/donhang/${iddon}`);
    if (!res.ok) throw new Error("Lỗi tải chi tiết");
    
    const order = await res.json();
    const items = order.Items || [];

    // DEBUG: In ra để kiểm tra
    console.log("📸 Dữ liệu món ăn:", items);
    items.forEach(item => {
      console.log(`Món: ${item.TenMon}, Ảnh: ${item.HinhAnh}`);
    });

    if (items.length === 0) {
      itemsContainer.innerHTML = '<p class="no-items">Không có món nào</p>';
    } else {
      itemsContainer.innerHTML = `
        <table class="items-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên món</th>
              <th>Số lượng</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td class="item-stt">${index + 1}</td>
                <td class="item-name-text">${item.TenMon}</td>
                <td class="item-qty">×${item.SoLuong}</td>
                <td class="item-note">-</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    itemsContainer.style.display = 'block';
    icon.className = 'fas fa-chevron-up';
    text.textContent = 'Ẩn chi tiết';
  } catch (err) {
    console.error("❌ Lỗi:", err);
    itemsContainer.innerHTML = '<p class="no-items">Không thể tải chi tiết</p>';
  } finally {
    button.disabled = false;
  }
}

// ==============================
// ✅ HOÀN TẤT ĐƠN HÀNG
// ==============================
async function completeOrder(iddon) {
  if (!confirm(`Xác nhận hoàn tất đơn #${iddon}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/bep/cap-nhat-trang-thai/${iddon}`, {
      method: "PUT"
    });

    if (!res.ok) throw new Error("Lỗi cập nhật");

    showNotification(`Đơn #${iddon} đã hoàn tất!`, 'success');
    loadOrders();
  } catch (err) {
    console.error("❌ Lỗi:", err);
    alert("Không thể cập nhật trạng thái!");
  }
}

// ==============================
// 📊 CẬP NHẬT THỐNG KÊ
// ==============================
function updateStats() {
  const pending = allOrders.filter(o => o.TrangThaiBep === 'Đang xử lý').length;
  const total = allOrders.length;

  document.getElementById('pending-count').textContent = pending;
  document.getElementById('total-count').textContent = total;
}

// ==============================
// 🎨 HÀM TIỆN ÍCH
// ==============================
function getStatusClass(status) {
  if (status === 'Đang xử lý') return 'status-pending';
  if (status === 'Hoàn tất') return 'status-completed';
  return '';
}

function getStatusIcon(status) {
  if (status === 'Đang xử lý') return 'fa-clock';
  if (status === 'Hoàn tất') return 'fa-check-circle';
  return 'fa-question';
}

function formatTime(dateStr) {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatMoney(amount) {
  if (!amount) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function showNotification(message, type) {
  // Xóa thông báo cũ nếu có
  const oldNotif = document.querySelector('.notification');
  if (oldNotif) oldNotif.remove();

  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `<i class="fas fa-bell"></i> ${message}`;
  document.body.appendChild(div);
  
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

// ==============================
// ⏰ CẬP NHẬT ĐỒNG HỒ
// ==============================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('current-time').textContent = `${h}:${m}:${s}`;
}

setInterval(updateClock, 1000);
updateClock();

// ==============================
// 🚀 KHỞI ĐỘNG
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
  setInterval(loadOrders, 30000); // Tự động refresh mỗi 30 giây
});