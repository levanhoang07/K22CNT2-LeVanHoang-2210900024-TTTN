// ==============================
// CẤU HÌNH CƠ BẢN
// ==============================
const API_BASE = "http://127.0.0.1:5000";
const socket = io(API_BASE);
const orderList = document.getElementById("order-list");
const reportDiv = document.getElementById("report");
const currentTime = document.getElementById("current-time");

// ==============================
// ĐỒNG HỒ THỜI GIAN
// ==============================
setInterval(() => {
  currentTime.textContent = new Date().toLocaleTimeString("vi-VN", { hour12: false });
}, 1000);

// ==============================
// SOCKETIO SỰ KIỆN
// ==============================
socket.on("connect", () => console.log("✅ Thu ngân connected:", socket.id));
socket.on("new_order", data => {
  toast(`🆕 Có đơn mới: #${data.IDDonHang} — Bàn ${data.IDBan}`, "info");
  loadOrders();
});
socket.on("bep_status_update", data => {
  console.log("👨‍🍳 Cập nhật bếp:", data);
  loadOrders();
});
socket.on("payment_done", data => {
  console.log("💳 Đã thanh toán:", data);
  loadOrders();
});

// ==============================
// HÀM HỖ TRỢ
// ==============================
function toast(msg, type = "info") {
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function formatMoney(v) {
  return (v || 0).toLocaleString("vi-VN") + " ₫";
}

function getStatusClass(trangthai) {
  switch (trangthai) {
    case "Nhận đơn": return "status-pending";
    case "Đang chế biến": return "status-cooking";
    case "Hoàn tất": return "status-done";
    default: return "status-unknown";
  }
}

// ==============================
// TẢI DANH SÁCH ĐƠN HÀNG
// ==============================
async function loadOrders() {
  orderList.innerHTML = "⏳ Đang tải...";
  try {
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không tải được danh sách đơn");
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.error(err);
    orderList.innerHTML = `<p class="error">❌ ${err.message}</p>`;
  }
}

// ==============================
// HIỂN THỊ ĐƠN HÀNG
// ==============================
function renderOrders(orders) {
  if (!orders?.length) {
    orderList.innerHTML = "<p>Không có đơn hàng nào.</p>";
    return;
  }

  orders.sort((a, b) => new Date(b.NgayTao) - new Date(a.NgayTao));

  orderList.innerHTML = orders.map(o => {
    const paid = o.TrangThaiThanhToan ? "✅ Đã thanh toán" : "❌ Chưa thanh toán";
    const btnPay = !o.TrangThaiThanhToan
      ? `<button class="btn pay" onclick="pay(${o.IDDonHang})">💳 Thanh toán</button>`
      : `<button class="btn cancel" onclick="refund(${o.IDDonHang})">↩️ Trả lại</button>`;

    return `
      <div class="order-card ${getStatusClass(o.TrangThaiBep)}">
        <div class="order-header">
          <strong>Đơn #${o.IDDonHang}</strong> — Bàn ${o.IDBan}
        </div>
        <div class="order-body">
          <p><b>Tổng:</b> ${formatMoney(o.TongTien)}</p>
          <p><b>Bếp:</b> ${o.TrangThaiBep || "Chưa có"}</p>
          <p><b>Thanh toán:</b> ${paid}</p>
        </div>
        <div class="actions">${btnPay}</div>
      </div>
    `;
  }).join("");
}

// ==============================
// THANH TOÁN / TRẢ LẠI
// ==============================
async function pay(id) {
  if (!confirm(`Xác nhận thanh toán đơn #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/donhang/thanh-toan/${id}`, { method: "PUT" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Lỗi server");
    toast(`💳 Thanh toán thành công — ${formatMoney(data.TongTien)}`, "success");
    loadOrders();
  } catch (err) {
    console.error(err);
    toast("Lỗi thanh toán: " + err.message, "error");
  }
}

async function refund(id) {
  if (!confirm(`Xác nhận TRẢ LẠI đơn #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/donhang/tra-lai/${id}`, { method: "PUT" });
    if (!res.ok) throw new Error("Không thể trả lại đơn này");
    toast(`↩️ Đơn #${id} đã được trả lại`, "warn");
    loadOrders();
  } catch (err) {
    toast("Lỗi: " + err.message, "error");
  }
}

// ==============================
// BÁO CÁO NHANH
// ==============================
async function loadBaoCao() {
  reportDiv.innerHTML = "⏳ Đang tính...";
  try {
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không lấy được dữ liệu");
    const orders = await res.json();
    const total = orders.reduce((sum, o) => sum + (o.TongTien || 0), 0);
    const count = orders.length;
    const paid = orders.filter(o => o.TrangThaiThanhToan).length;

    reportDiv.innerHTML = `
      <p>💰 <b>Tổng doanh thu:</b> ${formatMoney(total)}</p>
      <p>🧾 <b>Tổng đơn:</b> ${count}</p>
      <p>✅ <b>Đã thanh toán:</b> ${paid}</p>
    `;
  } catch (err) {
    console.error(err);
    reportDiv.innerHTML = `<p class="error">❌ ${err.message}</p>`;
  }
}

// ==============================
// KHỞI TẠO
// ==============================
loadOrders();
loadBaoCao();
