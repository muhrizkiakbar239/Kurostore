const menuToggle = document.querySelector(".menu-toggle");
const primaryNavigation = document.querySelector("#primary-navigation");
const announcementMessage = document.querySelector("#announcement-message");
const heroCarousel = document.querySelector(".hero-carousel");
const heroImage = document.querySelector(".hero-image");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const sellerApplicationPage = document.querySelector("#seller-application-page");
const adminDashboardPage = document.querySelector("#admin-dashboard-page");
const sellerDashboardPage = document.querySelector("#seller-dashboard-page");
const cartPage = document.querySelector("#cart-page");
const checkoutPage = document.querySelector("#checkout-page");
const allProductsPage = document.querySelector("#all-products-page");
const accountPage = document.querySelector("#account-page");
const productsPage = document.querySelector("#products-page");
const billsCarousel = document.querySelector("#bills-carousel");
const guestBrowseButton = document.querySelector("#guest-browse");
const accountIsAuthenticated = sessionStorage.getItem("kurostore-authenticated") === "true";
const isGuestSession = sessionStorage.getItem("kurostore-guest-session") === "true";
const canAccessAccount = accountIsAuthenticated || isGuestSession;
const checkoutSelectionStorageKey = "kurostore-checkout-selection";

const createProductSkeletons = (count) => Array.from({ length: count }, () => {
  const card = document.createElement("article");
  card.className = "product-card product-skeleton-card";
  card.setAttribute("aria-hidden", "true");

  const artwork = document.createElement("div");
  artwork.className = "product-skeleton-art";

  const copy = document.createElement("div");
  copy.className = "product-skeleton-copy";
  ["category", "title", "description", "description-short", "price", "action"].forEach((line) => {
    const placeholder = document.createElement("span");
    placeholder.className = `product-skeleton-line product-skeleton-line-${line}`;
    copy.append(placeholder);
  });

  card.append(artwork, copy);
  return card;
});

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "auto";
}

window.addEventListener("pageshow", (event) => {
  if (!event.persisted && window.location.hash === "#konten-utama") {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
});

const setCartBadges = (itemCount) => {
  document.querySelectorAll(".cart-count").forEach((badge) => {
    badge.textContent = String(itemCount);
    badge.setAttribute("aria-label", `${itemCount} barang di keranjang`);
  });
};

const updateCartBadges = async () => {
  if (!accountIsAuthenticated) {
    setCartBadges(0);
    return;
  }

  try {
    const result = await authenticatedRequestApi("/api/account-data/cart");
    if (!Array.isArray(result.items)) throw new Error("Data keranjang tidak valid.");
    const itemCount = result.items.reduce((total, item) =>
      total + (Number.isInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
    document.querySelectorAll(".cart-count").forEach((badge) => {
      badge.textContent = String(itemCount);
      badge.setAttribute("aria-label", `${itemCount} barang di keranjang`);
    });
  } catch (error) {
    console.error("Unable to read cart item count:", error);
    document.querySelectorAll(".cart-count").forEach((badge) => {
      badge.textContent = "!";
      badge.setAttribute("aria-label", "Keranjang tidak dapat dimuat");
    });
  }
};

updateCartBadges();
document.addEventListener("kurostore:cart-updated", () => void updateCartBadges());

let authRefreshPromise = null;

function clearAuthSession() {
  sessionStorage.removeItem("kurostore-authenticated");
  sessionStorage.removeItem("kurostore-access-token");
  sessionStorage.removeItem("kurostore-refresh-token");
}

async function refreshAuthSession() {
  const refreshToken = sessionStorage.getItem("kurostore-refresh-token");
  if (!refreshToken) return false;

  if (!authRefreshPromise) {
    authRefreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 400 || response.status === 401) clearAuthSession();
        if (response.status >= 500) {
          throw new Error(typeof data?.error === "string"
            ? data.error
            : "Sesi tidak dapat diperbarui saat ini.");
        }
        return false;
      }

      if (!data?.session?.access_token || !data.session.refresh_token) {
        throw new Error("Respons pembaruan sesi tidak valid.");
      }

      sessionStorage.setItem("kurostore-authenticated", "true");
      sessionStorage.setItem("kurostore-access-token", data.session.access_token);
      sessionStorage.setItem("kurostore-refresh-token", data.session.refresh_token);
      return true;
    })().finally(() => {
      authRefreshPromise = null;
    });
  }

  return authRefreshPromise;
}

async function fetchWithAuth(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasAuthorization = headers.has("Authorization");
  if (!hasAuthorization) return fetch(url, options);

  const accessToken = sessionStorage.getItem("kurostore-access-token");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401) return response;

  if (!await refreshAuthSession()) return response;

  const refreshedHeaders = new Headers(options.headers || {});
  refreshedHeaders.set("Authorization", `Bearer ${sessionStorage.getItem("kurostore-access-token")}`);
  const retriedResponse = await fetch(url, { ...options, headers: refreshedHeaders });
  if (retriedResponse.status === 401) clearAuthSession();
  return retriedResponse;
}

window.KurostoreAuth = { fetch: fetchWithAuth };

async function requestApi(url, options = {}) {
  const response = await fetchWithAuth(url, options);
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Respons server tidak dapat dibaca. Coba lagi nanti.");
  }

  if (!response.ok) {
    const error = new Error(data && typeof data.error === "string" ? data.error : "Permintaan tidak dapat diproses.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function authenticatedRequestApi(url, options = {}) {
  const accessToken = sessionStorage.getItem("kurostore-access-token");
  if (!accountIsAuthenticated || !accessToken) {
    const error = new Error("Masuk ke akun terlebih dahulu untuk menyimpan data.");
    error.status = 401;
    throw error;
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return requestApi(url, { ...options, headers });
}

window.applyAccountSettingsLanguage = (language) => {
  if (!accountPage) return;
  const translations = {
    en: {
      "#account-title": "Settings & Account",
      "#settings-title": "General settings",
      "#profile-title": "My profile",
      "#account-address-panel h3": "Shipping address",
      "#account-payment-title": "Bank & Cards",
      "#account-kuropay-title": "KuroPay demo",
      "#account-password-title": "Change password",
      "#account-notifications-title": "Notification settings",
      "#account-privacy-title": "Privacy & account data",
      "#account-language-title": "Language",
      "#account-theme-title": "Theme",
      "#account-vouchers-title": "Vouchers & Points",
      "#account-orders-title": "My orders",
      "#profile-name": "Name",
      "#profile-email": "Email",
      "#profile-phone": "Phone number",
      "#address-name": "Recipient name",
      "#address-phone": "Phone number",
      "#address-street": "Full address",
      "#address-city": "City / region",
      "#address-postal-code": "Postal code",
      "#account-payment-method": "Preferred payment method",
      "#account-current-password": "Current password",
      "#account-new-password": "New password",
      "#account-confirm-password": "Confirm new password",
      "#account-email-order-updates": "Order status emails",
      "#account-language": "Language",
      "#account-theme": "Appearance",
      "#account-export-data": "Download my data",
      "#account-wallet-topup-amount": "Demo top-up amount",
      "#account-wallet-topup-button": "Top up with sandbox",
      "#account-wallet-balance-label": "Demo balance",
      "#account-points-balance-label": "Available points",
    },
    ja: {
      "#account-title": "アカウント設定",
      "#settings-title": "一般設定",
      "#profile-title": "プロフィール",
      "#account-address-panel h3": "配送先住所",
      "#account-payment-title": "銀行・カード",
      "#account-kuropay-title": "KuroPay デモ",
      "#account-password-title": "パスワード変更",
      "#account-notifications-title": "通知設定",
      "#account-privacy-title": "プライバシーとアカウントデータ",
      "#account-language-title": "言語",
      "#account-theme-title": "テーマ",
      "#account-vouchers-title": "クーポンとポイント",
      "#account-orders-title": "注文履歴",
      "#profile-name": "氏名",
      "#profile-email": "メールアドレス",
      "#profile-phone": "電話番号",
      "#address-name": "受取人名",
      "#address-phone": "電話番号",
      "#address-street": "住所",
      "#address-city": "市区町村",
      "#address-postal-code": "郵便番号",
      "#account-payment-method": "優先する支払い方法",
      "#account-current-password": "現在のパスワード",
      "#account-new-password": "新しいパスワード",
      "#account-confirm-password": "新しいパスワード（確認）",
      "#account-email-order-updates": "注文状況メール",
      "#account-language": "言語",
      "#account-theme": "表示",
      "#account-export-data": "データをダウンロード",
      "#account-wallet-topup-amount": "デモチャージ金額",
      "#account-wallet-topup-button": "サンドボックスでチャージ",
      "#account-wallet-balance-label": "デモ残高",
      "#account-points-balance-label": "利用可能ポイント",
    },
  };
  const navLabels = {
    en: {
      profile: "Profile", payment: "Bank & Cards", kuropay: "KuroPay", address: "Address",
      password: "Change password", notifications: "Notifications", privacy: "Privacy",
      language: "Language", theme: "Theme", orders: "My orders", vouchers: "Vouchers & Points",
    },
    ja: {
      profile: "プロフィール", payment: "銀行・カード", kuropay: "KuroPay", address: "住所",
      password: "パスワード変更", notifications: "通知", privacy: "プライバシー",
      language: "言語", theme: "テーマ", orders: "注文履歴", vouchers: "クーポンとポイント",
    },
  };
  const selectedTranslations = translations[language];
  if (!selectedTranslations) return;

  Object.entries(selectedTranslations).forEach(([selector, text]) => {
    const element = accountPage.querySelector(selector);
    if (element instanceof HTMLSelectElement) {
      const label = accountPage.querySelector(`label[for="${element.id}"]`);
      if (label) label.textContent = text;
    } else if (element instanceof HTMLLabelElement) {
      const label = accountPage.querySelector(`label[for="${element.id}"]`);
      if (label) label.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = text;
      });
    } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
      const label = accountPage.querySelector(`label[for="${element.id}"] span strong`);
      if (label) label.textContent = text;
    } else if (element instanceof HTMLInputElement) {
      const label = accountPage.querySelector(`label[for="${element.id}"]`);
      if (label) label.textContent = text;
    } else if (element instanceof HTMLElement) {
      element.textContent = text;
    }
  });

  accountPage.querySelectorAll("[data-account-panel]").forEach((button) => {
    const label = navLabels[language][button.dataset.accountPanel];
    if (!label) return;
    const textNode = Array.from(button.childNodes).find((node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = ` ${label}`;
  });

  const optionLabels = {
    en: {
      "#account-payment-method": ["All Midtrans methods", "QRIS", "E-wallet", "Virtual account / bank transfer", "Debit / credit card", "KuroPay demo balance (sandbox)"],
      "#account-language": ["Bahasa Indonesia", "English", "日本語"],
      "#account-theme": ["Light", "Dark"],
    },
    ja: {
      "#account-payment-method": ["Midtrans の全決済方法", "QRIS", "電子ウォレット", "銀行振込 / バーチャルアカウント", "デビット / クレジットカード", "KuroPay デモ残高（サンドボックス）"],
      "#account-language": ["インドネシア語", "英語", "日本語"],
      "#account-theme": ["ライト", "ダーク"],
    },
  };
  Object.entries(optionLabels[language] || {}).forEach(([selector, labels]) => {
    const select = accountPage.querySelector(selector);
    if (!(select instanceof HTMLSelectElement)) return;
    Array.from(select.options).forEach((option, index) => {
      if (labels[index]) option.textContent = labels[index];
    });
  });
};

const accountPreferenceStorageKey = "kurostore-account-preferences";
let currentAccountPreferences = {
  preferred_payment_method: "all",
  email_order_updates: false,
  language: "id",
  theme: "light",
};

const applyAccountPreferences = (preferences) => {
  const next = {
    ...currentAccountPreferences,
    ...preferences,
  };
  if (!["all", "qris", "ewallet", "bank_transfer", "credit_card", "kuropay_demo"].includes(next.preferred_payment_method)) {
    next.preferred_payment_method = "all";
  }
  if (!["id", "en", "ja"].includes(next.language)) next.language = "id";
  if (!["light", "dark"].includes(next.theme)) next.theme = "light";
  if (typeof next.email_order_updates !== "boolean") next.email_order_updates = false;

  currentAccountPreferences = next;
  document.documentElement.lang = accountPage ? next.language : "id";
  document.documentElement.dataset.theme = next.theme;
  localStorage.setItem(accountPreferenceStorageKey, JSON.stringify(next));
  if (typeof window.applyAccountSettingsLanguage === "function") {
    window.applyAccountSettingsLanguage(next.language);
  }
};

try {
  const savedPreferences = JSON.parse(localStorage.getItem(accountPreferenceStorageKey) || "null");
  if (savedPreferences && typeof savedPreferences === "object" && !Array.isArray(savedPreferences)) {
    applyAccountPreferences(savedPreferences);
  } else {
    applyAccountPreferences({});
  }
} catch (error) {
  console.error("Unable to read saved account preferences:", error);
  applyAccountPreferences({});
}

if (accountIsAuthenticated) {
  void authenticatedRequestApi("/api/account-data/preferences")
    .then((result) => {
      if (result.preferences && typeof result.preferences === "object") {
        applyAccountPreferences(result.preferences);
      }
    })
    .catch((error) => console.error("Unable to synchronize account preferences:", error));
}

function notifyCartUpdated() {
  document.dispatchEvent(new Event("kurostore:cart-updated"));
}

function saveAuthSession(data) {
  if (!data?.session?.access_token || !data?.user) {
    throw new Error("Sesi akun tidak diterima. Silakan coba masuk kembali.");
  }

  sessionStorage.setItem("kurostore-authenticated", "true");
  sessionStorage.setItem("kurostore-access-token", data.session.access_token);
  if (data.session.refresh_token) {
    sessionStorage.setItem("kurostore-refresh-token", data.session.refresh_token);
  }
  sessionStorage.setItem("kurostore-user-name", data.user.name || "");
  sessionStorage.setItem("kurostore-user-email", data.user.email || "");
  sessionStorage.removeItem("kurostore-guest-session");
}

function authReturnTarget() {
  const target = new URLSearchParams(window.location.search).get("next");
  if (target === "pengajuan-seller.html"
    || target === "admin/dashboard.html"
    || target === "seller/dashboard.html"
    || target === "checkout.html"
    || target === "pengaturan-akun.html") {
    return target;
  }
  return "../index.html";
}

if (["pengajuan-seller.html", "admin/dashboard.html", "seller/dashboard.html"].includes(
  new URLSearchParams(window.location.search).get("next") || ""
)) {
  document.querySelectorAll('a[href="register.html"], a[href="login.html"]').forEach((link) => {
    const target = new URLSearchParams(window.location.search).get("next");
    link.href = `${link.getAttribute("href")}?next=${encodeURIComponent(target)}`;
  });
}

document.querySelectorAll("[data-current-year]").forEach((yearElement) => {
  yearElement.textContent = String(new Date().getFullYear());
});

document.querySelectorAll(".account-link").forEach((accountLink) => {
  accountLink.hidden = accountIsAuthenticated;
});

const footerAccountLink = document.querySelector("#site-footer-account-link");
const footerAccountSettings = document.querySelector("#site-footer-account-settings");

if (canAccessAccount) {
  if (footerAccountLink) {
    footerAccountLink.href = "pages/pengaturan-akun.html";
    footerAccountLink.textContent = accountIsAuthenticated ? "Akun Saya" : "Akun Tamu";
  }
  if (footerAccountSettings) {
    footerAccountSettings.hidden = true;
  }
}

const categoryToggle = document.querySelector("#home-categories-toggle");
const extraCategories = document.querySelectorAll("[data-category-extra]");

if (categoryToggle && extraCategories.length > 0) {
  categoryToggle.addEventListener("click", () => {
    const expanded = categoryToggle.getAttribute("aria-expanded") !== "true";
    extraCategories.forEach((category) => {
      category.hidden = !expanded;
    });
    categoryToggle.setAttribute("aria-expanded", String(expanded));
    categoryToggle.textContent = expanded
      ? "Tampilkan lebih sedikit"
      : `Lihat semua kategori (${extraCategories.length})`;
  });
}

const flashSaleCountdown = document.querySelector("#flash-sale-countdown");

if (flashSaleCountdown) {
  const deadline = Date.parse(flashSaleCountdown.dataset.countdownDeadline || "");
  const hoursElement = flashSaleCountdown.querySelector("[data-countdown-hours]");
  const minutesElement = flashSaleCountdown.querySelector("[data-countdown-minutes]");
  const secondsElement = flashSaleCountdown.querySelector("[data-countdown-seconds]");

  if (!Number.isFinite(deadline) || !hoursElement || !minutesElement || !secondsElement) {
    throw new Error("Konfigurasi hitung mundur Flash Sale tidak valid.");
  }

  let countdownInterval = null;

  const updateFlashSaleCountdown = () => {
    const remaining = Math.max(0, deadline - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    hoursElement.textContent = String(hours).padStart(2, "0");
    minutesElement.textContent = String(minutes).padStart(2, "0");
    secondsElement.textContent = String(seconds).padStart(2, "0");

    if (remaining === 0) {
      flashSaleCountdown.closest(".flash-sale-timer-wrap").querySelector(".flash-sale-timer-label").textContent = "Flash Sale berakhir";
      if (countdownInterval !== null) {
        window.clearInterval(countdownInterval);
      }
    }
  };

  updateFlashSaleCountdown();
  if (deadline > Date.now()) {
    countdownInterval = window.setInterval(updateFlashSaleCountdown, 1000);
  }
}

document.querySelectorAll(".account-settings-link").forEach((accountLink) => {
  accountLink.hidden = !canAccessAccount;
});

const loadMidtransSnap = async (clientKey, environment) => {
  if (window.snap) return window.snap;

  const script = document.createElement("script");
  script.id = "midtrans-snap-script";
  script.src = environment === "production"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
  script.setAttribute("data-client-key", clientKey);
  script.async = true;

  await new Promise((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Tidak dapat memuat Midtrans Snap SDK."));
    document.head.appendChild(script);
  });

  if (!window.snap) {
    throw new Error("Midtrans Snap SDK belum siap digunakan.");
  }

  return window.snap;
};

if (cartPage) {
  const hasCartAccess = accountIsAuthenticated || cartPage.dataset.authenticated === "true";
  const lockedView = cartPage.querySelector("#cart-locked");
  const cartContent = cartPage.querySelector("#cart-content");
  const guestNotice = cartPage.querySelector("#cart-guest-notice");
  const cartFeedback = cartPage.querySelector("#cart-feedback");
  const cartLayout = cartPage.querySelector("#cart-layout");
  const cartEmpty = cartPage.querySelector("#cart-empty");
  const cartItemList = cartPage.querySelector("#cart-item-list");
  const selectAll = cartPage.querySelector("#cart-select-all");
  const itemCount = cartPage.querySelector("#cart-item-count");
  const selectedCount = cartPage.querySelector("#cart-selected-count");
  const cartTotal = cartPage.querySelector("#cart-total");
  const removeSelected = cartPage.querySelector("#cart-remove-selected");
  const checkoutButton = cartPage.querySelector("#cart-checkout");
  const recommendationsGrid = cartPage.querySelector("#cart-recommendation-grid");
  const recommendationsMessage = cartPage.querySelector("#cart-recommendation-message");
  let cartItems = [];
  let selectedProductIds = new Set();
  let products = [];

  const setCartFeedback = (message) => {
    if (cartFeedback) cartFeedback.textContent = message;
  };

  const showCart = () => {
    if (lockedView) lockedView.hidden = true;
    if (cartContent) cartContent.hidden = false;
    if (guestNotice) guestNotice.hidden = true;
  };

  const parseCart = (value) => {
    if (!Array.isArray(value)) throw new Error("Data keranjang tidak valid.");
    const validItems = value.every((item) =>
      item
      && typeof item.productId === "string"
      && typeof item.name === "string"
      && Number.isFinite(Number(item.price))
      && item.price > 0
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && Number.isInteger(item.stock)
      && item.stock >= 0
      && typeof item.priceIsEstimate === "boolean"
      && typeof item.available === "boolean");
    if (!validItems) throw new Error("Data barang di keranjang tidak valid.");
    return value.map((item) => ({ ...item, price: Number(item.price) }));
  };

  const refreshCart = async () => {
    const result = await authenticatedRequestApi("/api/account-data/cart");
    cartItems = parseCart(result.items);
    selectedProductIds = new Set(cartItems.map((item) => item.productId));
    renderCart();
    notifyCartUpdated();
  };

  const updateCartItem = async (productId, quantity) => {
    await authenticatedRequestApi("/api/account-data/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity }),
    });
    await refreshCart();
  };

  const removeCartItems = async (productIds) => {
    if (productIds.length === 0) return;
    await authenticatedRequestApi("/api/account-data/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_ids: productIds }),
    });
    selectedProductIds = new Set();
    await refreshCart();
  };

  const addCartItem = async (productId) => {
    await authenticatedRequestApi("/api/account-data/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    await refreshCart();
  };

  const showCartError = (error, message) => {
    console.error(message, error);
    setCartFeedback(error instanceof Error ? error.message : "Perubahan keranjang gagal disimpan.");
  };

  const formatPrice = (price) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

  const renderCart = () => {
    if (!(cartItemList instanceof HTMLElement)) return;
    cartItemList.replaceChildren();
    const hasItems = cartItems.length > 0;
    if (cartLayout) cartLayout.hidden = !hasItems;
    if (cartEmpty) cartEmpty.hidden = hasItems;
    if (itemCount) itemCount.textContent = `(${cartItems.length})`;

    cartItems.forEach((item) => {
      const row = document.createElement("article");
      row.className = "cart-item-row";

      const selection = document.createElement("input");
      selection.type = "checkbox";
      selection.className = "cart-item-select";
      selection.checked = selectedProductIds.has(item.productId);
      selection.setAttribute("aria-label", `Pilih ${item.name}`);
      selection.dataset.cartSelect = item.productId;
      selection.disabled = !item.available;

      const artwork = document.createElement("span");
      artwork.className = "cart-item-art";
      artwork.setAttribute("aria-hidden", "true");
      artwork.innerHTML = '<svg viewBox="0 0 24 24"><path d="m3.5 7 8.5-4 8.5 4v10l-8.5 4-8.5-4V7Z"></path><path d="m3.8 7.2 8.2 4 8.2-4M12 11.2V21"></path></svg>';

      const product = document.createElement("div");
      product.className = "cart-item-product";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const price = document.createElement("span");
      price.textContent = `${formatPrice(item.price)} / item${item.available ? "" : " · Tidak tersedia"}`;
      product.append(name, price);
      if (item.priceIsEstimate) {
        const estimate = document.createElement("small");
        estimate.className = "price-estimate-badge";
        estimate.textContent = "Estimasi harga";
        product.append(estimate);
      }

      const quantity = document.createElement("div");
      quantity.className = "cart-quantity-control";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.textContent = "−";
      decrease.disabled = !item.available || item.quantity <= 1;
      decrease.setAttribute("aria-label", `Kurangi jumlah ${item.name}`);
      decrease.dataset.cartQuantity = "decrease";
      decrease.dataset.productId = item.productId;
      const quantityValue = document.createElement("span");
      quantityValue.textContent = String(item.quantity);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.textContent = "+";
      increase.disabled = !item.available || item.quantity >= item.stock;
      increase.setAttribute("aria-label", `Tambah jumlah ${item.name}`);
      increase.dataset.cartQuantity = "increase";
      increase.dataset.productId = item.productId;
      quantity.append(decrease, quantityValue, increase);

      const subtotal = document.createElement("strong");
      subtotal.className = "cart-item-subtotal";
      subtotal.textContent = formatPrice(item.price * item.quantity);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-item-remove";
      remove.textContent = "Hapus";
      remove.dataset.cartRemove = item.productId;
      remove.setAttribute("aria-label", `Hapus ${item.name} dari keranjang`);

      row.append(selection, artwork, product, quantity, subtotal, remove);
      cartItemList.append(row);
    });

    const selectedItems = cartItems.filter((item) => selectedProductIds.has(item.productId) && item.available);
    const selectedQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0);
    const selectedTotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
    if (selectedCount) selectedCount.textContent = `${selectedQuantity} barang`;
    if (cartTotal) cartTotal.textContent = formatPrice(selectedTotal);
    if (selectAll instanceof HTMLInputElement) {
      const availableItems = cartItems.filter((item) => item.available);
      selectAll.checked = availableItems.length > 0 && selectedItems.length === availableItems.length;
      selectAll.indeterminate = selectedProductIds.size > 0 && !selectAll.checked;
    }
    if (removeSelected instanceof HTMLButtonElement) {
      removeSelected.disabled = selectedProductIds.size === 0;
    }
    if (checkoutButton instanceof HTMLButtonElement) {
      checkoutButton.disabled = selectedItems.length === 0;
    }
  };

  const renderRecommendations = () => {
    if (!(recommendationsGrid instanceof HTMLElement)) return;
    recommendationsGrid.replaceChildren();
    if (products.length === 0) {
      if (recommendationsMessage) {
        recommendationsMessage.textContent = "Belum ada produk yang tersedia untuk direkomendasikan.";
        recommendationsGrid.append(recommendationsMessage);
      }
      return;
    }

    products.slice(0, 6).forEach((product) => {
      const card = document.createElement("article");
      card.className = "cart-recommendation-card";
      const artwork = document.createElement("span");
      artwork.className = "cart-recommendation-art";
      artwork.setAttribute("aria-hidden", "true");
      artwork.innerHTML = '<svg viewBox="0 0 24 24"><path d="m3.5 7 8.5-4 8.5 4v10l-8.5 4-8.5-4V7Z"></path><path d="m3.8 7.2 8.2 4 8.2-4M12 11.2V21"></path></svg>';
      const name = document.createElement("strong");
      name.textContent = product.name;
      const price = document.createElement("span");
      price.textContent = formatPrice(product.price);
      const estimate = document.createElement("small");
      estimate.className = "price-estimate-badge";
      estimate.textContent = "Estimasi harga pasar";
      estimate.hidden = product.price_is_estimate !== true;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cart-add-button";
      button.textContent = product.stock > 0 ? "Tambah ke keranjang" : "Stok habis";
      button.disabled = product.stock <= 0;
      button.dataset.addCartProduct = product.id;
      card.append(artwork, name, price, estimate, button);
      recommendationsGrid.append(card);
    });
  };

  const loadRecommendations = async () => {
    if (!(recommendationsGrid instanceof HTMLElement)) return;
    try {
      const result = await requestApi("/api/products?sort=popular");
      products = (Array.isArray(result.products) ? result.products : [])
        .filter((product) => typeof product.id === "string"
          && typeof product.name === "string"
          && Number.isFinite(Number(product.price))
          && Number(product.price) > 0
          && Number.isInteger(product.stock))
        .map((product) => ({ ...product, price: Number(product.price) }))
        .filter((product) => product.stock > 0);
      renderRecommendations();
    } catch (error) {
      console.error("Unable to load cart recommendations:", error);
      if (recommendationsMessage) {
        recommendationsMessage.textContent = "Rekomendasi belum dapat dimuat. Coba muat ulang halaman.";
        recommendationsGrid.replaceChildren(recommendationsMessage);
      }
    }
  };

  renderCart();
  void loadRecommendations();
  if (hasCartAccess) {
    showCart();
    void refreshCart().catch((error) => showCartError(error, "Unable to load shopping cart:"));
  }

  cartItemList?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.cartSelect) return;
    if (target.checked) selectedProductIds.add(target.dataset.cartSelect);
    else selectedProductIds.delete(target.dataset.cartSelect);
    renderCart();
  });

  selectAll?.addEventListener("change", () => {
    selectedProductIds = selectAll.checked
      ? new Set(cartItems.filter((item) => item.available).map((item) => item.productId))
      : new Set();
    renderCart();
  });

  cartItemList?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const removeButton = event.target.closest("[data-cart-remove]");
    const quantityButton = event.target.closest("[data-cart-quantity]");
    if (removeButton) {
      const productId = removeButton.dataset.cartRemove;
      void removeCartItems([productId]).then(() => setCartFeedback("Produk dihapus dari keranjang."))
        .catch((error) => showCartError(error, "Unable to remove cart item:"));
      return;
    }
    if (quantityButton) {
      const productId = quantityButton.dataset.productId;
      const item = cartItems.find((cartItem) => cartItem.productId === productId);
      if (!item) return;
      const quantity = item.quantity + (quantityButton.dataset.cartQuantity === "increase" ? 1 : -1);
      void updateCartItem(productId, Math.max(1, Math.min(quantity, item.stock)))
        .catch((error) => showCartError(error, "Unable to update cart quantity:"));
    }
  });

  removeSelected?.addEventListener("click", () => {
    void removeCartItems(Array.from(selectedProductIds))
      .then(() => setCartFeedback("Produk pilihan dihapus dari keranjang."))
      .catch((error) => showCartError(error, "Unable to remove selected cart items:"));
  });

  checkoutButton?.addEventListener("click", () => {
    const selectedIds = cartItems
      .filter((item) => selectedProductIds.has(item.productId))
      .map((item) => item.productId);
    if (selectedIds.length === 0) {
      setCartFeedback("Pilih produk yang ingin dibayar terlebih dahulu.");
      return;
    }

    try {
      sessionStorage.setItem(checkoutSelectionStorageKey, JSON.stringify(selectedIds));
      window.location.href = "checkout.html";
    } catch (error) {
      console.error("Unable to prepare checkout:", error);
      setCartFeedback("Pilihan checkout tidak dapat disimpan. Coba muat ulang halaman.");
    }
  });

  recommendationsGrid?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const addButton = event.target.closest("[data-add-cart-product]");
    const product = products.find((candidate) => candidate.id === addButton?.dataset.addCartProduct);
    if (!product || product.stock <= 0) return;

    if (!hasCartAccess) {
      window.location.href = "login.html";
      return;
    }

    void addCartItem(product.id)
      .then(() => setCartFeedback(`${product.name} ditambahkan ke keranjang.`))
      .catch((error) => showCartError(error, "Unable to add product to cart:"));
  });
}

