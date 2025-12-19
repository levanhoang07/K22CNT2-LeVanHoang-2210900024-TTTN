document.addEventListener("DOMContentLoaded", () => {

  // ================= CONFIG =================
  const API_BASE = "http://127.0.0.1:5000";
  const FALLBACK_IMG = `${API_BASE}/static/images/no-image.jpg`;

  // ================= SPINNER =================
  const spinner = document.getElementById("loading-spinner");
  const showSpinner = () => spinner && (spinner.style.display = "flex");
  const hideSpinner = () => spinner && (spinner.style.display = "none");

  // ================= NOTIFICATION =================
  const showNotification = (msg, type = "info") => {
    const n = document.createElement("div");
    n.className = `notification notification-${type}`;
    n.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add("show"), 20);
    setTimeout(() => {
      n.classList.remove("show");
      setTimeout(() => n.remove(), 300);
    }, 3000);
  };

  const escapeHtml = t => {
    const d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML.replace(/'/g, "\\'");
  };

  const getImageSrc = path => {
    if (!path) return FALLBACK_IMG;
    return path.startsWith("http")
      ? path
      : `${API_BASE}/static/${path.replace(/^\/+/, "")}`;
  };

  // ================= API FETCH (CHUẨN) =================
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json();

  console.log("🔍 API RAW RESPONSE:", url, json);

  // ✅ Nếu backend trả mảng trực tiếp
  if (Array.isArray(json)) {
    return json;
  }

  // ✅ Nếu backend trả { data: [...] }
  if (json.data && Array.isArray(json.data)) {
    return json.data;
  }

  // ✅ Nếu backend đã chuẩn { success, data }
  if (json.success === true) {
    return json.data;
  }

  throw new Error(json.message || "API Error");
}


  // ================= TAB =================
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");
  let currentTab = "menu-section";

  function switchTab(targetId) {
    currentTab = targetId;
    tabs.forEach(b => b.classList.toggle("active", b.dataset.target === targetId));
    sections.forEach(s => s.classList.toggle("active", s.id === targetId));

    if (targetId === "menu-section") loadMenu();
    if (targetId === "table-section") loadTables();
    if (targetId === "staff-section") loadStaff();
    if (targetId === "order-section") loadOrders();
  }

  tabs.forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.target))
  );

  // ================= MENU =================
  const menuBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  async function loadMenu() {
  console.log("👉 loadMenu called, currentTab =", currentTab);

  if (currentTab !== "menu-section") return;
  if (!menuBody) {
    console.error("❌ menuBody null");
    return;
  }

  showSpinner();

  try {
    const data = await apiFetch(`${API_BASE}/api/admin/menu`);
    console.log("✅ MENU ADMIN DATA:", data);

    menuBody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      menuBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:#64748b;">
            Chưa có món ăn
          </td>
        </tr>`;
      return;
    }

    data.forEach(m => {
      const gia = parseFloat(m.Gia || 0).toLocaleString();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.IDMon}</td>

        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img
              src="${m.HinhAnh}"
              style="width:42px;height:42px;object-fit:cover;border-radius:8px;"
              onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"
            >
            <div>
              <div style="font-weight:600;">${escapeHtml(m.TenMon)}</div>
              <div style="font-size:12px;color:#64748b;">
                ${escapeHtml(m.MoTa || "")}
              </div>
            </div>
          </div>
        </td>

        <td>${gia} ₫</td>

        <td>
          <span class="badge badge-category">
            ${escapeHtml(m.TenDanhMuc)}
          </span>
        </td>

        <td>
          <span class="badge ${m.TrangThai ? "badge-success" : "badge-danger"}">
            ${m.TrangThai ? "Đang bán" : "Ngưng bán"}
          </span>
        </td>

        <td>
          <button class="btn-edit"
            onclick="openMenuModal(
              ${m.IDMon},
              '${escapeHtml(m.TenMon)}',
              ${parseFloat(m.Gia)},
              '${escapeHtml(m.IDDanhMuc)}',
              '${escapeHtml(m.HinhAnh)}',
              '${escapeHtml(m.MoTa || "")}',
              ${m.TrangThai}
            )">
            ✏️ Sửa
          </button>

          <button class="btn-delete"
            onclick="deleteMenu(${m.IDMon})">
            🗑️ Xóa
          </button>
        </td>
      `;

      menuBody.appendChild(tr);
    });

    statMenu && (statMenu.textContent = data.length);

  } catch (err) {
    console.error("❌ loadMenu error:", err);
    showNotification("Lỗi tải menu", "error");
  } finally {
    hideSpinner();
  }
}

  // ================= TABLE =================
  const tableBody = document.querySelector("#table-list tbody");
  const statTable = document.getElementById("stat-table");

  async function loadTables() {
    if (currentTab !== "table-section") return;
    showSpinner();
    try {
      const data = await apiFetch(`${API_BASE}/api/admin/table`);
      tableBody.innerHTML = data.length ? "" :
        `<tr><td colspan="4">Chưa có bàn</td></tr>`;

      data.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.IDBan}</td>
          <td>${escapeHtml(t.TenBan)}</td>
          <td><button onclick="deleteTable(${t.IDBan})">Xóa</button></td>
        `;
        tableBody.appendChild(tr);
      });
      statTable.textContent = data.length;
    } catch {
      showNotification("Lỗi tải bàn", "error");
    } finally {
      hideSpinner();
    }
  }

  window.deleteTable = async id => {
    if (!confirm("Xóa bàn?")) return;
    showSpinner();
    try {
      await apiFetch(`${API_BASE}/api/admin/table/${id}`, { method: "DELETE" });
      loadTables();
    } catch {
      showNotification("Lỗi xóa bàn", "error");
    } finally {
      hideSpinner();
    }
  };

  // ================= STAFF =================
  const staffBody = document.querySelector("#staff-table-body");

  async function loadStaff() {
    showSpinner();
    try {
      const data = await apiFetch(`${API_BASE}/api/admin/staff`);
      staffBody.innerHTML = data.length ? "" :
        `<tr><td colspan="6">Chưa có nhân sự</td></tr>`;

      data.forEach((s, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${escapeHtml(s.HoTen)}</td>
          <td>${escapeHtml(s.VaiTro)}</td>
          <td><button onclick="deleteStaff(${s.IDNguoiDung})">Xóa</button></td>
        `;
        staffBody.appendChild(tr);
      });
    } catch {
      showNotification("Lỗi tải nhân sự", "error");
    } finally {
      hideSpinner();
    }
  }

  window.deleteStaff = async id => {
    if (!confirm("Xóa nhân sự?")) return;
    showSpinner();
    try {
      await apiFetch(`${API_BASE}/api/admin/staff/${id}`, { method: "DELETE" });
      loadStaff();
    } catch {
      showNotification("Lỗi xóa nhân sự", "error");
    } finally {
      hideSpinner();
    }
  };

  // ================= ORDER =================
  const orderBody = document.querySelector("#order-table tbody");

  async function loadOrders() {
    showSpinner();
    try {
      const data = await apiFetch(`${API_BASE}/api/admin/donhang`);
      orderBody.innerHTML = data.length ? "" :
        `<tr><td colspan="5">Chưa có đơn</td></tr>`;

      data.forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${o.IDDonHang}</td>
          <td>${o.IDBan}</td>
          <td>${Number(o.TongTien).toLocaleString()} ₫</td>
          <td><button onclick="deleteOrder(${o.IDDonHang})">Xóa</button></td>
        `;
        orderBody.appendChild(tr);
      });
    } catch {
      showNotification("Lỗi tải đơn", "error");
    } finally {
      hideSpinner();
    }
  }

  window.deleteOrder = async id => {
    if (!confirm("Xóa đơn?")) return;
    showSpinner();
    try {
      await apiFetch(`${API_BASE}/api/admin/donhang/${id}`, { method: "DELETE" });
      loadOrders();
    } catch {
      showNotification("Lỗi xóa đơn", "error");
    } finally {
      hideSpinner();
    }
  };

  // ================= INIT =================
  switchTab("menu-section");

  console.log("✅ Admin.js đã hoạt động ổn định!");
});
