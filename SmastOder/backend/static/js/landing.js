/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MI CAY HOANGCHEF - MOBILE-FIRST APP
 *  Optimized for touch, smooth animations, GrabFood/ShopeeFood experience
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_BASE: '/api',
  STORAGE_KEY: 'cart_data',
  HISTORY_KEY: 'order_history',
  ANIMATION_DURATION: 300
};

const ORDER_STATUS = {
  CHO_XAC_NHAN: { text: '🕐 Chờ xác nhận', color: '#ffc107' },
  DANG_NAU: { text: '👨‍🍳 Đang chế biến', color: '#17a2b8' },
  HOAN_THANH: { text: '🍜 Đã hoàn thành', color: '#28a745' }
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const AppState = {
  idBan: null,
  tenBan: '',
  menu: [],
  categories: [],
  cart: [],
  currentDish: null,
  orderHistory: [],
  currentOrderId: null,
  currentOrderStatus: null,
  
  init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.idBan = urlParams.get('ban') || 1;
    this.loadFromStorage();
  },
  
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.cart = data.cart || [];
      }
      
      const history = localStorage.getItem(CONFIG.HISTORY_KEY);
      if (history) {
        this.orderHistory = JSON.parse(history);
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  },
  
  saveToStorage() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        cart: this.cart,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },
  
  saveHistory() {
    try {
      localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(this.orderHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  },
  
  clearHistory() {
    this.orderHistory = [];
    localStorage.removeItem(CONFIG.HISTORY_KEY);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

const socket = io();

socket.on('connect', () => {
  console.log('✅ Socket connected');
  socket.emit('join_room_ban', { id_ban: AppState.idBan });
});

socket.on('order_status_update', (data) => {
  if (data.id_ban != AppState.idBan) return;
  console.log('📩 Order status update:', data.trang_thai);
  
  AppState.currentOrderStatus = data.trang_thai;
  HistoryManager.addStatusMessage(data.trang_thai);
});

socket.on('order_paid', (data) => {
  if (data.id_ban != AppState.idBan) return;
  console.log('💰 Order paid - clearing history');
  
  AppState.clearHistory();
  HistoryManager.render();
  Utils.showToast('✅ Đơn hàng đã được thanh toán!', 'success');
});

// ═══════════════════════════════════════════════════════════════════════════
// API SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const ApiService = {
  async loadTableInfo(idBan) {
    const response = await fetch(`${CONFIG.API_BASE}/ban/${idBan}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },
  
  async loadMenu() {
    const response = await fetch(`${CONFIG.API_BASE}/menu`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },
  
  async addToOrder(idBan, item) {
    const response = await fetch(`${CONFIG.API_BASE}/order/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_ban: idBan,
        id_mon: item.idMon,
        so_luong: item.soLuong,
        cap_do_cay: item.capDoCay,
        ghi_chu: item.ghiChu
      })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.data;
  },
  
  async callStaff(idBan, message) {
    const response = await fetch(`${CONFIG.API_BASE}/ban/${idBan}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noi_dung: message })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return true;
  },
  
  async submitReview(idBan, noiDung, tenKhach = null) {
    const response = await fetch(`${CONFIG.API_BASE}/danhgia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_ban: idBan,
        noi_dung: noiDung,
        ten_khach: tenKhach
      })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return true;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UI RENDERER
// ═══════════════════════════════════════════════════════════════════════════

const UIRenderer = {
  updateTableName(tenBan) {
    const el = document.getElementById('table-name');
    if (el) el.textContent = tenBan;
  },
  
  renderCategories(categories) {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    
    const tabs = [
      { id: 'all', name: 'Tất cả' },
      ...categories.map(cat => ({ id: cat.IDDanhMuc, name: cat.TenDanhMuc }))
    ];
    
    container.innerHTML = tabs.map((tab, index) => `
      <button 
        class="category-tab ${index === 0 ? 'active' : ''}" 
        data-category="${tab.id}">
        ${tab.name}
      </button>
    `).join('');
    
    // Event listeners
    container.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.category-tab').forEach(b => 
          b.classList.remove('active')
        );
        e.target.classList.add('active');
        
        const category = e.target.dataset.category;
        const categoryId = category === 'all' ? null : parseInt(category);
        UIRenderer.renderMenu(AppState.menu, categoryId);
      });
    });
  },
  
  renderMenu(menuItems, categoryFilter = null) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    
    let filteredMenu = menuItems;
    
    // Filter by category
    if (categoryFilter) {
      filteredMenu = filteredMenu.filter(item => item.IDDanhMuc === categoryFilter);
    }
    
    // Filter by search
    const searchEl = document.getElementById('search');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    if (searchTerm) {
      filteredMenu = filteredMenu.filter(item =>
        item.TenMon.toLowerCase().includes(searchTerm) ||
        item.MoTa.toLowerCase().includes(searchTerm)
      );
    }
    
    // Empty state
    if (filteredMenu.length === 0) {
      container.innerHTML = `
        <div class="empty-menu">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Không tìm thấy món ăn</p>
        </div>
      `;
      return;
    }
    
    // Render menu cards
    container.innerHTML = filteredMenu.map(item => `
      <div class="menu-card" data-id="${item.IDMon}">
        <div class="menu-card-image">
          <img src="/static/images/${item.HinhAnh}" 
               alt="${item.TenMon}"
               onerror="this.src='/static/images/no-image.jpg'">
        </div>
        <div class="menu-card-body">
          <h3 class="menu-card-name">${item.TenMon}</h3>
          <div class="menu-card-footer">
            <span class="menu-card-price">${Utils.formatPrice(item.Gia)}</span>
            <button class="btn-add-quick" data-id="${item.IDMon}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    
    // Event listeners
    container.querySelectorAll('.btn-add-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dishId = parseInt(btn.dataset.id);
        ModalManager.openDishModal(dishId);
      });
    });
  },
  
  renderCart(cart) {
    const cartList = document.getElementById('cart-list');
    const btnOrder = document.getElementById('btn-order');
    
    if (!cartList) return;
    
    // Empty cart
    if (cart.length === 0) {
      cartList.innerHTML = `
        <div class="empty-cart">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <p>Giỏ hàng trống</p>
        </div>
      `;
      if (btnOrder) btnOrder.disabled = true;
      UIRenderer.updateBottomBar(cart);
      return;
    }
    
    // Render cart items
    cartList.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4 class="cart-item-name">${item.tenMon}</h4>
          ${item.capDoCay || item.ghiChu ? `
            <div class="cart-item-options">
              ${item.capDoCay ? `<span class="cart-item-tag">🌶️ ${item.capDoCay}</span>` : ''}
              ${item.ghiChu ? `<span class="cart-item-tag">📝 ${item.ghiChu}</span>` : ''}
            </div>
          ` : ''}
          <div class="cart-item-footer">
            <span class="cart-item-price">${Utils.formatPrice(item.donGia * item.soLuong)}</span>
            <div class="quantity-control">
              <button class="btn-qty decrease-qty" data-index="${index}">−</button>
              <span class="qty-value">${item.soLuong}</span>
              <button class="btn-qty increase-qty" data-index="${index}">+</button>
            </div>
          </div>
        </div>
        <button class="btn-remove" data-index="${index}">×</button>
      </div>
    `).join('');
    
    if (btnOrder) btnOrder.disabled = false;
    UIRenderer.updateBottomBar(cart);
    UIRenderer.attachCartEventListeners();
  },
  
  attachCartEventListeners() {
    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartManager.removeItem(index);
      });
    });
    
    document.querySelectorAll('.increase-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartManager.increaseQuantity(index);
      });
    });
    
    document.querySelectorAll('.decrease-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartManager.decreaseQuantity(index);
      });
    });
  },
  
  updateBottomBar(cart) {
    const bottomBar = document.getElementById('bottom-cart-bar');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const cartSubtotal = document.getElementById('cart-subtotal');
    
    const totalItems = cart.reduce((sum, item) => sum + item.soLuong, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.donGia * item.soLuong), 0);
    
    if (totalItems > 0) {
      if (bottomBar) bottomBar.classList.add('show');
      if (cartCount) cartCount.textContent = `${totalItems} món`;
      if (cartTotal) cartTotal.textContent = Utils.formatPrice(totalPrice);
      if (cartSubtotal) cartSubtotal.textContent = Utils.formatPrice(totalPrice);
    } else {
      if (bottomBar) bottomBar.classList.remove('show');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CART MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const CartManager = {
  addItem(dish, options = {}) {
    const cartItem = {
      idMon: dish.IDMon,
      tenMon: dish.TenMon,
      donGia: dish.Gia,
      soLuong: 1,
      capDoCay: options.capDoCay || '',
      ghiChu: options.ghiChu || ''
    };
    
    // Check for duplicate
    const existingIndex = AppState.cart.findIndex(item =>
      item.idMon === cartItem.idMon &&
      item.capDoCay === cartItem.capDoCay &&
      item.ghiChu === cartItem.ghiChu
    );
    
    if (existingIndex >= 0) {
      AppState.cart[existingIndex].soLuong++;
    } else {
      AppState.cart.push(cartItem);
    }
    
    AppState.saveToStorage();
    UIRenderer.renderCart(AppState.cart);
    Utils.showToast(`✅ Đã thêm "${cartItem.tenMon}"`, 'success');
  },
  
  removeItem(index) {
    AppState.cart.splice(index, 1);
    AppState.saveToStorage();
    UIRenderer.renderCart(AppState.cart);
  },
  
  increaseQuantity(index) {
    if (AppState.cart[index]) {
      AppState.cart[index].soLuong++;
      AppState.saveToStorage();
      UIRenderer.renderCart(AppState.cart);
    }
  },
  
  decreaseQuantity(index) {
    if (AppState.cart[index]) {
      if (AppState.cart[index].soLuong > 1) {
        AppState.cart[index].soLuong--;
        AppState.saveToStorage();
        UIRenderer.renderCart(AppState.cart);
      } else {
        CartManager.removeItem(index);
      }
    }
  },
  
  clearCart() {
    AppState.cart = [];
    AppState.saveToStorage();
    UIRenderer.renderCart(AppState.cart);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BOTTOM SHEET MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const BottomSheetManager = {
  init() {
    const cartBar = document.getElementById('cart-bar-trigger');
    const cartSheet = document.getElementById('cart-sheet');
    const sheetOverlay = document.getElementById('sheet-overlay');
    const btnClose = document.getElementById('btn-close-sheet');
    
    if (cartBar) {
      cartBar.addEventListener('click', () => this.open());
    }
    
    if (sheetOverlay) {
      sheetOverlay.addEventListener('click', () => this.close());
    }
    
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }
    
    // Swipe down to close
    this.initSwipeGesture();
  },
  
  open() {
    const cartSheet = document.getElementById('cart-sheet');
    if (cartSheet) {
      cartSheet.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  },
  
  close() {
    const cartSheet = document.getElementById('cart-sheet');
    if (cartSheet) {
      cartSheet.classList.remove('show');
      document.body.style.overflow = '';
    }
  },
  
  initSwipeGesture() {
    const sheetContent = document.querySelector('.sheet-content');
    if (!sheetContent) return;
    
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    sheetContent.addEventListener('touchstart', (e) => {
      if (e.target.closest('.sheet-body')) return; // Allow scrolling in body
      startY = e.touches[0].clientY;
      isDragging = true;
    });
    
    sheetContent.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0) {
        sheetContent.style.transform = `translateY(${diff}px)`;
      }
    });
    
    sheetContent.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      
      const diff = currentY - startY;
      
      if (diff > 100) {
        this.close();
      }
      
      sheetContent.style.transform = '';
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MODAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const ModalManager = {
  openDishModal(dishId) {
    const dish = AppState.menu.find(d => d.IDMon === dishId);
    if (!dish) return;
    
    AppState.currentDish = dish;
    
    const modal = document.getElementById('option-modal');
    const spicyBlock = document.getElementById('spicy-block');
    
    // Show/hide spicy selector
    if (spicyBlock) {
      spicyBlock.style.display = dish.TenDanhMuc === 'Mì cay' ? 'block' : 'none';
    }
    
    // Reset form
    const levelSelect = document.getElementById('level-select');
    const noteInput = document.getElementById('note-input');
    
    if (levelSelect) levelSelect.value = '3';
    if (noteInput) noteInput.value = '';
    
    if (modal) modal.classList.add('show');
  },
  
  closeDishModal() {
    const modal = document.getElementById('option-modal');
    if (modal) modal.classList.remove('show');
    AppState.currentDish = null;
  },
  
  confirmDishModal() {
    if (!AppState.currentDish) return;
    
    const spicyLevel = document.getElementById('level-select')?.value || '3';
    const note = document.getElementById('note-input')?.value.trim() || '';
    
    const options = {
      capDoCay: AppState.currentDish.TenDanhMuc === 'Mì cay' ? `Cấp ${spicyLevel}` : '',
      ghiChu: note
    };
    
    CartManager.addItem(AppState.currentDish, options);
    this.closeDishModal();
  },
  
  openStaffModal() {
    const modal = document.getElementById('staff-modal');
    if (modal) modal.classList.add('show');
  },
  
  closeStaffModal() {
    const modal = document.getElementById('staff-modal');
    if (modal) modal.classList.remove('show');
  },
  
  async sendStaffRequest() {
    const messageInput = document.getElementById('staff-message');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message) {
      Utils.showToast('⚠️ Vui lòng nhập nội dung', 'error');
      return;
    }
    
    try {
      await ApiService.callStaff(AppState.idBan, message);
      Utils.showToast('✅ Đã gọi nhân viên!', 'success');
      this.closeStaffModal();
      if (messageInput) messageInput.value = '';
    } catch (error) {
      Utils.showToast('❌ Lỗi! Vui lòng thử lại', 'error');
    }
  },
  
  openReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.add('show');
  },
  
  closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.remove('show');
  },
  
  async sendReview() {
    const noiDungEl = document.getElementById('review-content');
    const tenKhachEl = document.getElementById('review-name');
    
    const noiDung = noiDungEl ? noiDungEl.value.trim() : '';
    const tenKhach = tenKhachEl ? tenKhachEl.value.trim() : '';
    
    if (!noiDung) {
      Utils.showToast('⚠️ Vui lòng nhập nội dung', 'error');
      return;
    }
    
    try {
      await ApiService.submitReview(AppState.idBan, noiDung, tenKhach || null);
      Utils.showToast('✅ Cảm ơn đánh giá!', 'success');
      
      if (noiDungEl) noiDungEl.value = '';
      if (tenKhachEl) tenKhachEl.value = '';
      
      this.closeReviewModal();
    } catch (error) {
      Utils.showToast('❌ Lỗi! Vui lòng thử lại', 'error');
    }
  },
  
  openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.add('show');
    HistoryManager.render();
  },
  
  closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.remove('show');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ORDER MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const OrderManager = {
  async submitOrder() {
    if (AppState.cart.length === 0) return;
    
    const btnOrder = document.getElementById('btn-order');
    
    if (btnOrder) {
      btnOrder.disabled = true;
      btnOrder.innerHTML = `
        <span class="spinner-border"></span>
        Đang gửi...
      `;
    }
    
    try {
      const itemsToSend = [...AppState.cart];
      
      for (const item of itemsToSend) {
        const result = await ApiService.addToOrder(AppState.idBan, item);
        AppState.currentOrderId = result.id_don_hang;
      }
      
      CartManager.clearCart();
      HistoryManager.addOrderMessage(itemsToSend);
      HistoryManager.addStatusMessage('CHO_XAC_NHAN');
      
      Utils.showToast('🎉 Đã gửi đơn hàng!', 'success');
      BottomSheetManager.close();
      
    } catch (error) {
      Utils.showToast('❌ Lỗi! Vui lòng thử lại', 'error');
    } finally {
      if (btnOrder) {
        btnOrder.disabled = false;
        btnOrder.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13"/>
            <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          Gửi đơn hàng
        `;
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const HistoryManager = {
  addOrderMessage(items) {
    const total = items.reduce((sum, item) => sum + (item.donGia * item.soLuong), 0);
    
    const html = `
      <div class="chat-message customer-message">
        <div class="message-bubble customer-bubble">
          <div class="order-header">
            <div class="order-header-info">
              <span class="order-table-name">${AppState.tenBan}</span>
              <span class="order-total-amount">${Utils.formatPrice(total)}</span>
            </div>
            <div class="order-timestamp">${Utils.formatTime(new Date())}</div>
          </div>
          <div class="order-items-list">
            ${items.map(item => `
              <div class="order-item-row">
                <div class="item-info">
                  <span class="item-name">${item.tenMon}</span>
                  <span class="item-quantity">×${item.soLuong}</span>
                </div>
                ${item.capDoCay || item.ghiChu ? `
                  <div class="item-details">
                    ${item.capDoCay ? `<span class="item-spicy">${item.capDoCay}</span>` : ''}
                    ${item.ghiChu ? `<span class="item-note">${item.ghiChu}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    AppState.orderHistory.push(html);
    AppState.saveHistory();
  },
  
  addStatusMessage(status) {
    const statusInfo = ORDER_STATUS[status];
    if (!statusInfo) return;
    
    const html = `
      <div class="chat-message system-message">
        <div class="message-bubble system-bubble">
          <div class="status-content" style="color: ${statusInfo.color};">
            ${statusInfo.text}
          </div>
          <div class="status-time">${Utils.formatTime(new Date())}</div>
        </div>
      </div>
    `;
    
    AppState.orderHistory.push(html);
    AppState.saveHistory();
  },
  
  render() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    historyList.innerHTML = AppState.orderHistory.join('');
    historyList.scrollTop = historyList.scrollHeight;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

const Utils = {
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  },
  
  formatTime(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════

const EventListeners = {
  init() {
    // Search
    const searchEl = document.getElementById('search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        UIRenderer.renderMenu(AppState.menu);
      });
    }
    
    // Order button
    const btnOrder = document.getElementById('btn-order');
    if (btnOrder) {
      btnOrder.addEventListener('click', () => OrderManager.submitOrder());
    }
    
    // Staff button
    const btnCallStaff = document.getElementById('btn-call-staff');
    if (btnCallStaff) {
      btnCallStaff.addEventListener('click', () => ModalManager.openStaffModal());
    }
    
    // Review button
    const btnReview = document.getElementById('btn-review');
    if (btnReview) {
      btnReview.addEventListener('click', () => ModalManager.openReviewModal());
    }
    
    // History button
    const btnHistory = document.getElementById('btn-history');
    if (btnHistory) {
      btnHistory.addEventListener('click', () => ModalManager.openHistoryModal());
    }
    
    // Dish modal
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.addEventListener('click', () => ModalManager.confirmDishModal());
    }
    
    const cancelModal = document.getElementById('cancel-modal');
    if (cancelModal) {
      cancelModal.addEventListener('click', () => ModalManager.closeDishModal());
    }
    
    // Staff modal
    const sendStaff = document.getElementById('send-staff');
    if (sendStaff) {
      sendStaff.addEventListener('click', () => ModalManager.sendStaffRequest());
    }
    
    const closeStaffModal = document.getElementById('close-staff-modal');
    if (closeStaffModal) {
      closeStaffModal.addEventListener('click', () => ModalManager.closeStaffModal());
    }
    
    // Review modal
    const sendReview = document.getElementById('send-review');
    if (sendReview) {
      sendReview.addEventListener('click', () => ModalManager.sendReview());
    }
    
    const closeReviewModal = document.getElementById('close-review-modal');
    if (closeReviewModal) {
      closeReviewModal.addEventListener('click', () => ModalManager.closeReviewModal());
    }
    
    // History modal
    const closeHistory = document.getElementById('close-history');
    if (closeHistory) {
      closeHistory.addEventListener('click', () => ModalManager.closeHistoryModal());
    }
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const App = {
  async init() {
    console.log('🚀 Mi Cay HoangChef - Mobile App Starting...');
    
    try {
      // Initialize state
      AppState.init();
      
      // Load data
      const tableInfo = await ApiService.loadTableInfo(AppState.idBan);
      AppState.tenBan = tableInfo.TenBan;
      UIRenderer.updateTableName(AppState.tenBan);
      
      const menuData = await ApiService.loadMenu();
      AppState.categories = menuData.danh_muc;
      
      // Flatten menu
      AppState.menu = [];
      AppState.categories.forEach(cat => {
        cat.mon_an.forEach(mon => {
          AppState.menu.push({
            ...mon,
            TenDanhMuc: cat.TenDanhMuc,
            IDDanhMuc: cat.IDDanhMuc
          });
        });
      });
      
      // Render UI
      UIRenderer.renderCategories(AppState.categories);
      UIRenderer.renderMenu(AppState.menu);
      UIRenderer.renderCart(AppState.cart);
      
      // Initialize components
      BottomSheetManager.init();
      EventListeners.init();
      
      console.log('✅ App initialized successfully');
      Utils.showToast('✅ Chào mừng bạn!', 'success');
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      Utils.showToast('❌ Lỗi khi tải dữ liệu', 'error');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// START APP
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

console.log('📱 Mi Cay HoangChef - Mobile-First App Loaded');