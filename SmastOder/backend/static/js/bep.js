// ═══════════════════════════════════════════════════════════════════════════
// KITCHEN MANAGEMENT SYSTEM - FRONTEND V2.0
// Filename: bep.js
// Version: 2.0 - Có lịch sử đơn hoàn thành đầy đủ
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  orders: [],
  completedHistory: [], // Lịch sử đơn hoàn thành
  currentTab: 'waiting',
  stats: {
    waiting: 0,
    cooking: 0,
    completed: 0,
    today: 0
  },
  loadingHistory: false
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔥 Kitchen System Started v2.0');
  
  await initialize();
  setupEventListeners();
  setupSocketListeners();
  startClock();
  
  // Auto refresh every 20 seconds
  setInterval(() => {
    loadOrders();
  }, 20000);
  
  // Update elapsed time every second
  setInterval(() => {
    updateElapsedTimes();
  }, 1000);
  
  console.log('✅ Kitchen System Ready');
});

async function initialize() {
  try {
    showLoading(true);
    await Promise.all([
      loadOrders(),
      loadCompletedHistory()
    ]);
    showToast('✅ Hệ thống bếp sẵn sàng!', 'success');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showToast('Lỗi khởi động hệ thống!', 'error');
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load active orders (chưa thanh toán + hoàn thành gần đây)
 */
async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/bep/donhang`);
    const result = await response.json();
    if (!result.success) return;

    // ✅ RESET THEO BACKEND
    state.orders = (result.data.don_hang || []).map(order => ({
      ...order,
      statusMapped: mapBackendStatus(order.TrangThaiBep)
    }));

    updateStats();

    if (state.currentTab !== 'completed') {
      renderOrders();
    }

    console.log('✅ Orders synced:', state.orders.length);

  } catch (error) {
    console.error('❌ Load orders error:', error);
  }
}


/**
 * Load completed history (lịch sử đơn hoàn thành)
 */
async function loadCompletedHistory(limit = 100, type = 'day') {
  try {
    if (state.loadingHistory) return;
    state.loadingHistory = true;

    console.log('📅 Load history:', type);

    const response = await fetch(
      `${API_BASE}/bep/donhang/lichsu?limit=${limit}&type=${type}`
    );

    const result = await response.json();

    if (result.success) {
      state.completedHistory = result.data.don_hang || [];

      state.completedHistory.forEach(order => {
        order.statusMapped = 'HOAN_THANH';
      });

      if (state.currentTab === 'completed') {
        renderOrders();
      }

      console.log(
        `✅ Completed history loaded (${type}):`,
        state.completedHistory.length
      );
    }
  } catch (error) {
    console.error('❌ Load history error:', error);
  } finally {
    state.loadingHistory = false;
  }
}


/**
 * Update order status
 */
async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${API_BASE}/bep/donhang/${orderId}/trangthai`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai: status })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const statusText = status === 'DANG_NAU' ? 'Đang nấu' : 'Hoàn thành';
      showToast(`✅ Đã cập nhật: ${statusText}`, 'success');
      playSound('success');
      
      // Reload orders
      await loadOrders();
      
      // Nếu hoàn thành, reload lịch sử
      if (status === 'HOAN_THANH') {
        await loadCompletedHistory();
      }
      
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Update status error:', error);
    showToast('Lỗi khi cập nhật trạng thái!', 'error');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

function mapBackendStatus(backendStatus) {
  const statusMap = {
    'CHỜ': 'WAITING',
    'Đang nấu': 'DANG_NAU',
    'Hoàn thành': 'HOAN_THANH'
  };
  return statusMap[backendStatus] || 'WAITING';
}

function getOrdersByStatus(status) {

  // ✅ TAB HOÀN THÀNH
  if (status === 'HOAN_THANH') {
    return state.completedHistory;
  }

  // ✅ TAB CHỜ LÀM
  if (status === 'WAITING') {
    // TẤT CẢ đơn chưa hoàn thành
    return state.orders.filter(order =>
      order.statusMapped !== 'HOAN_THANH'
    );
  }

  // ✅ TAB ĐANG NẤU
  if (status === 'DANG_NAU') {
    return state.orders.filter(order =>
      order.statusMapped === 'DANG_NAU'
    );
  }

  return [];
}


