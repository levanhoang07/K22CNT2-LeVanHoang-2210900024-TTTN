/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Client Side JavaScript
 *  Chức năng: Đặt món QR cho khách hàng
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

// State quản lý
const state = {
  idBan: null,
  tenBan: '',
  cart: [],
  menu: [],
  categories: [],
  currentDish: null,
  currentOrderId: null
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 MyCay_Oder Client Started');
  
  // Lấy ID bàn từ URL (ví dụ: ?ban=1)
  const urlParams = new URLSearchParams(window.location.search);
  state.idBan = urlParams.get('ban') || 1; // Mặc định bàn 1 nếu không có
  
  // Khởi tạo
  await initializePage();
  setupEventListeners();
  setupSocketListeners();
  
  console.log('✅ Initialization complete');
});

async function initializePage() {
  try {
    // Load thông tin bàn
    await loadTableInfo();
    
    // Load menu
    await loadMenu();
    
    // Load giỏ hàng hiện tại (nếu có)
    await loadCurrentOrder();
    
    showNotification('✅ Chào mừng bạn đến với Mì Cay One!', 'success');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showNotification('Lỗi khi tải dữ liệu. Vui lòng thử lại!', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function loadTableInfo() {
  try {
    const response = await fetch(`${API_BASE}/ban/${state.idBan}`);
    const result = await response.json();
    
    if (result.success) {
      state.tenBan = result.data.TenBan;
      document.getElementById('table-name').textContent = state.tenBan;
      console.log('✅ Table info loaded:', state.tenBan);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Load table error:', error);
    document.getElementById('table-name').textContent = 'Lỗi';
    throw error;
  }
}

async function loadMenu() {
  try {
    const response = await fetch(`${API_BASE}/menu`);
    const result = await response.json();
    
    if (result.success) {
      state.categories = result.data.danh_muc;
      
      // Flatten menu
      state.menu = [];
      state.categories.forEach(cat => {
        cat.mon_an.forEach(mon => {
          state.menu.push({...mon, TenDanhMuc: cat.TenDanhMuc, IDDanhMuc: cat.IDDanhMuc});
        });
      });
      
      renderCategories();
      renderMenu();
      console.log('✅ Menu loaded:', state.menu.length, 'items');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Load menu error:', error);
    throw error;
  }
}

async function loadCurrentOrder() {
  try {
    const response = await fetch(`${API_BASE}/ban/${state.idBan}/donhang`);
    const result = await response.json();

    if (result.success && result.data) {
      state.currentOrderId = result.data.IDDonHang;

      // ✅ LƯU RIÊNG
      state.currentOrder = result.data.chi_tiet;

      console.log('✅ Current order loaded:', state.currentOrderId);
    }
  } catch (error) {
    console.error('❌ Load current order error:', error);
  }
}


async function addToOrder(item) {
  try {
    const response = await fetch(`${API_BASE}/order/add`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        id_ban: state.idBan,
        id_mon: item.idMon,
        so_luong: item.soLuong,
        cap_do_cay: item.capDoCay,
        ghi_chu: item.ghiChu
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      state.currentOrderId = result.data.id_don_hang;
      showNotification('✅ Đã thêm món vào đơn hàng!', 'success');
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Add to order error:', error);
    showNotification('Lỗi khi thêm món. Vui lòng thử lại!', 'error');
    return false;
  }
}

async function callStaff(message) {
  try {
    const response = await fetch(`${API_BASE}/ban/${state.idBan}/call`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({noi_dung: message})
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('✅ Đã gọi nhân viên! Vui lòng chờ trong giây lát.', 'success');
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Call staff error:', error);
    showNotification('Lỗi khi gọi nhân viên. Vui lòng thử lại!', 'error');
    return false;
  }
}
async function submitReview(data) {
  try {
    if (!data.noiDung || !data.noiDung.trim()) {
      showNotification('Vui lòng nhập nội dung đánh giá!', 'warning');
      return false;
    }
    
/// đámh giá
    const response = await fetch(`${API_BASE}/danhgia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id_ban: state.idBan,
        noi_dung: data.noiDung,
        ten_khach: data.tenKhach || null
      })
    });

    const result = await response.json();

    if (response.ok && result.status === 'ok') {
      showNotification('✅ Cảm ơn bạn đã đánh giá!', 'success');
      return true;
    } else {
      throw new Error(result.message || 'Gửi đánh giá thất bại');
    }

  } catch (error) {
    console.error('❌ Submit review error:', error);
    showNotification('❌ Lỗi khi gửi đánh giá!', 'error');
    return false;
  }
}
document.addEventListener("DOMContentLoaded", () => {

  const btnReview = document.getElementById("btn-review");
  const reviewModal = document.getElementById("review-modal");
  const closeReviewModal = document.getElementById("close-review-modal");
  const sendReview = document.getElementById("send-review");

  if (!btnReview || !reviewModal || !sendReview) {
    console.error("❌ Thiếu nút hoặc modal đánh giá");
    return;
  }

  // ===== MỞ MODAL =====
  btnReview.addEventListener("click", () => {
    reviewModal.classList.remove("hidden");
  });

  // ===== ĐÓNG MODAL =====
  closeReviewModal.addEventListener("click", () => {
    reviewModal.classList.add("hidden");
  });

  // ===== GỬI ĐÁNH GIÁ =====
  sendReview.addEventListener("click", async () => {
    const noiDung = document.getElementById("review-content").value.trim();
    const tenKhach = document.getElementById("review-name").value.trim();

    if (!noiDung) {
      showNotification("Vui lòng nhập nội dung đánh giá!", "warning");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/danhgia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id_ban: state.idBan,
          noi_dung: noiDung,
          ten_khach: tenKhach || null
        })
      });

      const result = await response.json();

      if (response.ok && result.success === true) {
        showNotification("✅ Cảm ơn bạn đã đánh giá!", "success");

        // Reset form + đóng modal
        document.getElementById("review-content").value = "";
        document.getElementById("review-name").value = "";
        reviewModal.classList.add("hidden");

      } else {
        showNotification(result.message || "Gửi đánh giá thất bại", "error");
      }

    } catch (error) {
      console.error("❌ Submit review error:", error);
      showNotification("❌ Lỗi khi gửi đánh giá!", "error");
    }
  });

});


// ═══════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function renderCategories() {
  const categoryBar = document.querySelector('.category-bar');
  categoryBar.innerHTML = `
    <button class="btn btn-outline-primary category-btn active" data-category="all">
      Tất cả
    </button>
    ${state.categories.map(cat => `
      <button class="btn btn-outline-primary category-btn" data-category="${cat.IDDanhMuc}">
        ${cat.TenDanhMuc}
      </button>
    `).join('')}
  `;
  
  // Event listeners cho category buttons
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const category = e.target.dataset.category;
      renderMenu(category === 'all' ? null : parseInt(category));
    });
  });
}

function renderMenu(categoryFilter = null) {
  const container = document.getElementById('menu-container');
  
  let filteredMenu = state.menu;
  
  // Filter by category
  if (categoryFilter) {
    filteredMenu = filteredMenu.filter(item => item.IDDanhMuc === categoryFilter);
  }
  
  // Filter by search
  const searchTerm = document.getElementById('search').value.toLowerCase();
  if (searchTerm) {
    filteredMenu = filteredMenu.filter(item => 
      item.TenMon.toLowerCase().includes(searchTerm) ||
      item.MoTa.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filteredMenu.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-5 text-muted">Không tìm thấy món ăn phù hợp</div>';
    return;
  }
  
  container.innerHTML = filteredMenu.map(item => `
    <div class="col">
      <div class="card dish-card h-100 shadow-sm" data-id="${item.IDMon}">
        <div class="dish-image-wrapper">
          <img src="/static/images/${item.HinhAnh}" 
               class="card-img-top dish-image" 
               alt="${item.TenMon}"
               onerror="this.src='/static/images/no-image.jpg'">
        </div>
        <div class="card-body d-flex flex-column">
          <h6 class="card-title fw-bold">${item.TenMon}</h6>
          <p class="card-text text-muted small flex-grow-1">${item.MoTa}</p>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <span class="text-danger fw-bold fs-5">${formatPrice(item.Gia)}</span>
            <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${item.IDMon}">
              <span class="btn-text">+ Thêm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  // Event listeners cho add to cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dishId = parseInt(btn.dataset.id);
      openDishModal(dishId);
    });
  });
}

function renderCart() {
  const cartList = document.getElementById('cart-list');
  const btnOrder = document.getElementById('btn-order');
  
  if (state.cart.length === 0) {
    cartList.innerHTML = '<div class="empty text-muted text-center py-5">Giỏ hàng trống</div>';
    btnOrder.disabled = true;
    updateCartTotal();
    return;
  }
  
  cartList.innerHTML = state.cart.map((item, index) => `
    <div class="cart-item mb-3 p-3 border rounded">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div class="flex-grow-1">
          <h6 class="mb-1">${item.tenMon}</h6>
          
          ${item.ghiChu ? `<br><small class="text-muted">📝 ${item.ghiChu}</small>` : ''}
        </div>
        <button class="btn btn-sm btn-danger remove-item" data-index="${index}">
          <span style="font-size: 18px;">×</span>
        </button>
      </div>
      
      <div class="d-flex justify-content-between align-items-center">
        <div class="quantity-control d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary decrease-qty" data-index="${index}">−</button>
          <span class="fw-bold">${item.soLuong}</span>
          <button class="btn btn-sm btn-outline-secondary increase-qty" data-index="${index}">+</button>
        </div>
        <span class="fw-bold text-danger">${formatPrice(item.donGia * item.soLuong)}</span>
      </div>
    </div>
  `).join('');
  
  btnOrder.disabled = false;
  updateCartTotal();
  
  // Event listeners
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      state.cart.splice(index, 1);
      renderCart();
    });
  });
  
  document.querySelectorAll('.increase-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      state.cart[index].soLuong++;
      renderCart();
    });
  });
  
  document.querySelectorAll('.decrease-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      if (state.cart[index].soLuong > 1) {
        state.cart[index].soLuong--;
      } else {
        state.cart.splice(index, 1);
      }
        renderCart();

    });
  });
}

