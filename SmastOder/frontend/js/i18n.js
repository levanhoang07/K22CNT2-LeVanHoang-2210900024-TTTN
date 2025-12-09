// ===============================
// SIMPLE I18N WITH JSON + JS
// ===============================

let currentLang = localStorage.getItem("lang") || "vi";

// Load translation file
async function loadLang(lang) {
    try {
        const res = await fetch(`lang/${lang}.json`); // Load: /lang/vi.json
        const data = await res.json();
        applyTranslations(data);
    } catch (e) {
        console.error("Translation load error:", e);
    }
}

// Apply translations to HTML
function applyTranslations(dict) {
    // Text: <tag data-i18n="key">
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.innerHTML = dict[key];
    });

    // Placeholder: <input data-i18n-placeholder="key">
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (dict[key]) el.placeholder = dict[key];
    });
}

// Change language from dropdown
document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("lang-select");

    if (select) {
        select.value = currentLang;

        select.addEventListener("change", (e) => {
            currentLang = e.target.value;
            localStorage.setItem("lang", currentLang);
            loadLang(currentLang);
        });
    }

    // Load default language on start
    loadLang(currentLang);
});
