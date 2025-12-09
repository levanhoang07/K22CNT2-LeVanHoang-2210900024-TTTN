document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://127.0.0.1:5000";
  const socket = io(API_BASE);
  const FALLBACK_IMG = `${API_BASE}/static/images/no-image.jpg`;

  // ===== Spinner =====
  const spinner = document.getElementById("loading-spinner");
  const showSpinner = () => spinner && (spinner.style.display = "flex");
  const hideSpinner = () => spinner && (spinner.style.display = "none");

  // ===== Notification =====
  const showNotification = (msg, type="info") => {
    const n = document.createElement("div");
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${
      type==='success' ? 'check-circle'
      : type==='error' ? 'exclamation-circle'
      : type==='warning' ? 'exclamation-triangle'
      : 'info-circle'
    }"></i> <span>${msg}</span>`;
    document.body.appendChild(n);

    setTimeout(()=> n.classList.add("show"), 20);
    setTimeout(()=> {
      n.classList.remove("show");
      setTimeout(()=> n.remove(), 300);
    }, 3000);
  };

  const escapeHtml = text => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'");
  };

  const getImageSrc = path => {
    if (!path) return FALLBACK_IMG;
    return path.startsWith("http") ? path : `${API_BASE}/static/${path.replace(/^\/+/, "")}`;
  };

  // ===== Tabs =====
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");
  let currentTab = "menu-section";

  function switchTab(targetId) {
    currentTab = targetId;
    tabs.forEach(b => b.classList.toggle("active", b.dataset.target === targetId));
    sections.forEach(sec => sec.classList.toggle("active", sec.id === targetId));

    if (targetId === "menu-section") loadMenu();
    if (targetId === "table-section") loadTables();
    if (targetId === "report-section") loadReportCharts();
  }

  tabs.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.target)));

  // ==== Tìm kiếmm =====
function setupSearch(inputId, tableId, colIndexes = []) {
  const input = document.getElementById(inputId);
  const tableBody = document.querySelector(`#${tableId} tbody`);

  input.addEventListener("input", () => {
    const filter = input.value.toLowerCase();

    [...tableBody.rows].forEach(row => {
      const text = colIndexes.length
        ? colIndexes.map(i => row.cells[i]?.textContent.toLowerCase() || "").join(" ")
        : row.textContent.toLowerCase();

      row.style.display = text.includes(filter) ? "" : "none";
    });
  });
}