if (checkoutPage) {
  const content = checkoutPage.querySelector("#checkout-content");
  const emptyState = checkoutPage.querySelector("#checkout-empty");
  const feedback = checkoutPage.querySelector("#checkout-feedback");
  const form = checkoutPage.querySelector("#checkout-form");
  const itemList = checkoutPage.querySelector("#checkout-item-list");
  const quantityElement = checkoutPage.querySelector("#checkout-quantity");
  const totalElement = checkoutPage.querySelector("#checkout-total");
  const payableTotalElement = checkoutPage.querySelector("#checkout-payable-total");
  const redeemPointsInput = checkoutPage.querySelector("#checkout-redeem-points");
  const rewardBalanceElement = checkoutPage.querySelector("#checkout-reward-balance");
  const pointsDiscountRow = checkoutPage.querySelector("#checkout-points-discount-row");
  const pointsDiscountElement = checkoutPage.querySelector("#checkout-points-discount");
  const kuropayOption = checkoutPage.querySelector("#checkout-kuropay-option");
  const payButton = checkoutPage.querySelector("#checkout-pay");
  const resultPanel = checkoutPage.querySelector("#checkout-result");
  const resultTitle = checkoutPage.querySelector("#checkout-result-title");
  const resultMessage = checkoutPage.querySelector("#checkout-result-message");
  const loginLink = checkoutPage.querySelector("#checkout-login-link");
  const environmentNote = checkoutPage.querySelector("#checkout-environment-note");
  let selectedIds = new Set();
  let cartItems = [];
  let selectedItems = [];
  let checkoutPaymentConfig = null;
  let rewardBalance = 0;
  let demoWalletBalance = 0;
  let demoWalletEnabled = false;
  let checkoutSubtotal = 0;

  const setFeedback = (message) => {
    if (feedback) feedback.textContent = message;
  };

  const showResult = (title, message) => {
    if (content) content.hidden = true;
    if (resultPanel) resultPanel.hidden = false;
    if (resultTitle) resultTitle.textContent = title;
    if (resultMessage) resultMessage.textContent = message;
  };

  const formatPrice = (price) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

  const selectedPoints = () => {
    const points = Number(redeemPointsInput instanceof HTMLInputElement ? redeemPointsInput.value : 0);
    return Number.isInteger(points) && points >= 0 ? points : -1;
  };

  const updateCheckoutTotals = () => {
    const points = selectedPoints();
    const discount = points >= 0 && points % 100 === 0 ? (points / 100) * 1000 : 0;
    if (pointsDiscountRow instanceof HTMLElement) pointsDiscountRow.hidden = discount === 0;
    if (pointsDiscountElement) pointsDiscountElement.textContent = `−${formatPrice(discount)}`;
    if (payableTotalElement) payableTotalElement.textContent = formatPrice(Math.max(0, checkoutSubtotal - discount));
  };

  const loadPaymentConfig = async () => {
    const config = await requestApi("/api/payments/config");
    if (typeof config.clientKey !== "string" || !config.clientKey
      || !["sandbox", "production"].includes(config.environment)) {
      throw new Error("Konfigurasi Midtrans tidak valid.");
    }
    checkoutPaymentConfig = config;
    if (environmentNote) {
      environmentNote.textContent = config.environment === "sandbox"
        ? "Mode sandbox: transaksi hanya untuk pengujian dan tidak menarik uang sungguhan."
        : "Mode produksi Midtrans aktif.";
    }
    return config;
  };

  const initializeCheckout = async () => {
    if (!accountIsAuthenticated || !sessionStorage.getItem("kurostore-access-token")) {
      setFeedback("Masuk ke akun terlebih dahulu untuk memuat keranjang dan melanjutkan checkout.");
      if (loginLink) loginLink.hidden = false;
      if (emptyState) emptyState.hidden = true;
      return;
    }

    try {
      const savedSelection = JSON.parse(sessionStorage.getItem(checkoutSelectionStorageKey) || "[]");
      if (Array.isArray(savedSelection)) {
        selectedIds = new Set(savedSelection.filter((id) => typeof id === "string"));
      }
    } catch (error) {
      console.error("Unable to read checkout selection:", error);
      setFeedback("Pilihan produk tidak dapat dibaca. Kembali ke keranjang dan pilih ulang.");
    }

    try {
      const cartResult = await authenticatedRequestApi("/api/account-data/cart");
      if (!Array.isArray(cartResult.items)) throw new Error("Data keranjang tidak valid.");
      cartItems = cartResult.items.filter((item) =>
        item
        && typeof item.productId === "string"
        && typeof item.name === "string"
        && Number.isFinite(Number(item.price))
        && Number(item.price) > 0
        && Number.isInteger(item.quantity)
        && item.quantity > 0
        && typeof item.priceIsEstimate === "boolean"
        && item.available === true)
        .map((item) => ({ ...item, price: Number(item.price) }));
      selectedItems = cartItems.filter((item) => selectedIds.has(item.productId));
    } catch (error) {
      console.error("Unable to load checkout cart:", error);
      setFeedback(error instanceof Error ? error.message : "Keranjang tidak dapat dimuat. Coba lagi.");
    }

    if (selectedItems.length === 0) {
      if (emptyState) emptyState.hidden = false;
      sessionStorage.removeItem(checkoutSelectionStorageKey);
      return;
    }

    if (content) content.hidden = false;
    if (itemList) {
      itemList.replaceChildren();
      selectedItems.forEach((item) => {
        const row = document.createElement("li");
        row.className = "checkout-item";
        const copy = document.createElement("span");
        copy.className = "checkout-item-copy";
        const artwork = document.createElement("span");
        artwork.className = "checkout-item-art";
        artwork.setAttribute("aria-hidden", "true");
        artwork.innerHTML = '<svg viewBox="0 0 24 24"><path d="m3.5 7 8.5-4 8.5 4v10l-8.5 4-8.5-4V7Z"></path><path d="m3.8 7.2 8.2 4 8.2-4M12 11.2V21"></path></svg>';
        const name = document.createElement("strong");
        name.textContent = item.name;
        copy.append(artwork, name);
        if (item.priceIsEstimate) {
          const estimate = document.createElement("small");
          estimate.className = "price-estimate-badge";
          estimate.textContent = "Estimasi harga pasar";
          copy.append(estimate);
        }
        const unitPrice = document.createElement("span");
        unitPrice.className = "checkout-item-unit";
        unitPrice.textContent = formatPrice(item.price);
        const quantity = document.createElement("span");
        quantity.className = "checkout-item-quantity";
        quantity.textContent = String(item.quantity);
        const subtotal = document.createElement("strong");
        subtotal.className = "checkout-item-subtotal";
        subtotal.textContent = formatPrice(item.quantity * item.price);
        row.append(copy, unitPrice, quantity, subtotal);
        itemList.append(row);
      });
    }

    const itemQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const total = selectedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    checkoutSubtotal = total;
    if (quantityElement) quantityElement.textContent = `${itemQuantity} barang`;
    if (totalElement) totalElement.textContent = formatPrice(total);
    const productsTotalElement = checkoutPage.querySelector("#checkout-products-total");
    if (productsTotalElement) productsTotalElement.textContent = formatPrice(total);
    updateCheckoutTotals();

    const nameInput = form?.querySelector("#checkout-name");
    const emailInput = form?.querySelector("#checkout-email");
    const phoneInput = form?.querySelector("#checkout-phone");
    const addressInput = form?.querySelector("#checkout-address");
    const cityInput = form?.querySelector("#checkout-city");
    const postalCodeInput = form?.querySelector("#checkout-postal-code");
    const addressBadge = checkoutPage.querySelector("#checkout-address-badge");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = sessionStorage.getItem("kurostore-user-name") || "";
    }
    if (emailInput instanceof HTMLInputElement) {
      emailInput.value = sessionStorage.getItem("kurostore-user-email") || "";
    }

    const savedAddressResult = await authenticatedRequestApi("/api/account-data/address");
    const savedAddress = savedAddressResult.address;
    if (savedAddress) {
      if (nameInput instanceof HTMLInputElement) nameInput.value = savedAddress.name;
      if (phoneInput instanceof HTMLInputElement) phoneInput.value = savedAddress.phone;
      if (addressInput instanceof HTMLTextAreaElement) addressInput.value = savedAddress.address;
      if (cityInput instanceof HTMLInputElement) cityInput.value = savedAddress.city;
      if (postalCodeInput instanceof HTMLInputElement) postalCodeInput.value = savedAddress.postalCode;
      if (addressBadge) addressBadge.textContent = "Alamat tersimpan";
    } else if (phoneInput instanceof HTMLInputElement) {
      phoneInput.value = sessionStorage.getItem("kurostore-user-phone") || "";
    }

    try {
      await loadPaymentConfig();
    } catch (error) {
      console.error("Unable to load payment configuration:", error);
      if (environmentNote) environmentNote.textContent = "Pembayaran belum tersedia sampai Midtrans dikonfigurasi.";
    }

    try {
      const [walletResult, preferenceResult] = await Promise.all([
        authenticatedRequestApi("/api/account-data/wallet"),
        authenticatedRequestApi("/api/account-data/preferences"),
      ]);
      if (Number.isFinite(Number(walletResult.rewards?.balance))) {
        rewardBalance = Number(walletResult.rewards.balance);
      }
      if (rewardBalanceElement) rewardBalanceElement.textContent = new Intl.NumberFormat("id-ID").format(rewardBalance);
      if (redeemPointsInput instanceof HTMLInputElement) {
        redeemPointsInput.max = String(Math.min(rewardBalance, Math.floor(checkoutSubtotal / 1000) * 100));
        redeemPointsInput.disabled = walletResult.enabled !== true;
      }
      demoWalletBalance = Number.isFinite(Number(walletResult.wallet?.balance))
        ? Number(walletResult.wallet.balance)
        : 0;
      demoWalletEnabled = walletResult.enabled === true && checkoutPaymentConfig?.environment === "sandbox";
      if (kuropayOption instanceof HTMLLabelElement) {
        kuropayOption.hidden = !demoWalletEnabled;
        const walletDescription = kuropayOption.querySelector("small");
        if (walletDescription) walletDescription.textContent = `Saldo demo: ${formatPrice(demoWalletBalance)}`;
      }

      const preferredMethod = preferenceResult.preferences?.preferred_payment_method;
      if (typeof preferredMethod === "string" && (preferredMethod !== "kuropay_demo" || demoWalletEnabled)) {
        const preferredOption = checkoutPage.querySelector(`input[name="payment_method"][value="${preferredMethod}"]`);
        if (preferredOption instanceof HTMLInputElement && !preferredOption.disabled) {
          preferredOption.checked = true;
          checkoutPage.querySelectorAll(".checkout-payment-option").forEach((option) => {
            option.classList.toggle("is-selected", option.querySelector('input[name="payment_method"]')?.checked === true);
          });
        }
      }
    } catch (error) {
      console.error("Unable to load account wallet or checkout preferences:", error);
      if (kuropayOption instanceof HTMLLabelElement) kuropayOption.hidden = true;
    }
  };

  redeemPointsInput?.addEventListener("input", updateCheckoutTotals);

  void initializeCheckout().catch((error) => {
    console.error("Unable to initialize checkout:", error);
    setFeedback(error instanceof Error ? error.message : "Checkout tidak dapat dimuat.");
  });

  checkoutPage.querySelectorAll('input[name="payment_method"]').forEach((input) => {
    input.addEventListener("change", () => {
      checkoutPage.querySelectorAll(".checkout-payment-option").forEach((option) => {
        option.classList.toggle("is-selected", option.querySelector('input[name="payment_method"]')?.checked === true);
      });
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement) || !(payButton instanceof HTMLButtonElement)) return;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const fullName = String(formData.get("name") || "").trim();
    const nameParts = fullName.split(/\s+/);
    const address = String(formData.get("address") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const postalCode = String(formData.get("postal_code") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const paymentMethod = String(formData.get("payment_method") || "all");
    const redeemPoints = selectedPoints();
    const accessToken = sessionStorage.getItem("kurostore-access-token");

    if (!accountIsAuthenticated || !accessToken) {
      setFeedback("Masuk ke akun terlebih dahulu agar pesanan dapat disimpan.");
      if (loginLink) loginLink.hidden = false;
      return;
    }

    if (selectedItems.length === 0 || !address || !city || !postalCode || !phone) {
      setFeedback("Pastikan produk dan semua detail penerima sudah lengkap.");
      return;
    }
    if (redeemPoints < 0
      || redeemPoints % 100 !== 0
      || redeemPoints > rewardBalance
      || (redeemPoints / 100) * 1000 > checkoutSubtotal) {
      setFeedback("Jumlah poin tidak valid, tidak cukup, atau melebihi total pesanan.");
      return;
    }

    payButton.disabled = true;
    setFeedback(paymentMethod === "kuropay_demo"
      ? "Memproses pembayaran saldo KuroPay demo…"
      : "Menyiapkan pembayaran Midtrans…");

    try {
      const paymentConfig = checkoutPaymentConfig ?? await loadPaymentConfig();
      const payment = await requestApi("/api/payments/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedItems,
          customer: {
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
            email: String(formData.get("email") || "").trim(),
            phone,
            address,
            city,
            postalCode,
          },
          paymentMethod,
          redeemPoints,
        }),
      });

      if (payment.paid === true) {
        try {
          await authenticatedRequestApi("/api/account-data/cart", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_ids: selectedItems.map((item) => item.productId) }),
          });
          notifyCartUpdated();
        } catch (error) {
          console.error("Unable to clear KuroPay-paid cart items:", error);
          setFeedback("Pembayaran berhasil, tetapi keranjang belum dapat diperbarui.");
        }
        sessionStorage.removeItem(checkoutSelectionStorageKey);
        showResult(
          "Pembayaran demo berhasil",
          `Pesanan ${payment.orderId} telah dibayar dengan saldo demo atau poin. Tidak ada uang sungguhan yang diproses.`,
        );
        return;
      }

      if (!payment.token || !payment.redirectUrl) {
        throw new Error("Token pembayaran tidak diterima dari server.");
      }

      const snap = await loadMidtransSnap(paymentConfig.clientKey, paymentConfig.environment);
      setFeedback("Selesaikan pembayaran di popup Midtrans.");
      snap.pay(payment.token, {
        onSuccess: (result) => {
          void authenticatedRequestApi("/api/account-data/cart", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_ids: selectedItems.map((item) => item.productId) }),
          }).then(() => {
            notifyCartUpdated();
          }).catch((error) => {
            console.error("Unable to clear paid cart items:", error);
            showResult("Pembayaran berhasil", "Pembayaran terkonfirmasi, tetapi keranjang tidak dapat diperbarui. Hapus produk yang sudah dibayar dari keranjang secara manual.");
            sessionStorage.removeItem(checkoutSelectionStorageKey);
          });
          sessionStorage.removeItem(checkoutSelectionStorageKey);
          showResult("Pembayaran diterima", `Midtrans sedang mengonfirmasi pembayaran. Order ID: ${result.order_id || payment.orderId}. Status terbaru dapat dilihat di Pesanan Saya.`);
        },
        onPending: (result) => {
          showResult("Menunggu pembayaran", `Pesanan ${result.order_id || payment.orderId} sudah tersimpan. Status akan diperbarui setelah Midtrans mengonfirmasi pembayaran.`);
        },
        onError: () => {
          setFeedback("Pembayaran gagal. Coba lagi atau pilih metode pembayaran lain.");
          payButton.disabled = false;
        },
        onClose: () => {
          setFeedback("Popup pembayaran ditutup. Pesanan belum dikonfirmasi; kamu bisa mencoba lagi.");
          payButton.disabled = false;
        },
      });
    } catch (error) {
      console.error("Unable to start checkout payment:", error);
      setFeedback(error instanceof Error ? error.message : "Pembayaran gagal dibuat. Coba beberapa saat lagi.");
      if (error instanceof Error && error.status === 401 && loginLink) {
        loginLink.hidden = false;
      }
      payButton.disabled = false;
    }
  });
}

