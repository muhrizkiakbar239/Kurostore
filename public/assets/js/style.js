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
const cartStorageKey = "kurostore-cart";
const checkoutSelectionStorageKey = "kurostore-checkout-selection";
const shippingAddressStorageKey = "kurostore-shipping-address";

function readSavedShippingAddress() {
  const savedAddress = localStorage.getItem(shippingAddressStorageKey);
  if (!savedAddress) return null;

  const address = JSON.parse(savedAddress);
  if (!address || typeof address !== "object"
    || typeof address.name !== "string"
    || typeof address.phone !== "string"
    || typeof address.address !== "string"
    || typeof address.city !== "string"
    || typeof address.postalCode !== "string") {
    throw new Error("Format alamat tersimpan tidak valid.");
  }

  return address;
}

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "auto";
}

window.addEventListener("pageshow", (event) => {
  if (!event.persisted && window.location.hash === "#konten-utama") {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
});

const updateCartBadges = () => {
  let itemCount = 0;
  try {
    const savedCart = window.localStorage.getItem(cartStorageKey);
    const cartItems = savedCart ? JSON.parse(savedCart) : [];
    if (!Array.isArray(cartItems)) throw new Error("Format keranjang tidak valid.");
    itemCount = cartItems.reduce((total, item) =>
      total + (Number.isInteger(item?.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
  } catch (error) {
    console.error("Unable to read cart item count:", error);
    document.querySelectorAll(".cart-count").forEach((badge) => {
      badge.textContent = "!";
      badge.setAttribute("aria-label", "Keranjang tidak dapat dibaca");
    });
    return;
  }

  document.querySelectorAll(".cart-count").forEach((badge) => {
    badge.textContent = String(itemCount);
    badge.setAttribute("aria-label", `${itemCount} barang di keranjang`);
  });
};

updateCartBadges();
window.addEventListener("storage", (event) => {
  if (event.key === cartStorageKey) updateCartBadges();
});

async function requestApi(url, options = {}) {
  const response = await fetch(url, options);
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

document.querySelectorAll("[data-search-category]").forEach((categoryLink) => {
  categoryLink.addEventListener("click", () => {
    const searchInput = document.querySelector("#site-search");
    if (searchInput instanceof HTMLInputElement) {
      searchInput.value = categoryLink.dataset.searchCategory || "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
});

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
  let hasCartAccess = accountIsAuthenticated
    || cartPage.dataset.authenticated === "true"
    || sessionStorage.getItem("kurostore-guest-session") === "true";
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

  const setCartAccess = (guest = false) => {
    hasCartAccess = true;
    if (guest) sessionStorage.setItem("kurostore-guest-session", "true");
    if (lockedView) lockedView.hidden = true;
    if (cartContent) cartContent.hidden = false;
    if (guestNotice) guestNotice.hidden = !guest;
  };

  const parseCart = (value) => {
    if (!Array.isArray(value)) throw new Error("Data keranjang tidak valid.");
    const validItems = value.every((item) =>
      item
      && typeof item.productId === "string"
      && typeof item.name === "string"
      && Number.isFinite(item.price)
      && item.price > 0
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && Number.isInteger(item.stock)
      && item.stock >= 0);
    if (!validItems) throw new Error("Data barang di keranjang tidak valid.");
    return value;
  };

  const saveCart = () => {
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      updateCartBadges();
      return true;
    } catch (error) {
      console.error("Unable to save shopping cart:", error);
      setCartFeedback("Perubahan keranjang tidak dapat disimpan di browser ini.");
      return false;
    }
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

      const artwork = document.createElement("span");
      artwork.className = "cart-item-art";
      artwork.setAttribute("aria-hidden", "true");
      artwork.innerHTML = '<svg viewBox="0 0 24 24"><path d="m3.5 7 8.5-4 8.5 4v10l-8.5 4-8.5-4V7Z"></path><path d="m3.8 7.2 8.2 4 8.2-4M12 11.2V21"></path></svg>';

      const product = document.createElement("div");
      product.className = "cart-item-product";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const price = document.createElement("span");
      price.textContent = `${formatPrice(item.price)} / item`;
      product.append(name, price);

      const quantity = document.createElement("div");
      quantity.className = "cart-quantity-control";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.textContent = "−";
      decrease.disabled = item.quantity <= 1;
      decrease.setAttribute("aria-label", `Kurangi jumlah ${item.name}`);
      decrease.dataset.cartQuantity = "decrease";
      decrease.dataset.productId = item.productId;
      const quantityValue = document.createElement("span");
      quantityValue.textContent = String(item.quantity);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.textContent = "+";
      increase.disabled = item.quantity >= item.stock;
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

    const selectedItems = cartItems.filter((item) => selectedProductIds.has(item.productId));
    const selectedQuantity = selectedItems.reduce((total, item) => total + item.quantity, 0);
    const selectedTotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
    if (selectedCount) selectedCount.textContent = `${selectedQuantity} barang`;
    if (cartTotal) cartTotal.textContent = formatPrice(selectedTotal);
    if (selectAll instanceof HTMLInputElement) {
      selectAll.checked = hasItems && selectedProductIds.size === cartItems.length;
      selectAll.indeterminate = selectedProductIds.size > 0 && !selectAll.checked;
    }
    if (removeSelected instanceof HTMLButtonElement) {
      removeSelected.disabled = selectedProductIds.size === 0;
    }
    if (checkoutButton instanceof HTMLButtonElement) {
      checkoutButton.disabled = selectedProductIds.size === 0;
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cart-add-button";
      button.textContent = product.stock > 0 ? "Tambah ke keranjang" : "Stok habis";
      button.disabled = product.stock <= 0;
      button.dataset.addCartProduct = product.id;
      card.append(artwork, name, price, button);
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

  try {
    const savedCart = window.localStorage.getItem(cartStorageKey);
    cartItems = savedCart ? parseCart(JSON.parse(savedCart)) : [];
  } catch (error) {
    console.error("Unable to load shopping cart:", error);
    setCartFeedback("Keranjang tidak dapat dibaca. Coba hapus data situs atau buka kembali halaman.");
  }
  selectedProductIds = new Set(cartItems.map((item) => item.productId));

  if (hasCartAccess) {
    setCartAccess(sessionStorage.getItem("kurostore-guest-session") === "true");
  }
  renderCart();
  void loadRecommendations();

  cartItemList?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.cartSelect) return;
    if (target.checked) selectedProductIds.add(target.dataset.cartSelect);
    else selectedProductIds.delete(target.dataset.cartSelect);
    renderCart();
  });

  selectAll?.addEventListener("change", () => {
    selectedProductIds = selectAll.checked
      ? new Set(cartItems.map((item) => item.productId))
      : new Set();
    renderCart();
  });

  cartItemList?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const removeButton = event.target.closest("[data-cart-remove]");
    const quantityButton = event.target.closest("[data-cart-quantity]");
    if (removeButton) {
      const productId = removeButton.dataset.cartRemove;
      cartItems = cartItems.filter((item) => item.productId !== productId);
      selectedProductIds.delete(productId);
      saveCart();
      renderCart();
      return;
    }
    if (quantityButton) {
      const productId = quantityButton.dataset.productId;
      const item = cartItems.find((cartItem) => cartItem.productId === productId);
      if (!item) return;
      item.quantity += quantityButton.dataset.cartQuantity === "increase" ? 1 : -1;
      item.quantity = Math.max(1, Math.min(item.quantity, item.stock));
      saveCart();
      renderCart();
    }
  });

  removeSelected?.addEventListener("click", () => {
    cartItems = cartItems.filter((item) => !selectedProductIds.has(item.productId));
    selectedProductIds.clear();
    saveCart();
    renderCart();
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

    const existingItem = cartItems.find((item) => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        setCartFeedback("Jumlah barang di keranjang sudah mencapai batas stok.");
        return;
      }
      existingItem.quantity += 1;
      existingItem.stock = product.stock;
    } else {
      cartItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
      });
    }

    if (!hasCartAccess) {
      setCartAccess(true);
      setCartFeedback("Produk ditambahkan. Kamu menggunakan keranjang tamu di browser ini.");
    } else {
      setCartFeedback(`${product.name} ditambahkan ke keranjang.`);
    }
    selectedProductIds.add(product.id);
    saveCart();
    renderCart();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== cartStorageKey) return;
    try {
      cartItems = event.newValue ? parseCart(JSON.parse(event.newValue)) : [];
      selectedProductIds = new Set(cartItems.map((item) => item.productId));
      renderCart();
    } catch (error) {
      console.error("Unable to synchronize shopping cart:", error);
      setCartFeedback("Perubahan keranjang dari tab lain tidak dapat dibaca.");
    }
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
  const payButton = checkoutPage.querySelector("#checkout-pay");
  const resultPanel = checkoutPage.querySelector("#checkout-result");
  const resultTitle = checkoutPage.querySelector("#checkout-result-title");
  const resultMessage = checkoutPage.querySelector("#checkout-result-message");
  const loginLink = checkoutPage.querySelector("#checkout-login-link");
  let selectedIds = new Set();
  let cartItems = [];
  let selectedItems = [];

  const setFeedback = (message) => {
    if (feedback) feedback.textContent = message;
  };

  try {
    const savedSelection = JSON.parse(sessionStorage.getItem(checkoutSelectionStorageKey) || "[]");
    if (Array.isArray(savedSelection)) {
      selectedIds = new Set(savedSelection.filter((id) => typeof id === "string"));
    }
  } catch (error) {
    console.error("Unable to read checkout selection:", error);
    setFeedback("Pilihan produk tidak dapat dibaca. Kembali ke keranjang dan pilih ulang.");
  }

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

  try {
    const savedCart = localStorage.getItem(cartStorageKey);
    const parsedCart = savedCart ? JSON.parse(savedCart) : [];
    if (!Array.isArray(parsedCart)) throw new Error("Format keranjang tidak valid.");
    cartItems = parsedCart.filter((item) =>
      item
      && typeof item.productId === "string"
      && typeof item.name === "string"
      && Number.isFinite(item.price)
      && item.price > 0
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && Number.isInteger(item.stock)
      && item.stock >= item.quantity);
    selectedItems = cartItems.filter((item) => selectedIds.has(item.productId));
  } catch (error) {
    console.error("Unable to load checkout cart:", error);
    setFeedback("Keranjang tidak dapat dibaca. Kembali ke keranjang dan coba lagi.");
  }

  if (selectedItems.length === 0) {
    if (emptyState) emptyState.hidden = false;
    sessionStorage.removeItem(checkoutSelectionStorageKey);
  } else {
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
    if (quantityElement) quantityElement.textContent = `${itemQuantity} barang`;
    if (totalElement) totalElement.textContent = formatPrice(total);
    const productsTotalElement = checkoutPage.querySelector("#checkout-products-total");
    const payableTotalElement = checkoutPage.querySelector("#checkout-payable-total");
    if (productsTotalElement) productsTotalElement.textContent = formatPrice(total);
    if (payableTotalElement) payableTotalElement.textContent = formatPrice(total);

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
    try {
      const savedAddress = readSavedShippingAddress();
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
    } catch (error) {
      console.error("Unable to read saved shipping address:", error);
      setFeedback("Alamat tersimpan tidak dapat dibaca. Periksa kembali alamat di Pengaturan & Akun.");
    }
  }

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

    payButton.disabled = true;
    setFeedback("Menyiapkan pembayaran Midtrans…");

    try {
      const paymentConfig = await requestApi("/api/payments/config");
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
        }),
      });

      if (!payment.token || !payment.redirectUrl) {
        throw new Error("Token pembayaran tidak diterima dari server.");
      }

      const snap = await loadMidtransSnap(paymentConfig.clientKey, paymentConfig.environment);
      setFeedback("Selesaikan pembayaran di popup Midtrans.");
      snap.pay(payment.token, {
        onSuccess: (result) => {
          try {
            const latestCart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
            if (!Array.isArray(latestCart)) throw new Error("Format keranjang tidak valid.");
            const remainingItems = latestCart.filter((item) => !selectedIds.has(item?.productId));
            localStorage.setItem(cartStorageKey, JSON.stringify(remainingItems));
            updateCartBadges();
          } catch (error) {
            console.error("Unable to clear paid items from cart:", error);
            showResult("Pembayaran berhasil", "Pembayaran terkonfirmasi, tetapi keranjang tidak dapat diperbarui. Kamu bisa menghapus barang yang sudah dibayar secara manual.");
            sessionStorage.removeItem(checkoutSelectionStorageKey);
            return;
          }
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
  const feedback = allProductsPage.querySelector("#all-products-feedback");
  const emptyState = allProductsPage.querySelector("#all-products-empty");
  const emptyTitle = allProductsPage.querySelector("#all-products-empty-title");
  const emptyMessage = allProductsPage.querySelector("#all-products-empty-message");
  const loadMoreButton = allProductsPage.querySelector("#all-products-load-more");
  const productsPageSize = 24;
  let categoriesById = new Map();
  let loadedProducts = [];
  let totalProducts = 0;
  let currentPage = 0;
  let requestSequence = 0;
  let activeRequestController = null;
  let searchTimer = null;
  let isLoading = false;

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
      const bottom = document.createElement("div");
      bottom.className = "product-card-bottom";
      const price = document.createElement("strong");
      price.textContent = formatProductPrice(product.price);
      const stock = document.createElement("span");
      stock.textContent = product.stock > 0 ? `Stok ${product.stock}` : "Stok habis";
      bottom.append(price, stock);

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "all-product-add-button";
      addButton.textContent = product.stock > 0 ? "Tambah ke keranjang" : "Stok habis";
      addButton.disabled = product.stock <= 0;
      addButton.dataset.addCartProduct = product.id;

      copy.append(category, name, description, bottom, addButton);
      card.append(artwork, copy);
      productGrid.append(card);
    });

    if (resultCount) {
      const searchTerm = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : "";
      resultCount.textContent = searchTerm
        ? `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk ditemukan`
        : `${new Intl.NumberFormat("id-ID").format(totalProducts)} produk tersedia`;
    }

    const hasProducts = loadedProducts.length > 0;
    if (emptyState) emptyState.hidden = hasProducts;
    if (emptyTitle) emptyTitle.textContent = searchInput?.value.trim()
      ? "Produk tidak ditemukan"
      : "Produk belum tersedia";
    if (emptyMessage) emptyMessage.textContent = searchInput?.value.trim()
      ? "Coba kata pencarian lain."
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

    setFeedback("");
    if (!append) {
      if (resultCount && loadedProducts.length === 0) resultCount.textContent = "Memuat produk…";
      if (emptyState && loadedProducts.length === 0) emptyState.hidden = true;
      if (productGrid instanceof HTMLElement) {
        productGrid.classList.add("is-loading");
        productGrid.setAttribute("aria-busy", "true");
      }
    }
    if (loadMoreButton instanceof HTMLButtonElement) loadMoreButton.disabled = true;

    let requestFailed = false;
    try {
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
      }
    }
  };

  const loadCategories = async () => {
    try {
      const result = await requestApi("/api/categories");
      if (!Array.isArray(result.categories)) {
        throw new Error("Data kategori tidak valid.");
      }
      categoriesById = new Map(result.categories
        .filter((category) => typeof category.id === "string" && typeof category.name === "string")
        .map((category) => [category.id, category.name]));
      productGrid?.querySelectorAll("[data-product-category-id]").forEach((categoryLabel) => {
        categoryLabel.textContent = categoriesById.get(categoryLabel.dataset.productCategoryId) || "Semua kategori";
      });
    } catch (error) {
      console.error("Unable to load category labels:", error);
    }
  };

  const addProductToCart = (product) => {
    let cartItems = [];
    try {
      const savedCart = window.localStorage.getItem(cartStorageKey);
      const parsedCart = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(parsedCart)) throw new Error("Format keranjang tidak valid.");
      cartItems = parsedCart;
    } catch (error) {
      console.error("Unable to read shopping cart:", error);
      setFeedback("Keranjang tidak dapat dibaca. Coba muat ulang halaman.");
      return;
    }

    const existingItem = cartItems.find((item) => item?.productId === product.id);
    if (existingItem) {
      if (!Number.isInteger(existingItem.quantity) || existingItem.quantity >= product.stock) {
        setFeedback("Jumlah barang di keranjang sudah mencapai batas stok.");
        return;
      }
      existingItem.quantity += 1;
      existingItem.stock = product.stock;
      existingItem.name = product.name;
      existingItem.price = product.price;
    } else {
      cartItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
      });
    }

    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      updateCartBadges();
      if (!accountIsAuthenticated) {
        sessionStorage.setItem("kurostore-guest-session", "true");
      }
      setFeedback(`${product.name} ditambahkan ke keranjang.`);
    } catch (error) {
      console.error("Unable to save shopping cart:", error);
      setFeedback("Produk tidak dapat ditambahkan karena keranjang gagal disimpan.");
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
    }
    searchTimer = window.setTimeout(() => {
      void loadProducts();
    }, 250);
  });
  sortSelect?.addEventListener("change", () => {
    void loadProducts();
  });
  loadMoreButton?.addEventListener("click", () => {
    void loadProducts({ append: true });
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
    if (filtersChanged) void loadProducts();
  });
  document.addEventListener("kurostore:restore-catalog", () => {
    const urlSearch = new URLSearchParams(window.location.search).get("q") || "";
    let filtersChanged = false;
    if (searchInput instanceof HTMLInputElement && searchInput.value !== urlSearch) {
      searchInput.value = urlSearch;
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
    if (filtersChanged) void loadProducts();
  });
  productGrid?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-add-cart-product]");
    const product = loadedProducts.find((item) => item.id === button?.dataset.addCartProduct);
    if (product && product.stock > 0) addProductToCart(product);
  });

  void loadCategories();
  void loadProducts();
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
  const wishlistStorageNotice = productsPage.querySelector("#wishlist-storage-notice");

  if (wishlistGrid && wishlistCount && wishlistEmpty && wishlistStorageNotice) {
    const wishlistStorageKey = "kurostore-wishlist";
    let wishlist = new Set();
    let storageAvailable = true;

    const showStorageNotice = () => {
      wishlistStorageNotice.hidden = false;
    };

    try {
      const savedWishlist = window.localStorage.getItem(wishlistStorageKey);
      if (savedWishlist) {
        const parsedWishlist = JSON.parse(savedWishlist);
        if (Array.isArray(parsedWishlist) && parsedWishlist.every((item) => typeof item === "string")) {
          wishlist = new Set(parsedWishlist);
        } else {
          showStorageNotice();
        }
      }
    } catch {
      storageAvailable = false;
      showStorageNotice();
    }

    const saveWishlist = () => {
      if (!storageAvailable) {
        return;
      }

      try {
        window.localStorage.setItem(wishlistStorageKey, JSON.stringify(Array.from(wishlist)));
      } catch {
        storageAvailable = false;
        showStorageNotice();
      }
    };

    const renderWishlist = () => {
      wishlistGrid.replaceChildren();

      wishlist.forEach((productId) => {
        const title = productId
          .replace(/[-_]+/g, " ")
          .split(/\s+/)
          .map((word) => word.charAt(0).toLocaleUpperCase("id") + word.slice(1))
          .join(" ");
        const card = document.createElement("article");
        card.className = "product-card wishlist-item";
        card.dataset.wishlistItem = productId;

        const copy = document.createElement("div");
        copy.className = "product-card-copy";

        const label = document.createElement("span");
        label.className = "product-card-category";
        label.textContent = "Tersimpan";

        const name = document.createElement("h3");
        name.textContent = title;

        const removeButton = document.createElement("button");
        removeButton.className = "wishlist-remove";
        removeButton.type = "button";
        removeButton.textContent = "Hapus dari Wishlist";
        removeButton.setAttribute("aria-label", `Hapus ${title} dari wishlist`);

        copy.append(label, name, removeButton);
        card.append(copy);
        wishlistGrid.append(card);
      });

      wishlistCount.textContent = `${wishlistGrid.children.length} produk tersimpan`;
      wishlistEmpty.hidden = wishlistGrid.children.length > 0;
    };

    productsPage.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".wishlist-remove");
      const productId = removeButton?.closest("[data-wishlist-item]")?.dataset.wishlistItem;
      if (!productId) {
        return;
      }

      wishlist.delete(productId);
      saveWishlist();
      renderWishlist();
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== wishlistStorageKey) {
        return;
      }

      try {
        const parsedWishlist = event.newValue ? JSON.parse(event.newValue) : [];
        if (!Array.isArray(parsedWishlist) || !parsedWishlist.every((item) => typeof item === "string")) {
          showStorageNotice();
          return;
        }
        wishlist = new Set(parsedWishlist);
        renderWishlist();
      } catch {
        showStorageNotice();
      }
    });

    renderWishlist();
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
  const placeholderPanel = accountPage.querySelector("#account-placeholder-panel");
  const placeholderTitle = accountPage.querySelector("#account-placeholder-title");
  const placeholderDescription = accountPage.querySelector("#account-placeholder-description");
  const ordersPanel = accountPage.querySelector("#account-orders-panel");
  const ordersList = accountPage.querySelector("#account-orders-list");
  const ordersFeedback = accountPage.querySelector("#account-orders-feedback");
  const ordersEmpty = accountPage.querySelector("#account-orders-empty");
  const ordersLoginLink = accountPage.querySelector("#account-orders-login-link");
  const panelButtons = Array.from(accountPage.querySelectorAll("[data-account-panel]"));
  const logoutButton = accountPage.querySelector("#account-logout");
  const logoutLabel = accountPage.querySelector("#account-logout-label");

  const renderAccountCart = () => {
    if (!(accountCartItems instanceof HTMLElement)) return;
    accountCartItems.replaceChildren();
    if (accountCartFeedback) accountCartFeedback.textContent = "";

    try {
      const savedCart = localStorage.getItem(cartStorageKey);
      const cart = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(cart)) throw new Error("Format keranjang tidak valid.");

      const validItems = cart.filter((item) =>
        item
        && typeof item.productId === "string"
        && typeof item.name === "string"
        && Number.isFinite(item.price)
        && item.price > 0
        && Number.isInteger(item.quantity)
        && item.quantity > 0
        && Number.isInteger(item.stock)
        && item.stock >= 0);
      if (validItems.length !== cart.length) {
        throw new Error("Sebagian data produk di keranjang tidak valid.");
      }

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
        unitPrice.textContent = `${formatPrice(item.price)} / item`;
        details.append(name, unitPrice);

        const quantity = document.createElement("span");
        quantity.className = "account-cart-item-quantity";
        quantity.textContent = `x${numberFormat.format(item.quantity)}`;

        const subtotal = document.createElement("strong");
        subtotal.className = "account-cart-item-subtotal";
        subtotal.textContent = formatPrice(item.price * item.quantity);

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

  renderAccountCart();
  window.addEventListener("storage", (event) => {
    if (event.key === cartStorageKey || event.key === null) renderAccountCart();
  });
  window.addEventListener("pageshow", renderAccountCart);

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

    try {
      const savedAddress = readSavedShippingAddress();
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
    } catch (error) {
      console.error("Unable to load saved shipping address:", error);
      if (addressFeedback) addressFeedback.textContent = "Alamat tersimpan tidak dapat dibaca. Periksa penyimpanan browser.";
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

  profileForm?.addEventListener("submit", (event) => {
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

    if (accountSidebarName) {
      accountSidebarName.textContent = name;
    }
    if (accountSidebarEmail) {
      accountSidebarEmail.textContent = email || (accountIsAuthenticated ? "Email belum tersedia" : "Sesi tamu lokal");
    }
    profileFeedback.textContent = "Perubahan berhasil disimpan di sesi browser ini.";
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

    try {
      localStorage.setItem(shippingAddressStorageKey, JSON.stringify(address));
      addressFeedback.textContent = "Alamat berhasil disimpan dan akan terisi otomatis saat checkout.";
    } catch (error) {
      console.error("Unable to save shipping address:", error);
      addressFeedback.textContent = "Alamat tidak dapat disimpan. Periksa ruang penyimpanan browser dan coba lagi.";
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
        status.textContent = paymentLabels[order.paymentStatus] || "Status diperbarui";
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
          itemList.append(itemRow);
        });

        const total = document.createElement("div");
        total.className = "account-order-total";
        const totalLabel = document.createElement("span");
        totalLabel.textContent = "Total";
        const totalAmount = document.createElement("strong");
        totalAmount.textContent = formatPrice(order.total);
        total.append(totalLabel, totalAmount);
        card.append(heading, itemList, total);
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

  panelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const isProfile = button.dataset.accountPanel === "profile";
      const isAddress = button.dataset.accountPanel === "address";
      const isOrders = button.dataset.accountPanel === "orders";
      panelButtons.forEach((panelButton) => {
        const isActive = panelButton === button;
        panelButton.classList.toggle("is-active", isActive);
        if (isActive) {
          panelButton.setAttribute("aria-current", "page");
        } else {
          panelButton.removeAttribute("aria-current");
        }
      });

      if (profilePanel && addressPanel && ordersPanel && placeholderPanel) {
        profilePanel.hidden = !isProfile;
        addressPanel.hidden = !isAddress;
        ordersPanel.hidden = !isOrders;
        placeholderPanel.hidden = isProfile || isAddress || isOrders;
      }

      if (isOrders) {
        void loadAccountOrders();
      } else if (!isProfile && !isAddress && placeholderTitle && placeholderDescription) {
        placeholderTitle.textContent = button.dataset.panelTitle || "Pengaturan akun";
        placeholderDescription.textContent = button.dataset.panelDescription || "Pengaturan ini akan tersedia nanti.";
      }
    });
  });

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
        src: "../images/kurostore.png",
        alt: "Logo Kurostore",
        caption: "Belanja lebih mudah",
      },
      {
        src: "../images/diskon-50.png",
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
