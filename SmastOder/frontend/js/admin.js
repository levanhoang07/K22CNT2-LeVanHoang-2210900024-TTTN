const API_BASE = "http://127.0.0.1:5000";

// ========== Chuyển tab ==========
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target).classList.add("active");
  });
});

// ========== ĐỊNH DẠNG TIỀN ==========
function formatMoney(amount) {
  if (!amount) return "0 ₫";
  return amount.toLocaleString("vi-VN", { minimumFractionDigits: 0 }) + " ₫";
}

// ========== QUẢN LÝ MENU ==========
const menuTableBody = document.querySelector("#menu-table tbody");
const addBtn = document.getElementById("add-food");

async function loadMenu() {
  try {
    const res = await fetch(`${API_BASE}/api/menu`);
    const data = await res.json();
    menuTableBody.innerHTML = "";
    data.forEach(m => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.TenMon}</td>
        <td>${formatMoney(m.Gia)}</td>
        <td>${m.DanhMuc || "-"}</td>
        <td><img src="${m.HinhAnh ? `${API_BASE}/images/${m.HinhAnh}` : ""}" width="50" height="50"></td>
        <td>
          <button class="edit-btn" onclick="editFood(${m.IDMon}, '${m.TenMon}', ${m.Gia}, '${m.DanhMuc || ""}')">✏️</button>
          <button class="del-btn" onclick="deleteFood(${m.IDMon})">🗑️</button>
        </td>
      `;
      menuTableBody.appendChild(tr);
    });
    document.getElementById("stat-menu").textContent = data.length;
  } catch (err) {
    console.error("Lỗi load menu:", err);
  }
}

addBtn.addEventListener("click", async () => {
  const name = prompt("Tên món mới:");
  const price = parseFloat(prompt("Giá món:"));
  const cat = prompt("Danh mục:");
  if (!name || isNaN(price)) return;
  await fetch(`${API_BASE}/api/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ TenMon: name, Gia: price, DanhMuc: cat })
  });
  loadMenu();
});

async function editFood(id, oldName, oldPrice, oldCat) {
  const name = prompt("Tên món:", oldName);
  const price = parseFloat(prompt("Giá món:", oldPrice));
  const cat = prompt("Danh mục:", oldCat);
  if (!name || isNaN(price)) return;
  await fetch(`${API_BASE}/api/menu/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ TenMon: name, Gia: price, DanhMuc: cat })
  });
  loadMenu();
}

async function deleteFood(id) {
  if (!confirm("Xóa món này?")) return;
  await fetch(`${API_BASE}/api/menu/${id}`, { method: "DELETE" });
  loadMenu();
}

// ========== QUẢN LÝ BÀN + QR ==========
async function loadTables() {
  try {
    const res = await fetch(`${API_BASE}/api/ban`);
    const data = await res.json();
    const tableBody = document.querySelector("#table-list tbody");
    tableBody.innerHTML = "";
    data.forEach(b => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.IDBan}</td>
        <td>${b.TenBan}</td>
        <td>
          <button onclick="showQR(${b.IDBan})">📱 QR</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    document.getElementById("stat-table").textContent = data.length;
  } catch (err) {
    console.error("Lỗi load bàn:", err);
  }
}

function showQR(idBan) {
  const url = `${window.location.origin}/khach?table=${idBan}`;
  const qrDiv = document.getElementById("qr-result");
  qrDiv.innerHTML = "";
  new QRCode(qrDiv, {
    text: url,
    width: 200,
    height: 200,
  });
  document.getElementById("qr-link").textContent = url;
}

// ========== BÁO CÁO ==========
async function loadReport() {
  try {
    const res = await fetch(`${API_BASE}/api/report`);
    const data = await res.json();
    document.getElementById("stat-orders").textContent = data.total_orders || 0;
    document.getElementById("stat-revenue").textContent = formatMoney(data.total_revenue || 0);
  } catch (err) {
    console.error("Lỗi load báo cáo:", err);
  }
}

// ========== KHỞI CHẠY ==========
loadMenu();
loadTables();
loadReport();