// Khởi tạo
setupSearch("staff-search-input", "staff-table", [0]);    
setupSearch("table-search-input", "table-table", [0,1]);    
setupSearch("order-search-input", "order-table", [1]);    
setupSearch("menu-search-input", "menu-table", [0]);     

  // ===== MENU =====
  const menuBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  async function loadMenu() {
    if (currentTab !== "menu-section") return;
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/menu`);
      const data = await res.json();

      menuBody.innerHTML = data.length
        ? ""
        : `<tr><td colspan="6" style="text-align:center;color:#64748b;">Chưa có món ăn</td></tr>`;

      data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div class="food-name">
              <img src="${getImageSrc(item.HinhAnh)}" class="food-thumb" 
                onerror="this.onerror=null; this.src='${FALLBACK_IMG}'">
              <span>${escapeHtml(item.TenMon)}</span>
            </div>
          </td>
          <td><strong>${item.Gia.toLocaleString()} ₫</strong></td>
          <td><span class="badge badge-category">${escapeHtml(item.DanhMuc || "")}</span></td>
          <td>${escapeHtml(item.MoTa || "—")}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit"
                onclick="openMenuModal(${item.IDMon},
                  '${escapeHtml(item.TenMon)}',
                  ${item.Gia},
                  '${escapeHtml(item.DanhMuc)}',
                  '${escapeHtml(item.HinhAnh || "")}',
                  '${escapeHtml(item.MoTa || "")}')">
                <i class="fas fa-edit"></i> Sửa
              </button>

              <button class="btn-delete" onclick="deleteMenu(${item.IDMon})">
                <i class="fas fa-trash"></i> Xóa
              </button>
            </div>
          </td>
        `;
        menuBody.appendChild(tr);
      });

      statMenu && (statMenu.textContent = data.length);
    } catch (e) {
      showNotification("Lỗi tải menu", "error");
    } finally {
      hideSpinner();
    }
  }

  window.deleteMenu = async id => {
    if (!confirm("Bạn có chắc muốn xóa món?")) return;
    showSpinner();
    try {
      await fetch(`${API_BASE}/api/admin/menu/${id}`, { method: "DELETE" });
      showNotification("Xóa món thành công!", "success");
      loadMenu();
    } catch {
      showNotification("Lỗi xóa món", "error");
    } finally {
      hideSpinner();
    }
  };

  window.openMenuModal = (id=null, ten="", gia=0, dm="", ha="", mt="") => {
    editingMenuId = id;
    document.getElementById("menu-ten").value = ten;
    document.getElementById("menu-gia").value = gia;
    document.getElementById("menu-danhmuc").value = dm;
    document.getElementById("menu-hinhanh").value = ha;
    document.getElementById("menu-mota").value = mt;

    document.getElementById("menu-modal-title").textContent =
      id ? "Sửa món" : "Thêm món mới";

    document.getElementById("menu-modal").classList.add("show");
  };

  document.getElementById("menu-save-btn")?.addEventListener("click", async () => {
    const ten = document.getElementById("menu-ten").value.trim();
    const gia = parseFloat(document.getElementById("menu-gia").value);
    const dm = document.getElementById("menu-danhmuc").value.trim();
    const ha = document.getElementById("menu-hinhanh").value.trim();
    const mt = document.getElementById("menu-mota").value.trim();

    if (!ten) return showNotification("Nhập tên món", "warning");
    if (!gia || gia <= 0) return showNotification("Giá phải > 0", "warning");

    showSpinner();
    try {
      const body = { TenMon: ten, Gia: gia, DanhMuc: dm, HinhAnh: ha, MoTa: mt };

      const res = editingMenuId
        ? await fetch(`${API_BASE}/api/admin/menu/${editingMenuId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
        : await fetch(`${API_BASE}/api/admin/menu`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });

      if (!res.ok) throw new Error();

      showNotification(editingMenuId ? "Cập nhật thành công!" : "Thêm món thành công!", "success");
      document.getElementById("menu-modal").classList.remove("show");
      editingMenuId = null;
      loadMenu();

    } catch {
      showNotification("Lỗi lưu món", "error");
    } finally {
      hideSpinner();
    }
  });

  document.getElementById("add-food")?.addEventListener("click", () => openMenuModal());

  // ===== TABLE =====
  const tableBody = document.querySelector("#table-list tbody");
  const statTable = document.getElementById("stat-table");
  const qrResult = document.getElementById("qr-result");
  const qrLink = document.getElementById("qr-link");
  let editingTableId = null;

  async function loadTables() {
    if (currentTab !== "table-section") return;
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/table`);
      const data = await res.json();

      tableBody.innerHTML = data.length
        ? ""
        : `<tr><td colspan="4" style="text-align:center;color:#64748b;">Chưa có bàn nào</td></tr>`;

      data.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>Bàn ${t.IDBan}</strong></td>
          <td>${escapeHtml(t.TenBan)}</td>
          <td><button class="btn-view" onclick="showQR('${t.MaQR}', ${t.IDBan}, '${escapeHtml(t.TenBan)}')"><i class="fas fa-qrcode"></i> QR</button></td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" onclick="openTableModal(${t.IDBan}, '${escapeHtml(t.TenBan)}')">
                <i class="fas fa-edit"></i> Sửa
              </button>
              <button class="btn-delete" onclick="deleteTable(${t.IDBan})">
                <i class="fas fa-trash"></i> Xóa
              </button>
            </div>
          </td>
        `;
        tableBody.appendChild(tr);
      });

      statTable && (statTable.textContent = data.length);
    } catch {
      showNotification("Lỗi tải bàn", "error");
    } finally {
      hideSpinner();
    }
  }

  window.openTableModal = (id=null, ten="") => {
    editingTableId = id;
    document.getElementById("table-ten").value = ten;
    document.getElementById("table-modal-title").textContent = id ? "Sửa bàn" : "Thêm bàn mới";
    document.getElementById("table-modal").classList.add("show");
  };

  document.getElementById("add-table")?.addEventListener("click", () => openTableModal());

  document.getElementById("table-save-btn")?.addEventListener("click", async () => {
    const ten = document.getElementById("table-ten").value.trim();
    if (!ten) return showNotification("Nhập tên bàn", "warning");

    showSpinner();
    try {
      const body = { TenBan: ten };

      const res = editingTableId
        ? await fetch(`${API_BASE}/api/admin/table/${editingTableId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
        : await fetch(`${API_BASE}/api/admin/table`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });

      if (!res.ok) throw new Error();

      showNotification(editingTableId ? "Cập nhật bàn thành công!" : "Thêm bàn thành công!", "success");
      document.getElementById("table-modal").classList.remove("show");
      loadTables();
      editingTableId = null;

    } catch {
      showNotification("Lỗi lưu bàn", "error");
    } finally {
      hideSpinner();
    }
  });

  window.deleteTable = async id => {
    if (!confirm(`Xóa bàn ${id}?`)) return;
    showSpinner();
    try {
      await fetch(`${API_BASE}/api/admin/table/${id}`, { method: "DELETE" });
      showNotification("Xóa bàn thành công!", "success");
      loadTables();
    } catch {
      showNotification("Lỗi xóa bàn", "error");
    } finally {
      hideSpinner();
    }
  };

  // ===== QR Modal =====
  window.showQR = (path, id, tenBan) => {
    qrResult.innerHTML = "";
    qrLink.innerHTML = "";

    const baseUrl = `${window.location.protocol}//${window.location.host}/frontend`;
    const qrText = `${baseUrl}/index.html?ban=${id}`;

    const qrContainer = document.createElement("div");
    new QRCode(qrContainer, { text: qrText, width: 256, height: 256 });
    qrResult.appendChild(qrContainer);

    qrLink.innerHTML = `<strong>${tenBan || `Bàn ${id}`}</strong><br>
      Link: <a href="${qrText}" target="_blank">${qrText}</a>`;

    document.getElementById("qr-modal").classList.add("show");
  };

  // ===== Close modal =====
  document.querySelectorAll(".modal-close, .btn-cancel").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      modal && modal.classList.remove("show");
    });
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.classList.remove("show");
    });
  });

  // ===== REPORT CHARTS =====
  let chartPaidUnpaid = null;
  let chartCategory = null;

  async function loadReportCharts() {
    showSpinner();
    const period = document.getElementById("report-period")?.value || "day";

    // Chart 1 – Paid vs Unpaid
    try {
      const res1 = await fetch(`${API_BASE}/api/report/total-paid-unpaid?period=${period}`);
      const data1 = await res1.json();

      const paid = parseFloat(data1.Paid || 0);
      const unpaid = parseFloat(data1.Unpaid || 0);

      const ctx1 = document.getElementById("chart-paid-unpaid")?.getContext("2d");
      if (ctx1) {
        if (chartPaidUnpaid) chartPaidUnpaid.destroy();
        chartPaidUnpaid = new Chart(ctx1, {
          type: "doughnut",
          data: {
            labels: ["Đã thanh toán", "Chưa thanh toán"],
            datasets: [{
              data: [paid, unpaid],
              backgroundColor: ["#34d399", "#f87171"]
            }]
          },
          options: { responsive: true }
        });
      }
    } catch {
      console.warn("Không tải được biểu đồ Paid/Unpaid");
    }

    // Chart 2 – Revenue by category
    try {
      const res2 = await fetch(`${API_BASE}/api/report/revenue-by-category?period=${period}`);
      let data2 = await res2.json();

      if (!Array.isArray(data2)) data2 = [];

      const labels = data2.map(d => d.DanhMuc || "Khác");
      const values = data2.map(d => parseFloat(d.DoanhThu || 0));

      const ctx2 = document.getElementById("chart-category")?.getContext("2d");
      if (ctx2) {
        if (chartCategory) chartCategory.destroy();
        chartCategory = new Chart(ctx2, {
          type: "doughnut",
          data: {
            labels,
            datasets: [{
              data: values,
              backgroundColor: ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6"]
            }]
          },
          options: { responsive: true }
        });
      }
    } catch {
      console.warn("Không tải được biểu đồ Doanh thu");
    }

    hideSpinner();
  }

  document.getElementById("report-period")?.addEventListener("change", loadReportCharts);

