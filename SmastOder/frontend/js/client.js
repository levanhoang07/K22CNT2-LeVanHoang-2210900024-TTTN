// =============================
// CẤU HÌNH
// =============================
const API_URL = "http://127.0.0.1:5000/api/menu";
const ORDER_URL = "http://127.0.0.1:5000/api/donhang";
const socket = io("http://127.0.0.1:5000");

let cart = [];
let menuData = [];
let selectedItem = null;

// =============================
// LẤY DỮ LIỆU MENU
// =============================
async function fetchMenu() {
  const container = document.getElementById("menu-container");
  container.innerHTML = `<div class="loading-state">⏳ Đang tải thực đơn...</div>`;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Lỗi tải dữ liệu (${res.status})`);
    const data = await res.json();

    menuData = data;
    renderMenu(menuData);
    renderCategoryButtons();
  } catch (err) {
    console.error("Lỗi khi tải menu:", err);
    container.innerHTML = `<p class="error">⚠️ Không thể tải thực đơn. Vui lòng thử lại.</p>`;
  }
}

// =============================
// HIỂN THỊ MENU
// =============================
function renderMenu(menu) {
  const container = document.getElementById("menu-container");

  if (!menu || menu.length === 0) {
    container.innerHTML = `<p>Không có món nào trong menu.</p>`;
    return;
  }

  container.innerHTML = menu
    .map(
      (item) => `
      <div class="menu-item" role="listitem">
        <img 
          src="http://127.0.0.1:5000/static${item.HinhAnh}"
          alt="${item.TenMon}" 
          class="menu-img"
          onerror="this.src='image/no-image.jpg';"
        />
        <div class="menu-body">
          <h3 class="menu-name">${item.TenMon}</h3>
          <p class="menu-desc">${item.MoTa || ""}</p>
          <div class="menu-footer">
            <span class="menu-price">${parseInt(item.Gia).toLocaleString()} ₫</span>
            <button 
              class="btn add-to-cart" 
              data-id="${item.IDMon}" 
              data-name="${item.TenMon}" 
              data-price="${item.Gia}" 
              data-cat="${item.DanhMuc || ''}"
            >+</button>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".add-to-cart").forEach((btn) =>
    btn.addEventListener("click", (e) => handleAddToCart(e.target.dataset))
  );
}

// =============================
// THÊM MÓN
// =============================
function handleAddToCart(data) {
  const isSpicy = data.name.toLowerCase().includes("mì");
  openOptionModal(data, isSpicy);
}

// =============================
// MODAL
// =============================
function openOptionModal(data, isSpicy) {
  const modal = document.getElementById("option-modal");
  const levelSelect = document.getElementById("level-select");
  const levelLabel = document.querySelector("label[for='level-select']");
  const noteInput = document.getElementById("note-input");

  selectedItem = data;
  noteInput.value = "";
  levelSelect.value = "1";
  modal.classList.remove("hidden");

  if (isSpicy) {
    levelSelect.style.display = "block";
    levelLabel.style.display = "block";
  } else {
    levelSelect.style.display = "none";
    levelLabel.style.display = "none";
  }
}

document.getElementById("cancel-modal").addEventListener("click", () => {
  document.getElementById("option-modal").classList.add("hidden");
  selectedItem = null;
});

document.getElementById("confirm-modal").addEventListener("click", () => {
  const note = document.getElementById("note-input").value.trim();
  const levelSelect = document.getElementById("level-select");
  const level = levelSelect.style.display === "none" ? "" : levelSelect.value;

  if (selectedItem) {
    addToCart({ ...selectedItem, note, level });
  }
  document.getElementById("option-modal").classList.add("hidden");
  selectedItem = null;
});

// =============================
// GIỎ HÀNG
// =============================
function addToCart({ id, name, price, note = "", level = "" }) {
  const item = cart.find((x) => x.id === id && x.note === note && x.level === level);
  if (item) item.qty++;
  else cart.push({ id, name, price: parseFloat(price), qty: 1, note, level });
  renderCart();
}

