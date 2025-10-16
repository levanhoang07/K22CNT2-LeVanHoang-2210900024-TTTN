// 📁 /frontend/client.js

const API_URL = "http://localhost:5000/api";
const menuContainer = document.getElementById("menu-container");
const orderList = document.getElementById("order-list");
const totalPrice = document.getElementById("total-price");
const submitBtn = document.getElementById("submit-order");

let cart = [];

// 🥢 Lấy danh sách món ăn từ server
async function loadMenu() {
  try {
    const res = await fetch(`${API_URL}/menu`);
    const data = await res.json();

    menuContainer.innerHTML = "";
    data.forEach((item) => {
      const card = document.createElement("div");
      card.className = "menu-item";
      card.innerHTML = `
        <img src="${item.image_url}" alt="${item.name}" class="menu-image"/>
        <h3>${item.name}</h3>
        <p>${item.price.toLocaleString()} đ</p>
        <button onclick="addToCart(${item.id}, '${item.name}', ${item.price})">Thêm</button>
      `;
      menuContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Lỗi tải menu:", err);
    menuContainer.innerHTML = `<p class="error">Không thể tải menu!</p>`;
  }
}

// 🛒 Thêm món vào giỏ hàng
function addToCart(id, name, price) {
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }
  renderCart();
}

// 🧾 Hiển thị giỏ hàng
function renderCart() {
  orderList.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    total += item.price * item.qty;
    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} x${item.qty} 
      - ${(item.price * item.qty).toLocaleString()} đ
      <button onclick="removeItem(${i})" class="remove-btn">✖</button>
    `;
    orderList.appendChild(li);
  });

  totalPrice.textContent = total.toLocaleString() + " đ";
}

// ❌ Xóa món khỏi giỏ hàng
function removeItem(index) {
  cart.splice(index, 1);
  renderCart();
}

// 📤 Gửi đơn hàng
async function submitOrder() {
  if (cart.length === 0) return alert("Giỏ hàng đang trống!");

  const tableNumber = document.getElementById("table-number").value;
  if (!tableNumber) return alert("Vui lòng nhập số bàn!");

  const payload = {
    table_number: tableNumber,
    items: cart.map((i) => ({ id: i.id, qty: i.qty })),
  };

  try {
    const res = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Đặt món thành công! Mã đơn: ${data.order_id}`);
      cart = [];
      renderCart();
    } else {
      alert("Đặt món thất bại: " + data.message);
    }
  } catch (err) {
    console.error("Lỗi gửi đơn hàng:", err);
    alert("Không thể gửi đơn hàng!");
  }
}

// Gắn sự kiện
submitBtn.addEventListener("click", submitOrder);

// Gọi khi tải trang
loadMenu();
