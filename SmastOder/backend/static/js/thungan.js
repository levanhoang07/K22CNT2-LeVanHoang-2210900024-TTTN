/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Thu Ngân System (Full Version)
 *  Tính năng: Quản lý đơn hàng, xác nhận, gửi bếp, thanh toán
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & STATE
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  orders: [],
  selectedOrder: null,
  notifications: [],
  promotions: [],
  stats: {
    pending: 0,
    confirmed: 0,
    completed: 0,
    revenue: 0
  },
  currentPayment: null
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Thu Ngân System Started');
  
  await initialize();
  setupEventListeners();
  setupSocketListeners();
  startClock();
  
  setInterval(() => {
    loadOrders();
    loadNotifications();
  }, 30000);
  
  console.log('✅ System Ready');
});

async function initialize() {
  try {
    showLoading(true);
    await Promise.all([
      loadOrders(),
      loadNotifications(),
      loadPromotions(),
      loadTodayStats()
    ]);
    showToast('✅ Hệ thống sẵn sàng!', 'success');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showToast('Lỗi khởi động hệ thống!', 'error');
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALLS - ORDERS
// ═══════════════════════════════════════════════════════════════════════════

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/thungan/donhang`);
    const result = await response.json();
    if (result.success) {
      state.orders = result.data.don_hang || [];
      renderOrders();
      updateStats();
      console.log('✅ Orders loaded:', state.orders.length);
    }
  } catch (error) {
    console.error('❌ Load orders error:', error);
    showToast('Lỗi khi tải danh sách đơn hàng', 'error');
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
      showToast('✅ Đã xác nhận và gửi đơn cho bếp!', 'success');
      playSound('success');
      await loadOrders();
      if (state.selectedOrder?.IDDonHang === orderId) {
        await selectOrder(orderId);
      }
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Confirm order error:', error);
    showToast('Lỗi khi xác nhận đơn hàng!', 'error');
    return false;
  }
}

async function processPayment(paymentData) {
  try {
    const response = await fetch(`${API_BASE}/thungan/thanhtoan/${paymentData.idDonHang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_phuong_thuc: paymentData.phuongThuc,
        so_tien_nhan: paymentData.tienNhan,
        so_dien_thoai: paymentData.soDienThoai,
        id_khuyen_mai: paymentData.khuyenMai
      })
    });
    const result = await response.json();
    if (result.success) {
      const points = result.data.diem_tich_luy || 0;
      const change = result.data.tien_thua || 0;
      showToast(`✅ Thanh toán thành công!\n💎 Tích lũy: ${points} điểm\n💵 Tiền thừa: ${formatPrice(change)}`, 'success');
      playSound('payment');
      if (confirm('📄 In hóa đơn cho khách hàng?')) {
        printInvoice(result.data, paymentData);
      }
      await loadOrders();
      await loadTodayStats();
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Payment error:', error);
    showToast('Lỗi khi thanh toán: ' + error.message, 'error');
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
      showToast('✅ Đã xử lý thông báo', 'success');
      await loadNotifications();
    }
  } catch (error) {
    console.error('❌ Mark notification error:', error);
  }
}

async function loadPromotions() {
  try {
    const response = await fetch(`${API_BASE}/admin/khuyenmai`);
    const result = await response.json();
    if (result.success) {
      state.promotions = (result.data.khuyen_mai || []).filter(km => km.TrangThai === 1);
      console.log('✅ Promotions loaded:', state.promotions.length);
    }
  } catch (error) {
    console.error('❌ Load promotions error:', error);
  }
}

