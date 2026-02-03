/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MyCay_Oder - Client Side JavaScript (FIXED with Mobile Cart Toggle)
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_BASE: '/api',
  CHAT_HISTORY_KEY: 'chatHistory',
  BUBBLE_POS_KEY: 'historyBubblePos',
  NOTIFICATION_DURATION: 3000,
  MAX_HISTORY_HEIGHT: 500
};

const ORDER_STATUS = {
  CHO_XAC_NHAN: { text: 'Đơn hàng đã được gửi tới hệ thống, vui lòng chờ xử lý trong giây lát.', color: '#ffc107' },
  DANG_NAU: { text: 'Đơn hàng của quý khách đang được chế biến.', color: '#17a2b8' },
  HOAN_THANH: { text: 'Món ăn đã sẵn sàng phục vụ.', color: '#28a745' }
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const AppState = {
  // Table info
  idBan: null,
  tenBan: '',
  
  // Menu data
  menu: [],
  categories: [],
  
  // Cart
  cart: [],
  
  // Current dish in modal
  currentDish: null,
  
  // Current order
  currentOrderId: null,
  currentOrder: null,
  currentOrderTrangThai: null,
  
  // Chat history
  chatHistory: [],
  
  // Mobile cart state
  mobileCartExpanded: false,
  
  // Initialize state
  init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.idBan = urlParams.get('ban') || 1;
    this.chatHistory = this.loadChatHistory();
  },
  
  // LocalStorage helpers
  loadChatHistory() {
    try {
      const stored = localStorage.getItem(CONFIG.CHAT_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error loading chat history:', error);
      return [];
    }
  },
  
  saveChatHistory() {
    try {
      localStorage.setItem(CONFIG.CHAT_HISTORY_KEY, JSON.stringify(this.chatHistory));
    } catch (error) {
      console.error('❌ Error saving chat history:', error);
    }
  },
  
  clearChatHistory() {
    this.chatHistory = [];
    localStorage.removeItem(CONFIG.CHAT_HISTORY_KEY);
  },
  
  addChatMessage(html) {
    if (!this.chatHistory.includes(html)) {
      this.chatHistory.push(html);
      this.saveChatHistory();
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

const socket = io();

// ═══════════════════════════════════════════════════════════════════════════
// API SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const ApiService = {
  /**
   * Load table information
   */
  async loadTableInfo(idBan) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/ban/${idBan}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load table info');
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Load table error:', error);
      throw error;
    }
  },
  
  /**
   * Load menu with categories
   */
  async loadMenu() {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/menu`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load menu');
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Load menu error:', error);
      throw error;
    }
  },
  
  /**
   * Load current order for table
   */
  async loadCurrentOrder(idBan) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/ban/${idBan}/donhang`);
      const result = await response.json();
      
      if (result.success && result.data) {
        return {
          id: result.data.IDDonHang,
          items: result.data.chi_tiet || [],
          status: result.data.TrangThai
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Load current order error:', error);
      return null;
    }
  },
  
  /**
   * Add item to order
   */
  async addToOrder(idBan, item) {
    try {
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
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to add to order');
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Add to order error:', error);
      throw error;
    }
  },
  
  /**
   * Call staff
   */
  async callStaff(idBan, message) {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/ban/${idBan}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noi_dung: message })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to call staff');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Call staff error:', error);
      throw error;
    }
  },
  
  /**
   * Submit review
   */
  async submitReview(idBan, noiDung, tenKhach = null) {
    try {
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
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit review');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Submit review error:', error);
      throw error;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE CART CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const MobileCartController = {
  /**
   * Toggle mobile cart sheet
   */
  toggleCart() {
    const cartSheet = document.getElementById('mobile-cart-sheet');
    const backdrop = document.getElementById('cart-backdrop');
    
    if (!cartSheet || !backdrop) return;
    
    AppState.mobileCartExpanded = !AppState.mobileCartExpanded;
    
    if (AppState.mobileCartExpanded) {
      cartSheet.classList.remove('collapsed');
      cartSheet.classList.add('expanded');
      backdrop.classList.add('show');
    } else {
      cartSheet.classList.remove('expanded');
      cartSheet.classList.add('collapsed');
      backdrop.classList.remove('show');
    }
  },
  
  /**
   * Collapse mobile cart
   */
  collapseCart() {
    const cartSheet = document.getElementById('mobile-cart-sheet');
    const backdrop = document.getElementById('cart-backdrop');
    
    if (!cartSheet || !backdrop) return;
    
    AppState.mobileCartExpanded = false;
    cartSheet.classList.remove('expanded');
    cartSheet.classList.add('collapsed');
    backdrop.classList.remove('show');
  },
  
  /**
   * Show mobile cart (when items added)
   */
  showCart() {
    const cartSheet = document.getElementById('mobile-cart-sheet');
    if (!cartSheet) return;
    
    // Remove any hidden class
    cartSheet.style.display = 'block';
  },
  
  /**
   * Hide mobile cart (when empty)
   */
  hideCart() {
    const cartSheet = document.getElementById('mobile-cart-sheet');
    if (!cartSheet) return;
    
    this.collapseCart();
    cartSheet.style.display = 'none';
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UI RENDERER
// ═══════════════════════════════════════════════════════════════════════════

const UIRenderer = {
  /**
   * Update table name in UI
   */
  updateTableName(tenBan) {
    const tableNameEl = document.getElementById('table-name');
    if (tableNameEl) {
      tableNameEl.textContent = tenBan;
    }
    
    // Support for legacy setTableFromApi function
    if (typeof setTableFromApi === 'function') {
      setTableFromApi(tenBan);
    }
  },
  
  /**
   * Render category buttons
   */
  renderCategories(categories) {
    const categoryBar = document.querySelector('.category-bar');
    if (!categoryBar) return;
    
    const buttons = [
      `<button class="btn btn-outline-primary category-btn active" data-category="all">
        Tất cả
      </button>`,
      ...categories.map(cat => 
        `<button class="btn btn-outline-primary category-btn" data-category="${cat.IDDanhMuc}">
          ${cat.TenDanhMuc}
        </button>`
      )
    ];
    
    categoryBar.innerHTML = buttons.join('');
    
    // Attach event listeners
    categoryBar.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        categoryBar.querySelectorAll('.category-btn').forEach(b => 
          b.classList.remove('active')
        );
        e.target.classList.add('active');
        
        const category = e.target.dataset.category;
        const categoryId = category === 'all' ? null : parseInt(category);
        UIRenderer.renderMenu(AppState.menu, categoryId);
      });
    });
  },
  
  /**
   * Render menu items
   */
  renderMenu(menuItems, categoryFilter = null) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    
    let filteredMenu = menuItems;
    
    // Filter by category
    if (categoryFilter) {
      filteredMenu = filteredMenu.filter(item => item.IDDanhMuc === categoryFilter);
    }
    
    // Filter by search term
    const searchEl = document.getElementById('search');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    if (searchTerm) {
      filteredMenu = filteredMenu.filter(item => 
        item.TenMon.toLowerCase().includes(searchTerm) ||
        item.MoTa.toLowerCase().includes(searchTerm)
      );
    }
    
    // Render empty state
    if (filteredMenu.length === 0) {
      container.innerHTML = 
        '<div class="col-12 text-center py-5 text-muted">Không tìm thấy món ăn phù hợp</div>';
      return;
    }
    
    // Render menu items
    container.innerHTML = filteredMenu.map(item => `
      <div class="dish-card" data-id="${item.IDMon}">
        <div class="dish-image-wrapper">
          <img src="/static/images/${item.HinhAnh}" 
               class="dish-image" 
               alt="${item.TenMon}"
               onerror="this.src='/static/images/no-image.jpg'">
          <div class="price-badge">${Utils.formatPrice(item.Gia)}</div>
        </div>
        <div class="card-body">
          <h6 class="card-title">${item.TenMon}</h6>
          <p class="card-text">${item.MoTa}</p>
          <button class="btn btn-primary add-to-cart-btn" data-id="${item.IDMon}">
            + Thêm
          </button>
        </div>
      </div>
    `).join('');
    
    // Attach event listeners
    container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dishId = parseInt(btn.dataset.id);
        ModalController.openDishModal(dishId);
      });
    });
  },
  
  /**
   * Render cart (desktop and mobile)
   */
  renderCart(cart) {
    // Render desktop cart
    this.renderDesktopCart(cart);
    
    // Render mobile cart
    this.renderMobileCart(cart);
    
    // Update totals
    this.updateCartTotal(cart);
  },
  
  /**
   * Render desktop cart
   */
  renderDesktopCart(cart) {
    const cartList = document.getElementById('cart-list');
    const btnOrder = document.getElementById('btn-order');
    
    if (!cartList) return;
    
    // Empty cart
    if (cart.length === 0) {
      cartList.innerHTML = '<div class="empty text-muted text-center py-5">Giỏ hàng trống</div>';
      if (btnOrder) btnOrder.disabled = true;
      return;
    }
    
    // Render cart items
    cartList.innerHTML = cart.map((item, index) => `
      <div class="cart-item mb-3 p-3 border rounded">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div class="flex-grow-1">
            <h6 class="mb-1">${item.tenMon}</h6>
            ${item.capDoCay ? `<small class="text-info">🌶️ ${item.capDoCay}</small>` : ''}
            ${item.ghiChu ? `<br><small class="text-muted">📝 ${item.ghiChu}</small>` : ''}
          </div>
          <button class="btn btn-sm btn-danger remove-item" data-index="${index}">
            <span style="font-size: 18px;">×</span>
          </button>
        </div>
        
        <div class="d-flex justify-content-between align-items-center">
          <div class="quantity-control">
            <button class="btn btn-sm btn-outline-secondary decrease-qty" data-index="${index}">−</button>
            <span class="fw-bold">${item.soLuong}</span>
            <button class="btn btn-sm btn-outline-secondary increase-qty" data-index="${index}">+</button>
          </div>
          <span class="fw-bold text-danger">${Utils.formatPrice(item.donGia * item.soLuong)}</span>
        </div>
      </div>
    `).join('');
    
    if (btnOrder) btnOrder.disabled = false;
    
    // Attach event listeners
    this.attachCartEventListeners();
  },
  
  /**
   * Render mobile cart
   */
  renderMobileCart(cart) {
    const mobileCartList = document.getElementById('mobile-cart-list');
    const mobileBtnOrder = document.getElementById('mobile-btn-order');
    const mobileCartCount = document.getElementById('mobile-cart-count');
    const mobileCartPrice = document.getElementById('mobile-cart-price');
    
    if (!mobileCartList) return;
    
    // Calculate totals
    const totalItems = cart.reduce((sum, item) => sum + item.soLuong, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.donGia * item.soLuong), 0);
    
    // Update header
    if (mobileCartCount) {
      mobileCartCount.textContent = totalItems > 0 ? `${totalItems} món` : '0 món';
    }
    if (mobileCartPrice) {
      mobileCartPrice.textContent = Utils.formatPrice(totalPrice);
    }
    
    // Empty cart
    if (cart.length === 0) {
      mobileCartList.innerHTML = '<div class="empty text-muted text-center py-4">Giỏ hàng trống</div>';
      if (mobileBtnOrder) mobileBtnOrder.disabled = true;
      MobileCartController.hideCart();
      return;
    }
    
    // Show cart
    MobileCartController.showCart();
    
    // Render cart items
    mobileCartList.innerHTML = cart.map((item, index) => `
      <div class="cart-item mb-3 p-3 border rounded">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div class="flex-grow-1">
            <h6 class="mb-1">${item.tenMon}</h6>
            ${item.capDoCay ? `<small class="text-info">🌶️ ${item.capDoCay}</small>` : ''}
            ${item.ghiChu ? `<br><small class="text-muted">📝 ${item.ghiChu}</small>` : ''}
          </div>
          <button class="btn btn-sm btn-danger remove-item-mobile" data-index="${index}">
            <span style="font-size: 18px;">×</span>
          </button>
        </div>
        
        <div class="d-flex justify-content-between align-items-center">
          <div class="quantity-control">
            <button class="btn btn-sm btn-outline-secondary decrease-qty-mobile" data-index="${index}">−</button>
            <span class="fw-bold">${item.soLuong}</span>
            <button class="btn btn-sm btn-outline-secondary increase-qty-mobile" data-index="${index}">+</button>
          </div>
          <span class="fw-bold text-danger">${Utils.formatPrice(item.donGia * item.soLuong)}</span>
        </div>
      </div>
    `).join('');
    
    if (mobileBtnOrder) mobileBtnOrder.disabled = false;
    
    // Attach event listeners for mobile
    this.attachMobileCartEventListeners();
  },
  
  /**
   * Attach desktop cart event listeners
   */
  attachCartEventListeners() {
    // Remove item
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.removeItem(index);
      });
    });
    
    // Increase quantity
    document.querySelectorAll('.increase-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.increaseQuantity(index);
      });
    });
    
    // Decrease quantity
    document.querySelectorAll('.decrease-qty').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.decreaseQuantity(index);
      });
    });
  },
  
  /**
   * Attach mobile cart event listeners
   */
  attachMobileCartEventListeners() {
    // Remove item
    document.querySelectorAll('.remove-item-mobile').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.removeItem(index);
      });
    });
    
    // Increase quantity
    document.querySelectorAll('.increase-qty-mobile').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.increaseQuantity(index);
      });
    });
    
    // Decrease quantity
    document.querySelectorAll('.decrease-qty-mobile').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        CartController.decreaseQuantity(index);
      });
    });
  },
  
  /**
   * Update cart total
   */
  updateCartTotal(cart) {
    const total = cart.reduce((sum, item) => sum + (item.donGia * item.soLuong), 0);
    const subtotalEl = document.getElementById('cart-subtotal');
    if (subtotalEl) {
      subtotalEl.textContent = Utils.formatPrice(total);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAT HISTORY RENDERER
// ═══════════════════════════════════════════════════════════════════════════

const ChatRenderer = {
  /**
   * Render saved chat history
   */
  renderSavedHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    historyList.innerHTML = AppState.chatHistory.join('');
    this.scrollToBottom();
  },
  
  /**
   * Add message to chat
   */
  addMessage(html) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    AppState.addChatMessage(html);
    historyList.insertAdjacentHTML('beforeend', html);
    this.scrollToBottom();
  },
  
  /**
   * Render order message
   */
  renderOrderMessage(items) {
    const normalized = items.map(item => ({
      ten: item.TenMon ?? item.tenMon ?? '',
      qty: item.SoLuong ?? item.soLuong ?? 1,
      capDoCay: item.CapDoCay ?? item.capDoCay ?? '',
      ghiChu: item.GhiChu ?? item.ghiChu ?? '',
      price: item.ThanhTien ?? ((item.Gia ?? item.donGia ?? 0) * (item.SoLuong ?? item.soLuong ?? 1))
    }));
    
    const total = normalized.reduce((sum, item) => sum + item.price, 0);
    
    const html = `
      <div class="chat-message customer-message">
        <div class="message-bubble customer-bubble">
          <div class="order-header">
            <div class="order-header-info">
              <span class="order-table-name">🏠 ${AppState.tenBan}</span>
              <span class="order-total-amount">${Utils.formatPrice(total)}</span>
            </div>
            <div class="order-timestamp">${Utils.formatTime(new Date())}</div>
          </div>
          
          <div class="order-items-list">
            ${normalized.map(item => `
              <div class="order-item-row">
                <div class="item-info">
                  <span class="item-name">${item.ten}</span>
                  <span class="item-quantity">×${item.qty}</span>
                </div>
                ${item.capDoCay || item.ghiChu ? `
                  <div class="item-details">
                    ${item.capDoCay ? `<span class="item-spicy">🌶️ ${item.capDoCay}</span>` : ''}
                    ${item.ghiChu ? `<span class="item-note">📝 ${item.ghiChu}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    this.addMessage(html);
  },
  
  /**
   * Append status message
   */
  appendStatusMessage(status) {
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
    
    this.addMessage(html);
  },
  
  /**
   * Clear chat history
   */
  clearHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    AppState.clearChatHistory();
    historyList.innerHTML = '';
  },
  
  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    historyList.scrollTop = historyList.scrollHeight;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CART CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const CartController = {
  /**
   * Add item to cart
   */
  addItem(dish, options = {}) {
    const cartItem = {
      idMon: dish.IDMon,
      tenMon: dish.TenMon,
      hinhAnh: dish.HinhAnh,
      donGia: dish.Gia,
      soLuong: 1,
      capDoCay: options.capDoCay || '',
      ghiChu: options.ghiChu || ''
    };
    
    // Find existing item with same options
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
    
    UIRenderer.renderCart(AppState.cart);
    Utils.showNotification(`✅ Đã thêm "${cartItem.tenMon}" vào giỏ hàng!`, 'success');
  },
  
  /**
   * Remove item from cart
   */
  removeItem(index) {
    AppState.cart.splice(index, 1);
    UIRenderer.renderCart(AppState.cart);
  },
  
  /**
   * Increase quantity
   */
  increaseQuantity(index) {
    if (AppState.cart[index]) {
      AppState.cart[index].soLuong++;
      UIRenderer.renderCart(AppState.cart);
    }
  },
  
  /**
   * Decrease quantity
   */
  decreaseQuantity(index) {
    if (AppState.cart[index]) {
      if (AppState.cart[index].soLuong > 1) {
        AppState.cart[index].soLuong--;
      } else {
        this.removeItem(index);
      }
      UIRenderer.renderCart(AppState.cart);
    }
  },
  
  /**
   * Clear cart
   */
  clearCart() {
    AppState.cart = [];
    UIRenderer.renderCart(AppState.cart);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const ModalController = {
  /**
   * Open dish modal
   */
  openDishModal(dishId) {
    const dish = AppState.menu.find(d => d.IDMon === dishId);
    if (!dish) return;
    
    AppState.currentDish = dish;
    
    const modal = document.getElementById('option-modal');
    const spicyBlock = document.getElementById('spicy-block');
    
    if (!modal) return;
    
    // Show/hide spicy level selector
    if (spicyBlock) {
      spicyBlock.style.display = dish.TenDanhMuc === 'Mì cay' ? 'block' : 'none';
    }
    
    // Reset form
    const levelSelect = document.getElementById('level-select');
    const noteInput = document.getElementById('note-input');
    
    if (levelSelect) levelSelect.value = '3';
    if (noteInput) noteInput.value = '';
    
    modal.classList.remove('hidden');
  },
  
  /**
   * Close dish modal
   */
  closeDishModal() {
    const modal = document.getElementById('option-modal');
    if (modal) modal.classList.add('hidden');
    AppState.currentDish = null;
  },
  
  /**
   * Confirm dish modal
   */
  confirmDishModal() {
    if (!AppState.currentDish) return;
    
    const spicyLevel = document.getElementById('level-select')?.value || '3';
    const note = document.getElementById('note-input')?.value.trim() || '';
    
    const options = {
      capDoCay: AppState.currentDish.TenDanhMuc === 'Mì cay' ? `Cấp ${spicyLevel}` : '',
      ghiChu: note
    };
    
    CartController.addItem(AppState.currentDish, options);
    this.closeDishModal();
  },
  
  /**
   * Open staff modal
   */
  openStaffModal() {
    const modal = document.getElementById('staff-modal');
    const messageInput = document.getElementById('staff-message');
    
    if (modal) modal.classList.remove('hidden');
    if (messageInput) messageInput.value = '';
  },
  
  /**
   * Close staff modal
   */
  closeStaffModal() {
    const modal = document.getElementById('staff-modal');
    if (modal) modal.classList.add('hidden');
  },
  
  /**
   * Send staff request
   */
  async sendStaffRequest() {
    const messageInput = document.getElementById('staff-message');
    const message = messageInput ? messageInput.value.trim() : '';
    
    if (!message) {
      Utils.showNotification('Vui lòng nhập nội dung yêu cầu!', 'warning');
      return;
    }
    
    try {
      await ApiService.callStaff(AppState.idBan, message);
      Utils.showNotification('✅ Đã gọi nhân viên! Vui lòng chờ trong giây lát.', 'success');
      this.closeStaffModal();
    } catch (error) {
      Utils.showNotification('Lỗi khi gọi nhân viên. Vui lòng thử lại!', 'error');
    }
  },
  
  /**
   * Open history modal
   */
  openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.remove('hidden');
    ChatRenderer.renderSavedHistory();
  },
  
  /**
   * Close history modal
   */
  closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.add('hidden');
  },
  
  /**
   * Open review modal
   */
  openReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.remove('hidden');
  },
  
  /**
   * Close review modal
   */
  closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.add('hidden');
  },
  
  /**
   * Send review
   */
  async sendReview() {
    const noiDungEl = document.getElementById('review-content');
    const tenKhachEl = document.getElementById('review-name');
    
    const noiDung = noiDungEl ? noiDungEl.value.trim() : '';
    const tenKhach = tenKhachEl ? tenKhachEl.value.trim() : '';
    
    if (!noiDung) {
      Utils.showNotification('Vui lòng nhập nội dung đánh giá!', 'warning');
      return;
    }
    
    try {
      await ApiService.submitReview(AppState.idBan, noiDung, tenKhach || null);
      Utils.showNotification('✅ Cảm ơn bạn đã đánh giá!', 'success');
      
      if (noiDungEl) noiDungEl.value = '';
      if (tenKhachEl) tenKhachEl.value = '';
      
      this.closeReviewModal();
    } catch (error) {
      Utils.showNotification('❌ Lỗi khi gửi đánh giá!', 'error');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ORDER CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const OrderController = {
  /**
   * Submit order
   */
  async submitOrder() {
    if (AppState.cart.length === 0) return;
    
    const btnOrder = document.getElementById('btn-order');
    const mobileBtnOrder = document.getElementById('mobile-btn-order');
    
    // Disable buttons and show loading
    if (btnOrder) {
      btnOrder.disabled = true;
      btnOrder.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang gửi...';
    }
    if (mobileBtnOrder) {
      mobileBtnOrder.disabled = true;
      mobileBtnOrder.textContent = 'Đang gửi...';
    }
    
    try {
      // Keep copy of items being sent
      const itemsToSend = [...AppState.cart];
      
      // Send each item to server
      for (const item of itemsToSend) {
        const result = await ApiService.addToOrder(AppState.idBan, item);
        AppState.currentOrderId = result.id_don_hang;
      }
      
      // Clear cart
      CartController.clearCart();
      
      // Add to chat history
      ChatRenderer.renderOrderMessage(itemsToSend);
      ChatRenderer.appendStatusMessage('CHO_XAC_NHAN');
      
      Utils.showNotification('🎉 Đơn hàng đã được gửi! Vui lòng chờ xác nhận.', 'success');
      
      // Collapse mobile cart after order
      MobileCartController.collapseCart();
      
      // Reload current order state
      const currentOrder = await ApiService.loadCurrentOrder(AppState.idBan);
      if (currentOrder) {
        AppState.currentOrderId = currentOrder.id;
        AppState.currentOrder = currentOrder.items;
        AppState.currentOrderTrangThai = currentOrder.status;
      }
      
    } catch (error) {
      Utils.showNotification('Lỗi khi gửi đơn hàng. Vui lòng thử lại!', 'error');
    } finally {
      // Reset buttons
      if (btnOrder) {
        btnOrder.disabled = false;
        btnOrder.innerHTML = '🍜 Gửi đơn hàng';
      }
      if (mobileBtnOrder) {
        mobileBtnOrder.disabled = false;
        mobileBtnOrder.textContent = 'Gửi đơn';
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const SocketHandlers = {
  /**
   * Setup socket listeners
   */
  setup() {
    socket.on('connect', this.onConnect);
    socket.on('disconnect', this.onDisconnect);
    socket.on('order_status_update', this.onOrderStatusUpdate);
    socket.on('order_paid', this.onOrderPaid);
  },
  
  /**
   * On socket connect
   */
  onConnect() {
    console.log('✅ Socket connected:', socket.id);
    
    if (AppState.idBan) {
      socket.emit('join_room_ban', { id_ban: AppState.idBan });
      console.log('📥 Joined room ban_' + AppState.idBan);
    }
  },
  
  /**
   * On socket disconnect
   */
  onDisconnect() {
    console.log('❌ Socket disconnected');
  },
  
  /**
   * On order status update
   */
  onOrderStatusUpdate(data) {
    console.log('📩 order_status_update:', data);
    
    if (data.id_ban != AppState.idBan) return;
    
    // Append status message to chat
    ChatRenderer.appendStatusMessage(data.trang_thai);
    
    // Update state
    AppState.currentOrderTrangThai = data.trang_thai;
  },
  
  /**
   * On order paid
   */
  onOrderPaid(data) {
    if (data.id_ban != AppState.idBan) return;
    
    console.log('💰 Đơn đã thanh toán → clear history');
    
    // Clear state
    AppState.currentOrderId = null;
    AppState.currentOrder = null;
    AppState.currentOrderTrangThai = null;
    
    // Clear chat history
    ChatRenderer.clearHistory();
    
    // Re-render UI
    UIRenderer.renderCart(AppState.cart);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS SETUP
// ═══════════════════════════════════════════════════════════════════════════

const EventListeners = {
  /**
   * Setup all event listeners
   */
  setup() {
    this.setupSearch();
    this.setupOrderButtons();
    this.setupDishModal();
    this.setupStaffModal();
    this.setupHistoryModal();
    this.setupReviewModal();
    this.setupMobileCart();
  },
  
  /**
   * Setup search
   */
  setupSearch() {
    const searchEl = document.getElementById('search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        UIRenderer.renderMenu(AppState.menu);
      });
    }
  },
  
  /**
   * Setup order buttons
   */
  setupOrderButtons() {
    // Desktop order button
    const btnOrder = document.getElementById('btn-order');
    if (btnOrder) {
      btnOrder.addEventListener('click', () => OrderController.submitOrder());
    }
    
    // Mobile order button
    const mobileBtnOrder = document.getElementById('mobile-btn-order');
    if (mobileBtnOrder) {
      mobileBtnOrder.addEventListener('click', () => OrderController.submitOrder());
    }
    
    // Desktop call staff button
    const btnCallStaff = document.getElementById('btn-call-staff');
    if (btnCallStaff) {
      btnCallStaff.addEventListener('click', () => ModalController.openStaffModal());
    }
    
    // Mobile call staff button
    const mobileBtnCallStaff = document.getElementById('mobile-btn-call-staff');
    if (mobileBtnCallStaff) {
      mobileBtnCallStaff.addEventListener('click', () => {
        MobileCartController.collapseCart();
        ModalController.openStaffModal();
      });
    }
    
    // Desktop review button
    const btnReview = document.getElementById('btn-review');
    if (btnReview) {
      btnReview.addEventListener('click', () => ModalController.openReviewModal());
    }
    
    // Mobile review button
    const mobileBtnReview = document.getElementById('mobile-btn-review');
    if (mobileBtnReview) {
      mobileBtnReview.addEventListener('click', () => {
        MobileCartController.collapseCart();
        ModalController.openReviewModal();
      });
    }
  },
  
  /**
   * Setup dish modal
   */
  setupDishModal() {
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.addEventListener('click', () => ModalController.confirmDishModal());
    }
    
    const cancelModal = document.getElementById('cancel-modal');
    if (cancelModal) {
      cancelModal.addEventListener('click', () => ModalController.closeDishModal());
    }
  },
  
  /**
   * Setup staff modal
   */
  setupStaffModal() {
    const sendStaff = document.getElementById('send-staff');
    if (sendStaff) {
      sendStaff.addEventListener('click', () => ModalController.sendStaffRequest());
    }
    
    const closeStaffModalBtn = document.getElementById('close-staff-modal');
    if (closeStaffModalBtn) {
      closeStaffModalBtn.addEventListener('click', () => ModalController.closeStaffModal());
    }
  },
  
  /**
   * Setup history modal
   */
  setupHistoryModal() {
    const historyBubble = document.getElementById('history-bubble');
    if (historyBubble) {
      historyBubble.addEventListener('click', () => ModalController.openHistoryModal());
    }
    
    const closeHistory = document.getElementById('close-history');
    if (closeHistory) {
      closeHistory.addEventListener('click', () => ModalController.closeHistoryModal());
    }
  },
  
  /**
   * Setup review modal
   */
  setupReviewModal() {
    const closeReviewModal = document.getElementById('close-review-modal');
    if (closeReviewModal) {
      closeReviewModal.addEventListener('click', () => ModalController.closeReviewModal());
    }
    
    const sendReview = document.getElementById('send-review');
    if (sendReview) {
      sendReview.addEventListener('click', () => ModalController.sendReview());
    }
  },
  
  /**
   * Setup mobile cart toggle
   */
  setupMobileCart() {
    // Toggle cart when clicking header
    const cartToggle = document.getElementById('cart-sheet-toggle');
    if (cartToggle) {
      cartToggle.addEventListener('click', () => {
        MobileCartController.toggleCart();
      });
    }
    
    // Close cart when clicking backdrop
    const backdrop = document.getElementById('cart-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        MobileCartController.collapseCart();
      });
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const Utils = {
  /**
   * Format price
   */
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  },
  
  /**
   * Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  /**
   * Format time
   */
  formatTime(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    const now = new Date();
    const diff = now - date;
    
    // If today
    if (diff < 86400000) {
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // If different day
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const typeMap = {
      error: 'danger',
      warning: 'warning',
      success: 'success',
      info: 'info'
    };
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${typeMap[type]} notification-toast`;
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
    }, CONFIG.NOTIFICATION_DURATION);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const App = {
  /**
   * Initialize application
   */
  async init() {
    console.log('🚀 MyCay_Oder Client Started (Fixed with Mobile Cart Toggle)');
    
    try {
      // Initialize state
      AppState.init();
      
      // Load data
      await this.loadData();
      
      // Setup event listeners
      EventListeners.setup();
      
      // Setup socket listeners
      SocketHandlers.setup();
      
      // Inject styles
      this.injectStyles();
      
      console.log('✅ Initialization complete');
      
      Utils.showNotification('✅ Chào mừng bạn đến với Mì Cay HOANGCHEF', 'success');
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      Utils.showNotification('Lỗi khi tải dữ liệu. Vui lòng thử lại!', 'error');
    }
  },
  
  /**
   * Load all required data
   */
  async loadData() {
    // Load table info
    const tableInfo = await ApiService.loadTableInfo(AppState.idBan);
    AppState.tenBan = tableInfo.TenBan;
    UIRenderer.updateTableName(AppState.tenBan);
    console.log('✅ Table info loaded:', AppState.tenBan);
    
    // Load menu
    const menuData = await ApiService.loadMenu();
    AppState.categories = menuData.danh_muc;
    
    // Flatten menu items
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
    
    UIRenderer.renderCategories(AppState.categories);
    UIRenderer.renderMenu(AppState.menu);
    console.log('✅ Menu loaded:', AppState.menu.length, 'items');
    
    // Render saved chat history
    ChatRenderer.renderSavedHistory();
    
    // Load current order
    const currentOrder = await ApiService.loadCurrentOrder(AppState.idBan);
    if (currentOrder) {
      AppState.currentOrderId = currentOrder.id;
      AppState.currentOrder = currentOrder.items;
      AppState.currentOrderTrangThai = currentOrder.status;
      
      if (currentOrder.status) {
        ChatRenderer.appendStatusMessage(currentOrder.status);
      }
    }
  },
  
  /**
   * Inject CSS styles
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
/* ANIMATIONS */
@keyframes slideIn {
  from { transform: translateX(400px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(400px); opacity: 0; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* HISTORY LIST */
#history-list {
  max-height: ${CONFIG.MAX_HISTORY_HEIGHT}px;
  overflow-y: auto;
  padding: 12px;
  background: #f6f7fb;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

#history-list:empty::before {
  content: "💭 Bạn chưa có đơn hàng nào";
  display: block;
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 10px;
}

/* CHAT MESSAGE */
.chat-message {
  margin-bottom: 12px;
  display: flex;
  animation: fadeInUp 0.25s ease;
}

.customer-message {
  justify-content: flex-end;
}

.system-message {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 75%;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
  font-size: 14px;
  line-height: 1.4;
}

.customer-bubble {
  background: linear-gradient(135deg, #ff6b35, #ff9f43);
  color: white;
}

.system-bubble {
  background: #ffffff;
  color: #333;
  border: 1px solid #eee;
}

.order-header {
  padding: 10px 14px;
  background: rgba(255,255,255,0.12);
  border-bottom: 1px solid rgba(255,255,255,0.15);
}

.order-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.order-table-name {
  font-weight: 600;
  font-size: 13px;
}

.order-total-amount {
  font-size: 14px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.25);
}

.order-timestamp {
  font-size: 11px;
  opacity: 0.7;
}

.order-items-list {
  padding: 10px 14px;
}

.order-item-row {
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.15);
}

.order-item-row:last-child {
  border-bottom: none;
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
}

.item-quantity {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,0.25);
}

.item-details {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.item-spicy,
.item-note {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(255,255,255,0.18);
}

.status-content {
  padding: 10px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
}

.status-time {
  font-size: 11px;
  opacity: 0.6;
  padding-bottom: 8px;
  text-align: center;
}

#history-list::-webkit-scrollbar {
  width: 5px;
}

#history-list::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 10px;
}

@media (max-width: 768px) {
  #history-list {
    padding: 8px;
  }
  
  .message-bubble {
    max-width: 88%;
    font-size: 13px;
    border-radius: 16px;
  }
  
  .order-header-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .order-total-amount {
    font-size: 13px;
  }
  
  .item-name {
    font-size: 12px;
  }
  
  .chat-message {
    margin-bottom: 10px;
  }
}
`;
    document.head.appendChild(style);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// START APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

console.log('📱 MyCay_Oder Client Loaded (Fixed with Mobile Cart Toggle)');