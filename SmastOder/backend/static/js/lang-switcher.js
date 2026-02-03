/**
 * ════════════════════════════════════════════════════════════════════════════
 *  Language Switcher - Full Translation Support
 *  Supports: Vietnamese (vi), English (en), Korean (kr)
 * ════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

let currentTableNumber = null;

// ═══════════════════════════════════════════════════════════════════════════
// TRANSLATIONS DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const i18n = {
  vi: {
    // Meta
    label: "Tiếng Việt",
    flag: "🇻🇳",
    
    // Page Title
    pageTitle: "Mì Cay HoangChef – Đặt món qua QR",
    
    // Header - Brand
    brandName: "🌶️ Mì Cay HoangChef",
    slogan: "Nâng tầm hương vị Việt",
    address: "📍 88 Hoàng Hoa Thám, Xuân Hòa, Phú Thọ",
    openTime: "⏰ 9:00 - 22:00",
    phone: "📞 0982 121 680",
    tablePrefix: "Bàn",
    loading: "Đang tải...",
    
    // Menu Section
    menuTitle: "🍜 Thực Đơn",
    searchPlaceholder: "🔍 Tìm món ăn (ví dụ: mì cay, trà sữa...)",
    categoryAll: "Tất cả",
    noResultsFound: "Không tìm thấy món ăn phù hợp",
    addButton: "+ Thêm",
    
    // Cart - Desktop & Mobile
    cartTitle: "🛒 Giỏ hàng",
    emptyCart: "Giỏ hàng trống",
    subtotal: "Tạm tính:",
    orderBtn: "🍽️ Gửi đơn hàng",
    orderBtnShort: "Gửi đơn",
    orderBtnSending: "Đang gửi...",
    callStaffBtn: "📢 Gọi nhân viên hỗ trợ",
    callStaffBtnShort: "📢 Gọi nhân viên",
    reviewBtn: "⭐ Góp ý dịch vụ",
    reviewBtnShort: "⭐ Góp ý",
    
    // Mobile Cart
    itemsCount: "món",
    
    // History
    historyTitle: "📜 Lịch sử đơn hàng",
    historyBubbleTitle: "Xem lịch sử đơn hàng",
    closeBtn: "Đóng",
    noOrderHistory: "💭 Bạn chưa có đơn hàng nào",
    
    // Footer
    developedBy: "Phát triển bởi sinh viên: Lê Văn Hoàng",
    department: "Khoa Công nghệ Thông tin",
    university: "Trường Đại học Nguyễn Trãi",
    
    // Modal: Dish Options
    optionTitle: "Tùy chọn món",
    spicyLabel: "🌶️ Cấp độ cay",
    spicyLevels: {
      level1: "Cấp 1 - Nhẹ nhàng",
      level2: "Cấp 2 - Vừa phải",
      level3: "Cấp 3 - Cay vừa",
      level4: "Cấp 4 - Cay khá",
      level5: "Cấp 5 - Cay mạnh",
      level6: "Cấp 6 - Siêu cay",
      level7: "Cấp 7 - Thách thức"
    },
    noteLabel: "📝 Ghi chú thêm (tùy chọn)",
    notePlaceholder: "Ví dụ: ít đá, không hành, thêm ớt...",
    addToCart: "✅ Thêm vào giỏ",
    cancel: "❌ Hủy",
    
    // Modal: Call Staff
    staffTitle: "📢 Gọi nhân viên hỗ trợ",
    staffPlaceholder: "Mô tả vấn đề bạn cần hỗ trợ (ví dụ: cần thêm nước, hóa đơn, dọn bàn...)",
    sendBtn: "📤 Gửi",
    
    // Modal: Review
    reviewTitle: "⭐ Góp ý dịch vụ",
    reviewNameLabel: "Tên quý khách (không bắt buộc)",
    reviewNamePlaceholder: "Nhập tên hoặc để trống",
    reviewContentLabel: "📝 Nội dung góp ý",
    reviewPlaceholder: "Chia sẻ cảm nhận của bạn về món ăn và dịch vụ...",
    sendReview: "📤 Gửi đánh giá",
    
    // Notifications
    addedToCart: "✅ Đã thêm \"{item}\" vào giỏ hàng!",
    orderSuccess: "🎉 Đơn hàng đã được gửi! Vui lòng chờ xác nhận.",
    staffCalled: "✅ Đã gọi nhân viên! Vui lòng chờ trong giây lát.",
    reviewThanks: "✅ Cảm ơn bạn đã đánh giá!",
    welcome: "✅ Chào mừng bạn đến với Mì Cay HOANGCHEF",
    
    // Errors
    errorLoading: "Lỗi khi tải dữ liệu. Vui lòng thử lại!",
    errorOrder: "Lỗi khi gửi đơn hàng. Vui lòng thử lại!",
    errorStaff: "Lỗi khi gọi nhân viên. Vui lòng thử lại!",
    errorReview: "❌ Lỗi khi gửi đánh giá!",
    emptyStaffMessage: "Vui lòng nhập nội dung yêu cầu!",
    emptyReviewContent: "Vui lòng nhập nội dung đánh giá!"
  },
  
  en: {
    // Meta
    label: "English",
    flag: "🇺🇸",
    
    // Page Title
    pageTitle: "HoangChef Spicy Noodles – Order via QR",
    
    // Header - Brand
    brandName: "🌶️ HoangChef Spicy Noodles",
    slogan: "Elevating Vietnamese flavors",
    address: "📍 88 Hoang Hoa Tham, Xuan Hoa, Phu Tho",
    openTime: "⏰ 9:00 AM - 10:00 PM",
    phone: "📞 0982 121 680",
    tablePrefix: "Table",
    loading: "Loading...",
    
    // Menu Section
    menuTitle: "🍜 Menu",
    searchPlaceholder: "🔍 Search food (e.g. spicy noodles, milk tea...)",
    categoryAll: "All",
    noResultsFound: "No dishes found",
    addButton: "+ Add",
    
    // Cart - Desktop & Mobile
    cartTitle: "🛒 Cart",
    emptyCart: "Your cart is empty",
    subtotal: "Subtotal:",
    orderBtn: "🍽️ Place order",
    orderBtnShort: "Place order",
    orderBtnSending: "Sending...",
    callStaffBtn: "📢 Call staff for assistance",
    callStaffBtnShort: "📢 Call staff",
    reviewBtn: "⭐ Service feedback",
    reviewBtnShort: "⭐ Feedback",
    
    // Mobile Cart
    itemsCount: "items",
    
    // History
    historyTitle: "📜 Order History",
    historyBubbleTitle: "View order history",
    closeBtn: "Close",
    noOrderHistory: "💭 You have no orders yet",
    
    // Footer
    developedBy: "Developed by student: Le Van Hoang",
    department: "Faculty of Information Technology",
    university: "Nguyen Trai University",
    
    // Modal: Dish Options
    optionTitle: "Food options",
    spicyLabel: "🌶️ Spicy level",
    spicyLevels: {
      level1: "Level 1 - Mild",
      level2: "Level 2 - Medium",
      level3: "Level 3 - Medium spicy",
      level4: "Level 4 - Quite spicy",
      level5: "Level 5 - Very spicy",
      level6: "Level 6 - Super spicy",
      level7: "Level 7 - Challenge"
    },
    noteLabel: "📝 Additional notes (optional)",
    notePlaceholder: "Example: less ice, no onion, extra chili...",
    addToCart: "✅ Add to cart",
    cancel: "❌ Cancel",
    
    // Modal: Call Staff
    staffTitle: "📢 Call staff for assistance",
    staffPlaceholder: "Describe the issue you need help with (e.g. need water, bill, clean table...)",
    sendBtn: "📤 Send",
    
    // Modal: Review
    reviewTitle: "⭐ Service feedback",
    reviewNameLabel: "Your name (optional)",
    reviewNamePlaceholder: "Enter name or leave blank",
    reviewContentLabel: "📝 Feedback content",
    reviewPlaceholder: "Share your experience with our food and service...",
    sendReview: "📤 Send feedback",
    
    // Notifications
    addedToCart: "✅ Added \"{item}\" to cart!",
    orderSuccess: "🎉 Order placed successfully! Please wait for confirmation.",
    staffCalled: "✅ Staff called! Please wait a moment.",
    reviewThanks: "✅ Thank you for your feedback!",
    welcome: "✅ Welcome to HoangChef Spicy Noodles",
    
    // Errors
    errorLoading: "Error loading data. Please try again!",
    errorOrder: "Error placing order. Please try again!",
    errorStaff: "Error calling staff. Please try again!",
    errorReview: "❌ Error sending feedback!",
    emptyStaffMessage: "Please enter your request!",
    emptyReviewContent: "Please enter your feedback!"
  },
  
  kr: {
    // Meta
    label: "한국어",
    flag: "🇰🇷",
    
    // Page Title
    pageTitle: "HoangChef 매운 국수 – QR 주문",
    
    // Header - Brand
    brandName: "🌶️ HoangChef 매운 국수",
    slogan: "베트남의 맛을 한 단계 높이다",
    address: "📍 88 Hoang Hoa Tham, Xuan Hoa, Phu Tho",
    openTime: "⏰ 09:00 - 22:00",
    phone: "📞 0982 121 680",
    tablePrefix: "테이블",
    loading: "로딩 중...",
    
    // Menu Section
    menuTitle: "🍜 메뉴",
    searchPlaceholder: "🔍 음식 검색 (예: 매운 국수, 밀크티...)",
    categoryAll: "전체",
    noResultsFound: "검색 결과가 없습니다",
    addButton: "+ 추가",
    
    // Cart - Desktop & Mobile
    cartTitle: "🛒 장바구니",
    emptyCart: "장바구니가 비어 있습니다",
    subtotal: "소계:",
    orderBtn: "🍽️ 주문 보내기",
    orderBtnShort: "주문하기",
    orderBtnSending: "전송 중...",
    callStaffBtn: "📢 직원 호출하기",
    callStaffBtnShort: "📢 직원 호출",
    reviewBtn: "⭐ 서비스 평가하기",
    reviewBtnShort: "⭐ 평가",
    
    // Mobile Cart
    itemsCount: "개",
    
    // History
    historyTitle: "📜 주문 내역",
    historyBubbleTitle: "주문 내역 보기",
    closeBtn: "닫기",
    noOrderHistory: "💭 아직 주문 내역이 없습니다",
    
    // Footer
    developedBy: "개발: 학생 레 반 호앙",
    department: "정보기술학과",
    university: "응우옌 짜이 대학교",
    
    // Modal: Dish Options
    optionTitle: "메뉴 옵션",
    spicyLabel: "🌶️ 매운 단계",
    spicyLevels: {
      level1: "1단계 - 순한맛",
      level2: "2단계 - 중간맛",
      level3: "3단계 - 보통 매운맛",
      level4: "4단계 - 매운맛",
      level5: "5단계 - 아주 매운맛",
      level6: "6단계 - 극도로 매운맛",
      level7: "7단계 - 도전"
    },
    noteLabel: "📝 추가 요청사항 (선택)",
    notePlaceholder: "예: 얼음 적게, 양파 제외, 고추 추가...",
    addToCart: "✅ 장바구니 추가",
    cancel: "❌ 취소",
    
    // Modal: Call Staff
    staffTitle: "📢 직원 호출",
    staffPlaceholder: "도움이 필요한 내용을 입력하세요 (예: 물 필요, 계산서, 테이블 정리...)",
    sendBtn: "📤 전송",
    
    // Modal: Review
    reviewTitle: "⭐ 서비스 평가",
    reviewNameLabel: "이름 (선택 사항)",
    reviewNamePlaceholder: "이름 입력 또는 공백으로 남겨두세요",
    reviewContentLabel: "📝 평가 내용",
    reviewPlaceholder: "음식과 서비스에 대한 후기를 남겨주세요...",
    sendReview: "📤 평가 보내기",
    
    // Notifications
    addedToCart: "✅ \"{item}\"을(를) 장바구니에 추가했습니다!",
    orderSuccess: "🎉 주문이 전송되었습니다! 확인을 기다려주세요.",
    staffCalled: "✅ 직원을 호출했습니다! 잠시만 기다려주세요.",
    reviewThanks: "✅ 평가해 주셔서 감사합니다!",
    welcome: "✅ HoangChef 매운 국수에 오신 것을 환영합니다",
    
    // Errors
    errorLoading: "데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요!",
    errorOrder: "주문 중 오류가 발생했습니다. 다시 시도해주세요!",
    errorStaff: "직원 호출 중 오류가 발생했습니다. 다시 시도해주세요!",
    errorReview: "❌ 평가 전송 중 오류가 발생했습니다!",
    emptyStaffMessage: "요청 사항을 입력해주세요!",
    emptyReviewContent: "평가 내용을 입력해주세요!"
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TABLE NAME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set table number from API response
 * @param {string} tableName - Table name from API (e.g., "Bàn 5")
 */