if (allProductsPage) {
  const productGrid = allProductsPage.querySelector("#all-products-grid");
  const resultCount = allProductsPage.querySelector("#all-products-count");
  const searchInput = document.querySelector("#site-search");
  const sortSelect = allProductsPage.querySelector("#all-products-sort");
  const clearCategoryButton = allProductsPage.querySelector("#all-products-category-clear");
  const feedback = allProductsPage.querySelector("#all-products-feedback");
  const emptyState = allProductsPage.querySelector("#all-products-empty");
  const emptyTitle = allProductsPage.querySelector("#all-products-empty-title");
  const emptyMessage = allProductsPage.querySelector("#all-products-empty-message");
  const loadMoreButton = allProductsPage.querySelector("#all-products-load-more");
  const productsPageSize = 24;
  let categoriesById = new Map();
  let categoriesBySlug = new Map();
  let categoriesPromise = null;
  let wishlistIds = new Set();
  let loadedProducts = [];
  let totalProducts = 0;
  let currentPage = 0;
  let requestSequence = 0;
  let activeRequestController = null;
  let searchTimer = null;
  let isLoading = false;
  let catalogInitialized = false;
  let activeCategorySlug = new URLSearchParams(window.location.search).get("category") || "";

  if (searchInput instanceof HTMLInputElement) {
    searchInput.value = new URLSearchParams(window.location.search).get("q") || "";
  }

  const setFeedback = (message) => {
    if (feedback) feedback.textContent = message;
  };

  const formatProductPrice = (price) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

  const renderProducts = () => {
    if (!(productGrid instanceof HTMLElement)) return;
    productGrid.replaceChildren();
    const selectedCategory = categoriesBySlug.get(activeCategorySlug);
    const heading = document.querySelector("#all-products-list-title");
    const description = heading?.parentElement?.querySelector("p");
    if (heading) heading.textContent = selectedCategory
      ? `Kategori: ${selectedCategory.name}`
      : window.location.hash === "#all-products-page" ? "Produk terbaru" : "Semua produk";
    if (description) description.textContent = selectedCategory
      ? `Produk dalam kategori ${selectedCategory.name}.`
      : window.location.hash === "#all-products-page"
        ? "Produk terbaru dari berbagai kategori."
        : "Produk dari berbagai kategori ditampilkan bersama.";
    if (clearCategoryButton instanceof HTMLButtonElement) {
      clearCategoryButton.hidden = !selectedCategory;
    }

    loadedProducts.forEach((product) => {
      const card = document.createElement("article");
      card.className = "product-card all-product-card";
      const artwork = document.createElement("div");
      artwork.className = "product-card-art product-art-controller all-product-art";
      artwork.setAttribute("aria-hidden", "true");
      artwork.innerHTML = '<span class="product-art-orb"></span><svg viewBox="0 0 120 96"><path d="M27 33c3-8 9-12 17-12h32c8 0 14 4 17 12l8 24c3 9-3 15-10 12l-13-9H42l-13 9c-7 3-13-3-10-12l8-24Z"></path><path d="M40 43v14m-7-7h14m28-4h.01M84 52h.01"></path></svg>';

      const copy = document.createElement("div");
      copy.className = "product-card-copy";
      const category = document.createElement("span");
      category.className = "product-card-category";
      category.dataset.productCategoryId = product.category_id || "";
      category.textContent = categoriesById.get(product.category_id) || "Semua kategori";
      const name = document.createElement("h3");
      name.textContent = product.name;
      const description = document.createElement("p");
      description.textContent = product.description || "Lihat detail produk ini dan temukan pilihan yang cocok untukmu.";
      const rating = document.createElement("span");
      rating.className = "product-rating-summary";
      rating.textContent = product.rating_count > 0
        ? `★ ${Number(product.rating_average).toFixed(1)} · ${product.rating_count} ulasan`
        : "Belum ada rating";
      const bottom = document.createElement("div");
      bottom.className = "product-card-bottom";
      const price = document.createElement("strong");
      price.textContent = formatProductPrice(product.price);
      const stock = document.createElement("span");
      stock.textContent = product.stock > 0 ? `Stok ${product.stock}` : "Stok habis";
      bottom.append(price, stock);
      const estimate = document.createElement("small");
      estimate.className = "price-estimate-badge";
      estimate.textContent = "Estimasi harga pasar";
      estimate.hidden = product.price_is_estimate !== true;

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "all-product-add-button";
      addButton.textContent = product.stock > 0 ? "Tambah ke keranjang" : "Stok habis";
      addButton.disabled = product.stock <= 0;
      addButton.dataset.addCartProduct = product.id;

      const wishlistButton = document.createElement("button");
      wishlistButton.type = "button";
      wishlistButton.className = "all-product-wishlist-button";
      wishlistButton.textContent = wishlistIds.has(product.id) ? "Tersimpan di wishlist" : "Simpan ke wishlist";
      wishlistButton.setAttribute("aria-pressed", String(wishlistIds.has(product.id)));
      wishlistButton.dataset.wishlistProduct = product.id;

      copy.append(category, name, description, rating, bottom, estimate, addButton, wishlistButton);
      card.append(artwork, copy);
      productGrid.append(card);
    });

    if (resultCount) {
      const searchTerm = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : "";
      resultCount.textContent = searchTerm
        ? `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk ditemukan`
        : selectedCategory
          ? `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk`
          : `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk tersedia`;
    }

    const hasProducts = loadedProducts.length > 0;
    if (emptyState) emptyState.hidden = hasProducts;
    if (emptyTitle) emptyTitle.textContent = searchInput?.value.trim()
      ? "Produk tidak ditemukan"
      : selectedCategory
        ? `Belum ada produk di kategori ${selectedCategory.name}`
      : "Produk belum tersedia";
    if (emptyMessage) emptyMessage.textContent = searchInput?.value.trim()
      ? "Coba kata pencarian lain."
      : selectedCategory
        ? "Kategori ini belum memiliki produk aktif."
      : "Produk aktif akan muncul di sini saat sudah tersedia.";
    if (loadMoreButton instanceof HTMLButtonElement) {
      loadMoreButton.hidden = !hasProducts || loadedProducts.length >= totalProducts;
      loadMoreButton.disabled = isLoading;
    }
  };

  const loadProducts = async ({ append = false } = {}) => {
    if (append && isLoading) return;
    if (!append) activeRequestController?.abort();
    isLoading = true;
    const sequence = ++requestSequence;
    const controller = new AbortController();
    activeRequestController = controller;
    const page = append ? currentPage + 1 : 1;
    const searchTerm = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : "";
    const sort = sortSelect instanceof HTMLSelectElement ? sortSelect.value : "newest";
    const parameters = new URLSearchParams({
      page: String(page),
      page_size: String(productsPageSize),
      sort,
    });
    if (searchTerm) parameters.set("q", searchTerm);
    const categorySlug = new URLSearchParams(window.location.search).get("category") || "";
    activeCategorySlug = categorySlug;

    setFeedback("");
    if (!append) {
      if (resultCount && loadedProducts.length === 0) resultCount.textContent = "Memuat produk…";
      if (emptyState && loadedProducts.length === 0) emptyState.hidden = true;
    }
    if (productGrid instanceof HTMLElement) {
      productGrid.classList.add("is-loading");
      productGrid.setAttribute("aria-busy", "true");
      const skeletons = createProductSkeletons(append || loadedProducts.length > 0 ? 4 : 8);
      if (!append && loadedProducts.length === 0) productGrid.replaceChildren(...skeletons);
      else productGrid.append(...skeletons);
    }
    if (loadMoreButton instanceof HTMLButtonElement) loadMoreButton.disabled = true;

    let requestFailed = false;
    try {
      if (categorySlug) {
        await loadCategories();
        const category = categoriesBySlug.get(categorySlug);
        if (!category) throw new Error("Kategori tidak ditemukan.");
        parameters.set("category_id", category.id);
      }
      const result = await requestApi(`/api/products?${parameters.toString()}`, {
        signal: controller.signal,
      });
      if (sequence !== requestSequence) return;
      const products = Array.isArray(result.products) ? result.products : [];
      const validatedProducts = products.filter((product) =>
        product
        && typeof product.id === "string"
        && typeof product.name === "string"
        && Number.isFinite(Number(product.price))
        && Number(product.price) > 0
        && Number.isInteger(product.stock)
        && product.stock >= 0)
        .map((product) => ({ ...product, price: Number(product.price) }));
      loadedProducts = append ? [...loadedProducts, ...validatedProducts] : validatedProducts;
      totalProducts = Number.isSafeInteger(result.pagination?.total)
        ? result.pagination.total
        : loadedProducts.length;
      currentPage = page;
    } catch (error) {
      if (sequence !== requestSequence) return;
      requestFailed = true;
      setFeedback(error instanceof Error ? error.message : "Produk tidak dapat dimuat.");
      if (loadedProducts.length === 0) {
        if (resultCount) resultCount.textContent = "Produk belum dapat dimuat";
        if (emptyTitle) emptyTitle.textContent = "Produk belum dapat dimuat";
        if (emptyMessage) emptyMessage.textContent = "Periksa koneksi lalu coba muat ulang halaman.";
        if (emptyState) emptyState.hidden = false;
        if (loadMoreButton instanceof HTMLButtonElement) loadMoreButton.hidden = true;
      }
    } finally {
      if (sequence === requestSequence) {
        isLoading = false;
        if (productGrid instanceof HTMLElement) {
          productGrid.classList.remove("is-loading");
          productGrid.setAttribute("aria-busy", "false");
        }
        if (loadMoreButton instanceof HTMLButtonElement) loadMoreButton.disabled = false;
        if (!requestFailed) renderProducts();
        else productGrid?.querySelectorAll(".product-skeleton-card").forEach((card) => card.remove());
      }
    }
  };

  const loadCategories = () => {
    if (categoriesPromise) return categoriesPromise;
    categoriesPromise = requestApi("/api/categories").then((result) => {
      if (!Array.isArray(result.categories)) throw new Error("Data kategori tidak valid.");
      const categories = result.categories.filter((category) =>
        typeof category?.id === "string"
        && typeof category.name === "string"
        && typeof category.slug === "string");
      categoriesById = new Map(categories.map((category) => [category.id, category.name]));
      categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
      productGrid?.querySelectorAll("[data-product-category-id]").forEach((categoryLabel) => {
        categoryLabel.textContent = categoriesById.get(categoryLabel.dataset.productCategoryId) || "Semua kategori";
      });
      return categories;
    }).catch((error) => {
      categoriesPromise = null;
      console.error("Unable to load product categories:", error);
      throw error;
    });
    return categoriesPromise;
  };

  const initializeCatalog = () => {
    if (catalogInitialized) return false;
    catalogInitialized = true;
    void loadCategories().catch((error) => {
      setFeedback(error instanceof Error ? error.message : "Kategori produk tidak dapat dimuat.");
    });

    if (accountIsAuthenticated) {
      void authenticatedRequestApi("/api/account-data/wishlist").then((result) => {
        if (!Array.isArray(result.items)) throw new Error("Data wishlist tidak valid.");
        wishlistIds = new Set(result.items
          .map((item) => item?.id)
          .filter((id) => typeof id === "string"));
        renderProducts();
      }).catch((error) => {
        console.error("Unable to load saved wishlist:", error);
      });
    }

    return true;
  };

  const addProductToCart = async (product) => {
    if (!accountIsAuthenticated) {
      setFeedback("Masuk ke akun terlebih dahulu untuk menambahkan produk ke keranjang.");
      return;
    }

    try {
      await authenticatedRequestApi("/api/account-data/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      notifyCartUpdated();
      setFeedback(`${product.name} ditambahkan ke keranjang.`);
    } catch (error) {
      console.error("Unable to save shopping cart:", error);
      setFeedback(error instanceof Error ? error.message : "Produk tidak dapat ditambahkan ke keranjang.");
    }
  };

  searchInput?.addEventListener("input", () => {
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    if (searchInput instanceof HTMLInputElement) {
      const searchUrl = new URL(window.location.href);
      if (searchInput.value.trim()) {
        searchUrl.searchParams.set("q", searchInput.value.trim());
      } else {
        searchUrl.searchParams.delete("q");
      }
      searchUrl.hash = "#kategori";
      window.history.replaceState(
        { ...(window.history.state || {}), viewMode: "categories" },
        "",
        `${searchUrl.pathname}${searchUrl.search}${searchUrl.hash}`
      );
      document.dispatchEvent(new Event("kurostore:show-categories"));
      initializeCatalog();
    }
    searchTimer = window.setTimeout(() => {
      void loadProducts();
    }, 250);
  });
  sortSelect?.addEventListener("change", () => {
    initializeCatalog();
    void loadProducts();
  });
  loadMoreButton?.addEventListener("click", () => {
    initializeCatalog();
    void loadProducts({ append: true });
  });
  document.querySelector("#home-category-grid")?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const categoryLink = event.target.closest("a[data-product-category]");
    if (!(categoryLink instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    event.stopPropagation();
    const categorySlug = categoryLink.dataset.productCategory;
    if (!categorySlug) return;

    initializeCatalog();
    void loadCategories().then(() => {
      const category = categoriesBySlug.get(categorySlug);
      if (!category) throw new Error("Kategori ini belum tersedia.");
      if (searchInput instanceof HTMLInputElement) searchInput.value = "";

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("q");
      nextUrl.searchParams.set("category", categorySlug);
      nextUrl.hash = "#all-products-page";
      window.history.pushState(
        { viewMode: "latest" },
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );
      window.dispatchEvent(new PopStateEvent("popstate", { state: { viewMode: "latest" } }));
      document.querySelector("#all-products-page")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }).catch((error) => {
      console.error("Unable to filter products by category:", error);
      setFeedback(error instanceof Error ? error.message : "Produk kategori tidak dapat dimuat.");
    });
  });
  clearCategoryButton?.addEventListener("click", () => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("category");
    nextUrl.hash = "#all-products-page";
    window.history.pushState(
      { viewMode: "latest" },
      "",
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    );
    window.dispatchEvent(new PopStateEvent("popstate", { state: { viewMode: "latest" } }));
  });
  document.addEventListener("kurostore:show-latest", () => {
    let filtersChanged = false;
    if (searchInput instanceof HTMLInputElement && searchInput.value) {
      searchInput.value = "";
      filtersChanged = true;
    }
    if (sortSelect instanceof HTMLSelectElement && sortSelect.value !== "newest") {
      sortSelect.value = "newest";
      filtersChanged = true;
    }
    if (initializeCatalog() || filtersChanged) void loadProducts();
  });
  document.addEventListener("kurostore:restore-catalog", () => {
    const urlSearch = new URLSearchParams(window.location.search).get("q") || "";
    const urlCategory = new URLSearchParams(window.location.search).get("category") || "";
    let filtersChanged = false;
    if (searchInput instanceof HTMLInputElement && searchInput.value !== urlSearch) {
      searchInput.value = urlSearch;
      filtersChanged = true;
    }
    if (activeCategorySlug !== urlCategory) {
      activeCategorySlug = urlCategory;
      filtersChanged = true;
    }
    if (
      window.location.hash === "#all-products-page"
      && sortSelect instanceof HTMLSelectElement
      && sortSelect.value !== "newest"
    ) {
      sortSelect.value = "newest";
      filtersChanged = true;
    }
    const shouldLoadCatalog = window.location.hash === "#all-products-page"
      || window.location.hash === "#kategori"
      || Boolean(urlSearch)
      || Boolean(urlCategory);
    const newlyInitialized = shouldLoadCatalog ? initializeCatalog() : false;
    if (newlyInitialized || (filtersChanged && catalogInitialized)) void loadProducts();
  });
  productGrid?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const wishlistButton = event.target.closest("[data-wishlist-product]");
    if (wishlistButton) {
      const productId = wishlistButton.dataset.wishlistProduct;
      if (!productId) return;
      if (!accountIsAuthenticated) {
        setFeedback("Masuk ke akun terlebih dahulu untuk menyimpan wishlist.");
        return;
      }

      const shouldRemove = wishlistIds.has(productId);
      void authenticatedRequestApi("/api/account-data/wishlist", {
        method: shouldRemove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      }).then(() => {
        if (shouldRemove) wishlistIds.delete(productId);
        else wishlistIds.add(productId);
        renderProducts();
        setFeedback(shouldRemove ? "Produk dihapus dari wishlist." : "Produk disimpan ke wishlist.");
      }).catch((error) => {
        console.error("Unable to update wishlist:", error);
        setFeedback(error instanceof Error ? error.message : "Wishlist tidak dapat diperbarui.");
      });
      return;
    }

    const button = event.target.closest("[data-add-cart-product]");
    const product = loadedProducts.find((item) => item.id === button?.dataset.addCartProduct);
    if (product && product.stock > 0) void addProductToCart(product);
  });

  if (window.location.hash === "#all-products-page"
    || (searchInput instanceof HTMLInputElement && searchInput.value.trim())) {
    initializeCatalog();
    void loadProducts();
  }
}

const homeProductGrids = [
  {
    grid: document.querySelector("#popular-products-grid"),
    empty: document.querySelector("#popular-products-empty"),
    feedback: document.querySelector("#popular-products-grid")?.parentElement?.querySelector("[data-home-product-feedback]"),
  },
  {
    grid: document.querySelector("#recommended-products-grid"),
    empty: document.querySelector("#recommended-products-empty"),
    feedback: document.querySelector("#recommended-products-grid")?.parentElement?.querySelector("[data-home-product-feedback]"),
  },
];