// ===== STAFF =====
const staffBody = document.querySelector("#staff-table-body");
let editingStaffId = null;

// Hàm tải danh sách nhân sự
async function loadStaff() {
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/staff`);
    const data = await res.json();

    staffBody.innerHTML = data.length
      ? ""
      : `<tr><td colspan="6" style="text-align:center;color:#64748b;">Chưa có nhân sự</td></tr>`;

    data.forEach((s, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(s.HoTen)}</td>
        <td>${escapeHtml(s.TenDangNhap)}</td>
        <td>${escapeHtml(s.MatKhau || "")}</td>
        <td>${escapeHtml(s.VaiTro)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-edit" onclick="openStaffModal(${s.IDNguoiDung},
              '${escapeHtml(s.HoTen)}',
              '${escapeHtml(s.TenDangNhap)}',
              '${escapeHtml(s.MatKhau || "")}',
              '${escapeHtml(s.VaiTro)}')">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn-delete" onclick="deleteStaff(${s.IDNguoiDung})">
              <i class="fas fa-trash"></i> Xóa
            </button>
          </div>
        </td>
      `;
      staffBody.appendChild(tr);
    });
  } catch {
    showNotification("Lỗi tải nhân sự", "error");
  } finally {
    hideSpinner();
  }
}

// Hàm xóa nhân sự
window.deleteStaff = async id => {
  if (!confirm("Bạn có chắc muốn xóa nhân sự này?")) return;
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/staff/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    showNotification("Xóa nhân sự thành công!", "success");
    loadStaff();
  } catch {
    showNotification("Lỗi xóa nhân sự", "error");
  } finally {
    hideSpinner();
  }
};

