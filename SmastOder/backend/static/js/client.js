// ============================================
// Mì Cay One - Client JavaScript (FIXED & MATCH CSDL)
// ============================================

// ================= GLOBAL ==================
let menuData = [];
let cart = [];
let currentCategory = "all";
let selectedItem = null;
let isSpicyItem = false;   // 🔥 BIẾN QUYẾT ĐỊNH CÓ CAY HAY KHÔNG

// Socket.IO
const socket = io();

// ================= TABLE FROM QR =================
const params = new URLSearchParams(window.location.search);
const IDBan = params.get("ban") || params.get("IDBan");

// ❌ KHÔNG CÓ BÀN → KHÓA WEB
if (!IDBan) {
  document.body.innerHTML = `
    <div style="
      height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      font-size:18px;
      color:#666;
      padding:20px;
    ">
      📵 <br>
      Vui lòng quét mã QR tại bàn để bắt đầu đặt món
    </div>
  `;
  throw new Error("NO_TABLE");
}

// ✅ CÓ BÀN → HIỂN THỊ
const tableInput = document.getElementById("table-input");
if (tableInput) {
  tableInput.value = "Bàn " + IDBan;
}

// ================= INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  fetchMenu();
  renderCart();
  setupEventListeners();
});

// ================= API ==================

// MENU (Menu + DanhMuc)
async function fetchMenu() {
  try {
    const res = await fetch("/api/menu");
    const json = await res.json();

    if (json.status !== "ok") throw new Error();

    menuData = json.data;
    renderCategories(menuData);
    renderMenu(menuData);
  } catch (e) {
    console.error(e);
    showError("Không thể tải thực đơn");
  }
}

// ================= RENDER ==================

function renderCategories(data) {
  const bar = document.querySelector(".category-bar");
  bar.innerHTML = `<button class="category-btn active" data-cat="all">Tất cả</button>`;

  const cats = [...new Set(data.map(m => `${m.IDDanhMuc}|${m.TenDanhMuc}`))];

  cats.forEach(c => {
    const [id, name] = c.split("|");
    bar.innerHTML += `<button class="category-btn" data-cat="${id}">${name}</button>`;
  });

  bar.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => filterByCategory(btn.dataset.cat);
  });
}
function renderMenu(items) {
  const box = document.getElementById("menu-container");
  box.innerHTML = "";

  if (!items.length) {
    box.innerHTML = `<div class="loading-state">📭 Không có món</div>`;
    return;
  }

  items.forEach(item => {
    box.innerHTML += `
      <div class="menu-item">
        <img class="menu-item-image" src="${item.HinhAnh}" alt="${item.TenMon}">

        <div class="menu-item-info">
          <h5 class="menu-item-name">${item.TenMon}</h5>
          ${
            item.MoTa && item.MoTa.trim() !== ""
              ? `<p class="menu-item-desc">${item.MoTa}</p>`
              : ""
          }
          <p class="menu-item-price">${formatPrice(item.Gia)}</p>

          <!-- ✅ NÚT CHỌN MÓN -->
          <button 
            class="btn-add"
            onclick="openOptionModal(${item.IDMon})"
          >
            Chọn món ngay
          </button>
        </div>
      </div>
    `;
  });
}


// ================= FILTER ==================

function filterByCategory(cat) {
  currentCategory = cat;

  document.querySelectorAll(".category-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.cat === cat)
  );

  if (cat === "all") renderMenu(menuData);
  else renderMenu(menuData.filter(m => m.IDDanhMuc == cat));
}

// ================= MODAL ==================

function openOptionModal(id) {
  selectedItem = menuData.find(m => m.IDMon == id);
  if (!selectedItem) return;

  const spicyBlock = document.getElementById("spicy-block");

  // 🔥 CHỈ MÌ MỚI CÓ CẤP ĐỘ CAY
  isSpicyItem = selectedItem.TenDanhMuc
    .toLowerCase()
    .includes("mì");

  if (isSpicyItem) {
    spicyBlock.style.display = "block";
    document.getElementById("level-select").value = "1";
  } else {
    spicyBlock.style.display = "none";
  }

  document.getElementById("note-input").value = "";
  document.getElementById("option-modal").classList.remove("hidden");
}