function updateStats() {
  state.stats.waiting = state.orders.filter(o => o.statusMapped === 'WAITING').length;
  state.stats.cooking = state.orders.filter(o => o.statusMapped === 'DANG_NAU').length;
  
  // Completed count = đơn hoàn thành trong orders + lịch sử
  const completedInOrders = state.orders.filter(o => o.statusMapped === 'HOAN_THANH').length;
  state.stats.completed = completedInOrders + state.completedHistory.length;
  
  state.stats.today = state.stats.waiting + state.stats.cooking + state.stats.completed;
  
  renderStats();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function renderOrders() {
  const container = document.getElementById('orders-grid');

  let ordersToShow = [];

  if (state.currentTab === 'waiting') {
    // ✅ TẤT CẢ ĐƠN CHƯA HOÀN THÀNH
    ordersToShow = state.orders.filter(
      o => o.statusMapped !== 'HOAN_THANH'
    );
  } 
  else if (state.currentTab === 'cooking') {
    ordersToShow = state.orders.filter(
      o => o.statusMapped === 'DANG_NAU'
    );
  } 
  else if (state.currentTab === 'completed') {
    ordersToShow = state.completedHistory;
  }

  if (ordersToShow.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-utensils"></i>
        <h3>Không có đơn hàng nào</h3>
        <p class="text-muted">
          ${state.currentTab === 'completed'
            ? 'Chưa có đơn hoàn thành'
            : 'Đơn hàng sẽ xuất hiện ở đây khi có'}
        </p>
      </div>
    `;
    return;
  }

  // Sort
  if (state.currentTab === 'completed') {
    ordersToShow.sort((a, b) =>
      new Date(b.ThoiGianHoanThanh || b.NgayTao) -
      new Date(a.ThoiGianHoanThanh || a.NgayTao)
    );
  } else {
    ordersToShow.sort((a, b) =>
      new Date(a.NgayTao) - new Date(b.NgayTao)
    );
  }

  container.innerHTML = ordersToShow
    .map(order => renderOrderCard(order))
    .join('');
}

function renderOrderCard(order) {
  const status = order.statusMapped;
  const isPaid = order.TrangThaiThanhToan === 1;
  const detailId = `detail-${order.IDDonHang}`;

  return `
    <div class="order-card" data-order-id="${order.IDDonHang}">
      
      <!-- HEADER -->
      <div class="order-header">
        <div class="table-name">🍽️ ${order.TenBan}</div>
        <div class="order-id">#${order.IDDonHang}</div>
      </div>

      <!-- STATUS -->
      <div class="order-status status-${status}">
        ${status === 'WAITING' ? '⏳ Chờ làm' :
          status === 'DANG_NAU' ? '🔥 Đang nấu' :
          '✅ Hoàn thành'}
        ${isPaid ? ' | 💰 Đã thanh toán' : ''}
      </div>

      <!-- ACTION -->
      <div class="order-actions">
        <button class="btn-detail" onclick="toggleDetail('${detailId}')">
          👁️ Chi tiết món
        </button>
        ${renderActionButtons(order.IDDonHang, status, isPaid)}
      </div>

      <!-- DETAIL TABLE -->
      <div class="order-detail hidden" id="${detailId}">
        <table class="detail-table">
          <thead>
            <tr>
              <th>Món</th>
              <th>SL</th>
              <th>Cay</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${order.chi_tiet.map(item => `
              <tr>
                <td class="col-name">${item.TenMon}</td>
                <td class="col-qty">x${item.SoLuong}</td>
                <td class="col-spicy">${item.CapDoCay || '-'}</td>
                <td class="col-note">${item.GhiChu || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}
function toggleDetail(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
}


function renderActionButtons(orderId, status, isPaid) {
  if (isPaid && status === 'HOAN_THANH') {
    return `
      <div class="alert alert-success mb-0 text-center">
        <i class="fas fa-check-double"></i> Hoàn tất & Đã thanh toán
      </div>
    `;
  }
  
  if (status === 'WAITING') {
    return `
      <button class="btn-action btn-start" onclick="startCooking(${orderId})">
        <i class="fas fa-fire"></i> Bắt đầu nấu
      </button>
    `;
  } else if (status === 'DANG_NAU') {
    return `
      <button class="btn-action btn-complete" onclick="completeOrder(${orderId})">
        <i class="fas fa-check-circle"></i> Hoàn thành
      </button>
    `;
  } else {
    return `
      <div class="alert alert-success mb-0 text-center">
        <i class="fas fa-check-circle"></i> Món đã hoàn thành
      </div>
    `;
  }
}

function renderStats() {
  const els = {
    waiting: document.getElementById('stat-waiting'),
    cooking: document.getElementById('stat-cooking'),
    completed: document.getElementById('stat-completed'),
    today: document.getElementById('stat-today'),
    badgeWaiting: document.getElementById('badge-waiting'),
    badgeCooking: document.getElementById('badge-cooking'),
    badgeCompleted: document.getElementById('badge-completed')
  };
  
  if (els.waiting) els.waiting.textContent = state.stats.waiting;
  if (els.cooking) els.cooking.textContent = state.stats.cooking;
  if (els.completed) els.completed.textContent = state.stats.completed;
  if (els.today) els.today.textContent = state.stats.today;
  if (els.badgeWaiting) els.badgeWaiting.textContent = state.stats.waiting;
  if (els.badgeCooking) els.badgeCooking.textContent = state.stats.cooking;
  if (els.badgeCompleted) els.badgeCompleted.textContent = state.stats.completed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function startCooking(orderId) {
  if (!confirm('🔥 Bắt đầu nấu đơn hàng này?')) return;
  
  const success = await updateOrderStatus(orderId, 'DANG_NAU');
  if (success) {
    playSound('start');
  }
}

async function completeOrder(orderId) {
  if (!confirm('✅ Xác nhận món đã nấu xong?')) return;
  
  const success = await updateOrderStatus(orderId, 'HOAN_THANH');
  if (success) {
    playSound('complete');
    
    // Auto switch to completed tab after 2 seconds
    setTimeout(() => {
      switchTab('completed');
    }, 2000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  
  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('🚪 Đăng xuất khỏi hệ thống?')) {
      window.location.href = '/login';
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === '1') switchTab('waiting');
    if (e.key === '2') switchTab('cooking');
    if (e.key === '3') switchTab('completed');
    if (e.key === 'r' || e.key === 'R') {
      loadOrders();
      if (state.currentTab === 'completed') {
  loadCompletedHistory(100, currentHistoryType);
      }
    }
  });
}
function switchTab(tab) {
  state.currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });

  // 🔥 HIỆN / ẨN FILTER NGÀY - TUẦN - THÁNG
  const historyFilter = document.getElementById('history-filter');
  if (historyFilter) {
    historyFilter.style.display = tab === 'completed' ? 'block' : 'none';
  }

  // Load data theo tab
  if (tab === 'completed') {
    loadCompletedHistory();   // luôn load khi vào Hoàn thành
  } else {
    renderOrders();
  }
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
  
  socket.on('send_to_kitchen', async (data) => {
    console.log('🔥 New order to kitchen:', data);
    showToast(`🔥 Đơn mới từ ${data.ten_ban}!`, 'info');
    playSound('notification');
    await loadOrders();
    
    if (state.currentTab !== 'waiting') {
      switchTab('waiting');
    }
  });
  
  socket.on('order_status_update', async (data) => {
    console.log('📋 Order status updated:', data);
    await loadOrders();
    
    if (data.trang_thai === 'HOAN_THANH') {
      await loadCompletedHistory();
    }
  });
  
  socket.on('order_paid', async (data) => {
    console.log('💰 Order paid:', data);
    showToast(`💰 Đơn #${data.id_don_hang} đã thanh toán`, 'success');
    await loadOrders();
    await loadCompletedHistory();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getElapsedTime(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function updateElapsedTimes() {
  document.querySelectorAll('.time-elapsed').forEach(el => {
    const time = el.dataset.time;
    el.textContent = getElapsedTime(time);
  });
}

function isOrderUrgent(dateString) {
  const now = new Date();
  const orderTime = new Date(dateString);
  const diffMins = (now - orderTime) / 60000;
  return diffMins > 20;
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
    
    const clockTime = document.getElementById('clock-time');
    const clockDate = document.getElementById('clock-date');
    
    if (clockTime) clockTime.textContent = timeStr;
    if (clockDate) clockDate.textContent = dateStr;
  }
  
  update();
  setInterval(update, 1000);
}

function showLoading(show) {
  const overlay = document.getElementById('loading');
  if (overlay) {
    overlay.classList.toggle('show', show);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast-custom ${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <i class="fas fa-${getToastIcon(type)}" style="font-size: 1.8rem;"></i>
      <div style="flex: 1;">
        <strong style="font-size: 1.1rem;">${getToastTitle(type)}</strong>
        <div style="margin-top: 5px;">${message}</div>
      </div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s ease-out reverse';
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
    start: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA==',
    complete: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUB0NVKnk8bhlKgkldc3y1Y03CA1iqO7poFceDF+46PO0Zi4NQqPn8L1wKA=='
  };
  
  try {
    const audio = new Audio(sounds[type] || sounds.notification);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Cannot play sound:', e));
  } catch (e) {
    console.log('Sound error:', e);
  }
}
// ═══════════════════════════════════════════════════════════════════
// HISTORY FILTER (DAY / WEEK / MONTH)
// ═══════════════════════════════════════════════════════════════════

let currentHistoryType = 'day';

window.switchHistoryType = function (type) {
  console.log('🔁 Switch history type:', type);
  currentHistoryType = type;

  // Active button UI
  document.querySelectorAll('.history-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === type) {
      btn.classList.add('active');
    }
  });

  loadCompletedHistory(100, type);
};

// ═══════════════════════════════════════════════════════════════════════════
// PRINT KITCHEN TICKET
// ═══════════════════════════════════════════════════════════════════════════

function printKitchenTicket(orderId) {
  const order = state.orders.find(o => o.IDDonHang === orderId) ||
                state.completedHistory.find(o => o.IDDonHang === orderId);
  if (!order) return;
  
  const win = window.open('', '', 'width=300,height=500');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Phiếu Bếp - ${order.TenBan}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: 15px; font-size: 14px; }
        h2 { text-align: center; margin-bottom: 10px; font-size: 20px; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
        .table-name { font-size: 24px; font-weight: bold; margin: 10px 0; }
        .order-info { margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .item { margin: 10px 0; padding: 10px; border: 1px solid #000; }
        .item-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .item-qty { font-size: 22px; font-weight: bold; text-align: right; }
        .footer { text-align: center; margin-top: 15px; border-top: 2px dashed #000; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🔥 BẾP - MÌ CAY ONE</h2>
        <div class="table-name">${order.TenBan}</div>
      </div>
      <div class="order-info">
        <p><strong>Đơn hàng:</strong> #${order.IDDonHang}</p>
        <p><strong>Thời gian:</strong> ${formatTime(order.NgayTao)}</p>
      </div>
      ${order.chi_tiet.map(item => `
        <div class="item">
          <div style="display: flex; justify-content: space-between;">
            <div style="flex: 1;">
              <div class="item-name">${item.TenMon}</div>
              ${item.CapDoCay ? `<div>🌶️ ${item.CapDoCay}</div>` : ''}
              ${item.GhiChu ? `<div>📝 ${item.GhiChu}</div>` : ''}
            </div>
            <div class="item-qty">x${item.SoLuong}</div>
          </div>
        </div>
      `).join('')}
      <div class="footer">
        <p><strong>Làm nhanh - Đảm bảo chất lượng!</strong></p>
        <p>${new Date().toLocaleString('vi-VN')}</p>
      </div>
      <script>
        window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS
// ═══════════════════════════
window.startCooking = startCooking;
window.completeOrder = completeOrder;
window.printKitchenTicket = printKitchenTicket;

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

window.kitchenDebug = {
  state: () => console.table(state.stats),
  orders: () => console.table(state.orders),
  reload: () => loadOrders(),
  urgent: () => {
    const urgent = state.orders.filter(o => isOrderUrgent(o.NgayTao));
    console.log('Urgent orders:', urgent);
  }
};

// Show keyboard shortcuts on first load
if (!localStorage.getItem('kitchen_shortcuts_shown')) {
  setTimeout(() => {
    showToast(
      '⌨️ Phím tắt:\n1️⃣ Chờ làm\n2️⃣ Đang nấu\n3️⃣ Hoàn thành\nR - Làm mới',
      'info'
    );
    localStorage.setItem('kitchen_shortcuts_shown', 'true');
  }, 2000);
}

console.log('🔥 Kitchen System Loaded Successfully!');
console.log('📌 Backend API: ' + API_BASE);
console.log('📌 Keyboard shortcuts: 1 (Waiting), 2 (Cooking), 3 (Completed), R (Refresh)');
console.log('🐛 Debug: Use kitchenDebug.state(), kitchenDebug.orders(), etc.');