// Hàm mở modal thêm/sửa nhân sự
window.openStaffModal = (id = null, fullname = "", username = "", password = "", role = "") => {
  editingStaffId = id;
  document.getElementById("staff-fullname").value = fullname;
  document.getElementById("staff-username").value = username;
  document.getElementById("staff-password").value = password;
  document.getElementById("staff-role").value = role;

  document.getElementById("staff-modal-title").textContent =
    id ? "Sửa nhân sự" : "Thêm nhân sự mới";

  document.getElementById("staff-modal").classList.add("show");
};

// Nút thêm nhân sự
document.getElementById("add-staff-btn")?.addEventListener("click", () => openStaffModal());

// Lưu nhân sự (thêm hoặc sửa)
document.getElementById("staff-save-btn")?.addEventListener("click", async () => {
  const fullname = document.getElementById("staff-fullname").value.trim();
  const username = document.getElementById("staff-username").value.trim();
  const password = document.getElementById("staff-password").value.trim();
  const role = document.getElementById("staff-role").value.trim();

  if (!fullname) return showNotification("Nhập họ tên", "warning");
  if (!username) return showNotification("Nhập tên đăng nhập", "warning");
  if (!password) return showNotification("Nhập mật khẩu", "warning");
  if (!role) return showNotification("Chọn vai trò", "warning");

  showSpinner();
  try {
    const body = { HoTen: fullname, TenDangNhap: username, MatKhau: password, VaiTro: role };
    const res = editingStaffId
      ? await fetch(`${API_BASE}/api/admin/staff/${editingStaffId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      : await fetch(`${API_BASE}/api/admin/staff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

    if (!res.ok) throw new Error();
    showNotification(editingStaffId ? "Cập nhật thành công!" : "Thêm nhân sự thành công!", "success");
    document.getElementById("staff-modal").classList.remove("show");
    editingStaffId = null;
    loadStaff();
  } catch {
    showNotification("Lỗi lưu nhân sự", "error");
  } finally {
    hideSpinner();
  }
});


// ===== ORDER =====
const orderBody = document.querySelector("#order-table tbody");
let editingOrderId = null;

// Load danh sách đơn
async function loadOrders() {
  if (currentTab !== "order-section") return;
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/donhang`);
    const data = await res.json();

    orderBody.innerHTML = data.length
      ? ""
      : `<tr><td colspan="5" style="text-align:center;color:#64748b;">Chưa có đơn hàng</td></tr>`;

    data.forEach(o => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.IDDonHang}</td>
        <td>${escapeHtml(o.IDBan || "")}</td>
        <td>${parseFloat(o.TongTien || 0).toLocaleString()} ₫</td>
        <td>${new Date(o.NgayTao).toLocaleString()}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-view" onclick="viewOrder(${o.IDDonHang})">
              <i class="fas fa-eye"></i> Xem
            </button>
            <button class="btn-edit" onclick="editOrder(${o.IDDonHang})">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn-delete" onclick="deleteOrder(${o.IDDonHang})">
              <i class="fas fa-trash"></i> Xóa
            </button>
          </div>
        </td>
      `;
      orderBody.appendChild(tr);
    });
    // Cập nhật tổng đơn