if (homeProductGrids.some(({ grid }) => grid instanceof HTMLElement)) {
  homeProductGrids.forEach(({ grid, empty }) => {
    if (!(grid instanceof HTMLElement)) return;
    grid.replaceChildren(...createProductSkeletons(4));
    grid.hidden = false;
    grid.setAttribute("aria-busy", "true");
    if (empty instanceof HTMLElement) empty.hidden = true;
  });

  const homeProductArtwork = {
    elektronik: '<rect x="22" y="24" width="76" height="50" rx="5"></rect><path d="M15 82h90l-8 8H23l-8-8Zm30-8-4 8m28-8 4 8"></path>',
    "makanan-dan-minuman": '<path d="M35 35h50l-5 48H40l-5-48Z"></path><path d="M31 35h58M43 25c-5-7 5-9 0-16m17 16c-5-7 5-9 0-16m17 16c-5-7 5-9 0-16"></path>',
    "tas-dan-aksesori": '<path d="M25 40h70l5 48H20l5-48Z"></path><path d="M40 40V31a20 20 0 0 1 40 0v9m-29 17h.01m18 0h.01"></path>',
    "kesehatan-dan-kecantikan": '<path d="M45 20h30v14l11 12v39H34V46l11-12V20Zm0 0h30m-30 14h30m-39 24h48"></path><path d="M57 64h6m-3-3v6"></path>',
    "baju-pria": '<path d="m37 22 17 8h12l17-8 20 16-12 17-11-7v41H32V48l-11 7-12-17 20-16Z"></path><path d="M54 30a6 6 0 0 0 12 0"></path>',
    "baju-wanita": '<path d="m45 21 15 7 15-7 13 13-9 12-6-4 13 46H34l13-46-6 4-9-12 13-13Z"></path><path d="M52 29a8 8 0 0 0 16 0M60 29v58"></path>',
    "sepatu-pria": '<path d="M18 65c14 0 21-8 27-27l14 7c7 17 18 21 35 23 8 1 12 7 10 16H20c-5 0-7-4-7-9s1-10 5-10Z"></path><path d="m49 48 10 8m-17-3 10 8m-17-3 10 8M18 78h86"></path>',
    "sepatu-wanita": '<path d="M20 68c11 1 21-1 29-8l9-29h11l4 24c8 7 17 8 27 9 8 1 11 8 8 15H22c-6 0-9-4-9-8s2-4 7-3Z"></path><path d="M24 79h84M53 51l17 4"></path>',
    "hobi-dan-koleksi": '<circle cx="60" cy="57" r="31"></circle><circle cx="60" cy="57" r="19"></circle><path d="M76 37 94 19m-4 0h4v4M33 78l-8 10m0-4v4h4"></path>',
    merchandise: '<path d="m37 22 17 8h12l17-8 20 16-12 17-11-7v41H32V48l-11 7-12-17 20-16Z"></path><path d="M54 30a6 6 0 0 0 12 0"></path>',
    "voucher-dan-produk-digital": '<path d="M19 31h82v17a12 12 0 0 0 0 24v17H19V72a12 12 0 0 0 0-24V31Z"></path><path d="M69 39v9m0 7v9m0 7v9m0 7v3M52 48l-8 8 8 8m-8-8h21"></path>',
    "rumah-dan-gaya-hidup": '<path d="m17 50 43-34 43 34M27 44v45h66V44M51 89V62h18v27"></path><path d="M41 49h.01M79 49h.01"></path>',
  };
  const fallbackArtwork = '<path d="m60 14 39 22v44L60 102 21 80V36l39-22Z"></path><path d="m22 37 38 22 38-22M60 59v42"></path>';
  const formatHomeProductPrice = (price) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

  let homeCategoriesById = new Map();
  let homeProductsById = new Map();
  const homeWishlistIds = new Set();

  const renderHomeProduct = (product, categoriesById) => {
    const card = document.createElement("article");
    card.className = "product-card all-product-card home-featured-product-card";

    const categoryInfo = categoriesById.get(product.category_id);
    const artwork = document.createElement("div");
    artwork.className = "product-card-art all-product-art home-featured-product-art";
    artwork.dataset.artworkCategory = categoryInfo?.slug || "";
    artwork.setAttribute("aria-hidden", "true");
    artwork.innerHTML = `<span class="product-art-orb"></span><svg viewBox="0 0 120 112">${homeProductArtwork[categoryInfo?.slug] || fallbackArtwork}</svg>`;

    const wishlistButton = document.createElement("button");
    wishlistButton.type = "button";
    wishlistButton.className = "product-wishlist-toggle";
    wishlistButton.dataset.homeWishlistProduct = product.id;
    wishlistButton.classList.toggle("is-saved", homeWishlistIds.has(product.id));
    wishlistButton.setAttribute("aria-pressed", String(homeWishlistIds.has(product.id)));
    wishlistButton.setAttribute("aria-label", homeWishlistIds.has(product.id) ? `Hapus ${product.name} dari wishlist` : `Simpan ${product.name} ke wishlist`);
    wishlistButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"></path></svg>';
    artwork.append(wishlistButton);

    const copy = document.createElement("div");
    copy.className = "product-card-copy";
    const category = document.createElement("span");
    category.className = "home-featured-product-category";
    category.textContent = categoryInfo?.name || "Produk tersedia";
    const name = document.createElement("h3");
    name.textContent = product.name;
    const description = document.createElement("p");
    description.textContent = product.description || "Lihat produk ini di katalog Kurostore.";
    const rating = document.createElement("span");
    rating.className = "product-rating-summary";
    rating.textContent = product.rating_count > 0
      ? `★ ${Number(product.rating_average).toFixed(1)} · ${product.rating_count} ulasan`
      : "Belum ada rating";
    const bottom = document.createElement("div");
    bottom.className = "product-card-bottom";
    const price = document.createElement("strong");
    price.textContent = formatHomeProductPrice(product.price);
    const stock = document.createElement("span");
    stock.className = "home-featured-product-stock";
    stock.textContent = `Stok ${product.stock}`;
    bottom.append(price, stock);
    const estimate = document.createElement("small");
    estimate.className = "price-estimate-badge";
    estimate.textContent = "Estimasi harga pasar";
    estimate.hidden = product.price_is_estimate !== true;

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "all-product-add-button";
    addButton.dataset.homeAddCartProduct = product.id;
    addButton.textContent = "Tambah ke keranjang";

    copy.append(category, name, description, rating, bottom, estimate, addButton);
    card.append(artwork, copy);
    return card;
  };

  const renderHomeProductGroup = ({ grid, empty }, products, emptyMessage) => {
    if (!(grid instanceof HTMLElement) || !(empty instanceof HTMLElement)) return;
    grid.replaceChildren(...products.map((product) => renderHomeProduct(product, homeCategoriesById)));
    const hasProducts = products.length > 0;
    grid.hidden = !hasProducts;
    grid.setAttribute("aria-busy", "false");
    empty.hidden = hasProducts;
    if (!hasProducts) {
      const message = empty.querySelector("p");
      if (message) message.textContent = emptyMessage;
    }
  };

  const renderHomeProductGroups = (featuredProducts) => {
    renderHomeProductGroup(homeProductGrids[0], featuredProducts.slice(0, 4), "Belum ada produk tersedia.");
    renderHomeProductGroup(homeProductGrids[1], featuredProducts.slice(4, 8), "Tambahkan lebih banyak produk untuk ditampilkan di sini.");
  };

  const setHomeProductFeedback = (group, message, linkHref = "", linkText = "") => {
    const feedback = group.feedback;
    if (!(feedback instanceof HTMLElement)) return;
    feedback.replaceChildren(document.createTextNode(message));
    if (linkHref && linkText) {
      feedback.append(document.createTextNode(" "));
      const link = document.createElement("a");
      link.href = linkHref;
      link.textContent = linkText;
      feedback.append(link);
    }
    feedback.hidden = false;
  };

  homeProductGrids.forEach((group) => {
    group.grid?.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const wishlistButton = event.target.closest("[data-home-wishlist-product]");
      if (wishlistButton) {
        const productId = wishlistButton.dataset.homeWishlistProduct;
        const product = homeProductsById.get(productId);
        if (!productId || !product) return;
        if (!accountIsAuthenticated) {
          setHomeProductFeedback(group, "Masuk untuk menyimpan produk ke wishlist.", "pages/login.html", "Masuk / Daftar");
          return;
        }

        const shouldRemove = homeWishlistIds.has(productId);
        void authenticatedRequestApi("/api/account-data/wishlist", {
          method: shouldRemove ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        }).then(() => {
          if (shouldRemove) homeWishlistIds.delete(productId);
          else homeWishlistIds.add(productId);
          renderHomeProductGroups([...homeProductsById.values()]);
          setHomeProductFeedback(group, shouldRemove ? "Produk dihapus dari wishlist." : "Produk disimpan ke wishlist.", "pages/produk-pilihan.html", "Lihat wishlist");
        }).catch((error) => {
          console.error("Unable to update homepage wishlist:", error);
          setHomeProductFeedback(group, error instanceof Error ? error.message : "Wishlist tidak dapat diperbarui.");
        });
        return;
      }

      const addButton = event.target.closest("[data-home-add-cart-product]");
      if (!addButton) return;
      const productId = addButton.dataset.homeAddCartProduct;
      const product = homeProductsById.get(productId);
      if (!product || product.stock <= 0) return;
      if (!accountIsAuthenticated) {
        setHomeProductFeedback(group, "Masuk untuk menambahkan produk ke keranjang dan melanjutkan belanja.", "pages/login.html", "Masuk / Daftar");
        return;
      }

      addButton.disabled = true;
      addButton.textContent = "Menambahkan...";
      void authenticatedRequestApi("/api/account-data/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      }).then(() => {
        notifyCartUpdated();
        setHomeProductFeedback(group, `${product.name} ditambahkan ke keranjang.`, "pages/keranjang.html", "Buka keranjang");
      }).catch((error) => {
        console.error("Unable to add homepage product to cart:", error);
        setHomeProductFeedback(group, error instanceof Error ? error.message : "Produk tidak dapat ditambahkan ke keranjang.");
      }).finally(() => {
        addButton.disabled = false;
        addButton.textContent = "Tambah ke keranjang";
      });
    });
  });

  const homeCategoriesPromise = requestApi("/api/categories")
    .then((categoryResult) => {
      if (Array.isArray(categoryResult.categories)) {
        homeCategoriesById = new Map(categoryResult.categories
          .filter((category) => typeof category?.id === "string" && typeof category.name === "string")
          .map((category) => [category.id, { name: category.name, slug: category.slug }]));
      }
    })
    .catch((error) => {
      console.error("Unable to load home category names:", error);
    });

  void requestApi("/api/products?sort=newest&page_size=20")
    .then(async (result) => {
      if (!Array.isArray(result.products)) throw new Error("Data produk beranda tidak valid.");
      await homeCategoriesPromise;

      const availableProducts = result.products.filter((product) =>
        product
        && typeof product.id === "string"
        && typeof product.name === "string"
        && typeof product.category_id === "string"
        && Number.isFinite(Number(product.price))
        && Number(product.price) > 0
        && Number.isInteger(product.stock)
        && product.stock > 0)
        .map((product) => ({ ...product, price: Number(product.price) }));

      const selectedByCategory = new Map();
      availableProducts.forEach((product) => {
        if (!selectedByCategory.has(product.category_id)) {
          selectedByCategory.set(product.category_id, product);
        }
      });
      const selectedIds = new Set([...selectedByCategory.values()].map((product) => product.id));
      const featuredProducts = [
        ...selectedByCategory.values(),
        ...availableProducts.filter((product) => !selectedIds.has(product.id)),
      ];
      homeProductsById = new Map(featuredProducts.map((product) => [product.id, product]));
      renderHomeProductGroups(featuredProducts);
    })
    .catch((error) => {
      console.error("Unable to load home catalog products:", error);
      homeProductGrids.forEach(({ grid, empty }) => {
        if (grid instanceof HTMLElement) {
          grid.setAttribute("aria-busy", "false");
          grid.hidden = true;
          grid.querySelectorAll(".product-skeleton-card").forEach((card) => card.remove());
        }
        if (empty instanceof HTMLElement) {
          empty.hidden = false;
          const message = empty.querySelector("p");
          if (message) message.textContent = "Produk tidak dapat dimuat. Coba muat ulang halaman.";
        }
      });
    });

  if (accountIsAuthenticated) {
    void authenticatedRequestApi("/api/account-data/wishlist").then((result) => {
      if (!Array.isArray(result.items)) throw new Error("Data wishlist tidak valid.");
      result.items.forEach((item) => {
        if (typeof item?.id === "string") homeWishlistIds.add(item.id);
      });
      renderHomeProductGroups([...homeProductsById.values()]);
    }).catch((error) => {
      console.error("Unable to load homepage wishlist:", error);
      setHomeProductFeedback(homeProductGrids[0], error instanceof Error ? error.message : "Wishlist tidak dapat dimuat.");
    });
  }
}

if (billsCarousel) {
  const slides = Array.from(billsCarousel.querySelectorAll(".bills-slide"));
  let activeSlide = slides.findIndex((slide) => slide.getAttribute("aria-hidden") === "false");

  if (slides.length > 1) {
    const showSlide = (nextSlide) => {
      activeSlide = (nextSlide + slides.length) % slides.length;

      slides.forEach((slide, index) => {
        const isActive = index === activeSlide;
        slide.hidden = !isActive;
        slide.setAttribute("aria-hidden", String(!isActive));

        if (isActive) {
          slide.classList.add("is-entering");
          const removeEnteringClass = (event) => {
            if (event.target === slide) {
              slide.classList.remove("is-entering");
              slide.removeEventListener("animationend", removeEnteringClass);
            }
          };
          slide.addEventListener("animationend", removeEnteringClass);
        }
      });
    };

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setInterval(() => {
        if (document.hidden) {
          return;
        }

        showSlide(activeSlide + 1);
      }, 7000);
    }
  }
}

if (productsPage) {
  const wishlistGrid = productsPage.querySelector("#wishlist-grid");
  const wishlistCount = productsPage.querySelector("#wishlist-count");
  const wishlistEmpty = productsPage.querySelector("#wishlist-empty");
  const wishlistNotice = productsPage.querySelector("#wishlist-storage-notice");
  const wishlistNoticeMessage = productsPage.querySelector("#wishlist-notice-message");
  const wishlistLoginLink = productsPage.querySelector("#wishlist-login-link");

  if (wishlistGrid && wishlistCount && wishlistEmpty && wishlistNotice) {
    let wishlistItems = [];

    const renderWishlist = () => {
      wishlistGrid.replaceChildren();
      wishlistItems.forEach((item) => {
        const card = document.createElement("article");
        card.className = "product-card wishlist-item";
        card.dataset.wishlistItem = item.id;

        const copy = document.createElement("div");
        copy.className = "product-card-copy";
        const label = document.createElement("span");
        label.className = "product-card-category";
        label.textContent = "Tersimpan";
        const name = document.createElement("h3");
        name.textContent = item.name;
        const description = document.createElement("p");
        description.textContent = item.description || "Produk favoritmu di Kurostore.";
        const price = document.createElement("strong");
        price.textContent = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(Number(item.price));
        const estimate = document.createElement("small");
        estimate.className = "price-estimate-badge";
        estimate.textContent = "Estimasi harga pasar";
        estimate.hidden = item.price_is_estimate !== true;

        const removeButton = document.createElement("button");
        removeButton.className = "wishlist-remove";
        removeButton.type = "button";
        removeButton.textContent = "Hapus dari Wishlist";
        removeButton.setAttribute("aria-label", `Hapus ${item.name} dari wishlist`);
        removeButton.dataset.wishlistRemove = item.id;

        const addButton = document.createElement("button");
        addButton.className = "all-product-add-button";
        addButton.type = "button";
        addButton.textContent = item.status === "active" && item.stock > 0 ? "Tambah ke keranjang" : "Tidak tersedia";
        addButton.disabled = item.status !== "active" || item.stock <= 0;
        addButton.dataset.wishlistAddCart = item.id;

        copy.append(label, name, description, price, estimate, removeButton, addButton);
        card.append(copy);
        wishlistGrid.append(card);
      });

      wishlistCount.textContent = `${wishlistItems.length} produk tersimpan`;
      wishlistEmpty.hidden = wishlistItems.length > 0;
    };

    const loadWishlist = async () => {
      const result = await authenticatedRequestApi("/api/account-data/wishlist");
      if (!Array.isArray(result.items)) throw new Error("Data wishlist tidak valid.");
      wishlistItems = result.items.filter((item) =>
        item
        && typeof item.id === "string"
        && typeof item.name === "string"
        && Number.isFinite(Number(item.price))
        && Number.isInteger(item.stock)
        && typeof item.price_is_estimate === "boolean");
      renderWishlist();
    };

    if (!accountIsAuthenticated) {
      wishlistNotice.hidden = false;
      if (wishlistNoticeMessage) wishlistNoticeMessage.textContent = "Masuk ke akun untuk melihat dan menyimpan wishlist.";
      if (wishlistLoginLink) wishlistLoginLink.hidden = false;
      wishlistEmpty.hidden = true;
      wishlistCount.textContent = "Masuk untuk melihat wishlist";
    } else {
      wishlistNotice.hidden = true;
      if (wishlistLoginLink) wishlistLoginLink.hidden = true;
      void loadWishlist().catch((error) => {
        console.error("Unable to load wishlist:", error);
        wishlistNotice.hidden = false;
        if (wishlistNoticeMessage) {
          wishlistNoticeMessage.textContent = error instanceof Error ? error.message : "Wishlist tidak dapat dimuat.";
        }
      });
    }

    productsPage.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const removeButton = event.target.closest("[data-wishlist-remove]");
      const addCartButton = event.target.closest("[data-wishlist-add-cart]");

      if (removeButton) {
        const productId = removeButton.dataset.wishlistRemove;
        if (!productId) return;
        void authenticatedRequestApi("/api/account-data/wishlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId }),
        }).then(() => loadWishlist()).catch((error) => {
          console.error("Unable to remove wishlist product:", error);
          wishlistNotice.hidden = false;
          if (wishlistNoticeMessage) {
            wishlistNoticeMessage.textContent = error instanceof Error ? error.message : "Produk tidak dapat dihapus dari wishlist.";
          }
        });
        return;
      }

      if (addCartButton) {
        const productId = addCartButton.dataset.wishlistAddCart;
        const item = wishlistItems.find((candidate) => candidate.id === productId);
        if (!item || item.stock <= 0) return;
        void authenticatedRequestApi("/api/account-data/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: item.id }),
        }).then(() => notifyCartUpdated()).catch((error) => {
          console.error("Unable to add wishlist product to cart:", error);
          wishlistNotice.hidden = false;
          if (wishlistNoticeMessage) {
            wishlistNoticeMessage.textContent = error instanceof Error ? error.message : "Produk tidak dapat ditambahkan ke keranjang.";
          }
        });
      }
    });
  }
}

if (guestBrowseButton) {
  guestBrowseButton.addEventListener("click", () => {
    sessionStorage.setItem("kurostore-guest-session", "true");
    window.location.href = "../index.html";
  });
}

if (!accountIsAuthenticated && isGuestSession) {
  document.querySelectorAll(".account-link").forEach((accountLink) => {
    accountLink.href = "pages/login.html";
    const hint = accountLink.querySelector(".action-hint");
    const label = accountLink.querySelector(".action-copy strong");

    if (hint) {
      hint.textContent = "Menjelajah sebagai";
    }

    if (label) {
      label.textContent = "Tamu";
    }
  });
}

