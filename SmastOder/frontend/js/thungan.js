async function loadOrders() {
  const res = await fetch("/api/donhang");
  const orders = await res.json();
  const list = document.getElementById("order-list");
  list.innerHTML = orders.map(o => `
    <div class="order">
      <h4>Đơn #${o.IDDonHang} - Bàn ${o.IDBan}</h4>
      <p>Trạng thái: ${o.TrangThaiThanhToan ? "Đã thanh toán" : "Chưa thanh toán"}</p>
      <p>Tổng tiền: ${o.TongTien.toLocaleString()} ₫</p>
      ${!o.TrangThaiThanhToan ? `<button onclick="thanhToan(${o.IDDonHang})">Thanh toán</button>` : ""}
    </div>
  `).join("");
}

async function thanhToan(id) {
  await fetch(`/api/donhang/thanh-toan/${id}`, { method: "PUT" });
  loadOrders();
}

async function loadBaoCao() {
  const type = document.getElementById("filter-type").value;
  const res = await fetch(`/api/baocao/doanhthu?type=${type}`);
  const data = await res.json();

  const tbody = document.querySelector("#baoCaoTable tbody");
  tbody.innerHTML = "";
  data.forEach(row => {
    const tg = row.Ngay || (row.Tuan ? `Tuần ${row.Tuan}/${row.Nam}` : `Tháng ${row.Thang}/${row.Nam}`);
    tbody.innerHTML += `<tr><td>${tg}</td><td>${row.TongDoanhThu.toLocaleString()} ₫</td></tr>`;
  });
}

loadOrders();