const statOrder = document.getElementById("stat-order");
statOrder && (statOrder.textContent = data.length);


  } catch {
    showNotification("Lỗi tải đơn hàng", "error");
  } finally {
    hideSpinner();
  }
}

// Xem chi tiết đơn
window.viewOrder = async id => {
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/donhang/${id}`);
    const data = await res.json();

    const body = document.getElementById("order-detail-body");
    body.innerHTML = `
      <p><strong>Bàn:</strong> ${escapeHtml(data.IDBan)}</p>
      <p><strong>Thời gian:</strong> ${new Date(data.NgayTao).toLocaleString()}</p>
      <p><strong>Tổng tiền:</strong> ${parseFloat(data.TongTien).toLocaleString()} ₫</p>
      <p><strong>Ghi chú:</strong> ${escapeHtml(data.GhiChu || "")}</p>
      <p><strong>Danh sách món:</strong></p>
      <ul>
        ${data.Items.map(m => `<li>${escapeHtml(m.TenMon)} x ${m.SoLuong} - ${(m.DonGia*m.SoLuong).toLocaleString()} ₫</li>`).join("")}
      </ul>
    `;
    document.getElementById("order-detail-modal").classList.add("show");
  } catch {
    showNotification("Lỗi tải chi tiết đơn", "error");
  } finally {
    hideSpinner();
  }
};

// Sửa đơn (chỉ bàn & số lượng món)
window.editOrder = async id => {
  editingOrderId = id;
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/donhang/${id}`);
    const data = await res.json();

    document.getElementById("order-edit-table").value = data.IDBan;
    const container = document.getElementById("order-edit-items");
    container.innerHTML = data.Items.map(m => `
      <div>
        ${escapeHtml(m.TenMon)} x 
        <input type="number" value="${m.SoLuong}" min="1" data-id="${m.IDMon}" style="width:60px;">
      </div>
    `).join("");

    document.getElementById("order-edit-modal").classList.add("show");
  } catch {
    showNotification("Lỗi tải đơn hàng để sửa", "error");
  } finally {
    hideSpinner();
  }
};

// Cập nhật đơn
document.getElementById("order-update-btn")?.addEventListener("click", async () => {
  if (!editingOrderId) return;
  showSpinner();
  try {
    const idban = document.getElementById("order-edit-table").value;
    const items = [...document.getElementById("order-edit-items").querySelectorAll("input")].map(inp => ({
      IDMon: parseInt(inp.dataset.id),
      SoLuong: parseInt(inp.value)
    }));

    const res = await fetch(`${API_BASE}/api/admin/donhang/${editingOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDBan: idban, Items: items })
    });

    if (!res.ok) throw new Error();

    showNotification("Cập nhật đơn thành công", "success");
    document.getElementById("order-edit-modal").classList.remove("show");
    editingOrderId = null;
    loadOrders();
  } catch {
    showNotification("Lỗi cập nhật đơn", "error");
  } finally {
    hideSpinner();
  }
});

// Xóa đơn
window.deleteOrder = async id => {
  if (!confirm("Bạn có chắc muốn xóa đơn này?")) return;
  showSpinner();
  try {
    const res = await fetch(`${API_BASE}/api/admin/donhang/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    showNotification("Xóa đơn thành công", "success");
    loadOrders();
  } catch {
    showNotification("Lỗi xóa đơn", "error");
  } finally {
    hideSpinner();
  }
};

// Load orders khi switch tab
function switchTab(targetId) {
  currentTab = targetId;
  tabs.forEach(b => b.classList.toggle("active", b.dataset.target === targetId));
  sections.forEach(sec => sec.classList.toggle("active", sec.id === targetId));

  if (targetId === "menu-section") loadMenu();
  if (targetId === "table-section") loadTables();
  if (targetId === "report-section") loadReportCharts();
  if (targetId === "staff-section") loadStaff();
  if (targetId === "order-section") loadOrders(); // <-- thêm đây
}



  // ===== Init =====
  switchTab("menu-section");

  setInterval(() => {
    if (currentTab === "menu-section") loadMenu();
    if (currentTab === "table-section") loadTables();
    if (currentTab === "report-section") loadReportCharts();
  }, 30000);

  console.log("✅ Admin.js đã hoạt động ổn định!");
});