// ================= CART ==================
function renderCart() {
  const box = document.getElementById("cart-list");
  const subtotal = document.getElementById("cart-subtotal");
  const btn = document.getElementById("btn-order");

  if (!cart.length) {
    box.innerHTML = `<div class="empty">Giỏ hàng trống</div>`;
    subtotal.textContent = "0 ₫";
    btn.disabled = true;
    return;
  }

  let total = 0;
  box.innerHTML = "";

  cart.forEach((c, i) => {
    const itemTotal = c.DonGia * c.SoLuong;
    total += itemTotal;

    box.innerHTML += `
      <div class="cart-item">

        <div class="cart-item-header">
          <b>${c.TenMon}</b>
          <span>${formatPrice(itemTotal)}</span>
        </div>

        <!-- 🌶 CẤP ĐỘ CAY -->
        ${c.CapDoCay ? `<div class="cart-meta">🌶 Cay ${c.CapDoCay}</div>` : ""}

        <!-- 📝 GHI CHÚ -->
        ${c.GhiChu && c.GhiChu.trim() !== ""
          ? `<div class="cart-note">📝 ${c.GhiChu}</div>`
          : ""
        }

        <!-- ➖➕ SỐ LƯỢNG -->
        <div class="cart-qty">
          <button class="qty-btn" onclick="decreaseQty(${i})">−</button>
          <span class="qty-value">${c.SoLuong}</span>
          <button class="qty-btn" onclick="increaseQty(${i})">+</button>
        </div>

      </div>
    `;
  });

  subtotal.textContent = formatPrice(total);
  btn.disabled = false;
}
function increaseQty(index) {
  cart[index].SoLuong++;
  renderCart();
}

function decreaseQty(index) {
  if (cart[index].SoLuong > 1) {
    cart[index].SoLuong--;
  } else {
    // nếu còn 1 mà bấm "-" → xóa món
    cart.splice(index, 1);
  }
  renderCart();
}
// ================= móm đã đătrj ==================
async function loadHistory() {
  const res = await fetch(`/api/ban/${IDBan}/lichsu`);
  const json = await res.json();

  const box = document.getElementById("history-list");
  box.innerHTML = "";

  if (!json.data.length) {
    box.innerHTML = "<div>📜 Chưa có đơn nào</div>";
    return;
  }

  json.data.forEach(o => {
    box.innerHTML += `
      <div class="history-item">
        <b>Đơn #${o.IDDonHang}</b>
        <span>${new Date(o.NgayTao).toLocaleTimeString()}</span>
        <strong>${formatPrice(o.TongTien)}</strong>
      </div>
    `;
  });
}
// ===== BONG BÓNG LỊCH SỬ =====
document.getElementById("history-bubble").onclick = () => {
  document.getElementById("history-modal").classList.remove("hidden");
  loadHistory(); // 🔥 CHỖ NÀY
};

document.getElementById("close-history").onclick = () => {
  document.getElementById("history-modal").classList.add("hidden");
};


// ================= EVENTS ==================

function setupEventListeners() {

  // HỦY MODAL
  document.getElementById("cancel-modal").addEventListener("click", () => {
    document.getElementById("option-modal").classList.add("hidden");
    selectedItem = null;
  });

  // THÊM VÀO GIỎ
  document.getElementById("confirm-modal").addEventListener("click", () => {
    if (!selectedItem) return;

    const note = document.getElementById("note-input").value.trim();

    cart.push({
      IDMon: selectedItem.IDMon,
      TenMon: selectedItem.TenMon,
      DonGia: selectedItem.Gia,
      SoLuong: 1,
      CapDoCay: isSpicyItem
        ? document.getElementById("level-select").value
        : null,
      GhiChu: note
    });

    document.getElementById("option-modal").classList.add("hidden");
    selectedItem = null;
    renderCart();
    showNotification("✅ Đã thêm món");
  });

  // CLICK NGOÀI MODAL ĐỂ ĐÓNG
  document.querySelectorAll(".modal").forEach(m =>
    m.addEventListener("click", e => {
      if (e.target === m) m.classList.add("hidden");
    })
  );
}

// ================= ORDER ==================

document.getElementById("btn-order").onclick = async () => {
  if (!IDBan || !cart.length) return;

  for (const item of cart) {
    await fetch("/api/order/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        IDBan: IDBan,
        IDMon: item.IDMon,
        SoLuong: item.SoLuong || 1,
        CapDoCay: item.CapDoCay || null,
        GhiChu: item.GhiChu || null
      })
    });
  }

  socket.emit("new_order", { IDBan });

  cart = [];
  renderCart();
  showNotification("🎉 Đã gửi món!");
};


// ================= CALL STAFF ==================

document.getElementById("btn-call-staff").onclick = () =>
  document.getElementById("staff-modal").classList.remove("hidden");

document.getElementById("send-staff").onclick = async () => {
  const msg = document.getElementById("staff-message").value.trim();
  if (!msg) return;

  await fetch("/api/thongbao", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ IDBan, NoiDung: msg })
  });

  socket.emit("call_staff", { IDBan, NoiDung: msg });
  document.getElementById("staff-modal").classList.add("hidden");
  document.getElementById("staff-message").value = "";
  showNotification("📢 Đã gọi nhân viên");
};

// ================= UTILS ==================

function formatPrice(v) {
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

function showNotification(msg) {
  alert(msg);
}

function showError(msg) {
  alert("❌ " + msg);
}

// ================= SOCKET ==================

socket.on("connect", () => console.log("🔌 Socket connected"));
socket.on("disconnect", () => console.log("🔌 Socket disconnected"));
