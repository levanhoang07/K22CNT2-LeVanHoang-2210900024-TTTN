// static/js/thungan.js
const API_BASE = "http://127.0.0.1:5000";
const socket = io(API_BASE);
const orderList = document.getElementById("order-list");
const reportDiv = document.getElementById("report");
const currentTime = document.getElementById("current-time");

// clock
setInterval(() => {
  currentTime.textContent = new Date().toLocaleTimeString("vi-VN", { hour12: false });
}, 1000);

// socket
socket.on("connect", () => console.log("✅ Thu ngân connected", socket.id));
socket.on("new_order", (data) => {
  console.log("📦 new_order", data);
  alert(`🆕 Có đơn mới: #${data.IDDonHang} — Bàn ${data.IDBan}`);
  loadOrders();
});
socket.on("payment_done", (data) => {
  console.log("💳 payment_done", data);
  loadOrders();
});
socket.on("bep_status_update", (data) => {
  console.log("🔁 bep_status_update", data);
  loadOrders();
});

// load orders
async function loadOrders() {
  orderList.innerHTML = "⏳ Đang tải...";
  try {
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không tải được đơn");
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.error(err);
    orderList.innerHTML = `<p class="error">Lỗi: ${err.message}</p>`;
  }
}

function renderOrders(orders) {
  if (!orders || orders.length === 0) {
    orderList.innerHTML = "<p>Không có đơn hàng.</p>";
    return;
  }
  orders.sort((a,b)=> {
    if (a.NgayTao && b.NgayTao) return new Date(b.NgayTao) - new Date(a.NgayTao);
    return (b.IDDonHang||0) - (a.IDDonHang||0);
  });
  orderList.innerHTML = orders.map(o=> {
    const paid = o.TrangThaiThanhToan ? "✅" : "❌";
    return `
      <div class="order-card">
        <div><strong>#${o.IDDonHang}</strong> — Bàn ${o.IDBan}</div>
        <div>Tổng: ${(o.TongTien||0).toLocaleString()} ₫ — Thanh toán: ${paid}</div>
        <div class="actions">
          ${!o.TrangThaiThanhToan ? `<button onclick="pay(${o.IDDonHang})">💳 Thanh toán</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

async function pay(id) {
  if (!confirm(`Xác nhận thanh toán đơn #${id}?`)) return;
  try {
    // endpoint /api/donhang/thanh-toan/<id> may or may not exist in your server;
    // if not, implement it on backend to set TrangThaiThanhToan=1 and return TongTien.
    const res = await fetch(`${API_BASE}/api/donhang/thanh-toan/${id}`, { method: "PUT" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Lỗi server");
    }
    const data = await res.json();
    alert(`Thanh toán thành công — Tổng: ${(data.TongTien||0).toLocaleString()} ₫`);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert("Lỗi thanh toán: " + err.message);
  }
}

async function loadBaoCao() {
  reportDiv.innerHTML = "⏳ Đang tính...";
  try {
    // Tạm: gọi /api/donhang và tính tổng & số đơn ở client (nếu server chưa có API báo cáo)
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không lấy được đơn");
    const orders = await res.json();
    const total = orders.reduce((s,o)=> s + (o.TongTien || 0), 0);
    reportDiv.innerHTML = `<p>Tổng doanh thu: <strong>${total.toLocaleString()} ₫</strong></p>
      <p>Số đơn: <strong>${orders.length}</strong></p>`;
  } catch (err) {
    console.error(err);
    reportDiv.innerHTML = `<p class="error">Lỗi: ${err.message}</p>`;
  }
}

// init
loadOrders();
loadBaoCao();
