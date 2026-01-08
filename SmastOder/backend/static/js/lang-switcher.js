// ================== GLOBAL ==================
let currentTableNumber = null;

// ================== TRANSLATIONS ==================
const i18n = {
  vi: {
    label: "Tiếng Việt",
    flag: "🇻🇳",

    // header
    slogan: "Nâng tầm hương vị Việt",
    address: "📍 88 Hoàng Hoa Thám, Xuân Hòa, Phú Thọ",
    openTime: "⏰ 9:00 - 22:00",
    phone: "📞 0982 121 680",

    // menu
    menuTitle: "🍜 Thực Đơn",
    searchPlaceholder: "🔍 Tìm món ăn (ví dụ: mì cay, trà sữa...)",

    // cart
    cartTitle: "🛒 Giỏ hàng",
    emptyCart: "Giỏ hàng trống",
    subtotal: "Tạm tính:",
    orderBtn: "🍜 Gửi đơn hàng",
    callStaffBtn: "📢 Gọi nhân viên hỗ trợ",
    reviewBtn: "⭐ Góp ý dịch vụ",

    // modal
    optionTitle: "Tùy chọn món",
    spicyLabel: "🌶️ Cấp độ cay",
    notePlaceholder: "Ví dụ: ít đá, không hành, thêm ớt...",
    addCart: "✅ Thêm vào giỏ",
    cancel: "❌ Hủy",

    staffTitle: "📢 Gọi nhân viên hỗ trợ",
    staffPlaceholder: "Mô tả vấn đề bạn cần hỗ trợ...",

    reviewTitle: "⭐ Góp ý dịch vụ",
    reviewName: "Tên quý khách (không bắt buộc)",
    reviewPlaceholder: "Chia sẻ cảm nhận của bạn về món ăn và dịch vụ...",
    sendReview: "📤 Gửi đánh giá"
  },

  en: {
    label: "English",
    flag: "🇺🇸",

    slogan: "Elevating Vietnamese flavors",
    address: "📍 88 Hoang Hoa Tham, Xuan Hoa, Phu Tho",
    openTime: "⏰ 9:00 AM - 10:00 PM",
    phone: "📞 0982 121 680",

    menuTitle: "🍜 Menu",
    searchPlaceholder: "🔍 Search food (e.g. spicy noodles, milk tea...)",

    cartTitle: "🛒 Cart",
    emptyCart: "Your cart is empty",
    subtotal: "Subtotal:",
    orderBtn: "🍜 Place order",
    callStaffBtn: "📢 Call staff",
    reviewBtn: "⭐ Service feedback",

    optionTitle: "Food options",
    spicyLabel: "🌶️ Spicy level",
    notePlaceholder: "Example: less ice, no onion...",
    addCart: "✅ Add to cart",
    cancel: "❌ Cancel",

    staffTitle: "📢 Call staff",
    staffPlaceholder: "Describe the issue you need help with...",

    reviewTitle: "⭐ Service feedback",
    reviewName: "Your name (optional)",
    reviewPlaceholder: "Share your experience...",
    sendReview: "📤 Send feedback"
  },

  kr: {
    label: "한국어",
    flag: "🇰🇷",

    slogan: "베트남의 맛을 한 단계 높이다",
    address: "📍 88 Hoang Hoa Tham, Xuan Hoa, Phu Tho",
    openTime: "⏰ 09:00 - 22:00",
    phone: "📞 0982 121 680",

    menuTitle: "🍜 메뉴",
    searchPlaceholder: "🔍 음식 검색 (예: 매운 국수...)",

    cartTitle: "🛒 장바구니",
    emptyCart: "장바구니가 비어 있습니다",
    subtotal: "소계:",
    orderBtn: "🍜 주문 보내기",
    callStaffBtn: "📢 직원 호출",
    reviewBtn: "⭐ 서비스 평가",

    optionTitle: "메뉴 옵션",
    spicyLabel: "🌶️ 매운 단계",
    notePlaceholder: "예: 얼음 적게, 양파 제외...",
    addCart: "✅ 장바구니 추가",
    cancel: "❌ 취소",

    staffTitle: "📢 직원 호출",
    staffPlaceholder: "도움이 필요한 내용을 입력하세요...",

    reviewTitle: "⭐ 서비스 평가",
    reviewName: "이름 (선택 사항)",
    reviewPlaceholder: "후기를 남겨주세요...",
    sendReview: "📤 평가 보내기"
  }
  
};

// ================== TABLE NAME ==================
function setTableFromApi(tableName) {
  const match = tableName?.match(/\d+/);
  if (match) {
    currentTableNumber = match[0];
    updateTableName();
  }
}

function updateTableName() {
  const el = document.getElementById("table-name");
  if (!el || !currentTableNumber) return;

  const lang = localStorage.getItem("lang") || "vi";
  const map = {
    vi: `Bàn ${currentTableNumber}`,
    en: `Table ${currentTableNumber}`,
    kr: `테이블 ${currentTableNumber}`
  };

  el.textContent = map[lang];
}

// ================== APPLY LANGUAGE ==================
function applyLanguage(lang) {
  const t = i18n[lang];
  if (!t) return;

  // dropdown
  document.getElementById("current-lang").textContent = t.label;
  document.getElementById("current-lang-flag").textContent = t.flag;

  // header
  document.querySelector(".brand-info p").textContent = t.slogan;
  document.querySelector(".address-bar p").textContent = t.address;
  document.querySelectorAll(".info-item")[0].textContent = t.openTime;
  document.querySelectorAll(".info-item")[1].textContent = t.phone;

  // menu
  document.querySelector(".menu-title").textContent = t.menuTitle;
  document.getElementById("search").placeholder = t.searchPlaceholder;

  // cart
  document.querySelector(".cart-title").textContent = t.cartTitle;
  document.querySelector(".empty").textContent = t.emptyCart;
  document.querySelector(".cart-summary span").textContent = t.subtotal;
  document.getElementById("btn-order").textContent = t.orderBtn;
  document.getElementById("btn-call-staff").textContent = t.callStaffBtn;
  document.getElementById("btn-review").textContent = t.reviewBtn;

  // modal option
  document.querySelector("#option-modal h4").textContent = t.optionTitle;
  document.querySelector("#spicy-block label").textContent = t.spicyLabel;
  document.getElementById("note-input").placeholder = t.notePlaceholder;
  document.getElementById("confirm-modal").textContent = t.addCart;
  document.getElementById("cancel-modal").textContent = t.cancel;

  // staff modal
  document.querySelector("#staff-modal h4").textContent = t.staffTitle;
  document.getElementById("staff-message").placeholder = t.staffPlaceholder;

  // review modal
  document.querySelector("#review-modal h4").textContent = t.reviewTitle;
  document.querySelector("#review-modal label").textContent = t.reviewName;
  document.getElementById("review-content").placeholder = t.reviewPlaceholder;
  document.getElementById("send-review").textContent = t.sendReview;

  localStorage.setItem("lang", lang);
  updateTableName();
}

// ================== EVENTS ==================
document.addEventListener("DOMContentLoaded", () => {

  // dropdown click
  document.addEventListener("click", e => {
    const item = e.target.closest(".lang-item");
    if (!item) return;
    e.preventDefault();
    applyLanguage(item.dataset.lang);
  });

  // load saved
  applyLanguage(localStorage.getItem("lang") || "vi");
});