function updateCartTotal() {
  const total = state.cart.reduce((sum, item) => sum + (item.donGia * item.soLuong), 0);
  document.getElementById('cart-subtotal').textContent = formatPrice(total);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function openDishModal(dishId) {
  const dish = state.menu.find(d => d.IDMon === dishId);
  if (!dish) return;
  
  state.currentDish = dish;
  
  const modal = document.getElementById('option-modal');
  const spicyBlock = document.getElementById('spicy-block');
  
  // Chỉ hiện cấp độ cay cho món mì cay
  if (dish.TenDanhMuc === 'Mì cay') {
    spicyBlock.style.display = 'block';
  } else {
    spicyBlock.style.display = 'none';
  }
  
  // Reset form
  document.getElementById('level-select').value = '3';
  document.getElementById('note-input').value = '';
  
  modal.classList.remove('hidden');
}

function closeDishModal() {
  document.getElementById('option-modal').classList.add('hidden');
  state.currentDish = null;
}

function confirmDishModal() {
  if (!state.currentDish) return;
  
  const spicyLevel = document.getElementById('level-select').value;
  const note = document.getElementById('note-input').value.trim();
  
  const cartItem = {
    idMon: state.currentDish.IDMon,
    tenMon: state.currentDish.TenMon,
    hinhAnh: state.currentDish.HinhAnh,
    donGia: state.currentDish.Gia,
    soLuong: 1,
    capDoCay: state.currentDish.TenDanhMuc === 'Mì cay' ? `Cấp ${spicyLevel}` : 'Không cay',
    ghiChu: note
  };
  
  // Kiểm tra món trùng
  const existingIndex = state.cart.findIndex(item => 
    item.idMon === cartItem.idMon && 
    item.capDoCay === cartItem.capDoCay && 
    item.ghiChu === cartItem.ghiChu
  );
  
  if (existingIndex >= 0) {
    state.cart[existingIndex].soLuong++;
  } else {
    state.cart.push(cartItem);
  }
  
  renderCart();
  closeDishModal();
  showNotification(`✅ Đã thêm "${cartItem.tenMon}" vào giỏ hàng!`, 'success');
}

function openStaffModal() {
  document.getElementById('staff-modal').classList.remove('hidden');
  document.getElementById('staff-message').value = '';
}

function closeStaffModal() {
  document.getElementById('staff-modal').classList.add('hidden');
}

async function sendStaffRequest() {
  const message = document.getElementById('staff-message').value.trim();
  
  if (!message) {
    showNotification('Vui lòng nhập nội dung yêu cầu!', 'warning');
    return;
  }
  
  const success = await callStaff(message);
  if (success) {
    closeStaffModal();
  }
}
// ================= LỊCH SỬ ĐẶT MÓN =================

// MỞ MODAL
function openHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (!modal) {
    console.error('❌ Không tìm thấy history-modal');
    return;
  }

  modal.classList.remove('hidden');
  loadOrderHistory();
}

