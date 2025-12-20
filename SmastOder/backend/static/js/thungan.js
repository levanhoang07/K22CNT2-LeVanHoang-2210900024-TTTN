const socket = io();

// ================= GLOBAL STATE =================
let currentTable = null;
let currentOrder = null;
let orderItems = [];
let subtotal = 0;
let discountPercent = 0;
let paymentTotal = 0;
let currentPaymentMethod = "cash";

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  loadTables();
  loadStats();
  loadRecentPayments();
  setupFilterButtons();
});

// ================= LOAD TABLES =================
async function loadTables(filter = "all") {
  const res = await fetch("/api/thungan/ban");
  const json = await res.json();

  const list = document.getElementById("tablesList");
  list.innerHTML = "";

  if (!json.data || !json.data.length) {
    list.innerHTML = `<div class="empty-state">Không có bàn đang có khách</div>`;
    return;
  }

  json.data.forEach(b => {
    const card = document.createElement("div");
    card.className = "table-card occupied";
    card.innerHTML = `
      <span class="table-name">${b.TenBan}</span>
      <span class="table-status occupied">Có khách</span>
    `;
    card.onclick = () => selectTable(b, card);
    list.appendChild(card);
  });
}

// ================= SELECT TABLE =================
async function selectTable(table, el) {
  document.querySelectorAll(".table-card").forEach(c => c.classList.remove("active"));
  el.classList.add("active");

  currentTable = table;
  document.getElementById("selectedTableInfo").innerHTML =
    `<span class="table-name">${table.TenBan}</span>`;

  const res = await fetch(`/api/thungan/ban/${table.IDBan}/donhang`);
  const json = await res.json();

  if (!json.donhang) {
    resetOrderView();
    return;
  }

  currentOrder = json.donhang;
  orderItems = json.items || [];

  subtotal = currentOrder.TongTien || 0;
  discountPercent = 0;

  renderOrderItems(orderItems);
  updateSummary();
}

// ================= RENDER ORDER ITEMS =================
function renderOrderItems(items) {
  document.getElementById("orderContent").style.display = "none";
  document.getElementById("orderItems").style.display = "block";
  document.getElementById("orderSummary").style.display = "block";

  const box = document.getElementById("orderItems");
  box.innerHTML = "";

  items.forEach(i => {
    box.innerHTML += `
      <div class="order-item">
        <div>
          <b>${i.TenMon}</b><br>
          ${i.CapDoCay ? `🌶 Cay ${i.CapDoCay}<br>` : ""}
          ${i.GhiChu || ""}
        </div>
        <strong>${i.ThanhTien.toLocaleString()} đ</strong>
      </div>
    `;
  });
}

// ================= SUMMARY =================
function updateSummary() {
  const discount = subtotal * (discountPercent / 100);
  paymentTotal = subtotal - discount;

  document.getElementById("subtotal").textContent = subtotal.toLocaleString() + "đ";
  document.getElementById("discount").textContent = discount.toLocaleString() + "đ";
  document.getElementById("total").textContent = paymentTotal.toLocaleString() + "đ";

  updateChange();
  updateQR();
}

// ================= PAYMENT MODAL =================
function showPaymentModal() {
  if (!currentOrder) return alert("Chưa chọn bàn");

  document.getElementById("paymentTable").textContent = currentTable.TenBan;
  document.getElementById("paymentTotal").textContent = paymentTotal.toLocaleString() + "đ";
  document.getElementById("transferAmount").textContent = paymentTotal.toLocaleString() + "đ";

  document.getElementById("paymentModal").classList.add("active");
  selectPaymentMethod("cash");
}

function closePaymentModal() {
  document.getElementById("paymentModal").classList.remove("active");
}