if (accountPage) {
  const accountLocked = accountPage.querySelector("#account-locked");
  const accountContent = accountPage.querySelector("#account-content");
  const accountSidebarName = accountPage.querySelector("#account-sidebar-name");
  const accountSidebarEmail = accountPage.querySelector("#account-sidebar-email");
  const accountSellerMenu = accountPage.querySelector("#account-seller-menu");
  const accountAdminMenu = accountPage.querySelector("#account-admin-menu");
  const accountCartSummary = accountPage.querySelector("#account-cart-summary");
  const accountCartFeedback = accountPage.querySelector("#account-cart-feedback");
  const accountCartItems = accountPage.querySelector("#account-cart-items");
  const accountCartEmpty = accountPage.querySelector("#account-cart-empty");
  const profileForm = accountPage.querySelector("#account-profile-form");
  const profileName = accountPage.querySelector("#profile-name");
  const profileEmail = accountPage.querySelector("#profile-email");
  const profilePhone = accountPage.querySelector("#profile-phone");
  const profileFeedback = accountPage.querySelector("#account-profile-feedback");
  const profilePanel = accountPage.querySelector("#account-profile-panel");
  const addressForm = accountPage.querySelector("#account-address-form");
  const addressPanel = accountPage.querySelector("#account-address-panel");
  const addressFeedback = accountPage.querySelector("#account-address-feedback");
  const paymentPanel = accountPage.querySelector("#account-payment-panel");
  const walletPanel = accountPage.querySelector("#account-kuropay-panel");
  const passwordPanel = accountPage.querySelector("#account-password-panel");
  const notificationsPanel = accountPage.querySelector("#account-notifications-panel");
  const privacyPanel = accountPage.querySelector("#account-privacy-panel");
  const languagePanel = accountPage.querySelector("#account-language-panel");
  const themePanel = accountPage.querySelector("#account-theme-panel");
  const vouchersPanel = accountPage.querySelector("#account-vouchers-panel");
  const ordersPanel = accountPage.querySelector("#account-orders-panel");
  const ordersList = accountPage.querySelector("#account-orders-list");
  const ordersFeedback = accountPage.querySelector("#account-orders-feedback");
  const ordersEmpty = accountPage.querySelector("#account-orders-empty");
  const ordersLoginLink = accountPage.querySelector("#account-orders-login-link");
  const panelButtons = Array.from(accountPage.querySelectorAll("[data-account-panel]"));
  const allAccountPanels = [
    profilePanel,
    addressPanel,
    paymentPanel,
    walletPanel,
    passwordPanel,
    notificationsPanel,
    privacyPanel,
    languagePanel,
    themePanel,
    ordersPanel,
    vouchersPanel,
  ].filter((panel) => panel instanceof HTMLElement);
  const paymentForm = accountPage.querySelector("#account-payment-form");
  const paymentFeedback = accountPage.querySelector("#account-payment-feedback");
  const passwordForm = accountPage.querySelector("#account-password-form");
  const passwordFeedback = accountPage.querySelector("#account-password-feedback");
  const notificationForm = accountPage.querySelector("#account-notification-form");
  const notificationFeedback = accountPage.querySelector("#account-notification-feedback");
  const notificationAvailability = accountPage.querySelector("#account-notification-availability");
  const emailOrderUpdates = accountPage.querySelector("#account-email-order-updates");
  const languageForm = accountPage.querySelector("#account-language-form");
  const languageSelect = accountPage.querySelector("#account-language");
  const languageFeedback = accountPage.querySelector("#account-language-feedback");
  const themeForm = accountPage.querySelector("#account-theme-form");
  const themeSelect = accountPage.querySelector("#account-theme");
  const themeFeedback = accountPage.querySelector("#account-theme-feedback");
  const privacyFeedback = accountPage.querySelector("#account-privacy-feedback");
  const walletBalance = accountPage.querySelector("#account-wallet-balance");
  const walletEnvironment = accountPage.querySelector("#account-wallet-environment");
  const walletLedger = accountPage.querySelector("#account-wallet-ledger");
  const walletFeedback = accountPage.querySelector("#account-wallet-feedback");
  const walletTopupForm = accountPage.querySelector("#account-wallet-topup-form");
  const walletTopupButton = accountPage.querySelector("#account-wallet-topup-button");
  const pointsBalance = accountPage.querySelector("#account-points-balance");
  const pointsLedger = accountPage.querySelector("#account-points-ledger");
  let emailNotificationsConfigured = false;
  const logoutButton = accountPage.querySelector("#account-logout");
  const logoutLabel = accountPage.querySelector("#account-logout-label");

  const formatAccountPrice = (amount) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

  const saveAccountPreferences = async (updates) => {
    const next = { ...currentAccountPreferences, ...updates };
    if (accountIsAuthenticated) {
      const result = await authenticatedRequestApi("/api/account-data/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!result.preferences) throw new Error("Preferensi akun tidak dikembalikan server.");
      emailNotificationsConfigured = result.emailNotificationsConfigured === true;
      applyAccountPreferences(result.preferences);
      return result.preferences;
    }

    applyAccountPreferences(next);
    return next;
  };

  const loadAccountPreferences = async () => {
    if (languageSelect instanceof HTMLSelectElement) languageSelect.value = currentAccountPreferences.language;
    if (themeSelect instanceof HTMLSelectElement) themeSelect.value = currentAccountPreferences.theme;
    if (emailOrderUpdates instanceof HTMLInputElement) {
      emailOrderUpdates.checked = currentAccountPreferences.email_order_updates;
    }

    if (!accountIsAuthenticated) {
      if (notificationAvailability) {
        notificationAvailability.textContent = "Notifikasi transaksi memerlukan akun yang sudah masuk.";
      }
      return;
    }

    const result = await authenticatedRequestApi("/api/account-data/preferences");
    if (!result.preferences || typeof result.preferences !== "object") {
      throw new Error("Preferensi akun tidak valid.");
    }
    emailNotificationsConfigured = result.emailNotificationsConfigured === true;
    applyAccountPreferences(result.preferences);
    if (languageSelect instanceof HTMLSelectElement) languageSelect.value = currentAccountPreferences.language;
    if (themeSelect instanceof HTMLSelectElement) themeSelect.value = currentAccountPreferences.theme;
    if (emailOrderUpdates instanceof HTMLInputElement) {
      emailOrderUpdates.checked = currentAccountPreferences.email_order_updates;
    }
    if (notificationAvailability) {
      notificationAvailability.textContent = emailNotificationsConfigured
        ? "Email transaksi aktif setelah alamat pengirim Resend diverifikasi."
        : "Pilihan akan tersimpan. Pengiriman email aktif setelah RESEND_API_KEY dan RESEND_FROM_EMAIL dikonfigurasi di Vercel.";
    }
  };

  const renderLedger = (container, entries, kind) => {
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();
    if (!Array.isArray(entries) || entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "account-ledger-empty";
      empty.textContent = kind === "points" ? "Belum ada riwayat poin." : "Belum ada transaksi saldo demo.";
      container.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("article");
      row.className = "account-ledger-entry";
      const details = document.createElement("div");
      const description = document.createElement("strong");
      description.textContent = typeof entry.description === "string" ? entry.description : "Transaksi akun";
      const created = document.createElement("small");
      const date = new Date(entry.created_at);
      created.textContent = Number.isNaN(date.getTime())
        ? ""
        : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
      details.append(description, created);

      const amount = document.createElement("strong");
      if (kind === "points") {
        const points = Number(entry.points_delta);
        amount.textContent = `${points > 0 ? "+" : ""}${points} poin`;
        amount.classList.toggle("is-negative", points < 0);
      } else {
        const value = Number(entry.amount);
        const isCredit = entry.entry_type === "credit";
        amount.textContent = `${isCredit ? "+" : "−"}${formatAccountPrice(value)}`;
        amount.classList.toggle("is-negative", !isCredit);
      }
      row.append(details, amount);
      container.append(row);
    });
  };

  const loadDemoWallet = async () => {
    if (!accountIsAuthenticated) {
      if (walletFeedback) walletFeedback.textContent = "Masuk ke akun untuk menggunakan saldo demo KuroPay.";
      if (walletEnvironment) walletEnvironment.textContent = "Saldo demo hanya tersedia untuk akun yang masuk.";
      return;
    }

    if (walletFeedback) walletFeedback.textContent = "Memuat saldo demo...";
    try {
      const result = await authenticatedRequestApi("/api/account-data/wallet");
      if (walletBalance) walletBalance.textContent = formatAccountPrice(result.wallet?.balance);
      if (walletEnvironment) {
        walletEnvironment.textContent = result.enabled === true
          ? "Mode sandbox aktif · simulasi saja, bukan uang sungguhan"
          : "Mode produksi aktif · fitur saldo demo dinonaktifkan";
      }
      if (walletTopupButton instanceof HTMLButtonElement) {
        walletTopupButton.disabled = result.enabled !== true;
      }
      if (pointsBalance) {
        pointsBalance.textContent = new Intl.NumberFormat("id-ID").format(Number(result.rewards?.balance) || 0);
      }
      renderLedger(walletLedger, result.wallet?.ledger, "wallet");
      renderLedger(pointsLedger, result.rewards?.ledger, "points");
      if (walletFeedback) walletFeedback.textContent = "";
    } catch (error) {
      console.error("Unable to load KuroPay demo balance:", error);
      if (walletFeedback) {
        walletFeedback.textContent = error instanceof Error ? error.message : "Saldo demo tidak dapat dimuat.";
      }
    }
  };

  const renderAccountCart = async () => {
    if (!(accountCartItems instanceof HTMLElement)) return;
    accountCartItems.replaceChildren();
    if (accountCartFeedback) accountCartFeedback.textContent = "";

    if (!accountIsAuthenticated) {
      if (accountCartSummary) accountCartSummary.textContent = "Masuk untuk menyimpan dan melihat keranjang.";
      if (accountCartEmpty) accountCartEmpty.hidden = false;
      return;
    }

    try {
      const result = await authenticatedRequestApi("/api/account-data/cart");
      if (!Array.isArray(result.items)) throw new Error("Data keranjang tidak valid.");
      const validItems = result.items.filter((item) =>
        item
        && typeof item.productId === "string"
        && typeof item.name === "string"
        && Number.isFinite(Number(item.price))
        && Number(item.price) > 0
        && Number.isInteger(item.quantity)
        && item.quantity > 0
        && Number.isInteger(item.stock));

      if (accountCartEmpty) accountCartEmpty.hidden = validItems.length > 0;
      if (accountCartSummary) {
        const quantity = validItems.reduce((sum, item) => sum + item.quantity, 0);
        accountCartSummary.textContent = validItems.length
          ? `${validItems.length} produk · ${quantity} barang`
          : "Belum ada produk di keranjang.";
      }

      const numberFormat = new Intl.NumberFormat("id-ID");
      const formatPrice = (price) => new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(price);

      validItems.forEach((item, index) => {
        const priceValue = Number(item.price);
        const row = document.createElement("article");
        row.className = "account-cart-item";

        const artwork = document.createElement("span");
        artwork.className = `account-cart-art account-cart-art-${index % 4 + 1}`;
        artwork.setAttribute("aria-hidden", "true");
        artwork.textContent = item.name.trim().charAt(0).toLocaleUpperCase("id") || "P";

        const details = document.createElement("div");
        details.className = "account-cart-item-details";
        const name = document.createElement("strong");
        name.textContent = item.name;
        const unitPrice = document.createElement("span");
        unitPrice.textContent = `${formatPrice(priceValue)} / item`;
        details.append(name, unitPrice);

        const quantity = document.createElement("span");
        quantity.className = "account-cart-item-quantity";
        quantity.textContent = `x${numberFormat.format(item.quantity)}`;

        const subtotal = document.createElement("strong");
        subtotal.className = "account-cart-item-subtotal";
        subtotal.textContent = formatPrice(priceValue * item.quantity);

        row.append(artwork, details, quantity, subtotal);
        accountCartItems.append(row);
      });
    } catch (error) {
      console.error("Unable to render account cart preview:", error);
      if (accountCartSummary) accountCartSummary.textContent = "Keranjang tidak dapat dibaca.";
      if (accountCartEmpty) accountCartEmpty.hidden = true;
      if (accountCartFeedback) {
        accountCartFeedback.textContent = error instanceof Error
          ? error.message
          : "Isi keranjang tidak dapat ditampilkan.";
      }
    }
  };

  void renderAccountCart();
  document.addEventListener("kurostore:cart-updated", () => void renderAccountCart());

  if (accountLocked && accountContent) {
    accountLocked.hidden = canAccessAccount;
    accountContent.hidden = !canAccessAccount;
  }

  if (canAccessAccount) {
    const name = sessionStorage.getItem("kurostore-user-name")
      || (accountIsAuthenticated ? "Pengguna Kurostore" : "Tamu");
    const email = sessionStorage.getItem("kurostore-user-email") || "";

    if (accountSidebarName) {
      accountSidebarName.textContent = name;
    }

    if (accountSidebarEmail) {
      accountSidebarEmail.textContent = email || (accountIsAuthenticated ? "Email belum tersedia" : "Sesi tamu lokal");
    }

    if (profileName) {
      profileName.value = name;
    }

    if (profileEmail) {
      profileEmail.value = email;
    }

    if (profilePhone) {
      profilePhone.value = sessionStorage.getItem("kurostore-user-phone") || "";
    }

    if (accountIsAuthenticated) {
      void authenticatedRequestApi("/api/account-data/profile").then((result) => {
        const profile = result.profile;
        if (!profile || typeof profile.name !== "string" || typeof profile.email !== "string") {
          throw new Error("Data profil akun tidak valid.");
        }
        if (profileName) profileName.value = profile.name;
        if (profileEmail instanceof HTMLInputElement) profileEmail.value = profile.email;
        if (profilePhone instanceof HTMLInputElement) profilePhone.value = profile.phone || "";
        if (accountSidebarName) accountSidebarName.textContent = profile.name || "Pengguna Kurostore";
        if (accountSidebarEmail) accountSidebarEmail.textContent = profile.email || "Email belum tersedia";
        sessionStorage.setItem("kurostore-user-name", profile.name);
        sessionStorage.setItem("kurostore-user-email", profile.email);
        sessionStorage.setItem("kurostore-user-phone", profile.phone || "");
      }).catch((error) => {
        console.error("Unable to load account profile:", error);
        if (profileFeedback) {
          profileFeedback.textContent = error instanceof Error ? error.message : "Profil akun tidak dapat dimuat.";
        }
      });

      void loadAccountPreferences().catch((error) => {
        console.error("Unable to load account preferences:", error);
        if (notificationAvailability) {
          notificationAvailability.textContent = error instanceof Error
            ? error.message
            : "Preferensi akun tidak dapat dimuat.";
        }
      });

      void authenticatedRequestApi("/api/account-data/address").then((result) => {
        const savedAddress = result.address;
        const addressName = accountPage.querySelector("#address-name");
        const addressPhone = accountPage.querySelector("#address-phone");
        const addressStreet = accountPage.querySelector("#address-street");
        const addressCity = accountPage.querySelector("#address-city");
        const addressPostalCode = accountPage.querySelector("#address-postal-code");
        if (savedAddress) {
          if (addressName instanceof HTMLInputElement) addressName.value = savedAddress.name;
          if (addressPhone instanceof HTMLInputElement) addressPhone.value = savedAddress.phone;
          if (addressStreet instanceof HTMLTextAreaElement) addressStreet.value = savedAddress.address;
          if (addressCity instanceof HTMLInputElement) addressCity.value = savedAddress.city;
          if (addressPostalCode instanceof HTMLInputElement) addressPostalCode.value = savedAddress.postalCode;
        } else {
          if (addressName instanceof HTMLInputElement) addressName.value = profileName?.value || "";
          if (addressPhone instanceof HTMLInputElement) addressPhone.value = profilePhone?.value || "";
        }
      }).catch((error) => {
        console.error("Unable to load saved shipping address:", error);
        if (addressFeedback) {
          addressFeedback.textContent = error instanceof Error ? error.message : "Alamat tersimpan tidak dapat dimuat.";
        }
      });
    } else if (addressFeedback) {
      addressFeedback.textContent = "Masuk ke akun untuk menyimpan alamat pengiriman.";
    }

    if (!accountIsAuthenticated && logoutLabel) {
      logoutLabel.textContent = "Akhiri sesi tamu";
    }
  }

  const accessToken = sessionStorage.getItem("kurostore-access-token");
  if (accountIsAuthenticated && accessToken && (accountSellerMenu || accountAdminMenu)) {
    void requestApi("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((account) => {
      const roles = Array.isArray(account.user?.roles) ? account.user.roles : [account.user?.role];
      if (accountSellerMenu) accountSellerMenu.hidden = !roles.includes("seller");
      if (accountAdminMenu) accountAdminMenu.hidden = !roles.includes("admin");
    }).catch((error) => {
      if (error instanceof Error && error.status === 401) {
        sessionStorage.removeItem("kurostore-authenticated");
        sessionStorage.removeItem("kurostore-access-token");
        sessionStorage.removeItem("kurostore-refresh-token");
        if (accountSidebarEmail) {
          accountSidebarEmail.textContent = "Sesi berakhir. Silakan masuk kembali.";
        }
        return;
      }

      if (accountSidebarEmail) {
        accountSidebarEmail.textContent = "Role akun tidak dapat diverifikasi. Muat ulang halaman untuk mencoba lagi.";
      }
    });
  }

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!profileName || !profileEmail || !profilePhone || !profileFeedback) {
      return;
    }

    const name = profileName.value.trim();
    const email = profileEmail.value.trim();
    const phone = profilePhone.value.trim();

    if (!name) {
      profileFeedback.textContent = "Nama tidak boleh kosong.";
      profileName.focus();
      return;
    }

    const saveButton = profileForm.querySelector('button[type="submit"]');
    if (saveButton instanceof HTMLButtonElement) saveButton.disabled = true;
    try {
      if (accountIsAuthenticated) {
        await authenticatedRequestApi("/api/account-data/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone }),
        });
      } else {
        sessionStorage.setItem("kurostore-user-name", name);
        if (phone) {
          sessionStorage.setItem("kurostore-user-phone", phone);
        } else {
          sessionStorage.removeItem("kurostore-user-phone");
        }
      }

      sessionStorage.setItem("kurostore-user-name", name);
      if (email) {
        sessionStorage.setItem("kurostore-user-email", email);
      } else {
        sessionStorage.removeItem("kurostore-user-email");
      }
      if (phone) {
        sessionStorage.setItem("kurostore-user-phone", phone);
      } else {
        sessionStorage.removeItem("kurostore-user-phone");
      }

      if (accountSidebarName) accountSidebarName.textContent = name;
      if (accountSidebarEmail) {
        accountSidebarEmail.textContent = email || (accountIsAuthenticated ? "Email belum tersedia" : "Sesi tamu lokal");
      }
      profileFeedback.textContent = accountIsAuthenticated
        ? "Profil berhasil disimpan ke akunmu."
        : "Profil tersimpan di sesi browser ini.";
    } catch (error) {
      console.error("Unable to save account profile:", error);
      profileFeedback.textContent = error instanceof Error ? error.message : "Profil tidak dapat disimpan.";
    } finally {
      if (saveButton instanceof HTMLButtonElement) saveButton.disabled = false;
    }
  });

  addressForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(addressForm instanceof HTMLFormElement) || !(addressFeedback instanceof HTMLElement)) return;
    if (!addressForm.reportValidity()) return;

    const formData = new FormData(addressForm);
    const address = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      postalCode: String(formData.get("postal_code") || "").trim(),
    };

    if (Object.values(address).some((value) => !value)) {
      addressFeedback.textContent = "Lengkapi semua detail alamat sebelum menyimpan.";
      return;
    }

    if (!accountIsAuthenticated) {
      addressFeedback.textContent = "Masuk ke akun terlebih dahulu untuk menyimpan alamat.";
      return;
    }

    void authenticatedRequestApi("/api/account-data/address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...address,
        postal_code: address.postalCode,
      }),
    }).then(() => {
      addressFeedback.textContent = "Alamat tersimpan di akunmu dan akan terisi otomatis saat checkout.";
    }).catch((error) => {
      console.error("Unable to save shipping address:", error);
      addressFeedback.textContent = error instanceof Error ? error.message : "Alamat tidak dapat disimpan.";
    });
  });

  paymentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(paymentForm instanceof HTMLFormElement) || !(paymentFeedback instanceof HTMLElement)) return;
    const formData = new FormData(paymentForm);
    const method = String(formData.get("preferred_payment_method") || "all");
    try {
      await saveAccountPreferences({ preferred_payment_method: method });
      paymentFeedback.textContent = "Metode pembayaran utama berhasil disimpan.";
    } catch (error) {
      console.error("Unable to save preferred payment method:", error);
      paymentFeedback.textContent = error instanceof Error ? error.message : "Metode pembayaran tidak dapat disimpan.";
    }
  });

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(passwordForm instanceof HTMLFormElement) || !(passwordFeedback instanceof HTMLElement)) return;
    if (!accountIsAuthenticated) {
      passwordFeedback.textContent = "Masuk ke akun terlebih dahulu untuk mengubah password.";
      return;
    }

    const formData = new FormData(passwordForm);
    const currentPassword = String(formData.get("current_password") || "");
    const newPassword = String(formData.get("new_password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");
    if (newPassword !== confirmPassword) {
      passwordFeedback.textContent = "Konfirmasi password baru tidak cocok.";
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      passwordFeedback.textContent = "Password baru harus memiliki 8–128 karakter.";
      return;
    }

    const button = passwordForm.querySelector('button[type="submit"]');
    if (button instanceof HTMLButtonElement) button.disabled = true;
    try {
      await authenticatedRequestApi("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      passwordForm.reset();
      passwordFeedback.textContent = "Password berhasil diperbarui.";
    } catch (error) {
      console.error("Unable to change account password:", error);
      passwordFeedback.textContent = error instanceof Error ? error.message : "Password tidak dapat diperbarui.";
    } finally {
      if (button instanceof HTMLButtonElement) button.disabled = false;
    }
  });

  notificationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(emailOrderUpdates instanceof HTMLInputElement)
      || !(notificationFeedback instanceof HTMLElement)) return;
    try {
      await saveAccountPreferences({ email_order_updates: emailOrderUpdates.checked });
      notificationFeedback.textContent = emailOrderUpdates.checked && !emailNotificationsConfigured
        ? "Preferensi tersimpan. Email belum terkirim sampai Resend dikonfigurasi di Vercel."
        : "Preferensi notifikasi berhasil disimpan.";
    } catch (error) {
      console.error("Unable to save email notification preference:", error);
      notificationFeedback.textContent = error instanceof Error ? error.message : "Preferensi notifikasi tidak dapat disimpan.";
    }
  });

  languageForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(languageSelect instanceof HTMLSelectElement) || !(languageFeedback instanceof HTMLElement)) return;
    try {
      await saveAccountPreferences({ language: languageSelect.value });
      languageFeedback.textContent = "Bahasa Pengaturan & Akun berhasil diperbarui.";
      if (languageSelect.value === "id") {
        window.setTimeout(() => window.location.reload(), 250);
      }
    } catch (error) {
      console.error("Unable to save account language:", error);
      languageFeedback.textContent = error instanceof Error ? error.message : "Bahasa tidak dapat disimpan.";
    }
  });

  themeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(themeSelect instanceof HTMLSelectElement) || !(themeFeedback instanceof HTMLElement)) return;
    try {
      await saveAccountPreferences({ theme: themeSelect.value });
      themeFeedback.textContent = "Tema berhasil diperbarui.";
    } catch (error) {
      console.error("Unable to save account theme:", error);
      themeFeedback.textContent = error instanceof Error ? error.message : "Tema tidak dapat disimpan.";
    }
  });

  accountPage.querySelector("#account-export-data")?.addEventListener("click", async () => {
    if (!(privacyFeedback instanceof HTMLElement)) return;
    if (!accountIsAuthenticated) {
      privacyFeedback.textContent = "Masuk ke akun terlebih dahulu untuk mengunduh data.";
      return;
    }

    const exportButton = accountPage.querySelector("#account-export-data");
    if (exportButton instanceof HTMLButtonElement) exportButton.disabled = true;
    privacyFeedback.textContent = "Menyiapkan data akun...";
    try {
      const data = await authenticatedRequestApi("/api/account-data/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `kurostore-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      privacyFeedback.textContent = "Salinan data akun berhasil diunduh.";
    } catch (error) {
      console.error("Unable to export account data:", error);
      privacyFeedback.textContent = error instanceof Error ? error.message : "Data akun tidak dapat diekspor.";
    } finally {
      if (exportButton instanceof HTMLButtonElement) exportButton.disabled = false;
    }
  });

  walletTopupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(walletTopupForm instanceof HTMLFormElement) || !(walletFeedback instanceof HTMLElement)) return;
    if (!accountIsAuthenticated) {
      walletFeedback.textContent = "Masuk ke akun terlebih dahulu untuk top up demo.";
      return;
    }

    const formData = new FormData(walletTopupForm);
    const amount = Number(formData.get("amount"));
    if (!Number.isInteger(amount) || amount < 5000 || amount > 1000000) {
      walletFeedback.textContent = "Nominal top up harus antara Rp5.000 dan Rp1.000.000.";
      return;
    }

    if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = true;
    walletFeedback.textContent = "Menyiapkan transaksi sandbox...";
    try {
      const payment = await authenticatedRequestApi("/api/account-data/wallet-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const paymentConfig = await requestApi("/api/payments/config");
      if (paymentConfig.environment !== "sandbox") {
        throw new Error("Top up demo hanya boleh menggunakan Midtrans sandbox.");
      }
      const snap = await loadMidtransSnap(paymentConfig.clientKey, paymentConfig.environment);
      walletFeedback.textContent = "Selesaikan simulasi pembayaran di popup Midtrans.";
      snap.pay(payment.token, {
        onSuccess: () => {
          walletFeedback.textContent = "Pembayaran simulasi diterima. Saldo diperbarui setelah notifikasi Midtrans.";
          window.setTimeout(() => void loadDemoWallet(), 1800);
          if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = false;
        },
        onPending: () => {
          walletFeedback.textContent = "Top up menunggu konfirmasi sandbox.";
          if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = false;
        },
        onError: () => {
          walletFeedback.textContent = "Simulasi top up gagal. Coba lagi.";
          if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = false;
        },
        onClose: () => {
          walletFeedback.textContent = "Popup ditutup. Saldo belum berubah.";
          if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = false;
        },
      });
    } catch (error) {
      console.error("Unable to start KuroPay sandbox top up:", error);
      walletFeedback.textContent = error instanceof Error ? error.message : "Top up demo tidak dapat dimulai.";
      if (walletTopupButton instanceof HTMLButtonElement) walletTopupButton.disabled = false;
    }
  });

  const loadAccountOrders = async () => {
    if (!(ordersList instanceof HTMLElement) || !(ordersFeedback instanceof HTMLElement)) return;
    ordersList.replaceChildren();
    ordersFeedback.textContent = "";
    if (ordersEmpty) ordersEmpty.hidden = true;

    const accessToken = sessionStorage.getItem("kurostore-access-token");
    if (!accountIsAuthenticated || !accessToken) {
      ordersFeedback.textContent = "Masuk ke akun untuk melihat riwayat pesanan.";
      if (ordersLoginLink) ordersLoginLink.hidden = false;
      return;
    }
    if (ordersLoginLink) ordersLoginLink.hidden = true;

    ordersFeedback.textContent = "Memuat riwayat pesanan…";
    try {
      const result = await requestApi("/api/orders", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      ordersFeedback.textContent = "";
      if (!Array.isArray(result.orders)) throw new Error("Format riwayat pesanan tidak valid.");
      if (result.orders.length === 0) {
        if (ordersEmpty) ordersEmpty.hidden = false;
        return;
      }

      const formatPrice = (price) => new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(price);
      const formatDate = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const paymentLabels = {
        pending: "Menunggu pembayaran",
        paid: "Dibayar",
        failed: "Gagal",
        refunded: "Dikembalikan",
        partial_refunded: "Dikembalikan sebagian",
        disputed: "Dalam sengketa",
      };
      const orderStatusLabels = {
        pending: "Menunggu pembayaran",
        paid: "Pesanan dibayar",
        processing: "Pesanan diproses",
        shipped: "Pesanan dikirim",
        completed: "Pesanan selesai",
        cancelled: "Pesanan dibatalkan",
      };

      result.orders.forEach((order) => {
        if (!order || typeof order.orderId !== "string" || !Array.isArray(order.items)) {
          throw new Error("Data pesanan tidak valid.");
        }
        const card = document.createElement("article");
        card.className = "account-order-card";

        const heading = document.createElement("div");
        heading.className = "account-order-heading";
        const identity = document.createElement("div");
        const orderId = document.createElement("strong");
        orderId.textContent = order.orderId;
        const createdAt = document.createElement("span");
        const createdDate = new Date(order.createdAt);
        createdAt.textContent = Number.isNaN(createdDate.getTime()) ? "" : formatDate.format(createdDate);
        identity.append(orderId, createdAt);
        const status = document.createElement("span");
        status.className = `account-order-status account-order-status-${order.paymentStatus}`;
        status.textContent = orderStatusLabels[order.status] || paymentLabels[order.paymentStatus] || "Status diperbarui";
        heading.append(identity, status);

        const itemList = document.createElement("ul");
        itemList.className = "account-order-items";
        order.items.forEach((item) => {
          const itemRow = document.createElement("li");
          const name = document.createElement("span");
          name.textContent = `${item.name} × ${item.quantity}`;
          const subtotal = document.createElement("strong");
          subtotal.textContent = formatPrice(item.unitPrice * item.quantity);
          itemRow.append(name, subtotal);

          if (item.priceIsEstimate) {
            const estimate = document.createElement("small");
            estimate.className = "price-estimate-badge";
            estimate.textContent = "Harga estimasi saat pembelian";
            itemRow.append(estimate);
          }

          if (order.status === "completed" && typeof item.productId === "string") {
            if (item.review && Number.isInteger(item.review.rating)) {
              const review = document.createElement("div");
              review.className = "account-product-review";
              const rating = document.createElement("strong");
              rating.textContent = `${"★".repeat(item.review.rating)}${"☆".repeat(5 - item.review.rating)} · ${item.review.rating}/5`;
              review.append(rating);
              if (typeof item.review.comment === "string" && item.review.comment) {
                const comment = document.createElement("p");
                comment.textContent = item.review.comment;
                review.append(comment);
              }
              itemRow.append(review);
            } else {
              const reviewForm = document.createElement("form");
              reviewForm.className = "account-product-review-form";
              reviewForm.dataset.productRatingForm = "true";
              reviewForm.dataset.productId = item.productId;
              reviewForm.dataset.orderId = order.id;

              const ratingLabel = document.createElement("label");
              ratingLabel.textContent = "Rating";
              const ratingSelect = document.createElement("select");
              ratingSelect.name = "rating";
              ratingSelect.required = true;
              const ratingPlaceholder = document.createElement("option");
              ratingPlaceholder.value = "";
              ratingPlaceholder.textContent = "Pilih bintang";
              ratingPlaceholder.disabled = true;
              ratingPlaceholder.selected = true;
              ratingSelect.append(ratingPlaceholder);
              for (let value = 5; value >= 1; value -= 1) {
                const option = document.createElement("option");
                option.value = String(value);
                option.textContent = `${"★".repeat(value)}${"☆".repeat(5 - value)} · ${value}/5`;
                ratingSelect.append(option);
              }
              ratingLabel.append(ratingSelect);

              const commentLabel = document.createElement("label");
              commentLabel.textContent = "Ulasan (opsional)";
              const commentInput = document.createElement("textarea");
              commentInput.name = "comment";
              commentInput.maxLength = 1000;
              commentInput.rows = 2;
              commentInput.placeholder = "Ceritakan pengalamanmu memakai produk ini";
              commentLabel.append(commentInput);

              const submit = document.createElement("button");
              submit.type = "submit";
              submit.textContent = "Kirim rating";
              reviewForm.append(ratingLabel, commentLabel, submit);
              itemRow.append(reviewForm);
            }
          }
          itemList.append(itemRow);
        });

        const total = document.createElement("div");
        total.className = "account-order-total";
        const totalLabel = document.createElement("span");
        totalLabel.textContent = "Total";
        const totalAmount = document.createElement("strong");
        totalAmount.textContent = formatPrice(order.total);
        total.append(totalLabel, totalAmount);
        card.append(heading, itemList);
        if (Number(order.pointsDiscount) > 0) {
          const discount = document.createElement("div");
          discount.className = "account-order-total";
          const discountLabel = document.createElement("span");
          discountLabel.textContent = `Diskon ${Number(order.pointsRedeemed) || 0} poin`;
          const discountAmount = document.createElement("strong");
          discountAmount.textContent = `−${formatPrice(order.pointsDiscount)}`;
          discount.append(discountLabel, discountAmount);
          card.append(discount);
        }
        card.append(total);

        if (order.paymentStatus === "paid" && order.status !== "completed") {
          const completeButton = document.createElement("button");
          completeButton.type = "button";
          completeButton.className = "account-order-complete-button";
          completeButton.dataset.completeOrder = order.id;
          completeButton.textContent = "Saya sudah menerima pesanan";
          card.append(completeButton);
        }
        ordersList.append(card);
      });
    } catch (error) {
      console.error("Unable to load account orders:", error);
      ordersFeedback.textContent = error instanceof Error ? error.message : "Riwayat pesanan tidak dapat dimuat.";
      if (error instanceof Error && error.status === 401) {
        if (ordersLoginLink) ordersLoginLink.hidden = false;
      }
    }
  };

  ordersList?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-complete-order]");
    const orderId = button?.getAttribute("data-complete-order");
    if (!(button instanceof HTMLButtonElement) || !orderId) return;

    button.disabled = true;
    button.textContent = "Memproses...";
    void authenticatedRequestApi("/api/account-data/complete-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    }).then(() => loadAccountOrders()).catch((error) => {
      console.error("Unable to confirm order receipt:", error);
      ordersFeedback.textContent = error instanceof Error ? error.message : "Pesanan tidak dapat diselesaikan.";
      button.disabled = false;
      button.textContent = "Saya sudah menerima pesanan";
    });
  });

  ordersList?.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)
      || event.target.dataset.productRatingForm !== "true") return;
    event.preventDefault();
    const form = event.target;
    const productId = form.dataset.productId;
    const orderId = form.dataset.orderId;
    const submit = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const rating = Number(formData.get("rating"));
    const comment = String(formData.get("comment") || "").trim();
    if (!productId || !orderId || !Number.isInteger(rating) || rating < 1 || rating > 5) return;

    if (submit instanceof HTMLButtonElement) {
      submit.disabled = true;
      submit.textContent = "Mengirim...";
    }
    void authenticatedRequestApi("/api/account-data/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, order_id: orderId, rating, comment }),
    }).then(() => loadAccountOrders()).catch((error) => {
      console.error("Unable to submit product rating:", error);
      ordersFeedback.textContent = error instanceof Error ? error.message : "Rating produk tidak dapat disimpan.";
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = false;
        submit.textContent = "Kirim rating";
      }
    });
  });

  const accountPanelsByKey = {
    profile: profilePanel,
    address: addressPanel,
    payment: paymentPanel,
    kuropay: walletPanel,
    password: passwordPanel,
    notifications: notificationsPanel,
    privacy: privacyPanel,
    language: languagePanel,
    theme: themePanel,
    orders: ordersPanel,
    vouchers: vouchersPanel,
  };

  panelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.accountPanel;
      const selectedPanel = key ? accountPanelsByKey[key] : null;
      if (!(selectedPanel instanceof HTMLElement)) return;

      panelButtons.forEach((panelButton) => {
        const isActive = panelButton === button;
        panelButton.classList.toggle("is-active", isActive);
        if (isActive) panelButton.setAttribute("aria-current", "page");
        else panelButton.removeAttribute("aria-current");
      });
      allAccountPanels.forEach((panel) => {
        panel.hidden = panel !== selectedPanel;
      });

      if (key === "orders") void loadAccountOrders();
      if (key === "kuropay" || key === "vouchers") void loadDemoWallet();
      if (key === "payment" && accountPage.querySelector("#account-payment-method") instanceof HTMLSelectElement) {
        accountPage.querySelector("#account-payment-method").value = currentAccountPreferences.preferred_payment_method;
      }
    });
  });

  const requestedPanel = new URLSearchParams(window.location.search).get("panel");
  const requestedPanelButton = panelButtons.find((button) => button.dataset.accountPanel === requestedPanel);
  if (requestedPanelButton) requestedPanelButton.click();

  logoutButton?.addEventListener("click", () => {
    sessionStorage.removeItem("kurostore-authenticated");
    sessionStorage.removeItem("kurostore-access-token");
    sessionStorage.removeItem("kurostore-refresh-token");
    sessionStorage.removeItem("kurostore-user-name");
    sessionStorage.removeItem("kurostore-user-email");
    sessionStorage.removeItem("kurostore-user-phone");
    sessionStorage.removeItem("kurostore-guest-session");
    window.location.href = "../index.html";
  });
}