function renderCart() {
  const cartList = document.getElementById("cart-list");
  const subtotal = document.getElementById("cart-subtotal");
  const btnOrder = document.getElementById("btn-order");

  if (cart.length === 0) {
    cartList.innerHTML = `<div class="muted empty-cart-message">🛒 Giỏ hàng trống. Hãy chọn món!</div>`;
    subtotal.textContent = "0 ₫";
    btnOrder.disabled = true;
    return;
  }

  cartList.innerHTML = cart
    .map(
      (item) => `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong><br>
          ${item.level ? `<span>🌶️ Cấp độ: ${item.level}</span><br>` : ""}
          ${item.note ? `<span>📝 ${item.note}</span>` : ""}
        </div>
        <div>
          <button class="qty-btn" data-id="${item.id}" data-action="minus">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-action="plus">+</button>
          <strong>${(item.price * item.qty).toLocaleString()} ₫</strong>
        </div>
      </div>
    `
    )
    .join("");

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  subtotal.textContent = `${total.toLocaleString()} ₫`;
  btnOrder.disabled = false;

  document.querySelectorAll(".qty-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const { id, action } = e.target.dataset;
      const item = cart.find((x) => x.id === id);
      if (!item) return;

      if (action === "plus") item.qty++;
      else if (action === "minus") item.qty--;
      if (item.qty <= 0) cart = cart.filter((x) => x.id !== id);
      renderCart();
    })
  );
}

// =============================
// DANH MỤC
// =============================
function getCategoriesFromMenu() {
  const categories = new Set(menuData.map((m) => m.DanhMuc).filter(Boolean));
  return Array.from(categories);
}

function renderCategoryButtons() {
  const container = document.querySelector(".category-bar");
  if (!container) return;

  const categories = getCategoriesFromMenu();
  const existing = Array.from(container.querySelectorAll(".cat-btn")).map(
    (btn) => btn.dataset.cat
  );

  categories.forEach((cat) => {
    if (!existing.includes(cat)) {
      const btn = document.createElement("button");
      btn.className = "cat-btn";
      btn.dataset.cat = cat;
      btn.textContent = cat;
      container.appendChild(btn);
    }
  });

  attachCategoryEvents();
}

function attachCategoryEvents() {
  document.querySelectorAll(".cat-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      const query = document.getElementById("search").value.trim().toLowerCase();
      filterMenu(query);
    })
  );
}

// =============================
// TÌM KIẾM
// =============================
function filterMenu(searchQuery = "") {
  const activeBtn = document.querySelector(".cat-btn.active");
  const activeCat = activeBtn ? activeBtn.dataset.cat : "all";

  let filtered = menuData;
  if (activeCat !== "all") {
    filtered = filtered.filter((m) => m.DanhMuc === activeCat);
  }

  if (searchQuery) {
    filtered = filtered.filter(
      (m) =>
        m.TenMon.toLowerCase().includes(searchQuery) ||
        (m.MoTa && m.MoTa.toLowerCase().includes(searchQuery))
    );
  }

  renderMenu(filtered);
}

// =============================
// GỬI ĐƠN HÀNG
// =============================
document.addEventListener("DOMContentLoaded", () => {
  fetchMenu();

  // Tìm kiếm
  const searchInput = document.getElementById("search");
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    filterMenu(query);
  });

  // Gửi đơn
  const btnOrder = document.getElementById("btn-order");
  btnOrder.addEventListener("click", async () => {
    if (cart.length === 0) {
      alert("Giỏ hàng trống!");
      return;
    }

    const table = document.getElementById("table-input").value;
    if (!table) {
      alert("Vui lòng nhập số bàn!");
      return;
    }

    const orderData = {
  IDBan: table, // ✅ Flask nhận đúng key này
  items: cart.map((i) => ({
    id: i.id,
    qty: i.qty,
    note: i.note,
    level: i.level,
  })),
  time: new Date().toLocaleString("vi-VN"),
};


    try {
      const res = await fetch(ORDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Lỗi máy chủ (${res.status})`);
      }

      const json = await res.json();
      alert(`✅ Đơn hàng đã gửi! Mã đơn: ${json.IDDonHang || "—"}`);

      cart = [];
      renderCart();
    } catch (err) {
      console.error("Lỗi gửi đơn:", err);
      alert("❌ Không gửi được đơn. Vui lòng thử lại.");
    }
  });
});
