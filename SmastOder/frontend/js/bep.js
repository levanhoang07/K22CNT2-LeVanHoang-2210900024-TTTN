const socket = io();
const orderList = document.getElementById("order-list");

async function loadOrders() {
  const res = await fetch("/api/donhang");
  const orders = await res.json();
  renderOrders(orders);
}

function renderOrders(orders) {
  orderList.innerHTML = orders.map(o => `
    <div class="order">
      <h4>Đơn #${o.IDDonHang} - Bàn ${o.IDBan}</h4>
      <p>Trạng thái: ${o.TrangThaiBep}</p>
      <button onclick="updateStatus(${o.IDDonHang})">Hoàn tất</button>
    </div>
  `).join("");
}

async function updateStatus(id) {
  await fetch(`/api/bep/cap-nhat-trang-thai/${id}`, { method: "PUT" });
}

socket.on("new_order", data => {
  alert(`🆕 Đơn mới từ bàn ${data.ban}`);
  loadOrders();
});

loadOrders();