document.querySelectorAll(".auth-password-toggle").forEach((toggle) => {
  const password = document.getElementById(toggle.getAttribute("aria-controls"));

  if (password) {
    toggle.addEventListener("click", () => {
      const showPassword = password.type === "password";
      password.type = showPassword ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(showPassword));
      toggle.setAttribute(
        "aria-label",
        showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
      );
    });
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = loginForm.querySelector("#login-feedback");
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const formData = new FormData(loginForm);

    if (!(feedback instanceof HTMLElement) || !(submitButton instanceof HTMLButtonElement)) {
      return;
    }

    feedback.textContent = "";
    submitButton.disabled = true;
    try {
      const data = await requestApi("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      saveAuthSession(data);
      window.location.href = authReturnTarget();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : "Tidak dapat masuk. Coba lagi.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = registerForm.querySelector("#register-password");
    const passwordConfirm = registerForm.querySelector("#register-password-confirm");
    const feedback = registerForm.querySelector("#register-feedback");
    const submitButton = registerForm.querySelector('button[type="submit"]');

    if (!(password instanceof HTMLInputElement)
      || !(passwordConfirm instanceof HTMLInputElement)
      || !(feedback instanceof HTMLElement)
      || !(submitButton instanceof HTMLButtonElement)) {
      return;
    }

    if (password.value !== passwordConfirm.value) {
      feedback.textContent = "Konfirmasi kata sandi belum sama.";
      passwordConfirm.focus();
      return;
    }

    const formData = new FormData(registerForm);
    feedback.textContent = "";
    submitButton.disabled = true;
    try {
      const data = await requestApi("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: password.value,
        }),
      });

      if (data.authenticated) {
        saveAuthSession(data);
        window.location.href = authReturnTarget();
        return;
      }

      feedback.textContent = data.message;
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : "Pendaftaran tidak berhasil. Coba lagi.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (sellerApplicationPage) {
  const loginRequired = sellerApplicationPage.querySelector("#seller-login-required");
  const applicationContent = sellerApplicationPage.querySelector("#seller-application-content");
  const form = sellerApplicationPage.querySelector("#seller-application-form");
  const feedback = sellerApplicationPage.querySelector("#seller-application-feedback");
  const submitButton = form?.querySelector('button[type="submit"]');
  const storeNameInput = form?.querySelector("#seller-store-name");
  const storeDescriptionInput = form?.querySelector("#seller-store-description");
  const accessToken = sessionStorage.getItem("kurostore-access-token");

  const setApplicationMessage = (message) => {
    if (feedback) {
      feedback.textContent = message;
    }
  };

  const requireLogin = () => {
    sessionStorage.removeItem("kurostore-authenticated");
    sessionStorage.removeItem("kurostore-access-token");
    sessionStorage.removeItem("kurostore-refresh-token");
    if (loginRequired) loginRequired.hidden = false;
    if (applicationContent) applicationContent.hidden = true;
  };

  const loadApplications = async () => {
    if (!accessToken) {
      if (loginRequired) loginRequired.hidden = false;
      if (applicationContent) applicationContent.hidden = true;
      return;
    }

    if (loginRequired) loginRequired.hidden = true;
    if (applicationContent) applicationContent.hidden = false;

    try {
      const data = await requestApi("/api/seller/applications", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const application = data.applications?.[0];

      if (!application) {
        if (form) form.hidden = false;
        return;
      }

      if (storeNameInput instanceof HTMLInputElement) storeNameInput.value = application.store_name;
      if (storeDescriptionInput instanceof HTMLTextAreaElement) {
        storeDescriptionInput.value = application.store_description || "";
      }

      if (application.status === "pending") {
        if (form) form.hidden = true;
        setApplicationMessage("Pengajuanmu sedang ditinjau admin. Kamu dapat kembali ke halaman ini untuk melihat status terbaru.");
      } else if (application.status === "approved") {
        if (form) form.hidden = true;
        setApplicationMessage("Pengajuanmu disetujui! Kamu sudah dapat melanjutkan ke Seller Center.");
      } else {
        if (form) form.hidden = false;
        setApplicationMessage(application.rejection_reason
          ? `Pengajuan sebelumnya belum disetujui: ${application.rejection_reason} Kamu dapat memperbarui detail toko dan mengajukan kembali.`
          : "Pengajuan sebelumnya belum disetujui. Kamu dapat memperbarui detail toko dan mengajukan kembali.");
      }
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        requireLogin();
        return;
      }

      setApplicationMessage(error instanceof Error ? error.message : "Pengajuan tidak dapat dimuat.");
      if (form) form.hidden = true;
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(submitButton instanceof HTMLButtonElement)
      || !(storeNameInput instanceof HTMLInputElement)
      || !(storeDescriptionInput instanceof HTMLTextAreaElement)) {
      return;
    }

    submitButton.disabled = true;
    setApplicationMessage("");
    try {
      await requestApi("/api/seller/applications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          store_name: storeNameInput.value,
          store_description: storeDescriptionInput.value,
        }),
      });
      setApplicationMessage("Pengajuan berhasil dikirim dan sedang menunggu peninjauan admin.");
      form.hidden = true;
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        requireLogin();
        return;
      }

      setApplicationMessage(error instanceof Error ? error.message : "Pengajuan tidak dapat dikirim.");
    } finally {
      submitButton.disabled = false;
    }
  });

  void loadApplications();
}

