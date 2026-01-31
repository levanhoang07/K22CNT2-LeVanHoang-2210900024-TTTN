// ═══════════════════════════════════════════════════════════════════════════
// KITCHEN MANAGEMENT SYSTEM - FRONTEND V4.1 (FIXED)
// Filename: bep.js
// Version: 4.1 - Sửa lỗi hiển thị đơn và lịch sử
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  orders: [],
  completedHistory: [],
  currentTab: 'waiting',
  stats: {
    waiting: 0,
    cooking: 0,
    completed: 0,
    today: 0
  },
  loadingHistory: false,
  currentOrder: null
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔥 Kitchen System Started v4.1 (FIXED - Per-Dish Status)');
  
  await initialize();
  setupEventListeners();
  setupSocketListeners();
  startClock();
  
  // Auto refresh every 20 seconds
  setInterval(() => {
    loadOrders();
  }, 20000);
  
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
function normalizeStatus(s) {
  return (s || '').trim().toUpperCase();
}
// ═══════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/bep/donhang`);
    const result = await response.json();
    if (!result.success) return;

    state.orders = (result.data.don_hang || []).map(order => ({
      ...order,
      statusMapped: mapBackendStatus(order.TrangThaiBep)
    }));

    updateStats();

    if (state.currentTab !== 'completed') {
      renderTables();
    }

    console.log('✅ Orders synced:', state.orders.length);

  } catch (error) {
    console.error('❌ Load orders error:', error);
  }
}

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
        renderTables();
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