async function loadTodayStats() {
  try {
    const response = await fetch(`${API_BASE}/admin/dashboard`);
    const result = await response.json();
    if (result.success) {
      state.stats = {
        pending: result.data.don_cho_xu_ly || 0,
        confirmed: 0,
        completed: result.data.so_don_hang_hom_nay || 0,
        revenue: result.data.doanh_thu_hom_nay || 0
      };
      renderStats();
    }
  } catch (error) {
    console.error('❌ Load stats error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER - ORDERS
// ═══════════════════════════════════════════════════════════════════════════

function renderOrders() {
  const container = document.getElementById('order-list');
  if (state.orders.length === 0) {
    container.innerHTML = `
      <div class="detail-empty">
        <i class="fas fa-inbox"></i>
        <p>Không có đơn hàng nào</p>
      </div>
    `;
    return;
  }
  container.innerHTML = state.orders.map(order => {
    const isUrgent = isOrderUrgent(order.NgayTao);
    const isSelected = state.selectedOrder?.IDDonHang === order.IDDonHang;
    return `
      <div class="order-card ${isSelected ? 'selected' : ''} ${isUrgent ? 'urgent' : ''}" 
           data-order-id="${order.IDDonHang}">
        <div class="order-header">
          <span class="table-badge">
            <i class="fas fa-utensils"></i> ${order.TenBan}
          </span>
          <span class="order-time">
            <i class="far fa-clock"></i> ${getTimeAgo(order.NgayTao)}
          </span>
        </div>
        <div class="order-body">
          <div class="order-info mb-2">
            <span style="font-weight: 600; color: #2d3436;">
              <i class="fas fa-shopping-bag"></i> ${order.SoMon} món
            </span>
          </div>
          <div class="order-total-section">
            <span class="total-label">Tổng cộng:</span>
            <span class="total-amount">${formatPrice(order.TongTien)}</span>
          </div>
        </div>
        <div class="order-actions">
          <button class="btn-action btn-view" onclick="selectOrder(${order.IDDonHang})">
            <i class="fas fa-eye"></i> Xem
          </button>
          <button class="btn-action btn-send-kitchen" onclick="handleSendToKitchen(${order.IDDonHang})">
            <i class="fas fa-fire"></i> Gửi bếp
          </button>
          <button class="btn-action btn-payment" onclick="handlePayment(${order.IDDonHang})">
            <i class="fas fa-credit-card"></i> Thanh toán
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function selectOrder(orderId) {
  try {
    showLoading(true);
    const orderDetail = await loadOrderDetail(orderId);
    if (!orderDetail) {
      showToast('Không thể tải chi tiết đơn hàng', 'error');
      return;
    }
    state.selectedOrder = orderDetail;
    document.querySelectorAll('.order-card').forEach(card => {
      card.classList.remove('selected');
      if (parseInt(card.dataset.orderId) === orderId) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    renderOrderDetail();
  } catch (error) {
    console.error('❌ Select order error:', error);
    showToast('Lỗi khi xem chi tiết đơn hàng', 'error');
  } finally {
    showLoading(false);
  }
}

function renderOrderDetail() {
  const section = document.getElementById('detail-section');
  if (!state.selectedOrder) {
    section.innerHTML = `
      <div class="detail-empty">
        <i class="fas fa-hand-pointer"></i>
        <p>Chọn đơn hàng để xem chi tiết</p>
      </div>
    `;
    return;
  }
  const order = state.selectedOrder;
  const isPaid = order.TrangThaiThanhToan === 1;
  section.innerHTML = `
    <div class="detail-content">
      <div class="detail-header-box">
        <div class="detail-table-name">
          <i class="fas fa-utensils"></i> ${order.TenBan}
        </div>
        <div class="detail-order-id">
          Đơn hàng #${order.IDDonHang} • ${formatDateTime(order.NgayTao)}
        </div>
      </div>
      <div class="detail-items-list">
        <h6 class="mb-3" style="font-weight: 700;">
          <i class="fas fa-list"></i> Chi tiết món (${order.chi_tiet.length})
        </h6>
        ${order.chi_tiet.map(item => `
          <div class="detail-item">
            <div class="flex-grow-1">
              <div class="item-name">
                <i class="fas fa-check-circle" style="color: #00b894;"></i>
                ${item.TenMon}
              </div>
              <div class="item-meta">
                ${item.CapDoCay ? `<span class="badge bg-danger">🌶️ ${item.CapDoCay}</span>` : ''}
                ${item.GhiChu ? `<span class="badge bg-info">📝 ${item.GhiChu}</span>` : ''}
              </div>
            </div>
            <div class="text-end">
              <div class="item-qty">x${item.SoLuong}</div>
              <div class="item-price">${formatPrice(item.ThanhTien)}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ${order.GhiChu ? `
        <div class="alert alert-info mb-3">
          <strong><i class="fas fa-info-circle"></i> Ghi chú:</strong><br>
          ${order.GhiChu}
        </div>
      ` : ''}
      <div class="detail-summary">
        <div class="summary-row">
          <span>Tổng cộng:</span>
          <strong>${formatPrice(order.TongTien)}</strong>
        </div>
        <div class="summary-row total">
          <span>THANH TOÁN:</span>
          <strong>${formatPrice(order.TongTien)}</strong>
        </div>
      </div>
      ${!isPaid ? `
        <div class="d-grid gap-2">
          <button class="btn-action btn-send-kitchen btn-lg" onclick="handleSendToKitchen(${order.IDDonHang})">
            <i class="fas fa-fire"></i> Gửi đơn cho bếp
          </button>
          <button class="btn-action btn-payment btn-lg" onclick="handlePayment(${order.IDDonHang})">
            <i class="fas fa-credit-card"></i> Thanh toán ngay
          </button>
        </div>
      ` : `
        <div class="alert alert-success text-center">
          <h5><i class="fas fa-check-circle"></i> Đơn hàng đã thanh toán</h5>
          <p class="mb-0">Hoàn tất lúc ${formatDateTime(order.NgayTao)}</p>
        </div>
      `}
    </div>
  `;
}

function renderNotifications() {
  const container = document.getElementById('notification-list');
  const countBadge = document.getElementById('notif-count');
  countBadge.textContent = state.notifications.length;
  if (state.notifications.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Không có thông báo</p>';
    return;
  }
  container.innerHTML = state.notifications.map(notif => `
    <div class="notif-item">
      <div class="notif-header">
        <span class="notif-table">
          <i class="fas fa-table"></i> ${notif.TenBan}
        </span>
        <span class="notif-time">
          <i class="far fa-clock"></i> ${getTimeAgo(notif.ThoiGian)}
        </span>
      </div>
      <div class="notif-message">
        <i class="fas fa-comment-dots"></i> ${notif.NoiDung}
      </div>
      ${notif.TrangThai === 0 ? `
        <button class="btn btn-sm btn-success mt-2" onclick="markNotificationRead(${notif.IDThongBao})">
          <i class="fas fa-check"></i> Đã xử lý
        </button>
      ` : ''}
    </div>
  `).join('');
}

function renderStats() {
  document.getElementById('stat-pending').textContent = state.stats.pending;
  document.getElementById('stat-confirmed').textContent = state.stats.confirmed;
  document.getElementById('stat-completed').textContent = state.stats.completed;
  document.getElementById('stat-revenue').textContent = formatPrice(state.stats.revenue);
}

function updateStats() {
  state.stats.pending = state.orders.length;
  renderStats();
}
// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
state.promotions = [];
state.currentPayment = null;

// ═══════════════════════════════════════════════════════════════════════════
// LOAD KHUYẾN MÃI (BẮT BUỘC)
// ═══════════════════════════════════════════════════════════════════════════
async function loadPromotions() {
  try {
    const res = await fetch('/api/thungan/khuyenmai');
    const json = await res.json();

    if (!json.success) {
      state.promotions = [];
      console.error('❌ Không load được khuyến mãi');
      return;
    }

    state.promotions = json.data.khuyen_mai || [];
    console.log('✅ Promotions loaded:', state.promotions.length);
  } catch (err) {
    console.error('❌ Load promotions error:', err);
    state.promotions = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MỞ THANH TOÁN
// ═══════════════════════════════════════════════════════════════════════════
async function handlePayment(orderId) {
  await loadPromotions(); // ❗ BẮT BUỘC PHẢI CÓ

  const order = await loadOrderDetail(orderId);
  if (!order) return;

  state.currentPayment = {
    order: order,
    total: Number(order.TongTien),
    discount: 0,
    final: Number(order.TongTien),
    promoId: null
  };

  openPaymentModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// OPEN PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════
function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const order = state.currentPayment.order;

  document.getElementById('pay-table').textContent = order.TenBan;
  document.getElementById('pay-total').textContent = formatPrice(state.currentPayment.total);
  document.getElementById('pay-discount').textContent = '0đ';
  document.getElementById('pay-final').textContent = formatPrice(state.currentPayment.final);

  document.getElementById('payment-method').value = '1';
  document.getElementById('cash-received').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('change').textContent = '0đ';

  // ===== LOAD DROPDOWN KHUYẾN MÃI =====
  const promoSelect = document.getElementById('promotion');
  promoSelect.innerHTML = `
    <option value="">Không áp dụng</option>
    ${state.promotions.map(promo => {
      const text = promo.LoaiGiamGia === 'PhanTram'
        ? `${promo.TenKhuyenMai} (-${promo.GiaTri}%)`
        : `${promo.TenKhuyenMai} (-${formatPrice(promo.GiaTri)})`;
      return `<option value="${promo.IDKhuyenMai}">${text}</option>`;
    }).join('')}
  `;
  promoSelect.value = '';
  promoSelect.onchange = calculatePayment;

  document.getElementById('cash-group').style.display = 'block';
  modal.classList.add('show');
}
function setCash(amount) {
  const input = document.getElementById('cash-received');
  if (!input) return;

  input.value = amount;

  // cập nhật lại tính toán
  calculatePayment();

  // focus cho đẹp UX
  input.focus();
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOSE PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════
function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('show');
  state.currentPayment = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TÍNH TOÁN TIỀN + KHUYẾN MÃI
// ═══════════════════════════════════════════════════════════════════════════
function calculatePayment() {
  if (!state.currentPayment) return;

  const promoId = document.getElementById('promotion').value;
  let discount = 0;

  if (promoId) {
    const promo = state.promotions.find(p => p.IDKhuyenMai == promoId);
    if (promo) {
      if (promo.LoaiGiamGia === 'PhanTram') {
        discount = Math.round(state.currentPayment.total * promo.GiaTri / 100);
      } else {
        discount = Number(promo.GiaTri);
      }
    }
  }

  // ❗ Không cho giảm quá tổng tiền
  discount = Math.min(discount, state.currentPayment.total);

  const finalTotal = state.currentPayment.total - discount;

  state.currentPayment.discount = discount;
  state.currentPayment.final = finalTotal;
  state.currentPayment.promoId = promoId || null;

  document.getElementById('pay-discount').textContent = formatPrice(discount);
  document.getElementById('pay-final').textContent = formatPrice(finalTotal);

  // ===== TÍNH TIỀN THỪA =====
  const method = document.getElementById('payment-method').value;
  if (method === '1') {
    const cash = Number(document.getElementById('cash-received').value || 0);
    const change = Math.max(0, cash - finalTotal);
    document.getElementById('change').textContent = formatPrice(change);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// XÁC NHẬN THANH TOÁN
// ═══════════════════════════════════════════════════════════════════════════
async function confirmPayment() {
  if (!state.currentPayment) return;

  const method = Number(document.getElementById('payment-method').value);
  let cashReceived = Number(document.getElementById('cash-received').value || 0);
  const phone = document.getElementById('customer-phone').value.trim();
  const finalTotal = state.currentPayment.final;

  // ✅ NẾU LÀ TIỀN MẶT & KHÔNG NHẬP → MẶC ĐỊNH KHÁCH ĐƯA ĐỦ
  if (method === 1 && cashReceived === 0) {
    cashReceived = finalTotal;
  }

  // ❌ CHỈ CHẶN KHI NHẬP MÀ KHÔNG ĐỦ
  if (method === 1 && cashReceived < finalTotal) {
    showToast('⚠️ Tiền khách đưa không đủ!', 'warning');
    document.getElementById('cash-received').focus();
    return;
  }

  if (!confirm(`Xác nhận thanh toán ${formatPrice(finalTotal)}?`)) return;

  const btn = document.getElementById('btn-confirm-payment');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

  try {
    const paymentData = {
      idDonHang: state.currentPayment.order.IDDonHang,
      phuongThuc: method,
      tienNhan: cashReceived,
      soDienThoai: phone || null,
      khuyenMai: state.currentPayment.promoId
    };

    const result = await processPayment(paymentData);
    if (result) {
      closePaymentModal();
      state.selectedOrder = null;
      renderOrderDetail();
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận thanh toán';
  }
}



// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleSendToKitchen(orderId) {
  if (!confirm('🔥 Xác nhận gửi đơn hàng cho bếp?')) return;
  await confirmOrder(orderId);
}

function setupEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await loadOrders();
    await loadNotifications();
    showToast('🔄 Đã làm mới!', 'info');
  });
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('🚪 Đăng xuất khỏi hệ thống?')) {
      window.location.href = '/login';
    }
  });
  document.getElementById('payment-method').addEventListener('change', (e) => {
  const method = Number(e.target.value);

  const cashGroup = document.getElementById('cash-group');
  const qrGroup = document.getElementById('qr-group');

  if (method === 1) {
    // TIỀN MẶT
    cashGroup.style.display = 'block';
    qrGroup.style.display = 'none';
  } else if (method === 2) {
    // CHUYỂN KHOẢN
    cashGroup.style.display = 'none';
    qrGroup.style.display = 'block';

    generateVietQR(); // 🔥 tạo QR
  }
});

 
  document.getElementById('cash-received').addEventListener('input', calculatePayment);
  document.getElementById('promotion').addEventListener('change', calculatePayment);
  document.getElementById('btn-confirm-payment').addEventListener('click', confirmPayment);
  document.getElementById('btn-cancel-payment').addEventListener('click', closePaymentModal);
  document.getElementById('payment-modal').addEventListener('click', (e) => {
    if (e.target.id === 'payment-modal') {
      closePaymentModal();
    }
  });
}

function generateVietQR() {
  if (!state.currentPayment) return;

  const amount = state.currentPayment.final;

  // ⚠️ THÔNG TIN TÀI KHOẢN
  const bankId = 'Techcombank'; // Vietcombank
  const accountNo = '098212680';
  const accountName = 'MI CAY ONE';
  const description = `Thanh toan don ${state.currentPayment.order.IDDonHang}`;

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png` +
    `?amount=${amount}` +
    `&addInfo=${encodeURIComponent(description)}` +
    `&accountName=${encodeURIComponent(accountName)}`;

  document.getElementById('vietqr-img').src = qrUrl;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════

function setupSocketListeners() {
  socket.on('connect', () => {
    console.log('✅ Socket connected');
  });
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });
  socket.on('new_order', async (data) => {
    console.log('📦 New order:', data);
    showToast(`📦 Đơn hàng mới từ ${data.ten_ban || 'Bàn ' + data.id_ban}!`, 'info');
    playSound('notification');
    await loadOrders();
  });
  socket.on('call_staff', async (data) => {
    console.log('📢 Call staff:', data);
    showToast(`📢 ${data.ten_ban} cần hỗ trợ!`, 'warning');
    playSound('notification');
    await loadNotifications();
  });
  socket.on('order_status_update', async (data) => {
    console.log('🔄 Order status update:', data);
    await loadOrders();
  });
  socket.on('order_paid', async (data) => {
    console.log('💰 Order paid:', data);
    await loadOrders();
    await loadTodayStats();
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

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTimeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return formatDateTime(dateString);
}

function isOrderUrgent(dateString) {
  const now = new Date();
  const orderTime = new Date(dateString);
  const diffMins = (now - orderTime) / 60000;
  return diffMins > 15;
}

function startClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const dateStr = now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    document.getElementById('time-display').textContent = timeStr;
    document.getElementById('clock').title = dateStr;
  }
  update();
  setInterval(update, 1000);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast-custom ${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: start; gap: 10px;">
      <i class="fas fa-${getToastIcon(type)}" style="font-size: 1.5rem;"></i>
      <div style="flex: 1;">
        <strong>${getToastTitle(type)}</strong>
        <div style="margin-top: 5px; white-space: pre-line;">${message}</div>
      </div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function getToastIcon(type) {
  const icons = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  return icons[type] || 'info-circle';
}

function getToastTitle(type) {
  const titles = {
    success: 'Thành công',
    error: 'Lỗi',
    warning: 'Cảnh báo',
    info: 'Thông báo'
  };
  return titles[type] || 'Thông báo';
}

function playSound(type) {
  const sounds = {
    notification: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA==',
    success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA==',
    payment: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA=='
  };
  try {
    const audio = new Audio(sounds[type] || sounds.notification);
    audio.volume = 0.4;
    audio.play().catch(e => console.log('Cannot play sound:', e));
  } catch (e) {
    console.log('Sound error:', e);
  }
}

function showLoading(show) {
  console.log(show ? 'Loading...' : 'Loaded');
}

function printInvoice(paymentResult, paymentData) {
  const order = state.currentPayment.order;
  const win = window.open('', '', 'width=300,height=600');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Hóa đơn - ${order.TenBan}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          padding: 20px;
          font-size: 12px;
        }
        h2 { text-align: center; margin-bottom: 10px; }
        .center { text-align: center; }
        .line { border-bottom: 1px dashed #000; margin: 10px 0; }
        .row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
        }
        .total {
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 2px solid #000;
        }
      </style>
    </head>
    <body>
      <h2>🌶️ MÌ CAY ONE</h2>
      <p class="center">88 Hoàng Hoa Thám, Xuân Hòa, Phú Thọ</p>
      <p class="center">ĐT: 0982 121 680</p>
      <div class="line"></div>
      <p><strong>Đơn hàng:</strong> #${order.IDDonHang}</p>
      <p><strong>Bàn:</strong> ${order.TenBan}</p>
      <p><strong>Thời gian:</strong> ${formatDateTime(new Date())}</p>
      <div class="line"></div>
      <p><strong>Chi tiết:</strong></p>
      ${order.chi_tiet.map(item => `
        <div class="row">
          <span>${item.TenMon} (x${item.SoLuong})</span>
          <span>${formatPrice(item.ThanhTien)}</span>
        </div>
      `).join('')}
      <div class="line"></div>
      <div class="row">
        <span>Tổng cộng:</span>
        <span>${formatPrice(paymentResult.tong_tien)}</span>
      </div>
      ${paymentResult.so_tien_giam > 0 ? `
        <div class="row">
          <span>Giảm giá:</span>
          <span>-${formatPrice(paymentResult.so_tien_giam)}</span>
        </div>
      ` : ''}
      <div class="row total">
        <span>THANH TOÁN:</span>
        <span>${formatPrice(paymentResult.so_tien_thanh_toan)}</span>
      </div>
      ${paymentData.phuongThuc === 1 && paymentResult.tien_thua > 0 ? `
        <div class="row">
          <span>Tiền nhận:</span>
          <span>${formatPrice(paymentData.tienNhan)}</span>
        </div>
        <div class="row">
          <span>Tiền thừa:</span>
          <span>${formatPrice(paymentResult.tien_thua)}</span>
        </div>
      ` : ''}
      ${paymentResult.diem_tich_luy > 0 ? `
        <div class="line"></div>
        <p class="center">
          <strong>Tích lũy: +${paymentResult.diem_tich_luy} điểm</strong>
        </p>
      ` : ''}
      <div class="line"></div>
      <p class="center"><strong>Cảm ơn quý khách!</strong></p>
      <p class="center">Hẹn gặp lại!</p>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 1000);
        };F
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS (Called from HTML onclick)
// ═══════════════════════════════════════════════════════════════════════════
window.setCash = setCash;

window.selectOrder = selectOrder;
window.handleSendToKitchen = handleSendToKitchen;
window.handlePayment = handlePayment;
window.markNotificationRead = markNotificationRead;

console.log('💰 Thu Ngân System Loaded Successfully!');