/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Bếp System (Full Version)
 *  Tính năng: Nhận đơn, cập nhật trạng thái nấu, hoàn thành
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & STATE
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  orders: [],
  currentTab: 'waiting',
  stats: {
    waiting: 0,
    cooking: 0,
    completed: 0,
    today: 0
  },
  orderStatuses: {} // Lưu trạng thái của từng đơn {idDonHang: 'WAITING'|'COOKING'|'COMPLETED'}
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔥 Kitchen System Started');
  
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
    await loadOrders();
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

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/bep/donhang`);
    const result = await response.json();
    
    if (result.success) {
      state.orders = result.data.don_hang || [];
      processOrders();
      renderOrders();
      updateStats();
      console.log('✅ Orders loaded:', state.orders.length);
    }
  } catch (error) {
    console.error('❌ Load orders error:', error);
    showToast('Lỗi khi tải danh sách đơn hàng', 'error');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${API_BASE}/bep/donhang/${orderId}/trangthai`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai: status })
    });
    
    const result = await response.json();
    
    if (result.success) {
      state.orderStatuses[orderId] = status;
      
      const statusText = status === 'DANG_NAU' ? 'Đang nấu' : 'Hoàn thành';
      showToast(`✅ Đã cập nhật: ${statusText}`, 'success');
      playSound('success');
      
      await loadOrders();
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

function processOrders() {
  // Phân loại đơn hàng theo trạng thái
  state.orders.forEach(order => {
    if (!state.orderStatuses[order.IDDonHang]) {
      state.orderStatuses[order.IDDonHang] = 'WAITING';
    }
  });
  
  // Lọc bỏ các đơn đã thanh toán khỏi orderStatuses
  const currentOrderIds = state.orders.map(o => o.IDDonHang);
  Object.keys(state.orderStatuses).forEach(id => {
    if (!currentOrderIds.includes(parseInt(id))) {
      delete state.orderStatuses[id];
    }
  });
}

function getOrdersByStatus(status) {
  return state.orders.filter(order => state.orderStatuses[order.IDDonHang] === status);
}

function updateStats() {
  state.stats.waiting = getOrdersByStatus('WAITING').length;
  state.stats.cooking = getOrdersByStatus('DANG_NAU').length;
  state.stats.completed = getOrdersByStatus('HOAN_THANH').length;
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
    ordersToShow = getOrdersByStatus('WAITING');
  } else if (state.currentTab === 'cooking') {
    ordersToShow = getOrdersByStatus('DANG_NAU');
  } else if (state.currentTab === 'completed') {
    ordersToShow = getOrdersByStatus('HOAN_THANH');
  }
  
  if (ordersToShow.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-utensils"></i>
        <h3>Không có đơn hàng nào</h3>
        <p class="text-muted">Đơn hàng sẽ xuất hiện ở đây khi có</p>
      </div>
    `;
    return;
  }
  
  // Sắp xếp theo thời gian (cũ nhất trước)
  ordersToShow.sort((a, b) => new Date(a.NgayTao) - new Date(b.NgayTao));
  
  container.innerHTML = ordersToShow.map(order => {
    const isUrgent = isOrderUrgent(order.NgayTao);
    const status = state.orderStatuses[order.IDDonHang];
    
    return `
      <div class="order-card ${isUrgent ? 'urgent' : ''}" data-order-id="${order.IDDonHang}">
        ${status !== 'WAITING' ? `
          <div class="status-badge status-${status === 'DANG_NAU' ? 'cooking' : 'completed'}">
            ${status === 'DANG_NAU' ? '🔥 Đang nấu' : '✅ Hoàn thành'}
          </div>
        ` : ''}
        
        <div class="order-header">
          <div class="table-name">
            <i class="fas fa-utensils"></i>
            ${order.TenBan}
          </div>
          <div class="order-time-info">
            <div class="order-time">
              <i class="fas fa-clock"></i>
              <span>${formatTime(order.NgayTao)}</span>
            </div>
            <div class="time-elapsed" data-time="${order.NgayTao}">
              ${getElapsedTime(order.NgayTao)}
            </div>
            <div class="order-id">Đơn #${order.IDDonHang}</div>
          </div>
        </div>

        <div class="items-list">
          ${order.chi_tiet.map(item => `
            <div class="item-row">
              <div class="item-info">
                <div class="item-name">${item.TenMon}</div>
                <div class="item-meta">
                  ${item.CapDoCay ? `<span class="meta-badge badge-spicy">🌶️ ${item.CapDoCay}</span>` : ''}
                  ${item.GhiChu ? `<span class="meta-badge badge-note">📝 ${item.GhiChu}</span>` : ''}
                </div>
              </div>
              <div class="item-qty">x${item.SoLuong}</div>
            </div>
          `).join('')}
        </div>

        <div class="order-actions">
          ${renderActionButtons(order.IDDonHang, status)}
        </div>
      </div>
    `;
  }).join('');
}

function renderActionButtons(orderId, status) {
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
  document.getElementById('stat-waiting').textContent = state.stats.waiting;
  document.getElementById('stat-cooking').textContent = state.stats.cooking;
  document.getElementById('stat-completed').textContent = state.stats.completed;
  document.getElementById('stat-today').textContent = state.stats.today;
  
  document.getElementById('badge-waiting').textContent = state.stats.waiting;
  document.getElementById('badge-cooking').textContent = state.stats.cooking;
  document.getElementById('badge-completed').textContent = state.stats.completed;
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
    
    // Tự động chuyển sang tab completed sau 2 giây
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
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('🚪 Đăng xuất khỏi hệ thống?')) {
      window.location.href = '/login';
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === '1') switchTab('waiting');
    if (e.key === '2') switchTab('cooking');
    if (e.key === '3') switchTab('completed');
    if (e.key === 'r' || e.key === 'R') loadOrders();
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
  
  renderOrders();
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
    
    // Tự động chuyển sang tab waiting nếu đang ở tab khác
    if (state.currentTab !== 'waiting') {
      switchTab('waiting');
    }
  });
  
  socket.on('order_paid', async (data) => {
    console.log('💰 Order paid:', data);
    await loadOrders();
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
  return diffMins > 20; // Urgent if more than 20 minutes
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
    
    document.getElementById('clock-time').textContent = timeStr;
    document.getElementById('clock-date').textContent = dateStr;
  }
  
  update();
  setInterval(update, 1000);
}

function showLoading(show) {
  const overlay = document.getElementById('loading');
  if (show) {
    overlay.classList.add('show');
  } else {
    overlay.classList.remove('show');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
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

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED FEATURES
// ═══════════════════════════════════════════════════════════════════════════

// Auto notification for urgent orders
setInterval(() => {
  const urgentOrders = state.orders.filter(order => {
    const status = state.orderStatuses[order.IDDonHang];
    return status === 'WAITING' && isOrderUrgent(order.NgayTao);
  });
  
  if (urgentOrders.length > 0 && state.currentTab === 'waiting') {
    urgentOrders.forEach(order => {
      const elapsed = getElapsedTime(order.NgayTao);
      console.log(`⚠️ Urgent order: ${order.TenBan} - ${elapsed}`);
    });
  }
}, 60000); // Check every minute

// Print kitchen ticket function
function printKitchenTicket(order) {
  const win = window.open('', '', 'width=300,height=500');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Phiếu Bếp - ${order.TenBan}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          padding: 15px;
          font-size: 14px;
        }
        h2 { 
          text-align: center; 
          margin-bottom: 10px;
          font-size: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .table-name {
          font-size: 24px;
          font-weight: bold;
          margin: 10px 0;
        }
        .order-info {
          margin-bottom: 15px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .item {
          margin: 10px 0;
          padding: 10px;
          border: 1px solid #000;
        }
        .item-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .item-qty {
          font-size: 22px;
          font-weight: bold;
          text-align: right;
        }
        .item-meta {
          margin-top: 5px;
          font-style: italic;
        }
        .spicy {
          color: red;
          font-weight: bold;
        }
        .note {
          background: #ffeb3b;
          padding: 5px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          border-top: 2px dashed #000;
          padding-top: 10px;
        }
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
        <p><strong>Số món:</strong> ${order.chi_tiet.length}</p>
      </div>

      ${order.chi_tiet.map(item => `
        <div class="item">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div class="item-name">${item.TenMon}</div>
              <div class="item-meta">
                ${item.CapDoCay ? `<div class="spicy">🌶️ ${item.CapDoCay}</div>` : ''}
                ${item.GhiChu ? `<div class="note">📝 ${item.GhiChu}</div>` : ''}
              </div>
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
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 500);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// Add print button to order cards (optional)
function addPrintButton(orderId) {
  const order = state.orders.find(o => o.IDDonHang === orderId);
  if (order) {
    printKitchenTicket(order);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function getAverageCookingTime() {
  // Tính thời gian nấu trung bình (có thể lưu vào localStorage)
  const completedOrders = getOrdersByStatus('HOAN_THANH');
  if (completedOrders.length === 0) return 0;
  
  const totalTime = completedOrders.reduce((sum, order) => {
    const elapsed = (new Date() - new Date(order.NgayTao)) / 60000;
    return sum + elapsed;
  }, 0);
  
  return Math.round(totalTime / completedOrders.length);
}

function getOrderPriority(order) {
  // Tính độ ưu tiên dựa trên thời gian chờ và số món
  const elapsed = (new Date() - new Date(order.NgayTao)) / 60000;
  const itemCount = order.chi_tiet.reduce((sum, item) => sum + item.SoLuong, 0);
  
  let priority = elapsed * 2; // Thời gian chờ quan trọng gấp đôi
  
  if (itemCount > 5) priority += 10; // Đơn nhiều món
  if (order.chi_tiet.some(item => item.CapDoCay)) priority += 5; // Có món cay
  
  return priority;
}

// Sort orders by priority (optional feature)
function sortOrdersByPriority() {
  state.orders.sort((a, b) => {
    return getOrderPriority(b) - getOrderPriority(a);
  });
  renderOrders();
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE METRICS
// ═══════════════════════════════════════════════════════════════════════════

const metrics = {
  ordersCompleted: 0,
  totalCookingTime: 0,
  averageTime: 0,
  
  recordCompletion(cookingTimeMinutes) {
    this.ordersCompleted++;
    this.totalCookingTime += cookingTimeMinutes;
    this.averageTime = Math.round(this.totalCookingTime / this.ordersCompleted);
    
    console.log(`📊 Metrics: ${this.ordersCompleted} orders, avg ${this.averageTime}min`);
  },
  
  reset() {
    this.ordersCompleted = 0;
    this.totalCookingTime = 0;
    this.averageTime = 0;
  }
};

// Reset metrics at midnight
function scheduleMetricsReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  
  const msUntilMidnight = midnight - now;
  
  setTimeout(() => {
    metrics.reset();
    console.log('📊 Metrics reset at midnight');
    scheduleMetricsReset(); // Schedule next reset
  }, msUntilMidnight);
}

scheduleMetricsReset();

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

function performQualityCheck(orderId) {
  const order = state.orders.find(o => o.IDDonHang === orderId);
  if (!order) return;
  
  const checks = {
    passed: true,
    issues: []
  };
  
  // Check 1: Thời gian quá lâu
  const elapsed = (new Date() - new Date(order.NgayTao)) / 60000;
  if (elapsed > 30) {
    checks.passed = false;
    checks.issues.push('⚠️ Đơn hàng đã chờ quá 30 phút');
  }
  
  // Check 2: Món cay đặc biệt
  const spicyItems = order.chi_tiet.filter(item => 
    item.CapDoCay && (item.CapDoCay.includes('6') || item.CapDoCay.includes('7'))
  );
  if (spicyItems.length > 0) {
    checks.issues.push('🌶️ Lưu ý: Có món cay đặc biệt');
  }
  
  // Check 3: Ghi chú quan trọng
  const hasImportantNotes = order.chi_tiet.some(item => 
    item.GhiChu && (item.GhiChu.includes('gấp') || item.GhiChu.includes('nhanh'))
  );
  if (hasImportantNotes) {
    checks.issues.push('⚡ Khách yêu cầu làm gấp');
  }
  
  if (checks.issues.length > 0) {
    console.log(`Quality check for order #${orderId}:`, checks.issues);
  }
  
  return checks;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS (Called from HTML)
// ═══════════════════════════════════════════════════════════════════════════

window.startCooking = startCooking;
window.completeOrder = completeOrder;
window.printKitchenTicket = addPrintButton;

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Console helpers for debugging
window.kitchenDebug = {
  state: () => console.table(state.stats),
  orders: () => console.table(state.orders),
  statuses: () => console.log(state.orderStatuses),
  metrics: () => console.log(metrics),
  urgent: () => {
    const urgent = state.orders.filter(o => isOrderUrgent(o.NgayTao));
    console.log('Urgent orders:', urgent);
  }
};

// Show helpful shortcuts on first load
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
console.log('📌 Keyboard shortcuts: 1 (Waiting), 2 (Cooking), 3 (Completed), R (Refresh)');
console.log('🐛 Debug: Use kitchenDebug.state(), kitchenDebug.orders(), etc.');