// ================= PAYMENT METHOD =================
function selectPaymentMethod(method) {
  currentPaymentMethod = method;

  document.querySelectorAll(".method-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`[data-method="${method}"]`).classList.add("active");

  document.querySelectorAll(".payment-form").forEach(f => f.classList.remove("active"));
  document.getElementById(method + "Form").classList.add("active");

  updateQR();
}

// ================= CASH =================
function updateChange() {
  const input = document.getElementById("cashReceived");
  if (!input) return;

  const received = Number(input.value.replace(/\D/g, "")) || 0;
  const change = received - paymentTotal;

  document.getElementById("changeAmount").textContent =
    (change > 0 ? change : 0).toLocaleString() + "đ";
}

function quickCash(amount) {
  document.getElementById("cashReceived").value =
    (paymentTotal + amount).toLocaleString();
  updateChange();
}

function exactAmount() {
  document.getElementById("cashReceived").value = paymentTotal.toLocaleString();
  updateChange();
}

// ================= TRANSFER =================
function updateQR() {
  if (currentPaymentMethod !== "transfer" || !currentOrder) return;

  document.getElementById("transferContent").textContent =
    `MICAY ${currentTable.TenBan} ${currentOrder.IDDonHang}`;

  document.getElementById("qrCode").innerHTML = `
    <img src="https://api.vietqr.io/image/970422-0123456789-MICAY${currentOrder.IDDonHang}.jpg?amount=${paymentTotal}">
  `;
}

// ================= CRYPTO =================
function updateCryptoInfo() {
  const type = document.getElementById("cryptoType").value;
  const rates = { btc: 1200000000, eth: 60000000, usdt: 25000 };
  const amount = (paymentTotal / rates[type]).toFixed(6);
  document.getElementById("cryptoAmount").textContent =
    `${amount} ${type.toUpperCase()}`;
}

// ================= PROCESS PAYMENT =================
async function processPayment() {
  if (!currentOrder) return;

  let methodId = 1;
  if (currentPaymentMethod === "transfer") methodId = 2;
  if (currentPaymentMethod === "crypto") methodId = 3;

  const res = await fetch(`/api/thungan/thanhtoan/${currentOrder.IDDonHang}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IDPhuongThuc: methodId,
      SoTien: paymentTotal
    })
  });

  const json = await res.json();

  if (json.status === "ok") {
    closePaymentModal();
    document.getElementById("successMessage").textContent =
      `Thanh toán ${currentTable.TenBan} thành công`;
    document.getElementById("successModal").classList.add("active");

    loadTables();
    resetOrderView();
  } else {
    alert("Thanh toán thất bại");
  }
}

// ================= RESET =================
function resetOrderView() {
  currentOrder = null;
  orderItems = [];
  document.getElementById("orderItems").style.display = "none";
  document.getElementById("orderSummary").style.display = "none";
  document.getElementById("orderContent").style.display = "block";
}

// ================= STATS =================
async function loadStats() {
  const res = await fetch("/api/thungan/thongke");
  if (!res.ok) return;
  const s = await res.json();

  document.getElementById("todayRevenue").textContent =
    (s.DoanhThuHomNay || 0).toLocaleString() + "đ";
  document.getElementById("todayOrders").textContent = s.SoDonDaThanhToan || 0;
  document.getElementById("pendingOrders").textContent = s.SoDonChoThanhToan || 0;
}

// ================= RECENT PAYMENTS =================
async function loadRecentPayments() {
  const res = await fetch("/api/thungan/thanhtoan/recent");
  if (!res.ok) return;
  const data = await res.json();

  const box = document.getElementById("recentPayments");
  box.innerHTML = "";

  data.forEach(p => {
    box.innerHTML += `
      <div class="payment-history-item">
        <div>${p.TenBan}</div>
        <div>${p.SoTien.toLocaleString()}đ</div>
        <small>${p.TenPhuongThuc}</small>
      </div>
    `;
  });
}

// ================= FILTER =================
function setupFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadTables(btn.dataset.filter);
    };
  });
}

// ================= SUCCESS =================
function closeSuccessModal() {
  document.getElementById("successModal").classList.remove("active");
}

function printReceipt() {
  window.print();
}

// ================= SOCKET =================
socket.on("new_order", loadTables);
socket.on("order_paid", loadTables);
