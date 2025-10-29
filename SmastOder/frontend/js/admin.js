document.addEventListener("DOMContentLoaded", () => {

  // ==== API Base URL Configuration ====
  // Backend Flask chạy trên port 5000
  const API_BASE = "http://127.0.0.1:5000";
  console.log("API Base URL:", API_BASE);
// Kết nối Socket.IO
const socket = io(API_BASE);


  // Nhận tín hiệu gọi nhân viên
socket.on("staff_call", (data) => {
  const msg = `⚠️ Bàn ${data.table} vừa gọi nhân viên!`;
  console.warn(msg);
  alert(msg);
});

  // ==== Spinner/Loading ====
  function showSpinner() {
    const spinner = document.getElementById("loading-spinner");
    if (spinner) spinner.style.display = "flex";
  }

  function hideSpinner() {
    const spinner = document.getElementById("loading-spinner");
    if (spinner) spinner.style.display = "none";
  }

  // ==== Tab Navigation ====
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");
  
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach(sec => sec.classList.remove("active"));
      const targetSection = document.getElementById(btn.dataset.target);
      if (targetSection) targetSection.classList.add("active");
    });
  });

  // ==== QUẢN LÝ MENU ====
  const menuTableBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  // Load danh sách món ăn
  async function loadMenu() {
    showSpinner();
    try {
      const url = `${API_BASE}/api/admin/menu`;
      console.log("Fetching menu from:", url);
      const res = await fetch(url);
      console.log("Menu API response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải menu`);
      
      const data = await res.json();
      console.log("Menu data loaded:", data);
      menuTableBody.innerHTML = "";
      
      if (data.length === 0) {
        menuTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#64748b;">Chưa có món ăn nào</td></tr>';
      } else {
        data.forEach(item => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>
              <div class="food-name">
                ${item.HinhAnh ? `<img src="${API_BASE}/static/images/${item.HinhAnh}" alt="${item.TenMon}" class="food-thumb">` : ''}
                <span>${item.TenMon}</span>
              </div>
            </td>
            <td><strong>${item.Gia.toLocaleString()} ₫</strong></td>
            <td><span class="badge badge-category">${item.DanhMuc}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn-edit" onclick="openMenuModal(${item.IDMon}, '${escapeHtml(item.TenMon)}', ${item.Gia}, '${escapeHtml(item.DanhMuc)}', '${item.HinhAnh || ''}')">
                  <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="btn-delete" onclick="deleteMenu(${item.IDMon})">
                  <i class="fas fa-trash"></i> Xóa
                </button>
              </div>
            </td>
          `;
          menuTableBody.appendChild(tr);
        });
      }
      
      if (statMenu) statMenu.textContent = data.length;
    } catch (e) {
      console.error("Lỗi load menu:", e);
      console.error("Chi tiết:", e.message);
      showNotification("Lỗi khi tải danh sách món ăn: " + e.message, "error");
      menuTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#ef4444;">Lỗi tải dữ liệu: ' + e.message + '</td></tr>';
    } finally {
      hideSpinner();
    }
  }

  // Xóa món ăn
  window.deleteMenu = async function(id) {
    if (!confirm("Bạn có chắc muốn xóa món này không?")) return;
    
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/menu/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Không thể xóa món");
      
      showNotification("Xóa món thành công!", "success");
      await loadMenu();
    } catch (e) {
      console.error("Lỗi xóa món:", e);
      showNotification("Lỗi khi xóa món ăn", "error");
    } finally {
      hideSpinner();
    }
  }

  // Mở modal thêm/sửa món
  window.openMenuModal = function(id = null, ten = "", gia = 0, dm = "", ha = "") {
    editingMenuId = id;
    document.getElementById("menu-ten").value = ten;
    document.getElementById("menu-gia").value = gia;
    document.getElementById("menu-danhmuc").value = dm;
    document.getElementById("menu-hinhanh").value = ha;
    document.getElementById("menu-modal-title").textContent = id ? "Sửa món ăn" : "Thêm món mới";
    document.getElementById("menu-modal").classList.add("show");
  }

  // Đóng modal món ăn
  function closeMenuModal() {
    document.getElementById("menu-modal").classList.remove("show");
    editingMenuId = null;
  }

  // Lưu món ăn (thêm/sửa)
  document.getElementById("menu-save-btn")?.addEventListener("click", async () => {
    const tenMon = document.getElementById("menu-ten").value.trim();
    const gia = parseFloat(document.getElementById("menu-gia").value);
    const danhMuc = document.getElementById("menu-danhmuc").value.trim();
    const hinhAnh = document.getElementById("menu-hinhanh").value.trim();

    // Validate
    if (!tenMon) {
      showNotification("Vui lòng nhập tên món", "warning");
      return;
    }
    if (!gia || gia <= 0) {
      showNotification("Giá phải lớn hơn 0", "warning");
      return;
    }
    if (!danhMuc) {
      showNotification("Vui lòng chọn danh mục", "warning");
      return;
    }

    const data = {
      TenMon: tenMon,
      Gia: gia,
      DanhMuc: danhMuc,
      HinhAnh: hinhAnh
    };

    showSpinner();
    try {
      let res;
      if (editingMenuId) {
        // Sửa món
        res = await fetch(`${API_BASE}/api/admin/menu/${editingMenuId}`, {
          method: "PUT",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Thêm món mới
        res = await fetch(`${API_BASE}/api/admin/menu`, {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      if (!res.ok) throw new Error("Không thể lưu món");

      showNotification(editingMenuId ? "Cập nhật món thành công!" : "Thêm món thành công!", "success");
      closeMenuModal();
      await loadMenu();
    } catch (e) {
      console.error("Lỗi lưu món:", e);
      showNotification("Lỗi khi lưu món ăn", "error");
    } finally {
      hideSpinner();
    }
  });

  // Nút thêm món mới
  document.getElementById("add-food")?.addEventListener("click", () => openMenuModal());

  // Đóng modal khi click nút đóng hoặc click ngoài modal
  document.querySelectorAll(".modal-close, .btn-cancel").forEach(btn => {
    btn.addEventListener("click", function() {
      this.closest(".modal").classList.remove("show");
    });
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", function(e) {
      if (e.target === this) {
        this.classList.remove("show");
      }
    });
  });

  // ==== QUẢN LÝ BÀN ====
  const tableBody = document.querySelector("#table-list tbody");
  const statTable = document.getElementById("stat-table");
  const qrResult = document.getElementById("qr-result");
  const qrLink = document.getElementById("qr-link");

  // Load danh sách bàn
  async function loadTables() {
    showSpinner();
    try {
      const url = `${API_BASE}/api/admin/table`;
      console.log("Fetching tables from:", url);
      const res = await fetch(url);
      console.log("Table API response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải danh sách bàn`);
      
      const data = await res.json();
      console.log("Table data loaded:", data);
      tableBody.innerHTML = "";
      
      if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#64748b;">Chưa có bàn nào</td></tr>';
      } else {
        data.forEach(table => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>Bàn ${table.IDBan}</strong></td>
            <td>${table.TenBan}</td>
            <td>
              ${table.QRPath ? 
                `<img src="${API_BASE}/static/images/${table.QRPath}" alt="QR ${table.TenBan}" class="qr-thumb">` : 
                '<span style="color:#94a3b8;">Chưa có QR</span>'
              }
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-view" onclick="showQR('${table.QRPath}', ${table.IDBan}, '${escapeHtml(table.TenBan)}')">
                  <i class="fas fa-qrcode"></i> QR
                </button>
                <button class="btn-delete" onclick="deleteTable(${table.IDBan})">
                  <i class="fas fa-trash"></i> Xóa
                </button>
              </div>
            </td>
          `;
          tableBody.appendChild(tr);
        });
      }
      
      if (statTable) statTable.textContent = data.length;
    } catch (e) {
      console.error("Lỗi load bàn:", e);
      console.error("Chi tiết:", e.message);
      showNotification("Lỗi khi tải danh sách bàn: " + e.message, "error");
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#ef4444;">Lỗi tải dữ liệu: ' + e.message + '</td></tr>';
    } finally {
      hideSpinner();
    }
  }

  // Xóa bàn
  window.deleteTable = async function(id) {
    if (!confirm(`Bạn có chắc muốn xóa bàn ${id} không?`)) return;
    
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/table/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Không thể xóa bàn");
      
      showNotification("Xóa bàn thành công!", "success");
      await loadTables();
    } catch (e) {
      console.error("Lỗi xóa bàn:", e);
      showNotification("Lỗi khi xóa bàn", "error");
    } finally {
      hideSpinner();
    }
  }

  // Hiển thị QR code
  window.showQR = function(path, id, tenBan) {
    qrResult.innerHTML = "";
    
    if (path) {
      // Nếu bạn có thư viện QRCode.js
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrResult, {
          text: `${API_BASE}/khach?table=${id}`,
          width: 256,
          height: 256
        });
      } else {
        // Fallback: hiển thị ảnh QR có sẵn
        const img = document.createElement('img');
        img.src = `${API_BASE}/static/images/${path}`;
        img.alt = `QR ${tenBan}`;
        img.style.maxWidth = '256px';
        qrResult.appendChild(img);
      }
    } else {
      qrResult.innerHTML = '<p style="color:#94a3b8;">Chưa có mã QR</p>';
    }
    
    qrLink.innerHTML = `
      <strong>${tenBan || `Bàn ${id}`}</strong><br>
      Link: <a href="${API_BASE}/khach?table=${id}" target="_blank">
        ${API_BASE}/khach?table=${id}
      </a>
    `;
    
    document.getElementById("qr-modal").classList.add("show");
  }

  // Mở modal thêm bàn
  document.getElementById("add-table")?.addEventListener("click", () => {
    document.getElementById("table-modal").classList.add("show");
  });

  // Lưu bàn mới
  document.getElementById("table-save-btn")?.addEventListener("click", async () => {
    const tenBan = document.getElementById("table-ten").value.trim();
    const baseUrl = document.getElementById("table-base-url").value.trim();

    // Validate
    if (!tenBan) {
      showNotification("Vui lòng nhập tên bàn", "warning");
      return;
    }

    const data = {
      TenBan: tenBan,
      base_url: baseUrl || API_BASE
    };

    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/table`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error("Không thể tạo bàn");

      showNotification("Thêm bàn thành công!", "success");
      document.getElementById("table-modal").classList.remove("show");
      document.getElementById("table-ten").value = "";
      document.getElementById("table-base-url").value = "";
      await loadTables();
    } catch (e) {
      console.error("Lỗi tạo bàn:", e);
      showNotification("Lỗi khi tạo bàn", "error");
    } finally {
      hideSpinner();
    }
  });

  // Đóng modal QR
  document.getElementById("qr-modal-close")?.addEventListener("click", () => {
    document.getElementById("qr-modal").classList.remove("show");
  });

  // ==== BÁO CÁO & THỐNG KÊ ====
  async function loadReport(period = "day") {
    showSpinner();
    try {
      const url = `${API_BASE}/api/report?period=${period}`;
      console.log("Fetching report from:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Không thể tải báo cáo");
      
      const data = await res.json();
      
      const statOrders = document.getElementById("stat-orders");
      const statRevenue = document.getElementById("stat-revenue");
      
      if (statOrders) statOrders.textContent = data.totalOrders || 0;
      if (statRevenue) statRevenue.textContent = (data.totalRevenue || 0).toLocaleString() + " ₫";
      
    } catch (e) {
      console.error("Lỗi load báo cáo:", e);
      showNotification("Lỗi khi tải báo cáo", "error");
    } finally {
      hideSpinner();
    }
  }

  // Thay đổi kỳ báo cáo
  document.getElementById("report-period")?.addEventListener("change", (e) => {
    loadReport(e.target.value);
  });

  // ==== TIỆN ÍCH ====
  
  // Escape HTML để tránh XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'");
  }

  // Hiển thị thông báo
  function showNotification(message, type = "info") {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Tự động ẩn sau 3s
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ==== KHỞI TẠO ====
  loadMenu();
  loadTables();
  loadReport();

  // Tự động refresh mỗi 30s
  setInterval(() => {
    const activeTab = document.querySelector("nav button.active");
    if (activeTab) {
      const target = activeTab.dataset.target;
      if (target === "menu-section") loadMenu();
      else if (target === "table-section") loadTables();
      else if (target === "report-section") loadReport(document.getElementById("report-period")?.value || "day");
    }
  }, 30000);

  console.log("✅ Admin panel initialized successfully!");
});