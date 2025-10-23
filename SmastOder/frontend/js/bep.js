// js/bep.js

const socket = io("http://127.0.0.1:5000");
const orderList = document.getElementById("order-list");
const pendingCount = document.getElementById("pending-count");
const totalCount = document.getElementById("total-count");
const currentTime = document.getElementById("current-time");

// =============================
// ĐỒNG HỒ
// =============================
setInterval(() => {
  const now = new Date();
  currentTime.textContent = now.toLocaleTimeString("vi-VN");
}, 1000);

// =============================
// LẤY ĐƠN HÀNG BAN ĐẦU
// =============================
let currentOrders = [];

async function loadOrders() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/donhang");
    if (!res.ok) throw new Error("Không thể tải đơn hàng");
    const orders = await res.json();
    currentOrders = orders;
    renderOrders(currentOrders);
  } catch (err) {
    console.error("Lỗi tải đơn hàng:", err);
    orderList.innerHTML = `<p class="error">⚠️ Không thể tải đơn hàng. Vui lòng thử lại.</p>`;
  }
}

// =============================
// RENDER TOÀN BỘ DANH SÁCH
// =============================
function renderOrders(orders) {
  if (!orders || orders.length === 0) {
    orderList.innerHTML = `<p class="empty-list">Chưa có đơn hàng mới nào. ☕</p>`;
    pendingCount.textContent = "0";
    totalCount.textContent = "0";
    return;
  }

  // Sắp xếp mới nhất trước
  orders.sort((a, b) => new Date(b.NgayTao) - new Date(a.NgayTao));

  orderList.innerHTML = "";
  for (const o of orders) {
    const card = createOrderCard(o);
    orderList.appendChild(card);
  }

  updateSummary();
}

// =============================
// TẠO THẺ ĐƠN HÀNG (phần tử HTML)
// =============================
function createOrderCard(o) {
  const div = document.createElement("div");
  div.className = "order-card";
  div.dataset.id = o.IDDonHang;

  div.innerHTML = `
    <h3>🧾 Đơn #${o.IDDonHang} — Bàn ${o.IDBan}</h3>
    <p><strong>Trạng thái:</strong> ${o.TrangThaiBep || "Đang xử lý"}</p>
    <ul class="dish-list"></ul>
    <button class="btn-finish" onclick="updateStatus(${o.IDDonHang})">✅ Hoàn tất</button>
  `;
  return div;
}

// =============================
// CẬP NHẬT TÓM TẮT
// =============================
function updateSummary() {
  pendingCount.textContent = currentOrders.filter(o => o.TrangThaiBep !== "Hoàn tất").length;
  totalCount.textContent = currentOrders.length;
}

// =============================
// CẬP NHẬT TRẠNG THÁI ĐƠN
// =============================
async function updateStatus(id) {
  try {
    const res = await fetch(`http://127.0.0.1:5000/api/bep/cap-nhat-trang-thai/${id}`, { method: "PUT" });
    if (!res.ok) throw new Error("Cập nhật thất bại");
    const data = await res.json();
    const card = document.querySelector(`.order-card[data-id='${id}']`);
    if (card) card.querySelector("p").innerHTML = `<strong>Trạng thái:</strong> Hoàn tất`;
    const order = currentOrders.find(o => o.IDDonHang === id);
    if (order) order.TrangThaiBep = "Hoàn tất";
    updateSummary();
  } catch (err) {
    console.error(err);
    alert("❌ Không thể cập nhật trạng thái!");
  }
}

// =============================
// XỬ LÝ SOCKET - ĐƠN HÀNG MỚI
// =============================
socket.on("new_order", (data) => {
  console.log("📦 Đơn mới từ khách:", data);

  // 1️⃣ Kiểm tra xem đơn đã có chưa
  if (currentOrders.some(o => o.IDDonHang === data.IDDonHang)) {
    console.log("⏩ Đơn đã tồn tại, bỏ qua.");
    return;
  }

  // 2️⃣ Thêm vào đầu mảng & DOM
  currentOrders.unshift(data);
  const newCard = createOrderCard(data);
  if (orderList.querySelector(".empty-list")) {
    orderList.innerHTML = ""; // Xóa dòng "Chưa có đơn hàng"
  }
  orderList.prepend(newCard);

  // 3️⃣ Cập nhật tổng số
  updateSummary();

  // 4️⃣ Hiển thị thông báo
  showToast(`🆕 Có đơn hàng mới từ bàn ${data.IDBan}!`);
});

// =============================
// HÀM THÔNG BÁO NHẸ (TOAST)
// =============================
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    toast.remove();
  }, 4000);
}

// =============================
// KHỞI CHẠY
// =============================
loadOrders();
