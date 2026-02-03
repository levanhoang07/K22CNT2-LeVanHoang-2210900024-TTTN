/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Admin System (Full Version)
 *  Tính năng: Dashboard, CRUD đầy đủ, Báo cáo, Quản lý toàn bộ hệ thống
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & STATE
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

const state = {
  currentSection: 'dashboard',
  dashboard: {
    revenue: 0,
    orders: 0,
    customers: 0,
    tablesBusy: 0,
    tablesTotal: 0
  },
  menu: [],
  categories: [],
  tables: [],
  promotions: [],
  customers: [],
  staff: [],
  reviews: [],
  currentItem: null
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🛠️ Admin System Started');
  
  await initialize();
  setupEventListeners();
  setupSocketListeners();
  
  console.log('✅ Admin System Ready');
});

async function initialize() {
  try {
    showLoading(true);
    await loadDashboard();
    showToast('✅ Hệ thống quản trị sẵn sàng!', 'success');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showToast('Lỗi khởi động hệ thống!', 'error');
  } finally {
    showLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION & SECTION SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  // Menu navigation
  document.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      switchSection(section);
    });
  });
  
  // Top buttons
  document.getElementById('btn-refresh').addEventListener('click', refreshCurrentSection);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  
  // Add buttons
  document.getElementById('btn-add-menu')?.addEventListener('click', () => openMenuModal());
  document.getElementById('btn-add-category')?.addEventListener('click', () => openCategoryModal());
  document.getElementById('btn-add-table')?.addEventListener('click', () => openTableModal());
  document.getElementById('btn-add-promotion')?.addEventListener('click', () => openPromotionModal());
  document.getElementById('btn-add-staff')?.addEventListener('click', () => openStaffModal());
}

function switchSection(section) {
  state.currentSection = section;
  
  // Update menu
  document.querySelectorAll('.menu-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === section) {
      link.classList.add('active');
    }
  });
  
  // Hide all sections
  document.querySelectorAll('.tab-content-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  // Show selected section
  document.getElementById(`section-${section}`).classList.add('active');
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    orders: 'Quản lý Đơn hàng',
    menu: 'Quản lý Menu',
    categories: 'Danh mục',
    tables: 'Quản lý Bàn',
    promotions: 'Khuyến mãi',
    customers: 'Khách hàng',
    reviews: 'Đánh giá',
    staff: 'Nhân viên',
    reports: 'Báo cáo',
    settings: 'Cài đặt'
  };
  document.getElementById('page-title').textContent = titles[section] || 'Admin';
  
  // Load section data
  loadSectionData(section);
}

async function loadSectionData(section) {
  switch(section) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'orders':
      await loadOrders();
      break;
    case 'menu':
      await loadMenu();
      break;
    case 'categories':
      await loadCategories();
      break;
    case 'tables':
      await loadTables();
      break;
    case 'promotions':
      await loadPromotions();
      break;
    case 'customers':
      await loadCustomers();
      break;
    case 'reviews':
      await loadReviews();
      break;
    case 'staff':
      await loadStaff();
      break;
    case 'reports':
      await loadReports();
      break;
  }
}

async function refreshCurrentSection() {
  showToast('🔄 Đang làm mới...', 'info');
  await loadSectionData(state.currentSection);
  showToast('✅ Đã làm mới!', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/admin/dashboard`);
    const result = await response.json();
    
    if (result.success) {
      state.dashboard = {
        revenue: result.data.doanh_thu_hom_nay || 0,
        orders: result.data.so_don_hang_hom_nay || 0,
        customers: 0,
        tablesBusy: result.data.ban_dang_dung || 0,
        tablesTotal: result.data.tong_mon || 0
      };
      
      renderDashboardStats();
      await loadRecentOrders();
      await loadTopDishes();
      await loadReports('month'); // Load báo cáo mặc định theo tháng
    }
  } catch (error) {
    console.error('❌ Load dashboard error:', error);
    showToast('Lỗi khi tải dashboard', 'error');
  }
}

function renderDashboardStats() {
  document.getElementById('stat-revenue').textContent = formatPrice(state.dashboard.revenue);
  document.getElementById('stat-orders').textContent = state.dashboard.orders;
  document.getElementById('stat-customers').textContent = state.dashboard.customers;
  document.getElementById('stat-tables-busy').textContent = state.dashboard.tablesBusy;
  document.getElementById('stat-tables-total').textContent = state.dashboard.tablesTotal;
}

async function loadRecentOrders() {
  try {
    const response = await fetch(`${API_BASE}/thungan/donhang`);
    const result = await response.json();
    
    if (result.success) {
      const orders = result.data.don_hang || [];
      const tbody = document.getElementById('recent-orders-tbody');
      
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Không có đơn hàng</td></tr>';
        return;
      }
      
      tbody.innerHTML = orders.slice(0, 5).map(order => `
        <tr>
          <td><strong>#${order.IDDonHang}</strong></td>
          <td>${order.TenBan}</td>
          <td>${order.SoMon} món</td>
          <td><strong>${formatPrice(order.TongTien)}</strong></td>
          <td>${formatDateTime(order.NgayTao)}</td>
          <td>
            <span class="badge-custom ${order.TrangThaiThanhToan ? 'badge-completed' : 'badge-pending'}">
              ${order.TrangThaiThanhToan ? 'Đã thanh toán' : 'Chờ thanh toán'}
            </span>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('❌ Load recent orders error:', error);
  }
}