if (adminDashboardPage) {
  const loginRequired = adminDashboardPage.querySelector("#admin-login-required");
  const accessDenied = adminDashboardPage.querySelector("#admin-access-denied");
  const accessDeniedMessage = adminDashboardPage.querySelector("#admin-access-denied-message");
  const workspace = adminDashboardPage.querySelector("#admin-workspace");
  const applicationsList = adminDashboardPage.querySelector("#admin-application-list");
  const applicationsCount = adminDashboardPage.querySelector("#admin-applications-count");
  const applicationsEmpty = adminDashboardPage.querySelector("#admin-applications-empty");
  const applicationsEmptyTitle = adminDashboardPage.querySelector("#admin-applications-empty-title");
  const applicationsEmptyMessage = adminDashboardPage.querySelector("#admin-applications-empty-message");
  const applicationSearch = adminDashboardPage.querySelector("#admin-application-search");
  const feedback = adminDashboardPage.querySelector("#admin-dashboard-feedback");
  const refreshButton = adminDashboardPage.querySelector("#admin-dashboard-refresh");
  const updatedAt = adminDashboardPage.querySelector("#admin-updated-at");
  const systemSummary = adminDashboardPage.querySelector("#admin-system-summary");
  const systemSummaryText = adminDashboardPage.querySelector("#admin-system-summary-text");
  const systemCheckedAt = adminDashboardPage.querySelector("#admin-system-checked-at");
  const pendingMetric = adminDashboardPage.querySelector("#admin-metric-pending");
  const sellersMetric = adminDashboardPage.querySelector("#admin-metric-sellers");
  const productsMetric = adminDashboardPage.querySelector("#admin-metric-products");
  const categoriesMetric = adminDashboardPage.querySelector("#admin-metric-categories");
  const lowStockMetric = adminDashboardPage.querySelector("#admin-metric-low-stock");
  const lowStockList = adminDashboardPage.querySelector("#admin-low-stock-list");
  const lowStockEmpty = adminDashboardPage.querySelector("#admin-low-stock-empty");
  const notificationsCount = adminDashboardPage.querySelector("#admin-notifications-count");
  const notificationsList = adminDashboardPage.querySelector("#admin-notifications-list");
  const notificationsEmpty = adminDashboardPage.querySelector("#admin-notifications-empty");
  const accessToken = sessionStorage.getItem("kurostore-access-token");
  let applications = [];
  let healthCheckRunning = false;
  let applicationsRefreshRunning = false;
  let dashboardMetrics = null;
  let healthChecks = [];

  const setFeedback = (message) => {
    if (feedback) feedback.textContent = message;
  };

  const setAccessState = (state, message = "") => {
    if (loginRequired) loginRequired.hidden = state !== "login";
    if (accessDenied) accessDenied.hidden = state !== "denied";
    if (workspace) workspace.hidden = state !== "admin";
    if (accessDeniedMessage && message) accessDeniedMessage.textContent = message;
  };

  const renderApplications = () => {
    if (!(applicationsList instanceof HTMLElement)) return;
    const searchTerm = applicationSearch instanceof HTMLInputElement
      ? applicationSearch.value.trim().toLocaleLowerCase("id")
      : "";
    const filteredApplications = applications.filter((application) =>
      [application.store_name, application.store_description, application.id]
        .some((value) => String(value || "").toLocaleLowerCase("id").includes(searchTerm)));

    applicationsList.replaceChildren();
    filteredApplications.forEach((application) => applicationsList.append(createApplicationCard(application)));

    if (applicationsEmpty) {
      applicationsEmpty.hidden = filteredApplications.length > 0;
      if (applicationsEmptyTitle) {
        applicationsEmptyTitle.textContent = applications.length > 0 && searchTerm
          ? "Tidak ada pengajuan yang cocok"
          : "Semua pengajuan sudah ditinjau";
      }
      if (applicationsEmptyMessage) {
        applicationsEmptyMessage.textContent = applications.length > 0 && searchTerm
          ? "Coba kata kunci lain untuk menemukan toko."
          : "Pengajuan seller baru akan muncul di halaman ini.";
      }
    }

    if (applicationsCount) {
      applicationsCount.textContent = searchTerm
        ? `${filteredApplications.length} dari ${applications.length} pengajuan ditampilkan`
        : `${applications.length} pengajuan menunggu ditinjau`;
    }
  };

  const renderNotifications = () => {
    if (!(notificationsList instanceof HTMLElement)) return;

    const notifications = [];
    if (dashboardMetrics?.pendingApplications > 0) {
      notifications.push({
        title: "Pengajuan seller menunggu",
        detail: `${new Intl.NumberFormat("id-ID").format(dashboardMetrics.pendingApplications)} pengajuan perlu ditinjau.`,
        href: "#admin-applications-title",
      });
    }

    if (dashboardMetrics?.lowStockCount > 0) {
      const productNames = dashboardMetrics.lowStockProducts
        .slice(0, 3)
        .map((product) => product.name)
        .join(", ");
      notifications.push({
        title: "Stok produk menipis",
        detail: `${new Intl.NumberFormat("id-ID").format(dashboardMetrics.lowStockCount)} produk memiliki stok 5 atau kurang.${productNames ? ` Contoh: ${productNames}.` : ""}`,
        href: "#admin-low-stock-title",
      });
    }

    const serviceIssues = healthChecks.filter((check) =>
      check.status === "unavailable" || check.status === "unknown");
    if (serviceIssues.length > 0) {
      const serviceNames = serviceIssues.map((check) => check.name || check.id).join(", ");
      notifications.push({
        title: "Gangguan atau status sistem tidak diketahui",
        detail: `Periksa layanan: ${serviceNames}.`,
        href: "#admin-system-health-title",
      });
    }

    notificationsList.replaceChildren();
    notifications.forEach((notification) => {
      const item = document.createElement("li");
      item.className = "admin-notification-item";
      const title = document.createElement("strong");
      title.textContent = notification.title;
      const detail = document.createElement("span");
      detail.textContent = notification.detail;
      const action = document.createElement("a");
      action.href = notification.href;
      action.textContent = "Tinjau";
      item.append(title, detail, action);
      notificationsList.append(item);
    });

    const hasNotifications = notifications.length > 0;
    if (notificationsCount) {
      notificationsCount.textContent = hasNotifications
        ? `${notifications.length} hal perlu ditindaklanjuti`
        : "Semua kondisi utama terpantau";
    }
    if (notificationsEmpty) notificationsEmpty.hidden = hasNotifications;
  };

  const renderOverview = (metrics) => {
    dashboardMetrics = metrics;
    const numberFormat = new Intl.NumberFormat("id-ID");
    if (pendingMetric) pendingMetric.textContent = numberFormat.format(metrics.pendingApplications);
    if (sellersMetric) sellersMetric.textContent = numberFormat.format(metrics.sellers);
    if (productsMetric) productsMetric.textContent = numberFormat.format(metrics.activeProducts);
    if (categoriesMetric) categoriesMetric.textContent = numberFormat.format(metrics.activeCategories);
    if (lowStockMetric) lowStockMetric.textContent = numberFormat.format(metrics.lowStockCount);

    if (!(lowStockList instanceof HTMLElement)) return;
    lowStockList.replaceChildren();
    metrics.lowStockProducts.forEach((product) => {
      const item = document.createElement("li");
      const details = document.createElement("span");
      details.className = "admin-low-stock-details";
      const name = document.createElement("strong");
      name.textContent = product.name;
      const stock = document.createElement("small");
      stock.textContent = "Stok tersisa";
      details.append(name, stock);
      const quantity = document.createElement("span");
      quantity.className = "admin-stock-quantity";
      quantity.textContent = numberFormat.format(product.stock);
      item.append(details, quantity);
      lowStockList.append(item);
    });
    if (lowStockEmpty) lowStockEmpty.hidden = metrics.lowStockProducts.length > 0;
    renderNotifications();
  };

  const renderSystemHealth = (health) => {
    const checks = Array.isArray(health.checks) ? health.checks : [];
    healthChecks = checks;
    checks.forEach((check) => {
      const card = adminDashboardPage.querySelector(`[data-service="${check.id}"]`);
      if (!card) return;

      const status = ["operational", "not_configured", "unavailable", "unknown"].includes(check.status)
        ? check.status
        : "unknown";
      card.dataset.state = status;
      const detail = card.querySelector("[data-service-detail]");
      const statusLabel = card.querySelector("[data-service-status]");
      const action = card.querySelector("[data-service-action]");
      if (detail) {
        const latency = Number.isFinite(check.latencyMs) ? ` Respons ${check.latencyMs} ms.` : "";
        detail.textContent = `${check.detail}${latency}`;
      }
      if (statusLabel) {
        statusLabel.textContent = status === "operational"
          ? "Berjalan"
          : status === "not_configured" ? "Belum aktif"
            : status === "unavailable" ? "Gangguan" : "Tidak diketahui";
      }
      if (action instanceof HTMLAnchorElement) {
        const actionUrl = typeof check.actionUrl === "string" ? check.actionUrl : "";
        const showAction = status !== "operational" && actionUrl.startsWith("https://");
        action.hidden = !showAction;
        if (showAction) {
          action.href = actionUrl;
          action.textContent = `${check.actionLabel || "Buka layanan"} ↗`;
        }
      }
    });

    const hasUnavailableService = checks.some((check) => check.status === "unavailable");
    const hasUnknownService = checks.some((check) => check.status === "unknown");
    const needsSetup = checks.some((check) => check.status === "not_configured");
    const overallState = hasUnavailableService || hasUnknownService
      ? "attention"
      : needsSetup ? "setup" : "operational";
    if (systemSummary) systemSummary.dataset.state = overallState;
    if (systemSummaryText) {
      systemSummaryText.textContent = hasUnavailableService
        ? "Ada layanan yang terganggu"
        : hasUnknownService
          ? "Status sebagian layanan tidak diketahui"
          : needsSetup ? "Perlu konfigurasi" : "Semua layanan aktif";
    }

    if (systemCheckedAt && health.checkedAt) {
      systemCheckedAt.textContent = `Diperiksa ${new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(health.checkedAt))} · diperbarui otomatis tiap 10 detik`;
    }
    renderNotifications();
  };

  const renderHealthUnavailable = (error) => {
    const responseReceived = Number.isInteger(error?.status);
    const apiCheck = adminDashboardPage.querySelector('[data-service="api"]');
    const supabaseChecks = ["database", "auth"]
      .map((service) => adminDashboardPage.querySelector(`[data-service="${service}"]`));
    if (apiCheck) {
      apiCheck.dataset.state = responseReceived ? "operational" : "unavailable";
      const detail = apiCheck.querySelector("[data-service-detail]");
      const status = apiCheck.querySelector("[data-service-status]");
      if (detail) detail.textContent = responseReceived
        ? "API merespons, tetapi pemeriksaan layanan belum dapat diselesaikan."
        : "Tidak ada respons dari endpoint pemeriksaan.";
      if (status) status.textContent = responseReceived ? "Berjalan" : "Gangguan";
      const action = apiCheck.querySelector("[data-service-action]");
      if (action instanceof HTMLAnchorElement) {
        action.href = "https://vercel.com/dashboard";
        action.textContent = "Buka Vercel ↗";
        action.hidden = false;
      }
    }

    supabaseChecks.forEach((card) => {
      if (!card) return;
      card.dataset.state = "unknown";
      const detail = card.querySelector("[data-service-detail]");
      const status = card.querySelector("[data-service-status]");
      if (detail) detail.textContent = "Status koneksi belum dapat dipastikan.";
      if (status) status.textContent = "Tidak diketahui";
      const action = card.querySelector("[data-service-action]");
      if (action instanceof HTMLAnchorElement) {
        action.href = "https://supabase.com/dashboard";
        action.textContent = "Buka Supabase ↗";
        action.hidden = false;
      }
    });
    if (systemSummary) systemSummary.dataset.state = "attention";
    if (systemSummaryText) {
      systemSummaryText.textContent = responseReceived
        ? "Pemeriksaan layanan belum lengkap"
        : "API pemeriksaan tidak merespons";
    }
    if (systemCheckedAt) {
      systemCheckedAt.textContent = "Status layanan belum diperbarui. Akan dicoba lagi otomatis.";
    }
    healthChecks = [{
      id: "system-health",
      name: "Pemeriksaan layanan",
      status: "unavailable",
    }];
    renderNotifications();
  };

  const refreshSystemHealth = async () => {
    if (healthCheckRunning || !accessToken) return;
    healthCheckRunning = true;
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const health = await requestApi("/api/admin/system-health", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const apiCheck = health.checks?.find((check) => check.id === "api");
      if (apiCheck) apiCheck.latencyMs = Math.round(performance.now() - startedAt);
      renderSystemHealth(health);
    } catch (error) {
      renderHealthUnavailable(error);
    } finally {
      window.clearTimeout(timeoutId);
      healthCheckRunning = false;
    }
  };

  const submitDecision = async (applicationId, decision, rejectionReason = "") => {
    return requestApi("/api/admin/seller-applications", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        application_id: applicationId,
        decision,
        ...(decision === "rejected" ? { rejection_reason: rejectionReason } : {}),
      }),
    });
  };

  const createApplicationCard = (application) => {
    const card = document.createElement("article");
    card.className = "admin-application-card";

    const heading = document.createElement("div");
    heading.className = "admin-application-card-heading";

    const storeIdentity = document.createElement("div");
    storeIdentity.className = "admin-application-store-identity";
    const storeMark = document.createElement("span");
    storeMark.className = "admin-application-store-mark";
    storeMark.setAttribute("aria-hidden", "true");
    storeMark.textContent = String(application.store_name || "S").trim().charAt(0).toLocaleUpperCase("id");
    const storeInfo = document.createElement("div");
    storeInfo.className = "admin-application-store-info";
    const title = document.createElement("h3");
    title.textContent = application.store_name;
    const status = document.createElement("span");
    status.className = "admin-application-status";
    status.textContent = "Menunggu ditinjau";
    storeInfo.append(title, status);
    storeIdentity.append(storeMark, storeInfo);

    const submittedAt = document.createElement("time");
    const submittedDate = new Date(application.submitted_at);
    if (Number.isFinite(submittedDate.getTime())) {
      submittedAt.dateTime = submittedDate.toISOString();
      submittedAt.textContent = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(submittedDate);
    } else {
      submittedAt.textContent = "Tanggal pengajuan tidak tersedia";
    }

    heading.append(storeIdentity, submittedAt);
    card.append(heading);

    const description = document.createElement("p");
    description.className = "admin-application-description";
    description.textContent = application.store_description || "Tidak ada deskripsi toko.";
    card.append(description);

    const applicationId = document.createElement("small");
    applicationId.className = "admin-application-id";
    applicationId.textContent = `ID pengajuan: ${application.id}`;
    card.append(applicationId);

    const actions = document.createElement("div");
    actions.className = "admin-application-actions";

    const approveButton = document.createElement("button");
    approveButton.className = "admin-decision-button admin-approve-button";
    approveButton.type = "button";
    approveButton.textContent = "Setujui";
    approveButton.addEventListener("click", async () => {
      if (!window.confirm(`Setujui toko "${application.store_name}" sebagai seller?`)) return;
      await reviewApplication(application, "approved", "", approveButton, rejectButton);
    });

    const rejectButton = document.createElement("button");
    rejectButton.className = "admin-decision-button admin-reject-button";
    rejectButton.type = "button";
    rejectButton.textContent = "Tolak";

    actions.append(approveButton, rejectButton);
    card.append(actions);

    const rejectionForm = document.createElement("form");
    rejectionForm.className = "admin-rejection-form";
    rejectionForm.hidden = true;

    const reasonLabel = document.createElement("label");
    reasonLabel.textContent = "Alasan penolakan";
    const reasonInput = document.createElement("textarea");
    reasonInput.maxLength = 500;
    reasonInput.rows = 3;
    reasonInput.required = true;
    reasonInput.placeholder = "Jelaskan hal yang perlu diperbaiki pemohon (maksimal 500 karakter).";
    reasonInput.addEventListener("input", () => reasonInput.setCustomValidity(""));
    reasonLabel.append(reasonInput);

    const rejectionActions = document.createElement("div");
    rejectionActions.className = "admin-rejection-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "admin-decision-button admin-cancel-button";
    cancelButton.textContent = "Batal";
    cancelButton.addEventListener("click", () => {
      rejectionForm.hidden = true;
      reasonInput.value = "";
    });

    const confirmRejectButton = document.createElement("button");
    confirmRejectButton.type = "submit";
    confirmRejectButton.className = "admin-decision-button admin-reject-button";
    confirmRejectButton.textContent = "Konfirmasi penolakan";
    rejectionActions.append(cancelButton, confirmRejectButton);
    rejectionForm.append(reasonLabel, rejectionActions);
    rejectButton.addEventListener("click", () => {
      rejectionForm.hidden = false;
      reasonInput.focus();
    });
    rejectionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = reasonInput.value.trim();
      if (!reason) {
        reasonInput.setCustomValidity("Isi alasan penolakan.");
        reasonInput.reportValidity();
        return;
      }
      reasonInput.setCustomValidity("");
      await reviewApplication(application, "rejected", reason, confirmRejectButton, approveButton, rejectButton);
    });
    card.append(rejectionForm);

    return card;
  };

  const reviewApplication = async (application, decision, reason, ...buttons) => {
    buttons.forEach((button) => {
      button.disabled = true;
    });
    setFeedback("");

    try {
      await submitDecision(application.id, decision, reason);
      setFeedback(decision === "approved"
        ? `Toko "${application.store_name}" disetujui.`
        : `Pengajuan "${application.store_name}" ditolak.`);
      await loadApplications();
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        setAccessState("login");
        return;
      }
      setFeedback(error instanceof Error ? error.message : "Keputusan tidak dapat disimpan.");
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  };

  const loadApplications = async () => {
    if (applicationsRefreshRunning) return;
    applicationsRefreshRunning = true;
    if (!accessToken) {
      setAccessState("login");
      applicationsRefreshRunning = false;
      return;
    }

    if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = true;
    try {
      const account = await requestApi("/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (account.user?.role !== "admin") {
        setAccessState("denied", "Akun ini bukan admin. Masuk dengan akun admin untuk meninjau pengajuan seller.");
        return;
      }

      setAccessState("admin");
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [applicationData, overview] = await Promise.all([
        requestApi("/api/admin/seller-applications", { headers }),
        requestApi("/api/admin/overview", { headers }),
      ]);
      applications = Array.isArray(applicationData.applications) ? applicationData.applications : [];
      renderOverview(overview.metrics);
      renderApplications();
      if (updatedAt) {
        updatedAt.textContent = `Diperbarui ${new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())}`;
      }
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        setAccessState("login");
      } else if (error instanceof Error && error.status === 403) {
        setAccessState("denied", "Akun ini tidak memiliki akses admin.");
      } else {
        setAccessState("admin");
        setFeedback(error instanceof Error ? error.message : "Pengajuan tidak dapat dimuat.");
      }
    } finally {
      if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = false;
      applicationsRefreshRunning = false;
    }
  };

  refreshButton?.addEventListener("click", () => {
    void loadApplications();
    void refreshSystemHealth();
  });
  applicationSearch?.addEventListener("input", renderApplications);

  void loadApplications();
  void refreshSystemHealth();
  window.setInterval(() => {
    if (!document.hidden) void refreshSystemHealth();
  }, 10000);
  window.setInterval(() => {
    if (!document.hidden) void loadApplications();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshSystemHealth();
      void loadApplications();
    }
  });
}

if (heroCarousel) {
  const slides = Array.from(heroCarousel.querySelectorAll(".hero-slide"));
  const dots = Array.from(heroCarousel.querySelectorAll(".carousel-dot"));
  let activeSlide = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let artworkIndex = 0;

  if (heroImage) {
    const heroCaption = heroCarousel.querySelector(".hero-image-caption-text");
    const heroArtworks = [
      {
        src: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/kurostore.png",
        alt: "Logo Kurostore",
        caption: "Belanja lebih mudah",
      },
      {
        src: "https://mmtnqldmacxxoactieae.supabase.co/storage/v1/object/public/kurostore-assets/diskon-50.png",
        alt: "Promo diskon 50 persen",
        caption: "Promo spesial",
      },
    ];

    heroArtworks.forEach((artwork) => {
      const preloadedImage = new Image();
      preloadedImage.src = artwork.src;
    });

    window.setInterval(() => {
      if (activeSlide !== 0 || document.hidden) {
        return;
      }

      artworkIndex = (artworkIndex + 1) % heroArtworks.length;
      const nextArtwork = heroArtworks[artworkIndex];
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        heroImage.src = nextArtwork.src;
        heroImage.alt = nextArtwork.alt;
        if (heroCaption) {
          heroCaption.textContent = nextArtwork.caption;
        }
        return;
      }

      heroImage.classList.add("is-switching");
      window.setTimeout(() => {
        heroImage.src = nextArtwork.src;
        heroImage.alt = nextArtwork.alt;
        if (heroCaption) {
          heroCaption.textContent = nextArtwork.caption;
        }
        heroImage.classList.remove("is-switching");
      }, 220);
    }, 5000);
  }

  const showSlide = (nextSlide, direction) => {
    const previousSlide = activeSlide;
    activeSlide = (nextSlide + slides.length) % slides.length;
    const enterDirection = direction || (activeSlide >= previousSlide ? "from-right" : "from-left");

    slides.forEach((slide, index) => {
      const isActive = index === activeSlide;
      slide.hidden = !isActive;
      slide.classList.toggle("is-active", isActive);
      slide.classList.toggle("slide-from-right", isActive && enterDirection === "from-right");
      slide.classList.toggle("slide-from-left", isActive && enterDirection === "from-left");
      slide.setAttribute("aria-hidden", String(!isActive));
    });

    dots.forEach((dot, index) => {
      const isActive = index === activeSlide;
      dot.classList.toggle("is-active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  };

  if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(() => {
      if (document.hidden || heroCarousel.matches(":hover") || heroCarousel.contains(document.activeElement)) {
        return;
      }

      showSlide(activeSlide + 1, "from-right");
    }, 6000);
  }

  heroCarousel.querySelector("[data-slide-prev]")?.addEventListener("click", () => {
    showSlide(activeSlide - 1, "from-left");
  });

  heroCarousel.querySelector("[data-slide-next]")?.addEventListener("click", () => {
    showSlide(activeSlide + 1, "from-right");
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => showSlide(index));
  });

  heroCarousel.querySelector("[data-slide-to='0']:not(.carousel-dot)")?.addEventListener("click", () => {
    showSlide(0);
  });
}

if (announcementMessage) {
  const intro = announcementMessage.querySelector(".announcement-intro");
  const highlight = announcementMessage.querySelector(".announcement-highlight");
  const announcements = [
    ["Selamat datang di Kurostore", "belanja lebih mudah"],
    ["Temukan berbagai kebutuhanmu", "dalam satu tempat"],
    ["Jelajahi pilihan produk", "sesuai kebutuhanmu"],
  ];
  let currentAnnouncement = 0;

  window.setInterval(() => {
    currentAnnouncement = (currentAnnouncement + 1) % announcements.length;
    const [nextIntro, nextHighlight] = announcements[currentAnnouncement];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!intro || !highlight || reduceMotion) {
      if (intro && highlight) {
        intro.textContent = nextIntro;
        highlight.textContent = nextHighlight;
      }
      return;
    }

    announcementMessage.classList.add("is-changing");
    window.setTimeout(() => {
      intro.textContent = nextIntro;
      highlight.textContent = nextHighlight;
      announcementMessage.classList.remove("is-changing");
    }, 180);
  }, 6000);
}