async function updateDishStatus(idChiTiet, status) {
  try {
    const response = await fetch(`${API_BASE}/bep/chitiet/${idChiTiet}/trangthai`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai: status })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const statusText = status === 'DANG_NAU' ? 'Đang nấu' : 'Hoàn thành';
      showToast(`✅ ${result.message}`, 'success');
      playSound('success');
      
      await loadOrders();
      
      if (status === 'HOAN_THANH') {
        await loadCompletedHistory();
      }
      
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Update dish status error:', error);
    showToast('Lỗi khi cập nhật trạng thái món!', 'error');
    return false;
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
      const statusText = status === 'DANG_NAU' ? 'Đang nấu' : 'Hoàn thành';
      showToast(`✅ Đã cập nhật: ${statusText}`, 'success');
      playSound('success');
      
      await loadOrders();
      
      if (status === 'HOAN_THANH') {
        await loadCompletedHistory();
      }
      
      closeModal();
      if (status === 'HOAN_THANH') {
        setTimeout(() => switchTab('completed'), 1000);
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
  const s = normalizeStatus(backendStatus);

  const statusMap = {
    CHO_XAC_NHAN: 'WAITING',
    DANG_NAU: 'DANG_NAU',
    HOAN_THANH: 'HOAN_THANH',
    DA_THANH_TOAN: 'HOAN_THANH',
    HUY: 'WAITING'
  };

  return statusMap[s] || 'WAITING';
}
function mapDishStatus(status) {
  const s = normalizeStatus(status);

  const statusMap = {
    CHO_XAC_NHAN: 'WAITING',
    DANG_NAU: 'DANG_NAU',
    HOAN_THANH: 'HOAN_THANH'
  };

  return statusMap[s] || 'WAITING';
}


function getOrderPriorityStatus(order) {
  const dishes = order.chi_tiet || [];
  
  const hasCooking = dishes.some(d => mapDishStatus(d.TrangThai) === 'DANG_NAU');
  const hasWaiting = dishes.some(d => mapDishStatus(d.TrangThai) === 'WAITING');
  const allCompleted = dishes.every(d => mapDishStatus(d.TrangThai) === 'HOAN_THANH');
  
  if (hasCooking) return 'DANG_NAU';
  if (hasWaiting) return 'WAITING';
  if (allCompleted) return 'HOAN_THANH';
  
  return 'WAITING';
}

function updateStats() {
  state.stats.waiting = state.orders.filter(o => {
    const priority = getOrderPriorityStatus(o);
    return priority === 'WAITING' && o.TrangThaiThanhToan !== 1;
  }).length;
  
  state.stats.cooking = state.orders.filter(o => {
    const priority = getOrderPriorityStatus(o);
    return priority === 'DANG_NAU' && o.TrangThaiThanhToan !== 1;
  }).length;
  
  state.stats.completed = state.orders.filter(o => {
    const priority = getOrderPriorityStatus(o);
    return priority === 'HOAN_THANH' && o.TrangThaiThanhToan !== 1;
  }).length + state.completedHistory.length;
  
  state.stats.today = state.stats.waiting + state.stats.cooking + state.stats.completed;
  
  renderStats();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS - TABLE VIEW
// ═══════════════════════════════════════════════════════════════════════════

function renderTables() {
  const container = document.getElementById('tables-grid');

let ordersToShow = [];

if (state.currentTab === 'waiting') {
  // CHỈ LẤY ĐƠN ĐANG CHỜ (chưa nấu, chưa thanh toán)
  ordersToShow = state.orders.filter(o =>
    o.TrangThaiThanhToan !== 1 &&
    getOrderPriorityStatus(o) === 'WAITING'
  );
}
else if (state.currentTab === 'cooking') {
  // CHỈ LẤY ĐƠN ĐANG NẤU
  ordersToShow = state.orders.filter(o =>
    o.TrangThaiThanhToan !== 1 &&
    getOrderPriorityStatus(o) === 'DANG_NAU'
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
        <p>
          ${state.currentTab === 'completed'
            ? 'Chưa có đơn hoàn thành'
            : 'Đơn hàng sẽ xuất hiện ở đây khi có'}
        </p>
      </div>
    `;
    return;
  }

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

  if (state.currentTab === 'completed') {
// HIỂN THỊ THEO TỪNG ĐƠN (KHÔNG GOM THEO BÀN)
container.innerHTML = ordersToShow.map(order => {
  const orderStatus = getOrderPriorityStatus(order);

  const statusClass = `status-${orderStatus}`;
  const statusText =
    orderStatus === 'WAITING' ? '⏳ Chờ làm' :
    orderStatus === 'DANG_NAU' ? '🔥 Đang nấu' : '✅ Hoàn thành';

  const pendingDishes = (order.chi_tiet || []).filter(d =>
    mapDishStatus(d.TrangThai) !== 'HOAN_THANH'
  ).length;

  return `
    <div class="table-item ${statusClass}" onclick="showSingleOrder(${order.IDDonHang})">
      ${pendingDishes > 0 ? `<div class="order-count">${pendingDishes}</div>` : ''}
      <div class="table-icon">🍽️</div>
      <div class="table-name">${order.TenBan}</div>
      <div class="order-id">#${order.IDDonHang}</div>
      <div class="table-status">${statusText}</div>
      <div class="order-time">${formatTime(order.NgayTao)}</div>
    </div>
  `;
}).join('');
  } else {
    const tableMap = {};
    ordersToShow.forEach(order => {
      if (order.TrangThaiThanhToan === 1) return;
      
      const tableName = order.TenBan;
      if (!tableMap[tableName]) {
        tableMap[tableName] = [];
      }
      tableMap[tableName].push(order);
    });

    container.innerHTML = Object.entries(tableMap).map(([tableName, orders]) => {
      let priorityStatus = 'WAITING';
      let hasCooking = false;
      let hasWaiting = false;
      
      orders.forEach(order => {
        const orderStatus = getOrderPriorityStatus(order);
        if (orderStatus === 'DANG_NAU') hasCooking = true;
        if (orderStatus === 'WAITING') hasWaiting = true;
      });
      
      if (hasCooking) {
        priorityStatus = 'DANG_NAU';
      } else if (hasWaiting) {
        priorityStatus = 'WAITING';
      } else {
        priorityStatus = 'HOAN_THANH';
      }
      
      const statusClass = `status-${priorityStatus}`;
      const statusText = priorityStatus === 'WAITING' ? '⏳ Chờ làm' :
                        priorityStatus === 'DANG_NAU' ? '🔥 Đang nấu' : '✅ Hoàn thành';
      
      const totalDishes = orders.reduce((sum, order) => {
        const pendingDishes = (order.chi_tiet || []).filter(d => 
          mapDishStatus(d.TrangThai) !== 'HOAN_THANH'
        ).length;
        return sum + pendingDishes;
      }, 0);

      return `
        <div class="table-item ${statusClass}" onclick="showTableOrders('${tableName}')">
          ${totalDishes > 0 ? `<div class="order-count">${totalDishes}</div>` : ''}
          <div class="table-icon">🍽️</div>
          <div class="table-name">${tableName}</div>
          <div class="table-status ${priorityStatus}">${statusText}</div>
        </div>
      `;
    }).join('');
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
// MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function showTableOrders(tableName) {
  const allOrders = state.orders.filter(o =>
    o.TenBan === tableName && o.TrangThaiThanhToan !== 1
  );

  if (allOrders.length === 0) {
    console.error('No active orders found for table:', tableName);
    return;
  }

  allOrders.sort((a, b) => new Date(a.NgayTao) - new Date(b.NgayTao));

  const modal = document.getElementById('order-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');

  modalTitle.innerHTML = `
    <i class="fas fa-utensils"></i>
    ${tableName} - ${allOrders.length} đơn hàng
  `;

  modalBody.innerHTML = allOrders.map((order, index) => {
    const orderStatus = getOrderPriorityStatus(order);
    return renderOrderCard(order, index, orderStatus, false);
  }).join('');

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function showSingleOrder(orderId) {
  const order = state.completedHistory.find(o => o.IDDonHang === orderId);
  
  if (!order) {
    console.error('Order not found:', orderId);
    return;
  }

  const modal = document.getElementById('order-modal');
  const modalBody = document.getElementById('modal-body');
  const modalTitle = document.getElementById('modal-title');

  const isPaid = order.TrangThaiThanhToan === 1;
  const orderStatus = getOrderPriorityStatus(order);

  modalTitle.innerHTML = `
    <i class="fas fa-utensils"></i>
    ${order.TenBan} - Đơn #${order.IDDonHang}
    ${isPaid ? '<span style="color:#26de81;margin-left:10px;">💰 Đã thanh toán</span>' : ''}
  `;

  modalBody.innerHTML = renderOrderCard(order, 0, orderStatus, isPaid);

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function renderOrderCard(order, index, orderStatus, isPaid) {
  return `
    <div class="order-card-modal" style="
      background: rgba(255, 255, 255, 0.1);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
      border: 2px solid ${orderStatus === 'WAITING' ? '#3b82f6' :
                         orderStatus === 'DANG_NAU' ? '#facc15' : '#22c55e'};
    ">
      <div class="order-info-grid">
        <div class="info-card">
          <div class="info-label">Mã đơn</div>
          <div class="info-value">#${order.IDDonHang}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Lần gọi</div>
          <div class="info-value">#${index + 1}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Thời gian</div>
          <div class="info-value">${formatTime(order.NgayTao)}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Trạng thái</div>
          <div class="info-value">
            ${orderStatus === 'WAITING' ? '⏳ Chờ làm' :
              orderStatus === 'DANG_NAU' ? '🔥 Đang nấu' :
              '✅ Hoàn thành'}
          </div>
        </div>
      </div>

      <div class="dishes-table" style="margin-top: 15px;">
        <table>
          <thead>
            <tr>
              <th>Món ăn</th>
              <th>SL</th>
              <th>Độ cay</th>
              <th>Ghi chú</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${(order.chi_tiet || []).map(item => {
              const dishStatus = mapDishStatus(item.TrangThai);
              return `
                <tr>
                  <td class="dish-name">${item.TenMon}</td>
                  <td class="dish-qty">x${item.SoLuong}</td>
                  <td>${item.CapDoCay ? `<span class="spicy-level">${item.CapDoCay}</span>` : '-'}</td>
                  <td>${item.GhiChu || '-'}</td>
                  <td>
                    <span class="dish-status-badge status-${dishStatus}">
                      ${dishStatus === 'WAITING' ? '⏳ Chờ' :
                        dishStatus === 'DANG_NAU' ? '🔥 Nấu' :
                        '✅ Xong'}
                    </span>
                  </td>
                  <td>
                    ${renderDishActions(item.IDChiTiet, dishStatus, isPaid)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="modal-actions" style="margin-top: 15px;">
        ${renderOrderActions(order.IDDonHang, orderStatus, isPaid)}
      </div>
    </div>
  `;
}

function renderDishActions(idChiTiet, status, isPaid) {
  if (isPaid && status === 'HOAN_THANH') {
    return '<span style="color: #26de81;">✓</span>';
  }
  
  if (status === 'WAITING') {
    return `
      <button class="btn-dish-action btn-sm" onclick="startCookingDish(${idChiTiet})" 
             style="background:#facc15;color:#1f2937;border:none;padding:6px 14px;border-radius:999px;cursor:pointer;font-size:0.85rem;font-weight:600;transition:all .2s;">
        <i class="fas fa-fire"></i> Nấu
      </button>
    `;
  } else if (status === 'DANG_NAU') {
    return `
      <button class="btn-dish-action btn-sm" onclick="completeDish(${idChiTiet})" 
              style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); 
                     color: #fff; border: none; padding: 5px 12px; border-radius: 6px; 
                     cursor: pointer; font-size: 0.85rem;">
        <i class="fas fa-check"></i> Xong
      </button>
    `;
  } else {
    return '<span style="color: #26de81;">✓ Hoàn thành</span>';
  }
}

function renderOrderActions(orderId, status, isPaid) {
  if (isPaid && status === 'HOAN_THANH') {
    return `
      <div class="alert-completed">
        <i class="fas fa-check-double"></i> Đơn đã hoàn thành & thanh toán
      </div>
    `;
  }
  
  return `
    <button class="btn-action btn-start" onclick="startCookingAllDishes(${orderId})">
      <i class="fas fa-fire"></i> Nấu tất cả món chờ
    </button>
    <button class="btn-action btn-complete" onclick="completeAllDishes(${orderId})">
      <i class="fas fa-check-circle"></i> Hoàn thành tất cả
    </button>
    <button class="btn-action btn-print" onclick="printKitchenTicket(${orderId})">
      <i class="fas fa-print"></i> In phiếu
    </button>
  `;
}

function closeModal() {
  const modal = document.getElementById('order-modal');
  modal.classList.remove('show');
  document.body.style.overflow = 'auto';
  state.currentOrder = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISH ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function startCookingDish(idChiTiet) {
  if (!confirm('🔥 Bắt đầu nấu món này?')) return;
  
  const success = await updateDishStatus(idChiTiet, 'DANG_NAU');
  if (success) {
    playSound('start');
    const currentTableName = getCurrentTableName();
    const currentOrderId = getCurrentOrderId();
    
    if (currentTableName) {
      setTimeout(() => showTableOrders(currentTableName), 500);
    } else if (currentOrderId) {
      setTimeout(() => showSingleOrder(currentOrderId), 500);
    }
  }
}

async function completeDish(idChiTiet) {
  if (!confirm('✅ Xác nhận món đã nấu xong?')) return;
  
  const success = await updateDishStatus(idChiTiet, 'HOAN_THANH');
  if (success) {
    playSound('complete');
    const currentTableName = getCurrentTableName();
    const currentOrderId = getCurrentOrderId();
    
    if (currentTableName) {
      setTimeout(() => showTableOrders(currentTableName), 500);
    } else if (currentOrderId) {
      setTimeout(() => showSingleOrder(currentOrderId), 500);
    }
  }
}

async function startCookingAllDishes(orderId) {
  if (!confirm('🔥 Bắt đầu nấu TẤT CẢ món chờ trong đơn này?')) return;
  
  const order = state.orders.find(o => o.IDDonHang === orderId) ||
                state.completedHistory.find(o => o.IDDonHang === orderId);
  if (!order) return;
  
  const waitingDishes = (order.chi_tiet || []).filter(d => 
    mapDishStatus(d.TrangThai) === 'WAITING'
  );
  
  for (const dish of waitingDishes) {
    await updateDishStatus(dish.IDChiTiet, 'DANG_NAU');
  }
  
  showToast('✅ Đã bắt đầu nấu tất cả món!', 'success');
  playSound('start');
  
  const currentTableName = getCurrentTableName();
  const currentOrderId = getCurrentOrderId();
  
  if (currentTableName) {
    setTimeout(() => showTableOrders(currentTableName), 500);
  } else if (currentOrderId) {
    setTimeout(() => showSingleOrder(currentOrderId), 500);
  }
}

async function completeAllDishes(orderId) {
  if (!confirm('✅ Xác nhận TẤT CẢ món đã nấu xong?')) return;
  
  const success = await updateOrderStatus(orderId, 'HOAN_THANH');
  if (success) {
    playSound('complete');
  }
}

function getCurrentTableName() {
  const modalTitle = document.getElementById('modal-title');
  if (!modalTitle) return null;
  
  const text = modalTitle.textContent;
  const match = text.match(/([^\s]+)\s+-\s+\d+\s+đơn hàng/);
  return match ? match[1] : null;
}

function getCurrentOrderId() {
  const modalTitle = document.getElementById('modal-title');
  if (!modalTitle) return null;
  
  const text = modalTitle.textContent;
  const match = text.match(/Đơn #(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (confirm('🚪 Đăng xuất khỏi hệ thống?')) {
      window.location.href = '/login';
    }
  });
  
  document.getElementById('order-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'order-modal') {
      closeModal();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === '1') switchTab('waiting');
    if (e.key === '2') switchTab('cooking');
    if (e.key === '3') switchTab('completed');
    if (e.key === 'Escape') closeModal();
    if (e.key === 'r' || e.key === 'R') {
      loadOrders();
      if (state.currentTab === 'completed') {
        loadCompletedHistory(100, window.currentHistoryType || 'day');
      }
    }
  });
}

function switchTab(tab) {
  state.currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });

  const historyFilter = document.getElementById('history-filter');
  if (historyFilter) {
    historyFilter.style.display = tab === 'completed' ? 'block' : 'none';
  }

  if (tab === 'completed') {
    loadCompletedHistory();
  } else {
    renderTables();
  }
}

window.currentHistoryType = 'day';

window.switchHistoryType = function (type) {
  console.log('🔁 Switch history type:', type);
  window.currentHistoryType = type;

  document.querySelectorAll('.history-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === type) {
      btn.classList.add('active');
    }
  });

  loadCompletedHistory(100, type);
};

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
  
  socket.on('dish_status_update', async (data) => {
    console.log('🍽️ Dish status updated:', data);
    await loadOrders();
    showToast(`${data.ten_mon}: ${data.trang_thai_text}`, 'info');
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
      ${(order.chi_tiet || []).map(item => `
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
// ═══════════════════════════════════════════════════════════════════════════

window.showTableOrders = showTableOrders;
window.showSingleOrder = showSingleOrder;
window.closeModal = closeModal;
window.startCookingDish = startCookingDish;
window.completeDish = completeDish;
window.startCookingAllDishes = startCookingAllDishes;
window.completeAllDishes = completeAllDishes;
window.printKitchenTicket = printKitchenTicket;

window.kitchenDebug = {
  state: () => console.table(state.stats),
  orders: () => console.table(state.orders),
  history: () => console.table(state.completedHistory),
  reload: () => loadOrders(),
  currentOrder: () => console.log(state.currentOrder)
};

if (!localStorage.getItem('kitchen_shortcuts_shown')) {
  setTimeout(() => {
    showToast(
      '⌨️ Phím tắt:\n1️⃣ Chờ làm\n2️⃣ Đang nấu\n3️⃣ Hoàn thành\nESC - Đóng modal\nR - Làm mới',
      'info'
    );
    localStorage.setItem('kitchen_shortcuts_shown', 'true');
  }, 2000);
}

console.log('🔥 Kitchen System v4.1 FIXED - Loaded Successfully!');
console.log('📌 Backend API: ' + API_BASE);
console.log('📌 Keyboard: 1 (Waiting), 2 (Cooking), 3 (Completed), ESC (Close), R (Refresh)');
console.log('🐛 Debug: kitchenDebug.state(), orders(), history()');