async function loadTopDishes() {
  try {
    const response = await fetch(`${API_BASE}/admin/baocao/topmon?limit=5`);
    const result = await response.json();
    
    if (result.success) {
      const dishes = result.data.top_mon || [];
      const container = document.getElementById('top-dishes-list');
      
      if (dishes.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">Chưa có dữ liệu</p>';
        return;
      }
      
      container.innerHTML = dishes.map((dish, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8f9fa; border-radius: 12px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem;">
              ${index + 1}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 1.1rem;">${dish.TenMon}</div>
              <div style="color: #636e72; font-size: 0.9rem;">Đã bán: ${dish.TongSoLuong} phần</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 1.2rem; color: #00b894;">${formatPrice(dish.TongDoanhThu)}</div>
            <div style="color: #636e72; font-size: 0.85rem;">${dish.SoDonHang} đơn</div>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('❌ Load top dishes error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS (Tích hợp vào Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

async function loadReports(type = 'month') {
  try {
    showLoading(true);
    
    const today = new Date();
    let tuNgay, denNgay;

    denNgay = today.toISOString().split('T')[0];

    if (type === 'day') {
      // Báo cáo theo ngày (hôm nay)
      tuNgay = denNgay;
    } 
    else if (type === 'week') {
      // 7 ngày gần nhất
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      tuNgay = weekAgo.toISOString().split('T')[0];
    } 
    else {
      // Mặc định: tháng (30 ngày)
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 29);
      tuNgay = monthAgo.toISOString().split('T')[0];
    }
    
    // Load doanh thu theo thời gian
    const revenueResponse = await fetch(
      `${API_BASE}/admin/baocao/doanhthu?tu_ngay=${tuNgay}&den_ngay=${denNgay}`
    );
    const revenueResult = await revenueResponse.json();
    
    // Load doanh thu theo danh mục
    const categoryResponse = await fetch(
      `${API_BASE}/admin/baocao/danhmuc?tu_ngay=${tuNgay}&den_ngay=${denNgay}`
    );
    const categoryResult = await categoryResponse.json();
    
    if (revenueResult.success) {
      renderReports(revenueResult.data, categoryResult.success ? categoryResult.data : null);
    }
  } catch (error) {
    console.error('❌ Load reports error:', error);
    showToast('Lỗi khi tải báo cáo', 'error');
  } finally {
    showLoading(false);
  }
}

function renderReports(data, categoryData) {
  const container = document.getElementById('reports-content');
  
  container.innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="content-card text-center" style="padding: 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white;">
          <div style="font-size: 3rem; font-weight: 800; margin-bottom: 10px;">
            ${formatPrice(data.tong_doanh_thu)}
          </div>
          <div style="font-size: 1.2rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            Tổng doanh thu
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="content-card text-center" style="padding: 30px; background: linear-gradient(135deg, #00b894, #55efc4); color: white;">
          <div style="font-size: 3rem; font-weight: 800; margin-bottom: 10px;">
            ${data.tong_don_hang}
          </div>
          <div style="font-size: 1.2rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            Tổng đơn hàng
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="content-card text-center" style="padding: 30px; background: linear-gradient(135deg, #fdcb6e, #e17055); color: white;">
          <div style="font-size: 3rem; font-weight: 800; margin-bottom: 10px;">
            ${formatPrice(data.tong_doanh_thu / data.tong_don_hang || 0)}
          </div>
          <div style="font-size: 1.2rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            Trung bình/đơn
          </div>
        </div>
      </div>
    </div>
    
    <div class="row g-3 mb-4">
      <!-- Biểu đồ cột: Doanh thu theo ngày -->
      <div class="col-md-8">
        <div class="content-card">
          <h5 class="mb-4"><i class="fas fa-chart-line"></i> Doanh thu theo ngày</h5>
          <canvas id="revenue-chart" style="max-height: 400px;"></canvas>
        </div>
      </div>
      
      <!-- Biểu đồ tròn: Doanh thu theo danh mục -->
      <div class="col-md-4">
        <div class="content-card">
          <h5 class="mb-4"><i class="fas fa-chart-pie"></i> Theo danh mục</h5>
          <canvas id="category-chart" style="max-height: 400px;"></canvas>
        </div>
      </div>
    </div>
    
    <div class="content-card mt-4">
      <h5 class="mb-3"><i class="fas fa-table"></i> Chi tiết theo ngày</h5>
      <div class="table-responsive">
        <table class="table-custom">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số đơn hàng</th>
              <th>Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            ${data.chi_tiet.map(item => `
              <tr>
                <td>${formatDate(item.Ngay)}</td>
                <td><strong>${item.SoDonHang}</strong></td>
                <td><strong>${formatPrice(item.DoanhThu)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  // Render biểu đồ cột (doanh thu theo ngày)
  renderRevenueChart(data.chi_tiet);
  
  // Render biểu đồ tròn (doanh thu theo danh mục)
  if (categoryData && categoryData.danh_muc) {
    renderCategoryChart(categoryData.danh_muc);
  }
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx) return;

  // Xoá chart cũ nếu có (tránh bug render chồng)
  if (window.revenueChart) {
    window.revenueChart.destroy();
  }

  window.revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(item => formatDate(item.Ngay)),
      datasets: [
        {
          type: 'bar',
          label: 'Doanh thu',
          data: data.map(item => item.DoanhThu),
          backgroundColor: 'rgba(102, 126, 234, 0.7)',
          borderRadius: 8,
          barThickness: 22
        },
        {
          type: 'line',
          label: 'Xu hướng',
          data: data.map(item => item.DoanhThu),
          borderColor: '#ff7675',
          backgroundColor: 'rgba(255, 118, 117, 0.15)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return `${ctx.dataset.label}: ${formatPrice(ctx.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => formatPrice(value)
          },
          grid: {
            color: 'rgba(0,0,0,0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('category-chart');
  if (!ctx) return;

  // Xoá chart cũ nếu có
  if (window.categoryChart) {
    window.categoryChart.destroy();
  }

  // Màu sắc đẹp cho biểu đồ tròn
  const colors = [
    '#667eea',
    '#764ba2',
    '#f093fb',
    '#4facfe',
    '#00f2fe',
    '#43e97b',
    '#38f9d7',
    '#fa709a',
    '#fee140',
    '#30cfd0'
  ];

  window.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(item => item.TenDanhMuc),
      datasets: [{
        data: data.map(item => item.DoanhThu),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = formatPrice(context.parsed);
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}
// ═══════════════════════════════════════════════════════════════════════════
// ORDERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadOrders() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/thungan/donhang`);
    const result = await response.json();
    
    if (result.success) {
      const orders = result.data.don_hang || [];
      const container = document.getElementById('orders-content');
      
      if (orders.length === 0) {
        container.innerHTML = '<p class="text-center py-5">Không có đơn hàng nào</p>';
        return;
      }
      
      container.innerHTML = `
        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Bàn</th>
                <th>Số món</th>
                <th>Tổng tiền</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(order => `
                <tr>
                  <td><strong>#${order.IDDonHang}</strong></td>
                  <td>${order.TenBan}</td>
                  <td>${order.SoMon} món</td>
                  <td><strong>${formatPrice(order.TongTien)}</strong></td>
                  <td>${formatDateTime(order.NgayTao)}</td>
                  <td>
                    <span class="badge-custom ${order.TrangThaiThanhToan ? 'badge-completed' : 'badge-pending'}">
                      ${order.TrangThaiThanhToan ? 'Đã thanh toán' : 'Chờ thanh toán'}
                    </span>
                  </td>
                  <td>
                    <button class="btn-primary-custom btn-sm" onclick="viewOrderDetail(${order.IDDonHang})">
                      <i class="fas fa-eye"></i> Xem
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ Load orders error:', error);
    showToast('Lỗi khi tải danh sách đơn hàng', 'error');
  } finally {
    showLoading(false);
  }
}

async function viewOrderDetail(orderId) {
  try {
    const response = await fetch(`${API_BASE}/ban/donhang/${orderId}`);
    const result = await response.json();
    
    if (result.success) {
      const order = result.data;
      
      const modalBody = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h5><i class="fas fa-utensils"></i> ${order.TenBan}</h5>
          <p class="mb-1"><strong>Mã đơn:</strong> #${order.IDDonHang}</p>
          <p class="mb-0"><strong>Thời gian:</strong> ${formatDateTime(order.NgayTao)}</p>
        </div>
        
        <h6 class="mb-3"><strong>Chi tiết món:</strong></h6>
        ${order.chi_tiet.map(item => `
          <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <strong>${item.TenMon}</strong>
                <div style="font-size: 0.9rem; color: #636e72;">
                  ${item.CapDoCay ? `🌶️ ${item.CapDoCay}` : ''}
                  ${item.GhiChu ? `<br>📝 ${item.GhiChu}` : ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div>x${item.SoLuong}</div>
                <strong>${formatPrice(item.ThanhTien)}</strong>
              </div>
            </div>
          </div>
        `).join('')}
        
        <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); padding: 20px; border-radius: 12px; margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: 800;">
            <span>TỔNG CỘNG:</span>
            <span style="color: #667eea;">${formatPrice(order.TongTien)}</span>
          </div>
        </div>
      `;
      
      openModal('Chi tiết đơn hàng', modalBody);
    }
  } catch (error) {
    console.error('❌ View order detail error:', error);
    showToast('Lỗi khi xem chi tiết đơn hàng', 'error');
  }
}

async function loadCompletedOrders() {
  try {
    showLoading(true);

    const response = await fetch(`${API_BASE}/admin/donhang/hoanthanh`);
    const result = await response.json();

    const container = document.getElementById('orders-hoanthanh-content');

    if (!result.success || result.data.don_hang.length === 0) {
      container.innerHTML = '<p class="text-center py-5">Chưa có đơn hoàn thành</p>';
      return;
    }

    const orders = result.data.don_hang;

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table-custom">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Bàn</th>
              <th>Số món</th>
              <th>Tổng tiền</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td><strong>#${o.IDDonHang}</strong></td>
                <td>${o.TenBan}</td>
                <td>${o.SoMon} món</td>
                <td><strong>${formatPrice(o.TongTien)}</strong></td>
                <td>${formatDateTime(o.NgayTao)}</td>
                <td>
                  <span class="badge-custom badge-completed">
                    Đã thanh toán
                  </span>
                </td>
                <td>
                  <button class="btn-primary-custom btn-sm"
                          onclick="viewOrderDetail(${o.IDDonHang})">
                    <i class="fas fa-eye"></i> Xem
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error(err);
    showToast('Lỗi tải đơn hoàn thành', 'error');
  } finally {
    showLoading(false);
  }
}
document.querySelectorAll('.menu-link').forEach(link => {
  link.addEventListener('click', () => {
    const section = link.dataset.section;

    // active menu
    document.querySelectorAll('.menu-link')
      .forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // load đúng section
    switch (section) {
      case 'dashboard':
        loadDashboard();
        break;

      case 'orders':
        loadRecentOrders(); // dashboard orders (giữ nguyên)
        break;

      case 'orders-hoanthanh':
        loadCompletedOrders(); // ✅ đơn đã thanh toán
        break;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MENU MANAGEMENT - WITH ADVANCED SEARCH ✨
// Features: Debounce, Null-safe, Regex escape, Beautiful UI
// ═══════════════════════════════════════════════════════════════════════════

let menuSearchTimeout = null;

async function loadMenu() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/admin/menu`);
    const result = await response.json();
    
    if (result.success) {
      state.menu = result.data.menu || [];
      renderMenu();
    }
  } catch (error) {
    console.error('❌ Load menu error:', error);
    showToast('Lỗi khi tải menu', 'error');
  } finally {
    showLoading(false);
  }
}

function renderMenu(searchTerm = '') {
  const container = document.getElementById('menu-content');
  
  // Null-safe: Ensure menu exists
  if (!state.menu || state.menu.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-utensils" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px;"></i>
        <p style="font-size: 1.2rem; color: #64748b; font-weight: 600;">Chưa có món ăn nào</p>
      </div>
    `;
    return;
  }
  
  // Filter menu with null-safe checks
  let filteredMenu = state.menu;
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filteredMenu = state.menu.filter(item => {
      const tenMon = (item.TenMon || '').toLowerCase();
      const tenDanhMuc = (item.TenDanhMuc || '').toLowerCase();
      const moTa = (item.MoTa || '').toLowerCase();
      
      return tenMon.includes(term) || 
             tenDanhMuc.includes(term) || 
             moTa.includes(term);
    });
  }
  
  // Search bar HTML with beautiful design
  const searchBarHTML = `
    <div class="row mb-4 align-items-center">
      <div class="col-md-7">
        <div style="position: relative;">
          <div style="position: absolute; left: 18px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 8px; pointer-events: none;">
            <i class="fas fa-search" style="color: #667eea; font-size: 1.1rem;"></i>
          </div>
          <input 
            type="text" 
            id="menu-search-input" 
            class="form-control-custom" 
            placeholder="Tìm kiếm món ăn theo tên, danh mục hoặc mô tả..."
            style="
              padding-left: 50px; 
              padding-right: 50px;
              border: 2px solid #e2e8f0;
              transition: all 0.3s ease;
            "
            value="${escapeHtml(searchTerm)}"
            autocomplete="off">
          ${searchTerm ? `
            <button 
              onclick="clearMenuSearch()" 
              style="
                position: absolute; 
                right: 12px; 
                top: 50%; 
                transform: translateY(-50%);
                background: #f1f5f9;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                color: #64748b;
              "
              onmouseover="this.style.background='#e2e8f0'; this.style.color='#475569'"
              onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b'">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
        </div>
        <div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;">
          <i class="fas fa-lightbulb" style="color: #fbbf24; margin-right: 5px;"></i>
          Nhập từ khóa để lọc danh sách món ăn
        </div>
      </div>
      <div class="col-md-5 text-end">
        <div style="display: inline-flex; align-items: center; gap: 15px;">
          <div class="badge-custom" style="
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white;
            font-size: 0.95rem; 
            padding: 12px 20px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          ">
            <i class="fas fa-list-ul" style="margin-right: 8px;"></i>
            <strong>${filteredMenu.length}</strong> / ${state.menu.length} món
          </div>
        </div>
      </div>
    </div>
  `;
  
  // No results state
  if (filteredMenu.length === 0) {
    container.innerHTML = searchBarHTML + `
      <div class="text-center py-5" style="animation: fadeIn 0.3s ease;">
        <div style="
          width: 120px; 
          height: 120px; 
          margin: 0 auto 25px; 
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0); 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center;
        ">
          <i class="fas fa-search" style="font-size: 3rem; color: #cbd5e1;"></i>
        </div>
        <p style="font-size: 1.3rem; color: #475569; font-weight: 700; margin-bottom: 10px;">
          Không tìm thấy món ăn nào
        </p>
        <p style="color: #94a3b8; font-size: 1rem;">
          Thử tìm kiếm với từ khóa khác hoặc 
          <a href="#" onclick="clearMenuSearch(); return false;" style="color: #667eea; text-decoration: underline;">
            xóa bộ lọc
          </a>
        </p>
      </div>
    `;
    setupMenuSearch();
    return;
  }
  
  // Render table with results
  container.innerHTML = searchBarHTML + `
    <div class="table-responsive" style="animation: fadeIn 0.3s ease;">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 80px;">Hình ảnh</th>
            <th>Tên món</th>
            <th>Danh mục</th>
            <th style="width: 120px;">Giá</th>
            <th style="width: 250px;">Mô tả</th>
            <th style="width: 120px;">Trạng thái</th>
            <th style="width: 140px;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filteredMenu.map(item => `
            <tr style="transition: all 0.2s ease;">
              <td>
                <div style="
                  width: 60px; 
                  height: 60px; 
                  border-radius: 12px; 
                  overflow: hidden; 
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  transition: transform 0.2s ease;
                "
                onmouseover="this.style.transform='scale(1.1)'"
                onmouseout="this.style.transform='scale(1)'">
                  <img src="/static/images/${item.HinhAnh || 'no-image.jpg'}" 
                       style="width: 100%; height: 100%; object-fit: cover;"
                       onerror="this.src='/static/images/no-image.jpg'">
                </div>
              </td>
              <td>
                <strong style="font-size: 1.05rem; color: #1e293b;">
                  ${highlightText(item.TenMon || '', searchTerm)}
                </strong>
              </td>
              <td>
                <span style="
                  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                  color: #667eea;
                  padding: 6px 12px;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 0.9rem;
                ">
                  ${highlightText(item.TenDanhMuc || '', searchTerm)}
                </span>
              </td>
              <td>
                <strong style="font-size: 1.1rem; color: #10b981;">
                  ${formatPrice(item.Gia || 0)}
                </strong>
              </td>
              <td>
                <div style="
                  max-width: 250px; 
                  overflow: hidden; 
                  text-overflow: ellipsis; 
                  white-space: nowrap;
                  color: #64748b;
                " title="${escapeHtml(item.MoTa || '')}">
                  ${highlightText(item.MoTa || 'Chưa có mô tả', searchTerm)}
                </div>
              </td>
              <td>
                <span class="badge-custom ${item.TrangThai ? 'badge-active' : 'badge-inactive'}" style="
                  font-size: 0.85rem;
                  padding: 8px 14px;
                ">
                  <i class="fas fa-${item.TrangThai ? 'check-circle' : 'times-circle'}" style="margin-right: 5px;"></i>
                  ${item.TrangThai ? 'Đang bán' : 'Ngừng bán'}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <button 
                    class="btn-warning-custom btn-sm" 
                    onclick="editMenu(${item.IDMon})"
                    style="flex: 1;">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button 
                    class="btn-danger-custom btn-sm" 
                    onclick="deleteMenu(${item.IDMon})"
                    style="flex: 1;">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  setupMenuSearch();
}

// Setup debounced search
function setupMenuSearch() {
  const searchInput = document.getElementById('menu-search-input');
  if (!searchInput) return;
  
  // Add focus/blur effects
  searchInput.addEventListener('focus', function() {
    this.style.borderColor = '#667eea';
    this.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
  });
  
  searchInput.addEventListener('blur', function() {
    this.style.borderColor = '#e2e8f0';
    this.style.boxShadow = 'none';
  });
  
  // Debounced search (300ms delay)
  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value;
    
    // Clear previous timeout
    if (menuSearchTimeout) {
      clearTimeout(menuSearchTimeout);
    }
    
    // Set new timeout
    menuSearchTimeout = setTimeout(() => {
      renderMenu(searchTerm);
    }, 300);
  });
}

// Clear search function
function clearMenuSearch() {
  renderMenu('');
  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) {
    searchInput.focus();
  }
}

// Enhanced highlight function with regex escape
function highlightText(text, searchTerm) {
  if (!text) return '';
  if (!searchTerm || !searchTerm.trim()) return escapeHtml(text);
  
  // Escape special regex characters
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  try {
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    const escapedText = escapeHtml(text);
    
    return escapedText.replace(regex, 
      '<mark style="' +
        'background: linear-gradient(135deg, #fef08a, #fde047);' +
        'color: #854d0e;' +
        'padding: 3px 6px;' +
        'border-radius: 4px;' +
        'font-weight: 700;' +
        'box-shadow: 0 2px 4px rgba(251, 191, 36, 0.2);' +
      '">$1</mark>'
    );
  } catch (e) {
    return escapeHtml(text);
  }
}

// HTML escape helper
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function openMenuModal(id = null) {
  const isEdit = id !== null;
  let item = null;
  
  if (isEdit) {
    item = state.menu.find(m => m.IDMon === id);
    if (!item) return;
  }
  
  // Load categories for dropdown
  await loadCategories();
  
  const modalBody = `
    <form id="menu-form">
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-utensils" style="color: #667eea; margin-right: 8px;"></i>
          Tên món
        </label>
        <input type="text" class="form-control-custom" name="ten_mon" 
               value="${escapeHtml(item?.TenMon || '')}" 
               placeholder="VD: Mì cay Hàn Quốc"
               required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-list" style="color: #667eea; margin-right: 8px;"></i>
          Danh mục
        </label>
        <select class="form-control-custom" name="id_danh_muc" required>
          <option value="">-- Chọn danh mục --</option>
          ${state.categories.map(cat => `
            <option value="${cat.IDDanhMuc}" ${item?.IDDanhMuc === cat.IDDanhMuc ? 'selected' : ''}>
              ${escapeHtml(cat.TenDanhMuc)}
            </option>
          `).join('')}
        </select>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-tag" style="color: #667eea; margin-right: 8px;"></i>
          Giá (VNĐ)
        </label>
        <input type="number" class="form-control-custom" name="gia" 
               value="${item?.Gia || ''}" 
               placeholder="VD: 50000"
               min="0"
               step="1000"
               required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-align-left" style="color: #667eea; margin-right: 8px;"></i>
          Mô tả
        </label>
        <textarea class="form-control-custom" name="mo_ta" rows="3" 
                  placeholder="Mô tả ngắn về món ăn...">${escapeHtml(item?.MoTa || '')}</textarea>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-image" style="color: #667eea; margin-right: 8px;"></i>
          Hình ảnh (tên file)
        </label>
        <input type="text" class="form-control-custom" name="hinh_anh" 
               value="${escapeHtml(item?.HinhAnh || '')}" 
               placeholder="VD: miga.jpg">
        <small style="color: #94a3b8; margin-top: 5px; display: block;">
          <i class="fas fa-info-circle"></i> Tên file hình ảnh trong thư mục /static/images/
        </small>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">
          <i class="fas fa-toggle-on" style="color: #667eea; margin-right: 8px;"></i>
          Trạng thái
        </label>
        <select class="form-control-custom" name="trang_thai">
          <option value="1" ${item?.TrangThai === 1 ? 'selected' : ''}>✅ Đang bán</option>
          <option value="0" ${item?.TrangThai === 0 ? 'selected' : ''}>⛔ Ngừng bán</option>
        </select>
      </div>
      
      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="btn-success-custom flex-fill">
          <i class="fas fa-save"></i> ${isEdit ? 'Cập nhật' : 'Thêm mới'}
        </button>
        <button type="button" class="btn-secondary flex-fill" onclick="closeModal()">
          <i class="fas fa-times"></i> Hủy
        </button>
      </div>
    </form>
  `;
  
  openModal(isEdit ? 'Chỉnh sửa món ăn' : 'Thêm món mới', modalBody);
  
  document.getElementById('menu-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const success = isEdit ? await updateMenu(id, data) : await createMenu(data);
    if (success) {
      closeModal();
      await loadMenu();
    }
  });
}

async function createMenu(data) {
  try {
    const response = await fetch(`${API_BASE}/admin/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Thêm món thành công!', 'success');
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Create menu error:', error);
    showToast('Lỗi khi thêm món: ' + error.message, 'error');
    return false;
  }
}

async function updateMenu(id, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Cập nhật món thành công!', 'success');
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Update menu error:', error);
    showToast('Lỗi khi cập nhật món: ' + error.message, 'error');
    return false;
  }
}

async function deleteMenu(id) {
  if (!confirm('🗑️ Xác nhận xóa món ăn này?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/admin/menu/${id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Xóa món thành công!', 'success');
      await loadMenu();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Delete menu error:', error);
    showToast('Lỗi khi xóa món: ' + error.message, 'error');
  }
}

function editMenu(id) {
  openMenuModal(id);
}

// Add fadeIn animation to CSS if not exists
if (!document.getElementById('menu-animations')) {
  const style = document.createElement('style');
  style.id = 'menu-animations';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/admin/danhmuc`);
    const result = await response.json();
    
    if (result.success) {
      state.categories = result.data.danh_muc || [];
      if (state.currentSection === 'categories') {
        renderCategories();
      }
    }
  } catch (error) {
    console.error('❌ Load categories error:', error);
  }
}

function renderCategories() {
  const container = document.getElementById('categories-content');
  
  if (state.categories.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có danh mục nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="row g-3">
      ${state.categories.map(cat => `
        <div class="col-md-4">
          <div class="content-card" style="padding: 20px;">
            <h5 class="mb-3">${cat.TenDanhMuc}</h5>
            <div class="d-flex gap-2">
              <button class="btn-warning-custom btn-sm" onclick="editCategory(${cat.IDDanhMuc})">
                <i class="fas fa-edit"></i> Sửa
              </button>
              <button class="btn-danger-custom btn-sm" onclick="deleteCategory(${cat.IDDanhMuc})">
                <i class="fas fa-trash"></i> Xóa
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function openCategoryModal(id = null) {
  const isEdit = id !== null;
  let item = null;
  
  if (isEdit) {
    item = state.categories.find(c => c.IDDanhMuc === id);
    if (!item) return;
  }
  
  const modalBody = `
    <form id="category-form">
      <div class="form-group-custom">
        <label class="form-label-custom">Tên danh mục</label>
        <input type="text" class="form-control-custom" name="ten_danh_muc" 
               value="${item?.TenDanhMuc || ''}" required>
      </div>
      
      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="btn-success-custom flex-fill">
          <i class="fas fa-save"></i> ${isEdit ? 'Cập nhật' : 'Thêm mới'}
        </button>
        <button type="button" class="btn-secondary flex-fill" onclick="closeModal()">
          <i class="fas fa-times"></i> Hủy
        </button>
      </div>
    </form>
  `;
  
  openModal(isEdit ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới', modalBody);
  
  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const success = isEdit ? await updateCategory(id, data) : await createCategory(data);
    if (success) {
      closeModal();
      await loadCategories();
    }
  });
}

async function createCategory(data) {
  try {
    const response = await fetch(`${API_BASE}/admin/danhmuc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Thêm danh mục thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Create category error:', error);
    showToast('Lỗi khi thêm danh mục', 'error');
    return false;
  }
}

async function updateCategory(id, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/danhmuc/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Cập nhật danh mục thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Update category error:', error);
    showToast('Lỗi khi cập nhật danh mục', 'error');
    return false;
  }
}

async function deleteCategory(id) {
  if (!confirm('🗑️ Xác nhận xóa danh mục này?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/admin/danhmuc/${id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Xóa danh mục thành công!', 'success');
      await loadCategories();
    }
  } catch (error) {
    console.error('❌ Delete category error:', error);
    showToast('Lỗi khi xóa danh mục', 'error');
  }
}

function editCategory(id) {
  openCategoryModal(id);
}
// ═══════════════════════════════════════════════════════════════════════════
// TABLES MANAGEMENT - FIXED VERSION ✅
// ═══════════════════════════════════════════════════════════════════════════

async function loadTables() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/admin/ban`);
    const result = await response.json();
    
    if (result.success) {
      state.tables = result.data.ban || [];
      renderTables();
    }
  } catch (error) {
    console.error('❌ Load tables error:', error);
    showToast('Lỗi khi tải danh sách bàn', 'error');
  } finally {
    showLoading(false);
  }
}

function renderTables() {
  const container = document.getElementById('tables-content');
  
  if (state.tables.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có bàn nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="row g-3">
      ${state.tables.map(table => `
        <div class="col-md-4 col-lg-3">
          <div class="content-card" style="padding: 20px; text-align: center;">
            <!-- Tên bàn -->
            <div style="width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 800;">
              ${table.TenBan}
            </div>
            
            <!-- Trạng thái -->
            <div class="mb-3">
              <span class="badge-custom ${table.TrangThai === 'Trống' ? 'badge-active' : 'badge-inactive'}">
                ${table.TrangThai}
              </span>
            </div>
            
            <!-- QR Code -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
              <div style="font-size: 0.85rem; color: #636e72; margin-bottom: 10px; font-weight: 600;">
                <i class="fas fa-qrcode"></i> Mã QR
              </div>
              <div id="qrcode-${table.IDBan}" style="display: flex; justify-content: center; margin-bottom: 10px;"></div>
            </div>
            
            <!-- Link truy cập -->
            <div style="background: #e8f5e9; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
              <div style="font-size: 0.75rem; color: #2e7d32; font-weight: 600; margin-bottom: 5px;">
                🔗 Link đặt món
              </div>
              <input type="text" 
                     value="http://localhost:5000/?ban=${table.IDBan}" 
                     readonly 
                     class="form-control-custom" 
                     style="font-size: 0.75rem; padding: 5px; text-align: center;"
                     onclick="this.select()">
            </div>
            
            <!-- Buttons -->
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn-warning-custom btn-sm" onclick="editTable(${table.IDBan})">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-danger-custom btn-sm" onclick="deleteTable(${table.IDBan})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Generate QR codes after rendering
  state.tables.forEach(table => {
    generateQRCode(table.IDBan);
  });
}

function generateQRCode(idBan) {
  const el = document.getElementById(`qrcode-${idBan}`);
  if (!el) return;

  el.innerHTML = '';

  const orderUrl = `https://unglamorous-lahoma-insolvable.ngrok-free.dev/qr?ban=${idBan}`;

  new QRCode(el, {
    text: orderUrl,
    width: 140,
    height: 140,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

async function openTableModal(id = null) {
  const isEdit = id !== null;
  let item = null;
  
  if (isEdit) {
    item = state.tables.find(t => t.IDBan === id);
    if (!item) return;
  }
  
  const modalBody = `
    <form id="table-form">
      <div class="form-group-custom">
        <label class="form-label-custom">Tên bàn</label>
        <input type="text" class="form-control-custom" name="ten_ban" 
               value="${item?.TenBan || ''}" required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">Mã QR</label>
        <input type="text" class="form-control-custom" name="ma_qr" 
               value="${item?.MaQR || ''}" placeholder="Tự động tạo nếu để trống">
      </div>
      
      ${isEdit ? `
        <div class="form-group-custom">
          <label class="form-label-custom">Trạng thái</label>
          <select class="form-control-custom" name="trang_thai">
            <option value="Trống" ${item?.TrangThai === 'Trống' ? 'selected' : ''}>Trống</option>
            <option value="Đang dùng" ${item?.TrangThai === 'Đang dùng' ? 'selected' : ''}>Đang dùng</option>
          </select>
        </div>
      ` : ''}
      
      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="btn-success-custom flex-fill">
          <i class="fas fa-save"></i> ${isEdit ? 'Cập nhật' : 'Thêm mới'}
        </button>
        <button type="button" class="btn-secondary flex-fill" onclick="closeModal()">
          <i class="fas fa-times"></i> Hủy
        </button>
      </div>
    </form>
  `;
  
  openModal(isEdit ? 'Chỉnh sửa bàn' : 'Thêm bàn mới', modalBody);
  
  document.getElementById('table-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const success = isEdit ? await updateTable(id, data) : await createTable(data);
    if (success) {
      closeModal();
      await loadTables();
    }
  });
}

async function createTable(data) {
  try {
    const response = await fetch(`${API_BASE}/admin/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Thêm bàn thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Create table error:', error);
    showToast('Lỗi khi thêm bàn', 'error');
    return false;
  }
}

async function updateTable(id, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/ban/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Cập nhật bàn thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Update table error:', error);
    showToast('Lỗi khi cập nhật bàn', 'error');
    return false;
  }
}

async function deleteTable(id) {
  if (!confirm('🗑️ Xác nhận xóa bàn này?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/admin/ban/${id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Xóa bàn thành công!', 'success');
      await loadTables();
    }
  } catch (error) {
    console.error('❌ Delete table error:', error);
    showToast('Lỗi khi xóa bàn', 'error');
  }
}

function editTable(id) {
  openTableModal(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTIONS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadPromotions() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/admin/khuyenmai`);
    const result = await response.json();
    
    if (result.success) {
      state.promotions = result.data.khuyen_mai || [];
      renderPromotions();
    }
  } catch (error) {
    console.error('❌ Load promotions error:', error);
    showToast('Lỗi khi tải danh sách khuyến mãi', 'error');
  } finally {
    showLoading(false);
  }
}

function renderPromotions() {
  const container = document.getElementById('promotions-content');
  
  if (state.promotions.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có khuyến mãi nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom">
        <thead>
          <tr>
            <th>Tên khuyến mãi</th>
            <th>Loại giảm giá</th>
            <th>Giá trị</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${state.promotions.map(promo => `
            <tr>
              <td><strong>${promo.TenKhuyenMai}</strong></td>
              <td>${promo.LoaiGiamGia === 'PhanTram' ? 'Phần trăm' : 'Số tiền'}</td>
              <td><strong>${promo.LoaiGiamGia === 'PhanTram' ? promo.GiaTri + '%' : formatPrice(promo.GiaTri)}</strong></td>
              <td>
                <span class="badge-custom ${promo.TrangThai ? 'badge-active' : 'badge-inactive'}">
                  ${promo.TrangThai ? 'Đang áp dụng' : 'Tạm dừng'}
                </span>
              </td>
              <td>
                <button class="btn-warning-custom btn-sm" onclick="editPromotion(${promo.IDKhuyenMai})">
                  <i class="fas fa-edit"></i>
                </button>
                
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openPromotionModal(id = null) {
  const isEdit = id !== null;
  let item = null;
  
  if (isEdit) {
    item = state.promotions.find(p => p.IDKhuyenMai === id);
    if (!item) return;
  }
  
  const modalBody = `
    <form id="promotion-form">
      <div class="form-group-custom">
        <label class="form-label-custom">Tên khuyến mãi</label>
        <input type="text" class="form-control-custom" name="ten_khuyen_mai" 
               value="${item?.TenKhuyenMai || ''}" required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">Loại giảm giá</label>
        <select class="form-control-custom" name="loai_giam_gia" required>
          <option value="PhanTram" ${item?.LoaiGiamGia === 'PhanTram' ? 'selected' : ''}>Phần trăm (%)</option>
          <option value="SoTien" ${item?.LoaiGiamGia === 'SoTien' ? 'selected' : ''}>Số tiền (VNĐ)</option>
        </select>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">Giá trị</label>
        <input type="number" class="form-control-custom" name="gia_tri" 
               value="${item?.GiaTri || ''}" required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">Trạng thái</label>
        <select class="form-control-custom" name="trang_thai">
          <option value="1" ${item?.TrangThai === 1 ? 'selected' : ''}>Đang áp dụng</option>
          <option value="0" ${item?.TrangThai === 0 ? 'selected' : ''}>Tạm dừng</option>
        </select>
      </div>
      
      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="btn-success-custom flex-fill">
          <i class="fas fa-save"></i> ${isEdit ? 'Cập nhật' : 'Thêm mới'}
        </button>
        <button type="button" class="btn-secondary flex-fill" onclick="closeModal()">
          <i class="fas fa-times"></i> Hủy
        </button>
      </div>
    </form>
  `;
  
  openModal(isEdit ? 'Chỉnh sửa khuyến mãi' : 'Thêm khuyến mãi mới', modalBody);
  
  document.getElementById('promotion-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const success = isEdit ? await updatePromotion(id, data) : await createPromotion(data);
    if (success) {
      closeModal();
      await loadPromotions();
    }
  });
}

async function createPromotion(data) {
  try {
    const response = await fetch(`${API_BASE}/admin/khuyenmai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Thêm khuyến mãi thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Create promotion error:', error);
    showToast('Lỗi khi thêm khuyến mãi', 'error');
    return false;
  }
}
async function updatePromotion(id, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/khuyenmai/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
      showToast(result.message || 'Không thể cập nhật', 'error');
      return false;
    }

    showToast('✅ Cập nhật khuyến mãi thành công!', 'success');
    return true;

  } catch (error) {
    console.error('❌ Update promotion error:', error);
    showToast('Lỗi khi cập nhật khuyến mãi', 'error');
    return false;
  }
}
async function deletePromotion(id) {
  if (!confirm('🗑️ Xác nhận xóa khuyến mãi này?')) return;

  try {
    const response = await fetch(`${API_BASE}/admin/khuyenmai/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!result.success) {
      showToast(result.message || 'Không thể xóa', 'error');
      return;
    }

    showToast('✅ Xóa khuyến mãi thành công!', 'success');
    await loadPromotions();

  } catch (error) {
    console.error('❌ Delete promotion error:', error);
    showToast('Lỗi khi xóa khuyến mãi', 'error');
  }
}

function editPromotion(id) {
  openPromotionModal(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadCustomers() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/khachhang`);
    const result = await response.json();
    
    if (result.success) {
      state.customers = result.data.khach_hang || [];
      renderCustomers();
    }
  } catch (error) {
    console.error('❌ Load customers error:', error);
    showToast('Lỗi khi tải danh sách khách hàng', 'error');
  } finally {
    showLoading(false);
  }
}

function renderCustomers() {
  const container = document.getElementById('customers-content');
  
  if (state.customers.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có khách hàng nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên khách hàng</th>
            <th>Số điện thoại</th>
            <th>Điểm tích lũy</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${state.customers.map(customer => `
            <tr>
              <td><strong>#${customer.IDKhachHang}</strong></td>
              <td>${customer.TenKhachHang || 'Chưa cập nhật'}</td>
              <td>${customer.SoDienThoai}</td>
              <td><strong style="color: #667eea;">${customer.DiemTichLuy} điểm</strong></td>
              <td>
                <button class="btn-primary-custom btn-sm" onclick="viewCustomerDetail(${customer.IDKhachHang}, '${customer.SoDienThoai}')">
                  <i class="fas fa-eye"></i> Chi tiết
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function viewCustomerDetail(id, phone) {
  try {
    const response = await fetch(`${API_BASE}/khachhang/${phone}`);
    const result = await response.json();
    
    if (result.success) {
      const customer = result.data;
      
      const modalBody = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <h5>${customer.TenKhachHang || 'Khách hàng'}</h5>
          <p class="mb-1"><strong>SĐT:</strong> ${customer.SoDienThoai}</p>
          <p class="mb-0"><strong>Điểm tích lũy:</strong> <span style="color: #667eea; font-size: 1.3rem; font-weight: 800;">${customer.DiemTichLuy} điểm</span></p>
        </div>
        
        <h6 class="mb-3"><strong>Lịch sử tích điểm:</strong></h6>
        ${customer.lich_su_tich_diem.length > 0 ? `
          <div style="max-height: 400px; overflow-y: auto;">
            ${customer.lich_su_tich_diem.map(item => `
              <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div><strong>+${item.SoDiem} điểm</strong></div>
                    <div style="font-size: 0.9rem; color: #636e72;">${formatDateTime(item.ThoiGian)}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: 700;">${formatPrice(item.TongTien)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-muted text-center py-4">Chưa có lịch sử tích điểm</p>'}
      `;
      
      openModal('Thông tin khách hàng', modalBody);
    }
  } catch (error) {
    console.error('❌ View customer detail error:', error);
    showToast('Lỗi khi xem thông tin khách hàng', 'error');
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadReviews() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/danhgia`);
    const result = await response.json();
    
    if (result.success) {
      state.reviews = result.data.danh_gia || [];
      renderReviews();
    }
  } catch (error) {
    console.error('❌ Load reviews error:', error);
    showToast('Lỗi khi tải danh sách đánh giá', 'error');
  } finally {
    showLoading(false);
  }
}

function renderReviews() {
  const container = document.getElementById('reviews-content');
  
  if (state.reviews.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có đánh giá nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="row g-3">
      ${state.reviews.map(review => `
        <div class="col-md-6">
          <div class="content-card" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
              <div>
                <h6 class="mb-1">${review.TenKhachHang || 'Khách ẩn danh'}</h6>
                <small class="text-muted">${review.TenBan || 'Không rõ bàn'}</small>
              </div>
              <small class="text-muted">${formatDateTime(review.NgayDanhGia)}</small>
            </div>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 0;">
              ${review.NoiDung}
            </p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAFF MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function loadStaff() {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/admin/nguoidung`);
    const result = await response.json();
    
    if (result.success) {
      state.staff = result.data.nguoi_dung || [];
      renderStaff();
    }
  } catch (error) {
    console.error('❌ Load staff error:', error);
    showToast('Lỗi khi tải danh sách nhân viên', 'error');
  } finally {
    showLoading(false);
  }
}

function renderStaff() {
  const container = document.getElementById('staff-content');
  
  if (state.staff.length === 0) {
    container.innerHTML = '<p class="text-center py-5">Chưa có nhân viên nào</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table-custom">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên đăng nhập</th>
            <th>Họ tên</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${state.staff.map(staff => `
            <tr>
              <td><strong>#${staff.IDNguoiDung}</strong></td>
              <td>${staff.TenDangNhap}</td>
              <td>${staff.HoTen}</td>
              <td>
                <span class="badge-custom" style="background: ${getRoleBadgeColor(staff.VaiTro)};">
                  ${getRoleText(staff.VaiTro)}
                </span>
              </td>
              <td>
                <span class="badge-custom ${staff.TrangThai ? 'badge-active' : 'badge-inactive'}">
                  ${staff.TrangThai ? 'Đang làm việc' : 'Đã nghỉ'}
                </span>
              </td>
              <td>${formatDateTime(staff.NgayTao)}</td>
              <td>
                <button class="btn-warning-custom btn-sm" onclick="editStaff(${staff.IDNguoiDung})">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger-custom btn-sm" onclick="deleteStaff(${staff.IDNguoiDung})">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getRoleBadgeColor(role) {
  const colors = {
    'Admin': '#667eea',
    'ThuNgan': '#00b894',
    'Bep': '#d63031'
  };
  return colors[role] || '#636e72';
}

function getRoleText(role) {
  const texts = {
    'Admin': 'Quản trị',
    'ThuNgan': 'Thu ngân',
    'Bep': 'Bếp'
  };
  return texts[role] || role;
}

async function openStaffModal(id = null) {
  const isEdit = id !== null;
  let item = null;
  
  if (isEdit) {
    item = state.staff.find(s => s.IDNguoiDung === id);
    if (!item) return;
  }
  
  const modalBody = `
    <form id="staff-form">
      <div class="form-group-custom">
        <label class="form-label-custom">Tên đăng nhập</label>
        <input type="text" class="form-control-custom" name="ten_dang_nhap" 
               value="${item?.TenDangNhap || ''}" required ${isEdit ? 'readonly' : ''}>
      </div>
      
      ${!isEdit ? `
        <div class="form-group-custom">
          <label class="form-label-custom">Mật khẩu</label>
          <input type="password" class="form-control-custom" name="mat_khau" required>
        </div>
      ` : ''}
      
      <div class="form-group-custom">
        <label class="form-label-custom">Họ tên</label>
        <input type="text" class="form-control-custom" name="ho_ten" 
               value="${item?.HoTen || ''}" required>
      </div>
      
      <div class="form-group-custom">
        <label class="form-label-custom">Vai trò</label>
        <select class="form-control-custom" name="vai_tro" required>
          <option value="Admin" ${item?.VaiTro === 'Admin' ? 'selected' : ''}>Quản trị</option>
          <option value="ThuNgan" ${item?.VaiTro === 'ThuNgan' ? 'selected' : ''}>Thu ngân</option>
          <option value="Bep" ${item?.VaiTro === 'Bep' ? 'selected' : ''}>Bếp</option>
        </select>
      </div>
      
      ${isEdit ? `
        <div class="form-group-custom">
          <label class="form-label-custom">Trạng thái</label>
          <select class="form-control-custom" name="trang_thai">
            <option value="1" ${item?.TrangThai === 1 ? 'selected' : ''}>Đang làm việc</option>
            <option value="0" ${item?.TrangThai === 0 ? 'selected' : ''}>Đã nghỉ</option>
          </select>
        </div>
      ` : ''}
      
      <div class="d-flex gap-2 mt-4">
        <button type="submit" class="btn-success-custom flex-fill">
          <i class="fas fa-save"></i> ${isEdit ? 'Cập nhật' : 'Thêm mới'}
        </button>
        <button type="button" class="btn-secondary flex-fill" onclick="closeModal()">
          <i class="fas fa-times"></i> Hủy
        </button>
      </div>
    </form>
  `;
  
  openModal(isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới', modalBody);
  
  document.getElementById('staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const success = isEdit ? await updateStaff(id, data) : await createStaff(data);
    if (success) {
      closeModal();
      await loadStaff();
    }
  });
}

async function createStaff(data) {
  try {
    const response = await fetch(`${API_BASE}/admin/nguoidung`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Thêm nhân viên thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Create staff error:', error);
    showToast('Lỗi khi thêm nhân viên', 'error');
    return false;
  }
}

async function updateStaff(id, data) {
  try {
    const response = await fetch(`${API_BASE}/admin/nguoidung/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Cập nhật nhân viên thành công!', 'success');
      return true;
    }
  } catch (error) {
    console.error('❌ Update staff error:', error);
    showToast('Lỗi khi cập nhật nhân viên', 'error');
    return false;
  }
}

async function deleteStaff(id) {
  if (!confirm('🗑️ Xác nhận xóa nhân viên này?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/admin/nguoidung/${id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ Xóa nhân viên thành công!', 'success');
      await loadStaff();
    }
  } catch (error) {
    console.error('❌ Delete staff error:', error);
    showToast('Lỗi khi xóa nhân viên', 'error');
  }
}

function editStaff(id) {
  openStaffModal(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════

function setupSocketListeners() {
  socket.on('connect', () => {
    console.log('✅ Socket connected');
  });
  
  socket.on('new_order', () => {
    if (state.currentSection === 'dashboard') {
      loadDashboard();
    }
  });
  
  socket.on('order_paid', () => {
    if (state.currentSection === 'dashboard') {
      loadDashboard();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function openModal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-form').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-form').classList.remove('show');
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

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
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
      <i class="fas fa-${getToastIcon(type)}" style="font-size: 1.5rem;"></i>
      <div style="flex: 1;">
        <strong>${getToastTitle(type)}</strong>
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
    info: 'info-circle'
  };
  return icons[type] || 'info-circle';
}

function getToastTitle(type) {
  const titles = {
    success: 'Thành công',
    error: 'Lỗi',
    info: 'Thông báo'
  };
  return titles[type] || 'Thông báo';
}

function handleLogout() {
  if (confirm('🚪 Đăng xuất khỏi hệ thống?')) {
    window.location.href = '/login';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS (Called from HTML)
// ═══════════════════════════════════════════════════════════════════════════

window.switchSection = switchSection;
window.closeModal = closeModal;
window.viewOrderDetail = viewOrderDetail;
window.editMenu = editMenu;
window.deleteMenu = deleteMenu;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.editTable = editTable;
window.deleteTable = deleteTable;
window.editPromotion = editPromotion;
window.deletePromotion = deletePromotion;
window.viewCustomerDetail = viewCustomerDetail;
window.editStaff = editStaff;
window.deleteStaff = deleteStaff;

console.log('🛠️ Admin System Loaded Successfully!');
console.log('📊 Dashboard: Quản lý toàn diện hệ thống');
console.log('🎯 Features: Menu, Bàn, Đơn hàng, Khuyến mãi, Nhân viên, Báo cáo');