if (menuToggle && primaryNavigation) {
  const mainContent = document.querySelector("#konten-utama");
  const navigationSections = Array.from(primaryNavigation.querySelectorAll(".nav-link[href^='#']"))
    .map((link) => ({ link, section: document.querySelector(link.hash) }))
    .filter((item) => item.section);
  const viewNavigationHashes = new Set([
    "#konten-utama",
    "#kategori",
    "#all-products-page",
    "#promo",
    "#produk-populer",
    "#rekomendasi",
    "#tentang",
  ]);
  const getViewFromLocation = () => {
    if (window.location.hash === "#kategori") return "categories";
    if (window.location.hash === "#all-products-page") return "latest";
    if (window.location.hash === "#promo") return "promo";
    if (!window.location.hash && new URLSearchParams(window.location.search).get("q")?.trim()) {
      return "categories";
    }
    return "home";
  };
  let currentMainView = getViewFromLocation();
  let activeNavigationLink = null;
  let navigationUpdateScheduled = false;

  const setMainView = (view) => {
    currentMainView = view;
    mainContent?.classList.toggle("is-categories-view", view === "categories");
    mainContent?.classList.toggle("is-latest-view", view === "latest");
    mainContent?.classList.toggle("is-promo-view", view === "promo");

    const heading = document.querySelector("#all-products-list-title");
    const description = heading?.parentElement?.querySelector("p");
    if (heading) heading.textContent = view === "latest" ? "Produk terbaru" : "Semua produk";
    if (description) {
      description.textContent = view === "latest"
        ? "Produk terbaru dari berbagai kategori."
        : "Produk dari berbagai kategori ditampilkan bersama.";
    }
  };

  setMainView(currentMainView);

  document.addEventListener("kurostore:show-categories", () => {
    setMainView("categories");
    const categoriesLink = primaryNavigation.querySelector('.nav-link[href="#kategori"]');
    if (categoriesLink) setActiveNavigationLink(categoriesLink);
    scheduleNavigationUpdate();
  });

  const setActiveNavigationLink = (link) => {
    if (activeNavigationLink === link) return;

    activeNavigationLink = link;
    primaryNavigation.querySelectorAll(".nav-link").forEach((navLink) => {
      const isActive = navLink === link;
      navLink.classList.toggle("is-active", isActive);
      if (isActive) {
        navLink.setAttribute("aria-current", "location");
      } else {
        navLink.removeAttribute("aria-current");
      }
    });

  };

  const updateActiveNavigationLink = () => {
    navigationUpdateScheduled = false;
    if (currentMainView !== "home") {
      const activeHash = {
        categories: "#kategori",
        latest: "#all-products-page",
        promo: "#promo",
      }[currentMainView];
      const activeLink = primaryNavigation.querySelector(`.nav-link[href="${activeHash}"]`);
      if (activeLink) setActiveNavigationLink(activeLink);
      return;
    }

    const activationLine = window.scrollY + Math.min(window.innerHeight * 0.32, 240);
    let activeSection = navigationSections.find((item) => item.section.getClientRects().length > 0);

    navigationSections
      .filter((item) => item.section.getClientRects().length > 0)
      .forEach((item) => {
      if (item.section.getBoundingClientRect().top + window.scrollY <= activationLine) {
        activeSection = item;
      }
      });

    if (activeSection) setActiveNavigationLink(activeSection.link);
  };

  const scheduleNavigationUpdate = () => {
    if (navigationUpdateScheduled) return;
    navigationUpdateScheduled = true;
    window.requestAnimationFrame(updateActiveNavigationLink);
  };

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
    if (!link || !viewNavigationHashes.has(link.hash)) return;

    const target = document.querySelector(link.hash);
    if (!target) return;

    event.preventDefault();
    const viewForHash = {
      "#kategori": "categories",
      "#all-products-page": "latest",
      "#promo": "promo",
    };
    const nextView = viewForHash[link.hash] || "home";
    setMainView(nextView);
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = link.hash;
    if (nextView !== "categories") nextUrl.searchParams.delete("q");
    if (nextView === "categories") nextUrl.searchParams.delete("category");
    if (window.location.href !== nextUrl.href || window.history.state?.viewMode !== nextView) {
      window.history.pushState(
        { viewMode: nextView },
        "",
        `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      );
    }

    const matchingNavigationLink = primaryNavigation.querySelector(`.nav-link[href="${link.hash}"]`);
    if (matchingNavigationLink) setActiveNavigationLink(matchingNavigationLink);
    if (nextView === "latest") {
      document.dispatchEvent(new Event("kurostore:show-latest"));
    } else if (nextView === "categories") {
      document.dispatchEvent(new Event("kurostore:restore-catalog"));
    }
    const isViewTransition = nextView !== "home" || link.hash === "#konten-utama";
    if (isViewTransition) {
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    }
    scheduleNavigationUpdate();
  });

  window.addEventListener("popstate", (event) => {
    setMainView(typeof event.state?.viewMode === "string"
      ? event.state.viewMode
      : getViewFromLocation());
    document.dispatchEvent(new Event("kurostore:restore-catalog"));
    scheduleNavigationUpdate();
  });
  window.addEventListener("hashchange", () => {
    if (viewNavigationHashes.has(window.location.hash)) {
      setMainView(getViewFromLocation());
      document.dispatchEvent(new Event("kurostore:restore-catalog"));
      scheduleNavigationUpdate();
    }
  });
  window.addEventListener("scroll", scheduleNavigationUpdate, { passive: true });
  window.addEventListener("resize", scheduleNavigationUpdate);
  scheduleNavigationUpdate();

  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute(
      "aria-label",
      isExpanded ? "Buka menu navigasi" : "Tutup menu navigasi"
    );
    primaryNavigation.classList.toggle("is-open", !isExpanded);
  });

  primaryNavigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a") && window.innerWidth <= 640) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Buka menu navigasi");
      primaryNavigation.classList.remove("is-open");
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 640) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Buka menu navigasi");
      primaryNavigation.classList.remove("is-open");
    }
  });
}

if (sellerDashboardPage) {
  const loginRequired = sellerDashboardPage.querySelector("#seller-login-required");
  const accessDenied = sellerDashboardPage.querySelector("#seller-access-denied");
  const accessDeniedMessage = sellerDashboardPage.querySelector("#seller-access-denied-message");
  const workspace = sellerDashboardPage.querySelector("#seller-workspace");
  const sellerViews = Array.from(sellerDashboardPage.querySelectorAll("[data-seller-view-panel]"));
  const sellerViewButtons = Array.from(sellerDashboardPage.querySelectorAll("[data-seller-view]"));
  const feedback = sellerDashboardPage.querySelector("#seller-dashboard-feedback");
  const refreshButton = sellerDashboardPage.querySelector("#seller-dashboard-refresh");
  const updatedAt = sellerDashboardPage.querySelector("#seller-dashboard-updated");
  const productList = sellerDashboardPage.querySelector("#seller-products-list");
  const productSearch = sellerDashboardPage.querySelector("#seller-product-search");
  const productCount = sellerDashboardPage.querySelector("#seller-products-count");
  const dialog = document.querySelector("#seller-product-dialog");
  const productForm = document.querySelector("#seller-product-form");
  const dialogTitle = document.querySelector("#seller-product-dialog-title");
  const dialogFeedback = document.querySelector("#seller-product-dialog-feedback");
  const productIdInput = document.querySelector("#seller-product-id");
  const nameInput = document.querySelector("#seller-product-name");
  const descriptionInput = document.querySelector("#seller-product-description");
  const categoryInput = document.querySelector("#seller-product-category");
  const priceInput = document.querySelector("#seller-product-price");
  const stockInput = document.querySelector("#seller-product-stock");
  const statusInput = document.querySelector("#seller-product-status");
  const saveButton = document.querySelector("#seller-product-save");
  const accessToken = sessionStorage.getItem("kurostore-access-token");
  let products = [];
  let loading = false;

  const setFeedback = (message) => {
    if (feedback) feedback.textContent = message;
  };

  const setAccessState = (state, message = "") => {
    if (loginRequired) loginRequired.hidden = state !== "login";
    if (accessDenied) accessDenied.hidden = state !== "denied";
    if (workspace) workspace.hidden = state !== "seller";
    if (accessDeniedMessage && message) accessDeniedMessage.textContent = message;
  };

  const setSellerView = (viewName) => {
    const viewExists = sellerViews.some((view) => view.dataset.sellerViewPanel === viewName);
    if (!viewExists) return;

    sellerViews.forEach((view) => {
      view.hidden = view.dataset.sellerViewPanel !== viewName;
    });
    sellerViewButtons.forEach((button) => {
      const isActive = button.dataset.sellerView === viewName;
      if (button.classList.contains("seller-nav-item")) {
        button.classList.toggle("is-active", isActive);
        if (isActive) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
  };

  const apiHeaders = () => ({ Authorization: `Bearer ${accessToken}` });

  const formatPrice = (price) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(price));

  const updateMetrics = () => {
    const activeProducts = products.filter((product) => product.status === "active");
    const lowStockProducts = products.filter((product) => product.status !== "archived" && product.stock <= 5);
    const totalSales = products.reduce((sum, product) => sum + (Number(product.sales_count) || 0), 0);
    const metrics = [
      ["#seller-metric-total", products.length],
      ["#seller-metric-active", activeProducts.length],
      ["#seller-metric-low-stock", lowStockProducts.length],
      ["#seller-metric-sales", totalSales],
    ];
    metrics.forEach(([selector, value]) => {
      const element = sellerDashboardPage.querySelector(selector);
      if (element) element.textContent = new Intl.NumberFormat("id-ID").format(value);
    });
  };

  const createProductCard = (product) => {
    const card = document.createElement("article");
    card.className = "seller-product-card";

    const productInfo = document.createElement("div");
    productInfo.className = "seller-product-info";
    const productMark = document.createElement("span");
    productMark.className = "seller-product-mark";
    productMark.setAttribute("aria-hidden", "true");
    productMark.textContent = String(product.name || "P").trim().charAt(0).toLocaleUpperCase("id");
    const copy = document.createElement("div");
    copy.className = "seller-product-copy";
    const name = document.createElement("h3");
    name.textContent = product.name;
    const description = document.createElement("p");
    description.textContent = product.description || "Belum ada deskripsi produk.";
    copy.append(name, description);
    productInfo.append(productMark, copy);

    const price = document.createElement("div");
    price.className = "seller-product-value";
    const priceLabel = document.createElement("small");
    priceLabel.textContent = "Harga";
    const priceValue = document.createElement("strong");
    priceValue.textContent = formatPrice(product.price);
    price.append(priceLabel, priceValue);

    const stock = document.createElement("div");
    stock.className = "seller-product-value";
    const stockLabel = document.createElement("small");
    stockLabel.textContent = "Stok";
    const stockValue = document.createElement("strong");
    stockValue.textContent = new Intl.NumberFormat("id-ID").format(product.stock);
    stock.append(stockLabel, stockValue);

    const sales = document.createElement("div");
    sales.className = "seller-product-value";
    const salesLabel = document.createElement("small");
    salesLabel.textContent = "Terjual";
    const salesValue = document.createElement("strong");
    salesValue.textContent = new Intl.NumberFormat("id-ID").format(product.sales_count || 0);
    sales.append(salesLabel, salesValue);

    const status = document.createElement("span");
    status.className = `seller-product-status seller-product-status-${product.status}`;
    status.textContent = product.status === "active" ? "Aktif" : product.status === "draft" ? "Draft" : "Diarsipkan";

    const actions = document.createElement("div");
    actions.className = "seller-product-actions";
    const editButton = document.createElement("button");
    editButton.className = "seller-product-edit";
    editButton.type = "button";
    editButton.dataset.productAction = "edit";
    editButton.dataset.productId = product.id;
    editButton.textContent = "Ubah";
    actions.append(editButton);
    if (product.status !== "archived") {
      const archiveButton = document.createElement("button");
      archiveButton.className = "seller-product-archive";
      archiveButton.type = "button";
      archiveButton.dataset.productAction = "archive";
      archiveButton.dataset.productId = product.id;
      archiveButton.textContent = "Arsipkan";
      actions.append(archiveButton);
    }

    card.append(productInfo, price, stock, sales, status, actions);
    return card;
  };

  const renderProducts = () => {
    if (!productList) return;
    const query = productSearch instanceof HTMLInputElement ? productSearch.value.trim().toLocaleLowerCase("id") : "";
    const filteredProducts = products.filter((product) => product.name.toLocaleLowerCase("id").includes(query));
    productList.replaceChildren();

    if (filteredProducts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "seller-products-empty";
      const title = document.createElement("h3");
      title.textContent = query ? "Produk tidak ditemukan" : "Belum ada produk";
      const message = document.createElement("p");
      message.textContent = query
        ? "Coba gunakan kata kunci lain."
        : "Tambahkan produk pertamamu agar katalog tokomu mulai terisi.";
      empty.append(title, message);
      productList.append(empty);
    } else {
      filteredProducts.forEach((product) => productList.append(createProductCard(product)));
    }

    if (productCount) {
      productCount.textContent = query
        ? `Menampilkan ${filteredProducts.length} dari ${products.length} produk`
        : `${products.length} produk dimuat (maks. 100 terbaru)`;
    }
    updateMetrics();
  };

  const loadProducts = async () => {
    if (loading) return;
    loading = true;
    if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = true;
    try {
      const data = await requestApi("/api/seller/products", { headers: apiHeaders(), cache: "no-store" });
      products = Array.isArray(data.products) ? data.products : [];
      renderProducts();
      if (updatedAt) {
        updatedAt.textContent = `Katalog diperbarui ${new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())}`;
      }
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        sessionStorage.removeItem("kurostore-authenticated");
        sessionStorage.removeItem("kurostore-access-token");
        sessionStorage.removeItem("kurostore-refresh-token");
        setAccessState("login");
      } else if (error instanceof Error && error.status === 403) {
        setAccessState("denied", "Akun ini belum memiliki role seller. Ajukan tokomu untuk mulai berjualan.");
      } else {
        setFeedback(error instanceof Error ? error.message : "Produk toko tidak dapat dimuat.");
      }
    } finally {
      if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = false;
      loading = false;
    }
  };

  const loadCategories = async () => {
    if (!(categoryInput instanceof HTMLSelectElement)) return;
    const data = await requestApi("/api/categories");
    if (!Array.isArray(data.categories)) return;
    data.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categoryInput.append(option);
    });
  };

  const openProductDialog = (product = null) => {
    if (!(dialog instanceof HTMLDialogElement)
      || !(productForm instanceof HTMLFormElement)
      || !(productIdInput instanceof HTMLInputElement)
      || !(nameInput instanceof HTMLInputElement)
      || !(descriptionInput instanceof HTMLTextAreaElement)
      || !(categoryInput instanceof HTMLSelectElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(stockInput instanceof HTMLInputElement)
      || !(statusInput instanceof HTMLSelectElement)) return;

    productForm.reset();
    if (dialogFeedback) dialogFeedback.textContent = "";
    productIdInput.value = product?.id || "";
    nameInput.value = product?.name || "";
    descriptionInput.value = product?.description || "";
    categoryInput.value = product?.category_id || "";
    priceInput.value = product ? String(product.price) : "";
    stockInput.value = product ? String(product.stock) : "";
    statusInput.value = product?.status === "active" ? "active" : "draft";
    if (dialogTitle) dialogTitle.textContent = product ? "Ubah produk" : "Tambah produk";
    if (saveButton instanceof HTMLButtonElement) saveButton.textContent = product ? "Simpan perubahan" : "Simpan produk";
    dialog.showModal();
    nameInput.focus();
  };

  const handleProductAction = async (button) => {
    const product = products.find((item) => item.id === button.dataset.productId);
    if (!product) {
      setFeedback("Produk yang dipilih tidak ditemukan. Muat ulang data toko.");
      return;
    }
    if (button.dataset.productAction === "edit") {
      openProductDialog(product);
      return;
    }
    if (button.dataset.productAction !== "archive"
      || !window.confirm(`Arsipkan "${product.name}"? Produk tidak akan tampil lagi di katalog.`)) return;

    button.disabled = true;
    setFeedback("");
    try {
      await requestApi("/api/seller/products", {
        method: "DELETE",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      setFeedback(`Produk "${product.name}" berhasil diarsipkan.`);
      await loadProducts();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Produk tidak dapat diarsipkan.");
      button.disabled = false;
    }
  };

  refreshButton?.addEventListener("click", () => {
    setFeedback("");
    void loadProducts();
  });
  workspace?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const viewButton = target.closest("[data-seller-view]");
    if (viewButton instanceof HTMLElement) setSellerView(viewButton.dataset.sellerView);
  });
  sellerDashboardPage.querySelector("#seller-add-product")?.addEventListener("click", () => openProductDialog());
  productSearch?.addEventListener("input", renderProducts);
  productList?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button[data-product-action]");
    if (button instanceof HTMLButtonElement) void handleProductAction(button);
  });

  productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(productForm instanceof HTMLFormElement)
      || !(productIdInput instanceof HTMLInputElement)
      || !(nameInput instanceof HTMLInputElement)
      || !(descriptionInput instanceof HTMLTextAreaElement)
      || !(categoryInput instanceof HTMLSelectElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(stockInput instanceof HTMLInputElement)
      || !(statusInput instanceof HTMLSelectElement)
      || !(saveButton instanceof HTMLButtonElement)) return;

    saveButton.disabled = true;
    if (dialogFeedback) dialogFeedback.textContent = "";
    const productId = productIdInput.value;
    try {
      await requestApi("/api/seller/products", {
        method: productId ? "PATCH" : "POST",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(productId ? { product_id: productId } : {}),
          name: nameInput.value,
          description: descriptionInput.value,
          category_id: categoryInput.value || null,
          price: Number(priceInput.value),
          stock: Number(stockInput.value),
          status: statusInput.value,
        }),
      });
      if (dialog instanceof HTMLDialogElement) dialog.close();
      setFeedback(productId ? "Perubahan produk berhasil disimpan." : "Produk berhasil ditambahkan.");
      await loadProducts();
    } catch (error) {
      if (dialogFeedback) {
        dialogFeedback.textContent = error instanceof Error ? error.message : "Produk tidak dapat disimpan.";
      }
    } finally {
      saveButton.disabled = false;
    }
  });

  document.querySelector("#seller-product-dialog-close")?.addEventListener("click", () => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  });
  document.querySelector("#seller-product-cancel")?.addEventListener("click", () => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  });

  const initialize = async () => {
    setSellerView("dashboard");
    if (!accessToken) {
      setAccessState("login");
      return;
    }

    try {
      const account = await requestApi("/api/auth/me", { headers: apiHeaders(), cache: "no-store" });
      const roles = Array.isArray(account.user?.roles) ? account.user.roles : [account.user?.role];
      if (!roles.includes("seller")) {
        setAccessState("denied", "Akun ini belum memiliki role seller. Ajukan tokomu untuk mulai berjualan.");
        return;
      }

      setAccessState("seller");
      try {
        await loadCategories();
      } catch (error) {
        setFeedback(error instanceof Error ? `Kategori tidak dapat dimuat: ${error.message}` : "Kategori tidak dapat dimuat.");
      }
      await loadProducts();
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        sessionStorage.removeItem("kurostore-authenticated");
        sessionStorage.removeItem("kurostore-access-token");
        sessionStorage.removeItem("kurostore-refresh-token");
        setAccessState("login");
      } else if (error instanceof Error && error.status === 403) {
        setAccessState("denied", "Akun ini belum memiliki akses ke Seller Center.");
      } else {
        setAccessState("denied", error instanceof Error ? error.message : "Akses seller tidak dapat diverifikasi.");
      }
    }
  };

  void initialize();
}
