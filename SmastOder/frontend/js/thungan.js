// ==========================
// CẤU HÌNH
// ==========================
const API_BASE = "http://127.0.0.1:5000"; // URL backend Flask

// ==========================
// LOAD DANH SÁCH ĐƠN HÀNG
// ==========================
async function loadOrders() {
  const list = document.getElementById("order-list");
  list.innerHTML = `<p>⏳ Đang tải danh sách đơn...</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/donhang`);
    if (!res.ok) throw new Error("Không tải được danh sách đơn hàng");
    const orders = await res.json();

    if (orders.length === 0) {
      list.innerHTML = `<p>🍜 Chưa có đơn hàng nào.</p>`;
      return;
    }

    list.innerHTML = orders
      .map(
        (o) => `
        <div class="order-card">
          <h4>🧾 Đơn #${o.IDDonHang} — 🪑 Bàn ${o.IDBan}</h4>
          <p>💰 Tổng tiền: <strong>${o.TongTien.toLocaleString()} ₫</strong></p>
          <p>📦 Trạng thái: 
            <strong>${o.TrangThaiThanhToan ? "✅ Đã thanh toán" : "❌ Chưa thanh toán"}</strong>
          </p>
          ${
            !o.TrangThaiThanhToan
              ? `<button class="btn-pay" onclick="thanhToan(${o.IDDonHang})">💳 Thanh toán</button>`
              : ""
          }
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("Lỗi:", err);
    list.innerHTML = `<p>⚠️ Lỗi khi tải dữ liệu. Kiểm tra kết nối server.</p>`;
  }
}

// ==========================
// THANH TOÁN ĐƠN HÀNG
// ==========================
async function thanhToan(id) {
  if (!confirm(`💳 Xác nhận thanh toán cho đơn #${id}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/donhang/thanh-toan/${id}`, {
      method: "PUT",
    });

    if (res.ok) {
      alert("✅ Thanh toán thành công!");
      loadOrders();
      loadBaoCao(); // cập nhật báo cáo sau thanh toán
    } else {
      alert("⚠️ Lỗi khi thanh toán!");
    }
  } catch (err) {
    console.error(err);
    alert("🚫 Không thể kết nối đến server!");
  }
}

// ==========================
// BÁO CÁO DOANH THU
// ==========================
async function loadBaoCao() {
  const type = document.getElementById("filter-type").value;
  const tbody = document.querySelector("#baoCaoTable tbody");
  tbody.innerHTML = `<tr><td colspan="2">⏳ Đang tải báo cáo...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/api/baocao/doanhthu?type=${type}`);
    if (!res.ok) throw new Error("Không tải được báo cáo doanh thu");
    const data = await res.json();

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2">📭 Không có dữ liệu báo cáo.</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map((row) => {
        const tg =
          row.Ngay ||
          (row.Tuan ? `Tuần ${row.Tuan}/${row.Nam}` : `Tháng ${row.Thang}/${row.Nam}`);
        return `<tr>
          <td>${tg}</td>
          <td>${row.TongDoanhThu.toLocaleString()} ₫</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="2">⚠️ Lỗi khi tải báo cáo.</td></tr>`;
  }
}

// ==========================
// SỰ KIỆN KHI LOAD TRANG
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  loadOrders();
  loadBaoCao();

  const filterSelect = document.getElementById("filter-type");
  if (filterSelect) {
    filterSelect.addEventListener("change", loadBaoCao);
  }
});
