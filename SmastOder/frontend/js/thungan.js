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
// HÀM TIỆN ÍCH
// ==============================
function formatMoney(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " ₫";
}

function formatTime(dateStr) {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vnTime.getUTCFullYear();
  const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getUTCDate()).padStart(2, '0');
  const hh = String(vnTime.getUTCHours()).padStart(2, '0');
  const min = String(vnTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
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
// THỐNG KÊ
// ==============================
function updateStats() {
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders
    .filter(o => o.TrangThaiThanhToan)
    .reduce((sum, o) => sum + parseFloat(o.TongTien || 0), 0);

  document.getElementById("stat-orders").textContent = totalOrders;
  document.getElementById("stat-revenue").textContent = formatMoney(totalRevenue);
}

// ==============================
// LOAD & RENDER ĐƠN HÀNG
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

function filterOrders(filter) {
  currentFilter = filter;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.closest('.tab-btn')?.classList.add('active');
  renderOrders();
}

function getFilteredOrders() {
  if (currentFilter === 'all') return allOrders;
  if (currentFilter === 'pending') return allOrders.filter(o => !o.TrangThaiThanhToan);
  if (currentFilter === 'paid') return allOrders.filter(o => o.TrangThaiThanhToan);
  return allOrders;
}

function renderOrders() {
  const orderList = document.getElementById("order-list");
  const orders = getFilteredOrders();

  if (!orders || orders.length === 0) {
    orderList.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Không có đơn hàng nào</p></div>`;
    return;
  }

  orders.sort((a,b)=>{
    if(a.TrangThaiThanhToan!==b.TrangThaiThanhToan) return a.TrangThaiThanhToan?1:-1;
    return new Date(b.NgayTao)-new Date(a.NgayTao);
  });

  orderList.innerHTML = orders.map(order => {
    const isSelected = selectedOrder && selectedOrder.IDDonHang===order.IDDonHang;
    const statusClass = order.TrangThaiThanhToan?'status-paid':'status-pending';
    const statusText = order.TrangThaiThanhToan?'✅ Đã thanh toán':'⏳ Chờ thanh toán';
    return `
      <div class="order-item ${isSelected?'selected':''}" onclick="selectOrder(${order.IDDonHang})">
        <div class="order-item-header">
          <div class="order-table"><i class="fas fa-utensils"></i> Bàn ${order.IDBan}</div>
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
  document.getElementById("order-count").textContent = orders.length;
}

// ==============================
// CHỌN ĐƠN & RENDER PANEL
// ==============================
async function selectOrder(orderId) {
  try {
    const res = await fetch(`${API_BASE}/api/donhang/${orderId}`);
    if (!res.ok) throw new Error("Không tải được chi tiết đơn");
    selectedOrder = await res.json();
    renderPaymentPanel();
    renderOrders();
  } catch (err) {
    console.error(err);
    showNotification("Không thể tải chi tiết đơn hàng", "error");
  }
}

function renderPaymentPanel() {
  if (!selectedOrder) {
    document.getElementById("selected-order-info").innerHTML = `<p class="no-selection"><i class="fas fa-hand-pointer"></i> Chọn một đơn hàng để thanh toán</p>`;
    document.getElementById("order-items").innerHTML = '';
    resetCalculation();
    return;
  }

  const statusClass = selectedOrder.TrangThaiThanhToan?'status-paid':'status-pending';
  const statusText = selectedOrder.TrangThaiThanhToan?'✅ Đã thanh toán':'⏳ Chờ thanh toán';

  document.getElementById("selected-order-info").innerHTML = `
    <div class="info-row"><span><i class="fas fa-utensils"></i> Bàn:</span> <strong>Bàn ${selectedOrder.IDBan}</strong></div>
    <div class="info-row"><span><i class="fas fa-hashtag"></i> Đơn hàng:</span> <strong>#${selectedOrder.IDDonHang}</strong></div>
    <div class="info-row"><span><i class="fas fa-clock"></i> Thời gian:</span> <strong>${formatDateTime(selectedOrder.NgayTao)}</strong></div>
    <div class="info-row"><span><i class="fas fa-info-circle"></i> Trạng thái:</span> <span class="order-status ${statusClass}">${statusText}</span></div>
  `;

  const items = selectedOrder.Items || [];
  document.getElementById("order-items").innerHTML = items.length>0 ? items.map(item => `
    <div class="item-row">
      <div><div class="item-name">${item.TenMon}</div><div class="item-qty">x${item.SoLuong}</div></div>
      <div class="item-price">${formatMoney(item.Gia*item.SoLuong)}</div>
    </div>
  `).join('') : '<p class="no-items">Không có món nào</p>';

  // QR chuyển khoản
  let qrSection = document.getElementById('transfer-qr-section');
  if(!qrSection){
    qrSection = document.createElement('div');
    qrSection.id='transfer-qr-section';
    qrSection.style.display='none';
    qrSection.style.textAlign='center';
    qrSection.style.marginTop='1rem';
    qrSection.innerHTML = `<img id="transfer-qr" style="max-width:200px"/><p>Số tiền: <span id="transfer-amount"></span></p><p id="transfer-bank-info"></p>`;
    document.getElementById('payment-panel')?.appendChild(qrSection);
  }

  updateCalculation();
  selectPaymentMethod(paymentMethod);
}

// ==============================
// TÍNH TIỀN
// ==============================
function updateCalculation() {
  if(!selectedOrder) return;
  const totalAmount = selectedOrder.TongTien||0;
  const discount = parseFloat(document.getElementById("discount-input")?.value||0);
  const finalAmount = Math.max(0,totalAmount-discount);
  document.getElementById("total-amount").textContent = formatMoney(totalAmount);
  document.getElementById("final-amount").textContent = formatMoney(finalAmount);
  if(paymentMethod==='cash') updateChange(finalAmount);
}

function resetCalculation(){
  document.getElementById("total-amount").textContent='0 ₫';
  document.getElementById("final-amount").textContent='0 ₫';
  if(document.getElementById("discount-input")) document.getElementById("discount-input").value=0;
  if(document.getElementById("customer-cash")) document.getElementById("customer-cash").value='';
  if(document.getElementById("change-amount")) document.getElementById("change-amount").textContent='0 ₫';
}

function updateChange(finalAmount){
  const customerCash=parseFloat(document.getElementById("customer-cash")?.value||0);
  const change=Math.max(0,customerCash-finalAmount);
  const changeEl=document.getElementById("change-amount");
  if(changeEl){
    changeEl.textContent=formatMoney(change);
    changeEl.style.color=(customerCash>0 && customerCash<finalAmount)?'#ef4444':'white';
  }
}

// ==============================
// PHƯƠNG THỨC THANH TOÁN
// ==============================
function selectPaymentMethod(method) {
  paymentMethod = method;
  document.querySelectorAll('.method-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-method="${method}"]`)?.classList.add('active');

  const cashSection = document.getElementById('cash-payment-section');
  if (cashSection) cashSection.style.display = method === 'cash' ? 'block' : 'none';

  const transferSection = document.getElementById('transfer-qr-section');
  if (transferSection) transferSection.style.display = method === 'transfer' ? 'block' : 'none';

  if (method === 'transfer' && selectedOrder) {
    const amount = Math.round(selectedOrder.TongTien || 0); // Số nguyên
    const bankNumber = '6982121680';
    const bankName = 'Techcombank';
    const accountName = 'LE VAN HOANG'; // Tên chủ tài khoản
    const description = `Thanh toán đơn #${selectedOrder.IDDonHang}`; // Nội dung

    document.getElementById('transfer-amount').textContent = formatMoney(amount);
    document.getElementById('transfer-bank-info').textContent = `${bankNumber} - ${bankName}`;

    // Link VietQR
    const qrLink = `https://img.vietqr.io/image/TCB-${bankNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

    document.getElementById('transfer-qr').src = qrLink;
  }
}
// ==============================
// THANH TOÁN
// ==============================
async function processPayment(){
  if(!selectedOrder){showNotification("Chọn đơn hàng để thanh toán","warning");return;}
  if(selectedOrder.TrangThaiThanhToan){showNotification("Đơn này đã thanh toán","warning");return;}

  if(paymentMethod==='cash'){
    const finalAmount=parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g,''))||0;
    const customerCash=parseFloat(document.getElementById("customer-cash")?.value||0);
    if(customerCash<finalAmount){showNotification("Tiền khách đưa không đủ!","error");return;}
  }

  if(!confirm(`Xác nhận thanh toán đơn #${selectedOrder.IDDonHang}?\nPhương thức: ${paymentMethod==='cash'?'Tiền mặt':'Chuyển khoản'}`)) return;

  try{
    const res=await fetch(`${API_BASE}/api/donhang/thanh-toan/${selectedOrder.IDDonHang}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({PhuongThuc:paymentMethod==='cash'?'Tiền mặt':'Chuyển khoản'})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.message||"Lỗi server");
    showNotification(`💳 Thanh toán thành công — ${formatMoney(data.TongTien)}`,"success");
    selectedOrder=null;
    renderPaymentPanel();
    loadOrders();
  }catch(err){console.error(err);showNotification("Lỗi thanh toán: "+err.message,"error");}
}

function cancelPayment(){selectedOrder=null; renderPaymentPanel(); renderOrders();}

// ==============================
// XEM CHI TIẾT
// ==============================
async function viewOrderDetail(orderId){
  try{
    const res = await fetch(`${API_BASE}/api/donhang/${orderId}`);
    if(!res.ok) throw new Error("Không tải được chi tiết đơn");
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
            <tr><th>STT</th><th>Tên món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index+1}</td>
                <td>${item.TenMon}</td>
                <td>${item.SoLuong}</td>
                <td>${formatMoney(parseFloat(item.DonGia))}</td>
                <td><strong>${formatMoney(parseFloat(item.DonGia) * item.SoLuong)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-total">
        <h3>Tổng cộng: <span>${formatMoney(parseFloat(order.TongTien))}</span></h3>
      </div>
    `;
    
    document.getElementById("order-detail-modal").classList.add("show");
  } catch(err){
    console.error(err);
    showNotification("Không thể xem chi tiết đơn hàng","error");
  }
}

function closeModal(){
  document.getElementById("order-detail-modal").classList.remove("show");
}

// Đồng bộ tên hàm với button Xem
window.viewOrder = viewOrderDetail;


// ==============================
// NHẬP NHANH TIỀN MẶT
// ==============================
function setQuickCash(amount){const input=document.getElementById("customer-cash");if(input){input.value=amount;const finalAmount=parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g,''))||0;updateChange(finalAmount);}}


// Khi có bàn gọi nhân viên → hiển thị popup
socket.on("staff_call", (data) => {
  const { table, message } = data;

  // ✅ Thông báo nổi
  alert(`📢 BÀN ${table} GỌI NHÂN VIÊN\n📝 Nội dung: ${message}`);

  // ✅ Nếu muốn hiển thị trong danh sách thông báo thu ngân:
  const list = document.getElementById("staff-call-list");
  if (list) {
    const item = document.createElement("li");
    item.className = "staff-call-item";
    item.innerHTML = `
      <strong>Bàn ${table}</strong> - ${message}
      <span style="float:right;">${new Date().toLocaleTimeString()}</span>
    `;
    list.prepend(item);
  }
});

// ==============================
// EVENT LISTENERS
// ==============================
document.addEventListener('DOMContentLoaded',()=>{
  loadOrders();
  document.getElementById('discount-input')?.addEventListener('input',updateCalculation);
  document.getElementById('customer-cash')?.addEventListener('input',()=>{const finalAmount=parseFloat(document.getElementById("final-amount").textContent.replace(/[^\d]/g,''))||0;updateChange(finalAmount);});
  document.getElementById('order-detail-modal')?.addEventListener('click',(e)=>{if(e.target.id==='order-detail-modal')closeModal();});
  setInterval(loadOrders,30000);
});

console.log("💵 Thu ngân system initialized");
