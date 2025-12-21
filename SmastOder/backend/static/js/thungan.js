/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Thu Ngân JavaScript
 *  Chức năng: Quản lý đơn hàng, xác nhận, thanh toán
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  orders: [],
  confirmedOrders: [],
  notifications: [],
  selectedOrder: null,
  promotions: [],
  currentPayment: null
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Thu Ngân System Started');
  
  await initializePage();
  setupEventListeners();
  setupSocketListeners();
  startClock();
  
  // Auto refresh every 30 seconds
  setInterval(() => {
    loadOrders();
    loadNotifications();
  }, 30000);
  
  console.log('✅ Initialization complete');
});

async function initializePage() {
  try {
    await loadOrders();
    await loadNotifications();
    await loadPromotions();
    
    showNotification('✅ Hệ thống sẵn sàng!', 'success');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showNotification('Lỗi khi khởi động hệ thống!', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/thungan/donhang`);
    const result = await response.json();
    
    if (result.success) {
      state.orders = result.data.don_hang || [];
      renderOrders();
      updateOrderCounts();
      console.log('✅ Orders loaded:', state.orders.length);
    }
  } catch (error) {
    console.error('❌ Load orders error:', error);
  }
}

async function loadOrderDetail(orderId) {
  try {
    const response = await fetch(`${API_BASE}/ban/donhang/${orderId}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error('❌ Load order detail error:', error);
    return null;
  }
}

async function confirmOrder(orderId) {
  try {
    const response = await fetch(`${API_BASE}/thungan/donhang/${orderId}/xacnhan`, {
      method: 'PUT'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('✅ Đã xác nhận đơn hàng và gửi cho bếp!', 'success');
      await loadOrders();
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Confirm order error:', error);
    showNotification('Lỗi khi xác nhận đơn hàng!', 'error');
    return false;
  }
}

async function processPayment(paymentData) {
  try {
    const response = await fetch(`${API_BASE}/thungan/thanhtoan/${paymentData.idDonHang}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        id_phuong_thuc: paymentData.phuongThuc,
        so_tien_nhan: paymentData.tienNhan,
        so_dien_thoai: paymentData.soDienThoai,
        id_khuyen_mai: paymentData.khuyenMai
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`✅ Thanh toán thành công! Tích lũy: ${result.data.diem_tich_luy} điểm`, 'success');
      
      // In hóa đơn (optional)
      if (confirm('In hóa đơn?')) {
        printInvoice(result.data);
      }
      
      await loadOrders();
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Payment error:', error);
    showNotification('Lỗi khi thanh toán!', 'error');
    return null;
  }
}

async function loadNotifications() {
  try {
    const response = await fetch(`${API_BASE}/thongbao`);
    const result = await response.json();
    
    if (result.success) {
      state.notifications = result.data.thong_bao || [];
      renderNotifications();
      console.log('✅ Notifications loaded:', state.notifications.length);
    }
  } catch (error) {
    console.error('❌ Load notifications error:', error);
  }
}

async function markNotificationRead(notifId) {
  try {
    const response = await fetch(`${API_BASE}/thongbao/${notifId}/xuly`, {
      method: 'PUT'
    });
    
    const result = await response.json();
    
    if (result.success) {
      await loadNotifications();
    }
  } catch (error) {console.error('❌ Mark notification error:', error);
}
}
async function loadPromotions() {
try {
const response = await fetch(${API_BASE}/admin/khuyenmai);
const result = await response.json();
if (result.success) {
  state.promotions = result.data.khuyen_mai.filter(km => km.TrangThai === 1) || [];
  console.log('✅ Promotions loaded:', state.promotions.length);
}
} catch (error) {
console.error('❌ Load promotions error:', error);
}
}
/ ═══════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function renderOrders() {
const pendingList = document.getElementById('pending-order-list');
const confirmedList = document.getElementById('confirmed-order-list');
// Filter orders (giả sử chưa xác nhận là chưa có lịch sử xác nhận)
const pendingOrders = state.orders;
if (pendingOrders.length === 0) {
pendingList.innerHTML = '<div class="empty-state"><p class="text-muted text-center py-5">Không có đơn hàng nào</p></div>';
} else {
pendingList.innerHTML = pendingOrders.map(order =>       <div class="order-item ${state.selectedOrder?.IDDonHang === order.IDDonHang ? 'selected' : ''}"             data-order-id="${order.IDDonHang}">         <div class="order-header">           <span class="table-badge">${order.TenBan}</span>           <span class="order-time">${formatTime(order.NgayTao)}</span>         </div>         <div class="order-info">           <div>             <strong>${order.SoMon} món</strong>           </div>           <div class="order-total">${formatPrice(order.TongTien)}</div>         </div>         <div class="order-actions">           <button class="btn btn-primary btn-sm view-detail" data-order-id="${order.IDDonHang}">             👁️ Xem chi tiết           </button>           <button class="btn btn-success btn-sm confirm-order" data-order-id="${order.IDDonHang}">             ✅ Xác nhận           </button>         </div>       </div>    ).join('');
// Event listeners
document.querySelectorAll('.view-detail').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const orderId = parseInt(btn.dataset.orderId);
    await selectOrder(orderId);
  });
});

document.querySelectorAll('.confirm-order').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const orderId = parseInt(btn.dataset.orderId);
    await handleConfirmOrder(orderId);
  });
});

document.querySelectorAll('.order-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    if (!e.target.closest('button')) {
      const orderId = parseInt(item.dataset.orderId);
      await selectOrder(orderId);
    }
  });
});
}
}
async function selectOrder(orderId) {
const orderDetail = await loadOrderDetail(orderId);
if (!orderDetail) return;
state.selectedOrder = orderDetail;
// Update UI
document.querySelectorAll('.order-item').forEach(item => {
item.classList.remove('selected');
if (parseInt(item.dataset.orderId) === orderId) {
item.classList.add('selected');
}
});
renderOrderDetail();
}
function renderOrderDetail() {
const section = document.getElementById('order-detail-section');
if (!state.selectedOrder) {
section.innerHTML = '<div class="empty-state text-center py-5"><p class="text-muted">Chọn đơn hàng để xem chi tiết</p></div>';
return;
}
const order = state.selectedOrder;
section.innerHTML = `
<div class="detail-header">
<h4 class="mb-2">${order.TenBan}</h4>
<small>Đơn hàng #${order.IDDonHang} - ${formatDateTime(order.NgayTao)}</small>
</div>
<div class="detail-items">
  ${order.chi_tiet.map(item => `
    <div class="detail-item">
      <div class="flex-grow-1">
        <div class="item-name">${item.TenMon}</div>
        <div class="item-meta">
          ${item.CapDoCay ? `🌶️ ${item.CapDoCay}` : ''}
          ${item.GhiChu ? `<br>📝 ${item.GhiChu}` : ''}
        </div>
      </div>
      <div class="text-end">
        <div>x${item.SoLuong}</div>
        <div class="item-price">${formatPrice(item.ThanhTien)}</div>
      </div>
    </div>
  `).join('')}
</div>

<div class="detail-summary">
  <div class="summary-row">
    <span>Tổng cộng:</span>
    <strong>${formatPrice(order.TongTien)}</strong>
  </div>
  ${order.GhiChu ? `
    <div class="summary-row">
      <span>Ghi chú:</span>
      <span class="text-muted">${order.GhiChu}</span>
    </div>
  ` : ''}
</div>

<div class="action-buttons">
  ${!order.TrangThaiThanhToan ? `
    <button class="btn btn-success btn-lg" id="btn-payment">
      💳 Thanh toán
    </button>
    <button class="btn btn-primary" id="btn-confirm-this">
      ✅ Xác nhận gửi bếp
    </button>
  ` : `
    <div class="alert alert-success">
      ✅ Đơn hàng đã thanh toán
    </div>
  `}
</div>
`;
// Event listeners
const btnPayment = document.getElementById('btn-payment');
if (btnPayment) {
btnPayment.addEventListener('click', () => openPaymentModal(order));
}
const btnConfirm = document.getElementById('btn-confirm-this');
if (btnConfirm) {
btnConfirm.addEventListener('click', () => handleConfirmOrder(order.IDDonHang));
}
}
function renderNotifications() {
const list = document.getElementById('notification-list');
if (state.notifications.length === 0) {
list.innerHTML = '<div class="empty-state"><p class="text-muted text-center py-3">Không có thông báo</p></div>';
return;
}
list.innerHTML = state.notifications.map(notif =>     <div class="notification-item ${notif.TrangThai === 0 ? 'unread' : ''}">       <div class="notification-header">         <span class="notification-table">${notif.TenBan}</span>         <span class="notification-time">${formatTime(notif.ThoiGian)}</span>       </div>       <div class="notification-message">${notif.NoiDung}</div>       ${notif.TrangThai === 0 ?
<div class="notification-actions">
<button class="btn btn-sm btn-success mark-read" data-notif-id="${notif.IDThongBao}">
✅ Đã xử lý
</button>
</div>
: ''}     </div>  ).join('');
// Event listeners
document.querySelectorAll('.mark-read').forEach(btn => {
btn.addEventListener('click', () => {
const notifId = parseInt(btn.dataset.notifId);
markNotificationRead(notifId);
});
});
}
function updateOrderCounts() {
document.getElementById('pending-count').textContent = state.orders.length;
document.getElementById('confirmed-count').textContent = state.confirmedOrders.length;
}
// ═══════════════════════════════════════════════════════════════════════════
// MODAL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
function openPaymentModal(order) {
state.currentPayment = {
order: order,
total: order.TongTien,
discount: 0,
final: order.TongTien
};
// Fill data
document.getElementById('payment-table').textContent = order.TenBan;
document.getElementById('payment-total').textContent = formatPrice(order.TongTien);
document.getElementById('payment-discount').textContent = '0 ₫';
document.getElementById('payment-final').textContent = formatPrice(order.TongTien);
// Reset form
document.getElementById('payment-method').value = '1';
document.getElementById('cash-received').value = '';
document.getElementById('customer-phone').value = '';
document.getElementById('change-amount').textContent = '0 ₫';
// Load promotions
const promoSelect = document.getElementById('promotion-select');
promoSelect.innerHTML = '<option value="">Không áp dụng</option>' +
state.promotions.map(promo =>       <option value="${promo.IDKhuyenMai}">         ${promo.TenKhuyenMai} - ${promo.LoaiGiamGia === 'PhanTram' ? promo.GiaTri + '%' : formatPrice(promo.GiaTri)}       </option>    ).join('');
document.getElementById('payment-modal').classList.remove('hidden');
}
function closePaymentModal() {
document.getElementById('payment-modal').classList.add('hidden');
state.currentPayment = null;
}
function calculatePayment() {
if (!state.currentPayment) return;
const promoId = document.getElementById('promotion-select').value;
let discount = 0;
if (promoId) {
const promo = state.promotions.find(p => p.IDKhuyenMai == promoId);
if (promo) {
if (promo.LoaiGiamGia === 'PhanTram') {
discount = state.currentPayment.total * (promo.GiaTri / 100);
} else {
discount = promo.GiaTri;
}
}
}
state.currentPayment.discount = discount;
state.currentPayment.final = state.currentPayment.total - discount;
document.getElementById('payment-discount').textContent = formatPrice(discount);
document.getElementById('payment-final').textContent = formatPrice(state.currentPayment.final);
// Calculate change
const cashReceived = parseFloat(document.getElementById('cash-received').value) || 0;
const change = Math.max(0, cashReceived - state.currentPayment.final);
document.getElementById('change-amount').textContent = formatPrice(change);
}
async function confirmPayment() {
if (!state.currentPayment) return;
const paymentMethod = parseInt(document.getElementById('payment-method').value);
const cashReceived = parseFloat(document.getElementById('cash-received').value) || 0;
const phone = document.getElementById('customer-phone').value.trim();
const promoId = document.getElementById('promotion-select').value;
// Validate
if (paymentMethod === 1 && cashReceived < state.currentPayment.final) {
showNotification('Tiền nhận không đủ!', 'warning');
return;
}
const btn = document.getElementById('confirm-payment');
btn.disabled = true;
btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xử lý...';
try {
const result = await processPayment({
idDonHang: state.currentPayment.order.IDDonHang,
phuongThuc: paymentMethod,
tienNhan: cashReceived,
soDienThoai: phone || null,
khuyenMai: promoId || null
});
if (result) {
  closePaymentModal();
  state.selectedOrder = null;
  renderOrderDetail();
}
} finally {
btn.disabled = false;
btn.innerHTML = '✅ Xác nhận thanh toán';
}
}
async function handleConfirmOrder(orderId) {
const confirmed = await showConfirmDialog('Xác nhận gửi đơn hàng cho bếp?');
if (!confirmed) return;
await confirmOrder(orderId);
}
// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════
function setupEventListeners() {
// Refresh button
document.getElementById('btn-refresh-orders').addEventListener('click', () => {
loadOrders();
loadNotifications();
});
// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
if (confirm('Đăng xuất khỏi hệ thống?')) {
window.location.href = '/login';
}
});
// Payment modal
document.getElementById('payment-method').addEventListener('change', (e) => {
const cashGroup = document.getElementById('cash-received-group');
cashGroup.style.display = e.target.value === '1' ? 'block' : 'none';
});
document.getElementById('cash-received').addEventListener('input', calculatePayment);
document.getElementById('promotion-select').addEventListener('change', calculatePayment);
document.getElementById('confirm-payment').addEventListener('click', confirmPayment);
document.getElementById('cancel-payment').addEventListener('click', closePaymentModal);
document.querySelector('#payment-modal .modal-backdrop').addEventListener('click', closePaymentModal);
}
// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO LISTENERS
// ═══════════════════════════════════════════════════════════════════════════
function setupSocketListeners() {
socket.on('connect', () => {
console.log('✅ Socket connected');
});
socket.on('new_order', (data) => {
console.log('📦 New order received:', data);
showNotification(📦 Đơn hàng mới từ ${data.ten_ban || 'Bàn ' + data.id_ban}!, 'info');
playNotificationSound();
loadOrders();
});
socket.on('call_staff', (data) => {
console.log('📢 Staff called:', data);
showNotification(📢 ${data.ten_ban} cần hỗ trợ!, 'warning');
playNotificationSound();
loadNotifications();
});
socket.on('order_status_update', (data) => {
console.log('🔄 Order status updated:', data);
loadOrders();
});
}
// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
function formatPrice(price) {
return new Intl.NumberFormat('vi-VN', {
style: 'currency',
currency: 'VND'
}).format(price);
}
function formatTime(dateString) {
const date = new Date(dateString);
return date.toLocaleTimeString('vi-VN', {
hour: '2-digit',
minute: '2-digit'
});
}
function formatDateTime(dateString) {
const date = new Date(dateString);
return date.toLocaleString('vi-VN', {
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit'
});
}
function startClock() {
function updateClock() {
const now = new Date();
const timeString = now.toLocaleString('vi-VN', {
weekday: 'long',
year: 'numeric',
month: 'long',
day: 'numeric',
hour: '2-digit',
minute: '2-digit',
second: '2-digit'
});
document.getElementById('current-time').textContent = timeString;
}
updateClock();
setInterval(updateClock, 1000);
}
function showNotification(message, type = 'info') {
const notification = document.createElement('div');
notification.className = alert alert-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info'} notification-toast;
notification.textContent = message;
document.body.appendChild(notification);
setTimeout(() => {
notification.style.animation = 'slideOutRight 0.3s ease-in';
setTimeout(() => notification.remove(), 300);
}, 4000);
}
function playNotificationSound() {
try {
const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA==');
audio.volume = 0.3;
audio.play();
} catch (e) {
console.log('Cannot play sound');
}
}
function showConfirmDialog(message) {
return new Promise((resolve) => {
const modal = document.getElementById('confirm-modal');
document.getElementById('confirm-message').textContent = message;
modal.classList.remove('hidden');
const handleYes = () => {
  modal.classList.add('hidden');
  cleanup();
  resolve(true);
};

const handleNo = () => {
  modal.classList.add('hidden');
  cleanup();
  resolve(false);
};

const cleanup = () => {
  document.getElementById('confirm-yes').removeEventListener('click', handleYes);
  document.getElementById('confirm-no').removeEventListener('click', handleNo);
};

document.getElementById('confirm-yes').addEventListener('click', handleYes);
document.getElementById('confirm-no').addEventListener('click', handleNo);
});
}
function printInvoice(paymentData) {
const printWindow = window.open('', '', 'width=300,height=600');
printWindow.document.write(    <html>       <head>         <title>Hóa đơn</title>         <style>           body { font-family: monospace; padding: 20px; }           h2 { text-align: center; }           .line { border-bottom: 1px dashed #000; margin: 10px 0; }           .row { display: flex; justify-content: space-between; margin: 5px 0; }         </style>       </head>       <body>         <h2>MÌ CAY ONE</h2>         <p style="text-align: center;">88 Hoàng Hoa Thám, Phúc Yên</p>         <div class="line"></div>         <p>Mã đơn: #${paymentData.id_don_hang}</p>         <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>         <div class="line"></div>         <div class="row">           <span>Tổng tiền:</span>           <span>${formatPrice(paymentData.tong_tien)}</span>         </div>         <div class="row">           <span>Giảm giá:</span>           <span>-${formatPrice(paymentData.so_tien_giam)}</span>         </div>         <div class="line"></div>         <div class="row" style="font-weight: bold; font-size: 1.2em;">           <span>Thanh toán:</span>           <span>${formatPrice(paymentData.so_tien_thanh_toan)}</span>         </div>         ${paymentData.tien_thua > 0 ?
<div class="row">
<span>Tiền thừa:</span>
<span>${formatPrice(paymentData.tien_thua)}</span>
</div>
: ''}         ${paymentData.diem_tich_luy > 0 ?
<div class="row">
<span>Điểm tích lũy:</span>
<span>+${paymentData.diem_tich_luy} điểm</span>
</div>
: ''}         <div class="line"></div>         <p style="text-align: center;">Cảm ơn quý khách!</p>       </body>     </html>  );
printWindow.document.close();
printWindow.print();
}
console.log('💰 Thu Ngân System Loaded');