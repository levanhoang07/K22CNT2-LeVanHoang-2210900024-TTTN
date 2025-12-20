// ==================================================
// ADMIN DASHBOARD – MyCay_Oder
// ==================================================

const socket = io();

// ================== GLOBAL ==================
let currentSection = "dashboard";

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  loadDashboard();
  loadCategories();
  loadMenu();
  loadTables();
  loadUsers();
  loadCustomers();
  loadPromotions();
  loadPayments();
  loadNotifications();
});

// ================== SIDEBAR ==================
function initSidebar() {
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();

      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const section = item.dataset.section;
      showSection(section);
    });
  });
}

function showSection(name) {
  currentSection = name;
  document.getElementById("page-title").textContent =
    name.charAt(0).toUpperCase() + name.slice(1);

  document.querySelectorAll(".content-section").forEach(sec =>
    sec.classList.remove("active")
  );

  document.getElementById(`section-${name}`)?.classList.add("active");
}

// ================== DASHBOARD ==================
async function loadDashboard() {
  try {
    const res = await fetch("/api/admin/dashboard");
    const data = await res.json();

    document.getElementById("stat-revenue").textContent =
      formatPrice(data.revenue || 0);
    document.getElementById("stat-orders").textContent = data.orders || 0;
    document.getElementById("stat-menu-items").textContent = data.menu || 0;
    document.getElementById("stat-tables").textContent = data.tables || 0;

    renderRevenueChart(data.chart || []);
    renderRecentOrders(data.recentOrders || []);
  } catch (e) {
    console.error("Dashboard error", e);
  }
}

function renderRevenueChart(rows) {
  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map(r => r.Ngay),
      datasets: [{
        label: "Doanh thu",
        data: rows.map(r => r.DoanhThu),
        fill: true,
        tension: 0.3
      }]
    }
  });
}

function renderRecentOrders(rows) {
  const tbody = document.querySelector("#recent-orders-table tbody");
  tbody.innerHTML = "";

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Không có đơn</td></tr>`;
    return;
  }

  rows.forEach(o => {
    tbody.innerHTML += `
      <tr>
        <td>#${o.IDDonHang}</td>
        <td>Bàn ${o.IDBan}</td>
        <td>${formatPrice(o.TongTien)}</td>
        <td>${o.TrangThaiThanhToan ? "Đã TT" : "Chưa TT"}</td>
      </tr>
    `;
  });
}

// ================== MENU ==================
async function loadMenu() {
  const grid = document.getElementById("menu-grid");
  if (!grid) return;

  grid.innerHTML = `<div class="loading-state">Đang tải...</div>`;

  const res = await fetch("/api/admin/menu");
  const data = await res.json();

  grid.innerHTML = "";

  data.forEach(m => {
    grid.innerHTML += `
      <div class="menu-card">
        <img src="${m.HinhAnh}">
        <h4>${m.TenMon}</h4>
        <p>${formatPrice(m.Gia)}</p>
        <small>${m.TenDanhMuc}</small>
      </div>
    `;
  });
}

// ================== CATEGORIES ==================
async function loadCategories() {
  const tbody = document.querySelector("#categories-table tbody");
  if (!tbody) return;

  const res = await fetch("/api/admin/danhmuc");
  const data = await res.json();

  tbody.innerHTML = "";
  data.forEach(d => {
    tbody.innerHTML += `
      <tr>
        <td>${d.IDDanhMuc}</td>
        <td>${d.TenDanhMuc}</td>
        <td>${d.SoMon || 0}</td>
        <td>—</td>
      </tr>
    `;
  });

  // fill select menu-category
  const sel = document.getElementById("menu-category");
  if (sel) {
    sel.innerHTML = data.map(
      d => `<option value="${d.IDDanhMuc}">${d.TenDanhMuc}</option>`
    ).join("");
  }
}

// ================== TABLES ==================
async function loadTables() {
  const grid = document.getElementById("tables-grid");
  if (!grid) return;

  const res = await fetch("/api/admin/ban");
  const data = await res.json();

  grid.innerHTML = "";

  data.forEach(b => {
    grid.innerHTML += `
      <div class="table-card">
        <h4>${b.TenBan}</h4>
        <p>${b.TrangThai}</p>
        <small>?ban=${b.IDBan}</small>
      </div>
    `;
  });
}

// ================== USERS ==================
async function loadUsers() {
  const tbody = document.querySelector("#users-table tbody");
  if (!tbody) return;

  const res = await fetch("/api/admin/users");
  const data = await res.json();

  tbody.innerHTML = "";
  data.forEach(u => {
    tbody.innerHTML += `
      <tr>
        <td>${u.IDNguoiDung}</td>
        <td>${u.TenDangNhap}</td>
        <td>${u.HoTen}</td>
        <td>${u.VaiTro}</td>
        <td>${u.TrangThai ? "Hoạt động" : "Khóa"}</td>
        <td>${u.NgayTao}</td>
        <td>—</td>
      </tr>
    `;
  });
}

// ================== CUSTOMERS ==================
async function loadCustomers() {
  const tbody = document.querySelector("#customers-table tbody");
  if (!tbody) return;

  const res = await fetch("/api/admin/khachhang");
  const data = await res.json();

  tbody.innerHTML = "";
  data.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.IDKhachHang}</td>
        <td>${c.TenKhachHang}</td>
        <td>${c.SoDienThoai}</td>
        <td>${c.DiemTichLuy}</td>
        <td>—</td>
      </tr>
    `;
  });
}

// ================== PROMOTIONS ==================
async function loadPromotions() {
  const tbody = document.querySelector("#promotions-table tbody");
  if (!tbody) return;

  const res = await fetch("/api/admin/khuyenmai");
  const data = await res.json();

  tbody.innerHTML = "";
  data.forEach(km => {
    tbody.innerHTML += `
      <tr>
        <td>${km.IDKhuyenMai}</td>
        <td>${km.TenKhuyenMai}</td>
        <td>${km.LoaiGiamGia}</td>
        <td>${km.GiaTri}</td>
        <td>${km.TrangThai ? "ON" : "OFF"}</td>
        <td>—</td>
      </tr>
    `;
  });
}

// ================== PAYMENTS ==================
async function loadPayments() {
  const tbody = document.querySelector("#payments-table tbody");
  if (!tbody) return;

  const res = await fetch("/api/admin/thanhtoan");
  const data = await res.json();

  tbody.innerHTML = "";
  data.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.IDThanhToan}</td>
        <td>#${p.IDDonHang}</td>
        <td>${p.TenPhuongThuc}</td>
        <td>${formatPrice(p.SoTien)}</td>
        <td>${p.ThoiGian}</td>
      </tr>
    `;
  });
}

// ================== NOTIFICATIONS ==================
async function loadNotifications() {
  const box = document.getElementById("notifications-list");
  if (!box) return;

  const res = await fetch("/api/admin/thongbao");
  const data = await res.json();

  box.innerHTML = "";
  data.forEach(n => {
    box.innerHTML += `
      <div class="notification-item ${n.TrangThai ? "" : "unread"}">
        <b>Bàn ${n.IDBan}</b>
        <p>${n.NoiDung}</p>
        <small>${n.ThoiGian}</small>
      </div>
    `;
  });
}

// ================== UTIL ==================
function formatPrice(v) {
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

// ================== SOCKET ==================
socket.on("new_order", () => {
  loadDashboard();
  loadNotifications();
});