// ĐÓNG MODAL
function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.add('hidden');
}

// LOAD LỊCH SỬ ĐƠN HÀNG
async function loadOrderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) {
    console.error('❌ Không tìm thấy history-list');
    return;
  }

  historyList.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border"></div>
      <div class="mt-2">Đang tải lịch sử...</div>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/ban/${state.idBan}/donhang`);
    const json = await res.json();

    // ❌ Không có đơn
    if (!json.success || !json.data) {
      historyList.innerHTML = `
        <p class="text-muted text-center py-5">
          📭 Chưa có đơn hàng nào
        </p>
      `;
      return;
    }

    const order = json.data;

    historyList.innerHTML = `
      <div class="order-history-item p-3 border rounded shadow-sm">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <strong>🧾 Đơn #${order.IDDonHang}</strong>
          <small class="text-muted">${formatDate(order.NgayTao)}</small>
        </div>

        <div class="mb-2">
          ${order.chi_tiet.map(item => `
            <div class="d-flex justify-content-between mb-1">
              <span>${item.TenMon} × ${item.SoLuong}</span>
              <span class="text-danger">${formatPrice(item.ThanhTien)}</span>
            </div>
          `).join('')}
        </div>

        <hr>

        <div class="d-flex justify-content-between fw-bold fs-5 text-danger">
          <span>TỔNG CỘNG</span>
          <span>${formatPrice(order.TongTien)} đồng</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('❌ Load history error:', err);
    historyList.innerHTML = `
      <p class="text-danger text-center py-5">
        ❌ Lỗi khi tải lịch sử đơn hàng
      </p>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  // Search
  document.getElementById('search').addEventListener('input', () => {
    renderMenu();
  });
  
  // Cart buttons
  document.getElementById('btn-order').addEventListener('click', submitOrder);
  document.getElementById('btn-call-staff').addEventListener('click', openStaffModal);
  
  // Dish modal
  document.getElementById('confirm-modal').addEventListener('click', confirmDishModal);
  document.getElementById('cancel-modal').addEventListener('click', closeDishModal);
  document.querySelector('#option-modal .modal-backdrop').addEventListener('click', closeDishModal);
  
  // Staff modal
  document.getElementById('send-staff').addEventListener('click', sendStaffRequest);
  document.getElementById('close-staff-modal').addEventListener('click', closeStaffModal);
  document.querySelector('#staff-modal .modal-backdrop').addEventListener('click', closeStaffModal);
  
  // History
  document.getElementById('history-bubble').addEventListener('click', openHistoryModal);
  document.getElementById('close-history').addEventListener('click', closeHistoryModal);
  document.querySelector('#history-modal .modal-backdrop').addEventListener('click', closeHistoryModal);
}

async function submitOrder() {
  if (state.cart.length === 0) return;
  
  const btnOrder = document.getElementById('btn-order');
  btnOrder.disabled = true;
  btnOrder.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang gửi...';
  
  try {
    // Gửi từng món trong giỏ hàng
    for (const item of state.cart) {
      const success = await addToOrder(item);
      if (!success) {
        throw new Error('Không thể thêm món');
      }
    }
    
    // Clear cart sau khi gửi thành công
    state.cart.length = 0; 
    renderCart();
    
    showNotification('🎉 Đơn hàng đã được gửi! Vui lòng chờ xác nhận.', 'success');
    
    // Reload đơn hàng hiện tại
    await loadCurrentOrder();
    
  } catch (error) {
    console.error('❌ Submit order error:', error);
    showNotification('Lỗi khi gửi đơn hàng. Vui lòng thử lại!', 'error');
  } finally {
    btnOrder.disabled = false;
    btnOrder.innerHTML = '🍜 Gửi đơn hàng';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

function setupSocketListeners() {
  socket.on('connect', () => {
    console.log('✅ Socket connected');
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });
  
  socket.on('order_status_update', (data) => {
    if (data.id_ban === state.idBan) {
      console.log('📦 Order status updated:', data.trang_thai);
      showNotification(`📦 ${data.trang_thai_text}`, 'info');
    }
  });
  
  socket.on('order_paid', (data) => {
    if (data.id_ban === state.idBan) {
      console.log('💰 Order paid');
      showNotification('💰 Đơn hàng đã được thanh toán. Cảm ơn quý khách!', 'success');
      
      // Reset state
      state.cart = [];
      state.currentOrderId = null;
      renderCart();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showNotification(message, type = 'info') {
  // Tạo notification element
  const notification = document.createElement('div');
  notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info'} notification-toast`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// CSS Animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

console.log('📱 MyCay_Oder Client Loaded');