function setTableFromApi(tableName) {
  const match = tableName?.match(/\d+/);
  if (match) {
    currentTableNumber = match[0];
    updateTableName();
  }
}

/**
 * Update table name display based on current language
 */
function updateTableName() {
  const el = document.getElementById("table-name");
  if (!el || !currentTableNumber) return;

  const lang = localStorage.getItem("lang") || "vi";
  const t = i18n[lang];
  
  el.textContent = `${t.tablePrefix} ${currentTableNumber}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply selected language to entire page
 * @param {string} lang - Language code (vi, en, kr)
 */
function applyLanguage(lang) {
  const t = i18n[lang];
  if (!t) {
    console.warn(`Language '${lang}' not found, falling back to Vietnamese`);
    lang = 'vi';
  }

  // Update page title
  document.title = t.pageTitle;
  
  // Update HTML lang attribute
  document.documentElement.lang = lang;

  // ═══ LANGUAGE DROPDOWN ═══
  safeSetText("current-lang", t.label);
  safeSetText("current-lang-flag", t.flag);

  // ═══ HEADER ═══
  safeSetText(".brand-info h1", t.brandName);
  safeSetText(".brand-info p", t.slogan);
  safeSetText(".address-bar p", t.address);
  
  const infoItems = document.querySelectorAll(".info-item");
  if (infoItems[0]) infoItems[0].textContent = t.openTime;
  if (infoItems[1]) infoItems[1].textContent = t.phone;

  // ═══ MENU SECTION ═══
  safeSetText(".menu-title", t.menuTitle);
  safeSetAttr("#search", "placeholder", t.searchPlaceholder);

  // Update category buttons (if they exist)
  updateCategoryButtons(t);

  // ═══ CART - DESKTOP ═══
  safeSetText(".cart-title", t.cartTitle);
  safeSetText(".empty", t.emptyCart);
  safeSetText(".cart-summary .fw-bold", t.subtotal);
  safeSetText("#btn-order", t.orderBtn);
  safeSetText("#btn-call-staff", t.callStaffBtn);
  safeSetText("#btn-review", t.reviewBtn);

  // ═══ MOBILE CART ═══
  const mobileCartCount = document.getElementById("mobile-cart-count");
  if (mobileCartCount) {
    const count = mobileCartCount.textContent.match(/\d+/)?.[0] || "0";
    mobileCartCount.textContent = `${count} ${t.itemsCount}`;
  }
  
  const mobileEmptyCart = document.querySelector("#mobile-cart-list .empty");
  if (mobileEmptyCart) {
    mobileEmptyCart.textContent = t.emptyCart;
  }
  
  safeSetText("#mobile-btn-order", t.orderBtnShort);
  safeSetText("#mobile-btn-call-staff", t.callStaffBtnShort);
  safeSetText("#mobile-btn-review", t.reviewBtnShort);

  // ═══ HISTORY ═══
  safeSetAttr("#history-bubble", "title", t.historyBubbleTitle);
  safeSetText("#history-modal h4", t.historyTitle);
  safeSetAttr("#close-history", "title", t.closeBtn);

  // ═══ FOOTER ═══
  const footerContent = document.querySelector(".footer-content");
  if (footerContent) {
    footerContent.innerHTML = `
      <span>${t.developedBy}</span>
      <span class="divider">|</span>
      <a href="#" target="_blank">${t.department}</a>
      <span class="divider">|</span>
      <a href="#" target="_blank">${t.university}</a>
    `;
  }

  // ═══ MODAL: DISH OPTIONS ═══
  safeSetText("#option-modal h4", t.optionTitle);
  safeSetText("#spicy-block label", t.spicyLabel);
  
  // Update spicy level options
  const levelSelect = document.getElementById("level-select");
  if (levelSelect) {
    const options = levelSelect.querySelectorAll("option");
    options[0].textContent = t.spicyLevels.level1;
    options[1].textContent = t.spicyLevels.level2;
    options[2].textContent = t.spicyLevels.level3;
    options[3].textContent = t.spicyLevels.level4;
    options[4].textContent = t.spicyLevels.level5;
    options[5].textContent = t.spicyLevels.level6;
    options[6].textContent = t.spicyLevels.level7;
  }
  
  const noteLabels = document.querySelectorAll("#option-modal .form-label");
  if (noteLabels[1]) noteLabels[1].textContent = t.noteLabel;
  
  safeSetAttr("#note-input", "placeholder", t.notePlaceholder);
  safeSetText("#confirm-modal", t.addToCart);
  safeSetText("#cancel-modal", t.cancel);

  // ═══ MODAL: CALL STAFF ═══
  safeSetText("#staff-modal h4", t.staffTitle);
  safeSetAttr("#staff-message", "placeholder", t.staffPlaceholder);
  safeSetText("#send-staff", t.sendBtn);
  safeSetText("#close-staff-modal", t.cancel);

  // ═══ MODAL: REVIEW ═══
  safeSetText("#review-modal h4", t.reviewTitle);
  
  const reviewLabels = document.querySelectorAll("#review-modal .form-label");
  if (reviewLabels[0]) reviewLabels[0].textContent = t.reviewNameLabel;
  if (reviewLabels[1]) reviewLabels[1].textContent = t.reviewContentLabel;
  
  safeSetAttr("#review-name", "placeholder", t.reviewNamePlaceholder);
  safeSetAttr("#review-content", "placeholder", t.reviewPlaceholder);
  safeSetText("#send-review", t.sendReview);
  safeSetText("#close-review-modal", t.cancel);

  // Save language preference
  localStorage.setItem("lang", lang);
  
  // Update table name
  updateTableName();
  
  // Dispatch custom event for other scripts to react
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, translations: t } }));
}

/**
 * Update category button text if they exist
 * @param {Object} t - Translation object
 */
function updateCategoryButtons(t) {
  const categoryBar = document.querySelector(".category-bar");
  if (!categoryBar) return;
  
  const allButton = categoryBar.querySelector('[data-category="all"]');
  if (allButton) {
    allButton.textContent = t.categoryAll;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safely set text content of an element
 * @param {string} selector - CSS selector or ID
 * @param {string} text - Text to set
 */
function safeSetText(selector, text) {
  const el = selector.startsWith("#") || selector.startsWith(".") 
    ? document.querySelector(selector)
    : document.getElementById(selector);
  
  if (el) {
    el.textContent = text;
  }
}

/**
 * Safely set attribute of an element
 * @param {string} selector - CSS selector or ID
 * @param {string} attr - Attribute name
 * @param {string} value - Attribute value
 */
function safeSetAttr(selector, attr, value) {
  const el = selector.startsWith("#") || selector.startsWith(".") 
    ? document.querySelector(selector)
    : document.getElementById(selector);
  
  if (el) {
    el.setAttribute(attr, value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API FOR OTHER SCRIPTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current language
 * @returns {string} Current language code
 */
function getCurrentLanguage() {
  return localStorage.getItem("lang") || "vi";
}

/**
 * Get translation for current language
 * @param {string} key - Translation key (e.g., "addedToCart")
 * @returns {string} Translated text
 */
function translate(key) {
  const lang = getCurrentLanguage();
  const t = i18n[lang];
  
  // Support nested keys (e.g., "spicyLevels.level1")
  const keys = key.split('.');
  let value = t;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  return value || key;
}

/**
 * Get all translations for current language
 * @returns {Object} Translation object
 */
function getTranslations() {
  const lang = getCurrentLanguage();
  return i18n[lang] || i18n.vi;
}

// Make functions available globally
window.setTableFromApi = setTableFromApi;
window.updateTableName = updateTableName;
window.applyLanguage = applyLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.translate = translate;
window.getTranslations = getTranslations;

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  
  // ═══ LANGUAGE DROPDOWN CLICK HANDLER ═══
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".lang-item");
    if (!item) return;
    
    e.preventDefault();
    const lang = item.dataset.lang;
    applyLanguage(lang);
    
    // Close dropdown
    const dropdown = item.closest('.dropdown-menu');
    if (dropdown) {
      const bsDropdown = bootstrap.Dropdown.getInstance(dropdown.previousElementSibling);
      if (bsDropdown) bsDropdown.hide();
    }
  });

  // ═══ LOAD SAVED LANGUAGE ═══
  const savedLang = localStorage.getItem("lang") || "vi";
  applyLanguage(savedLang);
  
  console.log(`✅ Language Switcher initialized with '${savedLang}'`);
});

console.log('🌐 Language Switcher Loaded - Supports: Vietnamese, English, Korean');