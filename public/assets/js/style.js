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
const productDetailPage = document.querySelector("#product-detail-page");
const accountPage = document.querySelector("#account-page");
const productsPage = document.querySelector("#products-page");
const billsCarousel = document.querySelector("#bills-carousel");
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

const appendProductImage = (container, imageUrl, alt) => {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) return null;

  let url;
  try {
    url = new URL(imageUrl, window.location.origin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.origin !== window.location.origin) return null;

  const image = document.createElement("img");
  image.className = "product-photo";
  image.src = url.href;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  container.classList.add("has-product-image");
  image.addEventListener("error", () => {
    image.remove();
    container.classList.remove("has-product-image");
  }, { once: true });
  container.append(image);
  return image;
};

const productDetailHref = (productId, fromPage = false) =>
  `${fromPage ? "" : "pages/"}detail-produk.html?id=${encodeURIComponent(productId)}`;

const enableProductCardNavigation = (card, productId, fromPage = false) => {
  const href = productDetailHref(productId, fromPage);
  card.classList.add("product-card-clickable");
  card.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || event.target.closest("a, button")) return;
    window.location.href = href;
  });
};

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
  const translations = {
    id: {},
    en: {
      "Kurostore, kembali ke beranda": "Kurostore, back to home",
      "Kembali ke beranda": "Back to home",
      "Pengaturan dan informasi akun Kurostore.": "Kurostore account settings and information.",
      "Seller Center": "Seller Center",
      "Dashboard Admin": "Admin Dashboard",
      "AREA AKUN": "ACCOUNT ACCESS",
      "Masuk untuk membuka pengaturan akun": "Sign in to open your account settings",
      "Pengaturan dan informasi akun hanya tersedia setelah kamu masuk ke Kurostore.": "Account settings and information are available after you sign in to Kurostore.",
      "Masuk ke akun": "Sign in",
      "Belum punya akun?": "Don't have an account?",
      "Daftar sekarang": "Create an account",
      "PUSAT AKUN": "ACCOUNT CENTER",
      "Pengaturan & Akun": "Settings & Account",
      "Kelola akun dan jelajahi fitur Kurostore.": "Manage your account and explore Kurostore features.",
      "AKUN DAN PREFERENSI": "ACCOUNT AND PREFERENCES",
      "Pengaturan umum": "General settings",
      "Navigasi akun": "Account navigation",
      "Pengaturan akun": "Account settings",
      "Akun saya": "My account",
      "Profil": "Profile",
      "Bank & Kartu": "Bank & Cards",
      "Alamat": "Address",
      "Ubah Password": "Change password",
      "Notifikasi": "Notifications",
      "Privasi": "Privacy",
      "Preferensi": "Preferences",
      "Bahasa": "Language",
      "Tema": "Theme",
      "Aktivitas": "Activity",
      "Seller": "Seller",
      "Seller Center": "Seller Center",
      "Administrasi": "Administration",
      "Tamu": "Guest",
      "Sesi tamu lokal": "Local guest session",
      "Email belum tersedia": "Email unavailable",
      "Pengguna Kurostore": "Kurostore user",
      "Keranjang Saya": "My cart",
      "Pesanan Saya": "My orders",
      "Voucher & Poin": "Vouchers & Points",
      "Keluar dari akun": "Sign out",
      "Akhiri sesi tamu": "End guest session",
      "Profil saya": "My profile",
      "Kelola informasi profil untuk pengalaman belanja yang lebih personal.": "Manage your profile information for a more personalized shopping experience.",
      "Nama": "Name",
      "Email": "Email",
      "Nomor telepon": "Phone number",
      "Tambahkan nomor telepon": "Add a phone number",
      "Simpan perubahan": "Save changes",
      "Nama dan nomor telepon disimpan ke akun. Email login belum dapat diubah dari halaman ini.": "Your name and phone number are saved to your account. Your login email can't be changed here.",
      "Alamat pengiriman": "Shipping address",
      "Simpan alamat utama agar detail penerima terisi otomatis saat checkout.": "Save your primary address to automatically fill in recipient details at checkout.",
      "Nama penerima": "Recipient name",
      "Alamat lengkap": "Full address",
      "Kota / Kabupaten": "City / region",
      "Kode pos": "Postal code",
      "Simpan alamat": "Save address",
      "Alamat disimpan di akunmu dan akan terisi otomatis saat checkout.": "Your address is saved to your account and will be filled in automatically at checkout.",
      "Lihat status pembayaran dan rincian pesananmu.": "View your payment status and order details.",
      "Masuk ke akun untuk melihat pesanan": "Sign in to view your orders",
      "Belum ada pesanan": "No orders yet",
      "Pesanan yang dibuat akan muncul di sini.": "Your orders will appear here.",
      "Mulai belanja": "Start shopping",
      "Pilih metode yang akan diprioritaskan saat checkout. Data kartu dan rekening tidak disimpan di Kurostore.": "Choose the payment method to prioritize at checkout. Kurostore does not store card or bank account details.",
      "Metode pembayaran utama": "Preferred payment method",
      "Semua metode di Midtrans": "All Midtrans methods",
      "E-wallet": "E-wallet",
      "Virtual account / transfer bank": "Virtual account / bank transfer",
      "Kartu debit / kredit": "Debit / credit card",
      "Saldo KuroPay demo (sandbox)": "KuroPay demo balance (sandbox)",
      "Simpan metode": "Save payment method",
      "Pilihan ini hanya mengatur metode checkout. Nomor kartu, CVV, PIN, dan rekening tidak pernah disimpan.": "This only sets your preferred checkout method. Card numbers, CVVs, PINs, and bank details are never stored.",
      "KuroPay demo": "KuroPay demo",
      "Saldo ini hanya untuk simulasi Midtrans sandbox, bukan uang sungguhan dan tidak bisa dicairkan.": "This balance is for Midtrans sandbox simulations only. It is not real money and cannot be withdrawn.",
      "Saldo demo": "Demo balance",
      "Memeriksa mode pembayaran...": "Checking payment mode...",
      "Nominal top up demo": "Demo top-up amount",
      "Top up lewat sandbox": "Top up via sandbox",
      "Riwayat saldo": "Balance history",
      "Ubah Password": "Change password",
      "Masukkan kata sandi saat ini untuk mengonfirmasi perubahan.": "Enter your current password to confirm the change.",
      "Password saat ini": "Current password",
      "Password baru": "New password",
      "Ulangi password baru": "Confirm new password",
      "Perbarui password": "Update password",
      "Pengaturan Notifikasi": "Notification settings",
      "Pilih apakah Kurostore boleh mengirim email transaksi tentang status pesanan dan pembayaran.": "Choose whether Kurostore can send transaction emails about order and payment status.",
      "Email status pesanan": "Order status emails",
      "Hanya email transaksi, bukan promosi.": "Transaction emails only, not promotions.",
      "Simpan notifikasi": "Save notification settings",
      "Email memerlukan konfigurasi Resend dan domain pengirim terverifikasi.": "Email requires Resend configuration and a verified sender domain.",
      "Privasi & data akun": "Privacy & account data",
      "Unduh salinan data profil, alamat, pesanan, ulasan, keranjang, preferensi, dan saldo demo yang tersimpan di akunmu.": "Download a copy of the profile, address, orders, reviews, cart, preferences, and demo balance data stored in your account.",
      "Unduh data saya": "Download my data",
      "File unduhan hanya berisi data akunmu. Kata sandi, token sesi, dan rahasia pembayaran tidak pernah disertakan.": "The download contains only your account data. Passwords, session tokens, and payment secrets are never included.",
      "Pilih bahasa untuk seluruh tampilan halaman Pengaturan & Akun.": "Choose the language for the entire Kurostore website.",
      "Simpan bahasa": "Save language",
      "Bahasa Indonesia": "Indonesian",
      "English": "English",
      "Atur tampilan situs agar nyaman digunakan.": "Adjust the appearance for a more comfortable experience.",
      "Tampilan": "Appearance",
      "Terang": "Light",
      "Gelap": "Dark",
      "Simpan tema": "Save theme",
      "Voucher & Poin": "Vouchers & Points",
      "Poin demo diperoleh dari pesanan sandbox yang berhasil dibayar. Poin tidak kedaluwarsa.": "Demo points are earned from successfully paid sandbox orders. Points do not expire.",
      "Poin tersedia": "Available points",
      "100 poin = diskon Rp1.000 saat checkout. Minimal pesanan Rp5.000 untuk mendapat 100 poin.": "100 points = Rp1,000 off at checkout. Orders must be at least Rp5,000 to earn 100 points.",
      "Riwayat poin": "Points history",
      "Belum ada voucher": "No vouchers yet",
      "Kode voucher hanya akan tampil jika diterbitkan resmi oleh Kurostore. Tidak ada voucher contoh yang dapat digunakan.": "Vouchers appear only when officially issued by Kurostore. No sample vouchers are available to use.",
      "BELANJA KAMU": "YOUR SHOPPING",
      "Isi keranjang": "Cart contents",
      "Memeriksa keranjang belanjamu…": "Checking your cart…",
      "Buka keranjang": "Open cart",
      "Keranjangmu masih kosong": "Your cart is empty",
      "Produk yang kamu tambahkan akan muncul di sini.": "Products you add will appear here.",
      "Cari produk": "Find products",
      "Masuk untuk menyimpan dan melihat keranjang.": "Sign in to save and view your cart.",
      "Belum ada produk di keranjang.": "There are no products in your cart yet.",
      "Keranjang tidak dapat dibaca.": "Your cart could not be loaded.",
      "Isi keranjang tidak dapat ditampilkan.": "Cart contents could not be displayed.",
      "Memuat saldo demo...": "Loading demo balance...",
      "Masuk ke akun untuk menggunakan saldo demo KuroPay.": "Sign in to use your KuroPay demo balance.",
      "Saldo demo hanya tersedia untuk akun yang masuk.": "The demo balance is available only to signed-in accounts.",
      "Mode sandbox aktif · simulasi saja, bukan uang sungguhan": "Sandbox mode is active · simulation only, not real money",
      "Mode produksi aktif · fitur saldo demo dinonaktifkan": "Production mode is active · demo balance is disabled",
      "Belum ada riwayat poin.": "No points history yet.",
      "Belum ada transaksi saldo demo.": "No demo balance transactions yet.",
      "Masuk ke akun terlebih dahulu untuk menyimpan data.": "Sign in to save your data.",
      "Profil akun tidak dapat dimuat.": "Your account profile could not be loaded.",
      "Profil akun tidak dapat disimpan.": "Your account profile could not be saved.",
      "Preferensi akun tidak dapat dimuat.": "Account preferences could not be loaded.",
      "Preferensi akun tidak dapat disimpan.": "Account preferences could not be saved.",
      "Alamat tersimpan tidak dapat dimuat.": "Your saved address could not be loaded.",
      "Alamat tidak dapat disimpan.": "Your address could not be saved.",
      "Profil berhasil disimpan ke akunmu.": "Your profile has been saved to your account.",
      "Profil tersimpan di sesi browser ini.": "Your profile is saved in this browser session.",
      "Nama tidak boleh kosong.": "Name is required.",
      "Lengkapi semua detail alamat sebelum menyimpan.": "Complete all address details before saving.",
      "Masuk ke akun terlebih dahulu untuk menyimpan alamat.": "Sign in to save your address.",
      "Alamat tersimpan di akunmu dan akan terisi otomatis saat checkout.": "Your address is saved to your account and will be filled in automatically at checkout.",
      "Metode pembayaran utama berhasil disimpan.": "Your preferred payment method has been saved.",
      "Metode pembayaran tidak dapat disimpan.": "Your payment method could not be saved.",
      "Masuk ke akun terlebih dahulu untuk mengubah password.": "Sign in to change your password.",
      "Konfirmasi password baru tidak cocok.": "The new passwords do not match.",
      "Password baru harus memiliki 8–128 karakter.": "The new password must be 8–128 characters long.",
      "Password berhasil diperbarui.": "Your password has been updated.",
      "Password tidak dapat diperbarui.": "Your password could not be updated.",
      "Preferensi notifikasi berhasil disimpan.": "Your notification preferences have been saved.",
      "Preferensi notifikasi tidak dapat disimpan.": "Your notification preferences could not be saved.",
      "Preferensi tersimpan. Email belum terkirim sampai Resend dikonfigurasi di Vercel.": "Preferences saved. Emails won't be sent until Resend is configured in Vercel.",
      "Email transaksi aktif setelah alamat pengirim Resend diverifikasi.": "Transaction emails are active after the Resend sender address is verified.",
      "Pilihan akan tersimpan. Pengiriman email aktif setelah RESEND_API_KEY dan RESEND_FROM_EMAIL dikonfigurasi di Vercel.": "Your choice will be saved. Email delivery requires RESEND_API_KEY and RESEND_FROM_EMAIL to be configured in Vercel.",
      "Notifikasi transaksi memerlukan akun yang sudah masuk.": "Transaction notifications require a signed-in account.",
      "Bahasa Pengaturan & Akun berhasil diperbarui.": "The Settings & Account language has been updated.",
      "Bahasa tidak dapat disimpan.": "Your language preference could not be saved.",
      "Tema berhasil diperbarui.": "Your theme has been updated.",
      "Tema tidak dapat disimpan.": "Your theme could not be saved.",
      "Masuk ke akun terlebih dahulu untuk mengunduh data.": "Sign in to download your data.",
      "Menyiapkan data akun...": "Preparing your account data...",
      "Salinan data akun berhasil diunduh.": "Your account data has been downloaded.",
      "Data akun tidak dapat diekspor.": "Your account data could not be exported.",
      "Masuk ke akun terlebih dahulu untuk top up demo.": "Sign in to top up your demo balance.",
      "Nominal top up harus antara Rp5.000 dan Rp1.000.000.": "The top-up amount must be between Rp5,000 and Rp1,000,000.",
      "Menyiapkan transaksi sandbox...": "Preparing sandbox transaction...",
      "Selesaikan simulasi pembayaran di popup Midtrans.": "Complete the payment simulation in the Midtrans popup.",
      "Pembayaran simulasi diterima. Saldo diperbarui setelah notifikasi Midtrans.": "Simulation payment received. Your balance will update after the Midtrans notification.",
      "Top up menunggu konfirmasi sandbox.": "Top-up is awaiting sandbox confirmation.",
      "Simulasi top up gagal. Coba lagi.": "Top-up simulation failed. Please try again.",
      "Popup ditutup. Saldo belum berubah.": "Popup closed. Your balance has not changed.",
      "Top up demo tidak dapat dimulai.": "The demo top-up could not be started.",
      "Top up demo hanya boleh menggunakan Midtrans sandbox.": "Demo top-ups can only use Midtrans sandbox.",
      "Saldo demo tidak dapat dimuat.": "Your demo balance could not be loaded.",
      "Masuk ke akun untuk melihat riwayat pesanan.": "Sign in to view your order history.",
      "Memuat riwayat pesanan…": "Loading order history…",
      "Riwayat pesanan tidak dapat dimuat.": "Your order history could not be loaded.",
      "Status diperbarui": "Status updated",
      "Menunggu pembayaran": "Awaiting payment",
      "Dibayar": "Paid",
      "Gagal": "Failed",
      "Dikembalikan": "Refunded",
      "Dikembalikan sebagian": "Partially refunded",
      "Dalam sengketa": "Disputed",
      "Pesanan dibayar": "Order paid",
      "Pesanan diproses": "Order processing",
      "Pesanan dikirim": "Order shipped",
      "Pesanan selesai": "Order completed",
      "Pesanan dibatalkan": "Order cancelled",
      "Harga estimasi saat pembelian": "Estimated price at purchase",
      "Rating": "Rating",
      "Pilih bintang": "Choose a rating",
      "Ulasan (opsional)": "Review (optional)",
      "Ceritakan pengalamanmu memakai produk ini": "Tell us about your experience with this product",
      "Kirim rating": "Submit rating",
      "Total": "Total",
      "Saya sudah menerima pesanan": "I have received this order",
      "Memproses...": "Processing...",
      "Pesanan tidak dapat diselesaikan.": "The order could not be completed.",
      "Mengirim...": "Submitting...",
      "Rating produk tidak dapat disimpan.": "Your product rating could not be saved.",
      "1 produk · 1 barang": "1 product · 1 item",
      "Sesi berakhir. Silakan masuk kembali.": "Your session has ended. Please sign in again.",
      "Role akun tidak dapat diverifikasi. Muat ulang halaman untuk mencoba lagi.": "Your account role could not be verified. Reload the page to try again.",
    },
    ja: {
      "Kurostore, kembali ke beranda": "Kurostore、ホームに戻る",
      "Kembali ke beranda": "ホームに戻る",
      "Pengaturan dan informasi akun Kurostore.": "Kurostoreのアカウント設定と情報。",
      "Dashboard Admin": "管理者ダッシュボード",
      "AREA AKUN": "アカウントエリア",
      "Masuk untuk membuka pengaturan akun": "ログインしてアカウント設定を開く",
      "Pengaturan dan informasi akun hanya tersedia setelah kamu masuk ke Kurostore.": "アカウント設定と情報は、Kurostoreにログインすると利用できます。",
      "Masuk ke akun": "ログイン",
      "Belum punya akun?": "アカウントをお持ちでないですか？",
      "Daftar sekarang": "新規登録",
      "PUSAT AKUN": "アカウントセンター",
      "Pengaturan & Akun": "設定とアカウント",
      "Kelola akun dan jelajahi fitur Kurostore.": "アカウントを管理し、Kurostoreの機能をご利用ください。",
      "AKUN DAN PREFERENSI": "アカウントと設定",
      "Pengaturan umum": "一般設定",
      "Navigasi akun": "アカウントナビゲーション",
      "Pengaturan akun": "アカウント設定",
      "Akun saya": "マイアカウント",
      "Profil": "プロフィール",
      "Bank & Kartu": "銀行・カード",
      "Alamat": "住所",
      "Ubah Password": "パスワード変更",
      "Notifikasi": "通知",
      "Privasi": "プライバシー",
      "Preferensi": "設定",
      "Bahasa": "言語",
      "Tema": "テーマ",
      "Aktivitas": "アクティビティ",
      "Seller": "販売者",
      "Seller Center": "販売者センター",
      "Administrasi": "管理",
      "Tamu": "ゲスト",
      "Sesi tamu lokal": "ローカルのゲストセッション",
      "Email belum tersedia": "メールアドレスはありません",
      "Pengguna Kurostore": "Kurostoreユーザー",
      "Keranjang Saya": "カート",
      "Pesanan Saya": "注文履歴",
      "Voucher & Poin": "クーポンとポイント",
      "Keluar dari akun": "ログアウト",
      "Akhiri sesi tamu": "ゲストセッションを終了",
      "Profil saya": "プロフィール",
      "Kelola informasi profil untuk pengalaman belanja yang lebih personal.": "プロフィール情報を管理して、より快適にお買い物いただけます。",
      "Nama": "氏名",
      "Email": "メールアドレス",
      "Nomor telepon": "電話番号",
      "Tambahkan nomor telepon": "電話番号を追加",
      "Simpan perubahan": "変更を保存",
      "Nama dan nomor telepon disimpan ke akun. Email login belum dapat diubah dari halaman ini.": "氏名と電話番号はアカウントに保存されます。このページではログイン用メールアドレスを変更できません。",
      "Alamat pengiriman": "配送先住所",
      "Simpan alamat utama agar detail penerima terisi otomatis saat checkout.": "配送先住所を保存すると、購入手続き時に入力内容が自動で反映されます。",
      "Nama penerima": "受取人名",
      "Alamat lengkap": "住所",
      "Kota / Kabupaten": "市区町村",
      "Kode pos": "郵便番号",
      "Simpan alamat": "住所を保存",
      "Alamat disimpan di akunmu dan akan terisi otomatis saat checkout.": "住所はアカウントに保存され、購入手続き時に自動で入力されます。",
      "Lihat status pembayaran dan rincian pesananmu.": "支払い状況と注文の詳細を確認できます。",
      "Masuk ke akun untuk melihat pesanan": "ログインして注文を確認",
      "Belum ada pesanan": "注文はまだありません",
      "Pesanan yang dibuat akan muncul di sini.": "注文はここに表示されます。",
      "Mulai belanja": "買い物を始める",
      "Pilih metode yang akan diprioritaskan saat checkout. Data kartu dan rekening tidak disimpan di Kurostore.": "購入手続きで優先する支払い方法を選択してください。カードや銀行口座の情報はKurostoreに保存されません。",
      "Metode pembayaran utama": "優先する支払い方法",
      "Semua metode di Midtrans": "Midtransのすべての決済方法",
      "E-wallet": "電子ウォレット",
      "Virtual account / transfer bank": "銀行振込 / バーチャルアカウント",
      "Kartu debit / kredit": "デビット / クレジットカード",
      "Saldo KuroPay demo (sandbox)": "KuroPayデモ残高（サンドボックス）",
      "Simpan metode": "支払い方法を保存",
      "Pilihan ini hanya mengatur metode checkout. Nomor kartu, CVV, PIN, dan rekening tidak pernah disimpan.": "この設定は購入時の支払い方法のみを指定します。カード番号、CVV、PIN、銀行口座情報は保存されません。",
      "KuroPay demo": "KuroPayデモ",
      "Saldo ini hanya untuk simulasi Midtrans sandbox, bukan uang sungguhan dan tidak bisa dicairkan.": "この残高はMidtransサンドボックスでのシミュレーション専用です。実際のお金ではなく、引き出しできません。",
      "Saldo demo": "デモ残高",
      "Memeriksa mode pembayaran...": "決済モードを確認中...",
      "Nominal top up demo": "デモチャージ金額",
      "Top up lewat sandbox": "サンドボックスでチャージ",
      "Riwayat saldo": "残高履歴",
      "Masukkan kata sandi saat ini untuk mengonfirmasi perubahan.": "変更を確認するため、現在のパスワードを入力してください。",
      "Password saat ini": "現在のパスワード",
      "Password baru": "新しいパスワード",
      "Ulangi password baru": "新しいパスワードを再入力",
      "Perbarui password": "パスワードを更新",
      "Pengaturan Notifikasi": "通知設定",
      "Pilih apakah Kurostore boleh mengirim email transaksi tentang status pesanan dan pembayaran.": "注文や支払い状況に関する通知メールをKurostoreから受け取るか選択してください。",
      "Email status pesanan": "注文状況メール",
      "Hanya email transaksi, bukan promosi.": "取引に関するメールのみで、広告メールは送信されません。",
      "Simpan notifikasi": "通知設定を保存",
      "Email memerlukan konfigurasi Resend dan domain pengirim terverifikasi.": "メールの送信にはResendの設定と送信元ドメインの認証が必要です。",
      "Privasi & data akun": "プライバシーとアカウントデータ",
      "Unduh salinan data profil, alamat, pesanan, ulasan, keranjang, preferensi, dan saldo demo yang tersimpan di akunmu.": "アカウントに保存されているプロフィール、住所、注文、レビュー、カート、設定、デモ残高のコピーをダウンロードできます。",
      "Unduh data saya": "データをダウンロード",
      "File unduhan hanya berisi data akunmu. Kata sandi, token sesi, dan rahasia pembayaran tidak pernah disertakan.": "ダウンロードにはアカウントデータのみが含まれます。パスワード、セッショントークン、決済情報は含まれません。",
      "Pilih bahasa untuk seluruh tampilan halaman Pengaturan & Akun.": "Kurostoreサイト全体の表示言語を選択してください。",
      "Simpan bahasa": "言語を保存",
      "Bahasa Indonesia": "インドネシア語",
      "English": "英語",
      "Atur tampilan situs agar nyaman digunakan.": "見やすい表示に設定できます。",
      "Tampilan": "表示モード",
      "Terang": "ライト",
      "Gelap": "ダーク",
      "Simpan tema": "テーマを保存",
      "Poin demo diperoleh dari pesanan sandbox yang berhasil dibayar. Poin tidak kedaluwarsa.": "デモポイントはサンドボックスで支払い済みの注文から獲得できます。ポイントに有効期限はありません。",
      "Poin tersedia": "利用可能ポイント",
      "100 poin = diskon Rp1.000 saat checkout. Minimal pesanan Rp5.000 untuk mendapat 100 poin.": "100ポイントで購入時にRp1,000割引になります。Rp5,000以上の注文で100ポイントを獲得できます。",
      "Riwayat poin": "ポイント履歴",
      "Belum ada voucher": "クーポンはまだありません",
      "Kode voucher hanya akan tampil jika diterbitkan resmi oleh Kurostore. Tidak ada voucher contoh yang dapat digunakan.": "クーポンはKurostoreが正式に発行した場合に表示されます。利用可能なサンプルクーポンはありません。",
      "BELANJA KAMU": "お買い物",
      "Isi keranjang": "カートの中身",
      "Memeriksa keranjang belanjamu…": "カートを確認中…",
      "Buka keranjang": "カートを開く",
      "Keranjangmu masih kosong": "カートは空です",
      "Produk yang kamu tambahkan akan muncul di sini.": "追加した商品はここに表示されます。",
      "Cari produk": "商品を探す",
      "Masuk untuk menyimpan dan melihat keranjang.": "ログインするとカートを保存・表示できます。",
      "Belum ada produk di keranjang.": "カートに商品はありません。",
      "Keranjang tidak dapat dibaca.": "カートを読み込めませんでした。",
      "Isi keranjang tidak dapat ditampilkan.": "カートの内容を表示できませんでした。",
      "Memuat saldo demo...": "デモ残高を読み込み中...",
      "Masuk ke akun untuk menggunakan saldo demo KuroPay.": "ログインしてKuroPayデモ残高をご利用ください。",
      "Saldo demo hanya tersedia untuk akun yang masuk.": "デモ残高はログイン中のアカウントでのみ利用できます。",
      "Mode sandbox aktif · simulasi saja, bukan uang sungguhan": "サンドボックスモード有効 · シミュレーション専用、実際のお金ではありません",
      "Mode produksi aktif · fitur saldo demo dinonaktifkan": "本番モード有効 · デモ残高機能は無効です",
      "Belum ada riwayat poin.": "ポイント履歴はありません。",
      "Belum ada transaksi saldo demo.": "デモ残高の取引履歴はありません。",
      "Masuk ke akun terlebih dahulu untuk menyimpan data.": "データを保存するにはログインしてください。",
      "Profil akun tidak dapat dimuat.": "プロフィールを読み込めませんでした。",
      "Profil akun tidak dapat disimpan.": "プロフィールを保存できませんでした。",
      "Preferensi akun tidak dapat dimuat.": "アカウント設定を読み込めませんでした。",
      "Preferensi akun tidak dapat disimpan.": "アカウント設定を保存できませんでした。",
      "Alamat tersimpan tidak dapat dimuat.": "保存済み住所を読み込めませんでした。",
      "Alamat tidak dapat disimpan.": "住所を保存できませんでした。",
      "Profil berhasil disimpan ke akunmu.": "プロフィールをアカウントに保存しました。",
      "Profil tersimpan di sesi browser ini.": "プロフィールをこのブラウザーセッションに保存しました。",
      "Nama tidak boleh kosong.": "氏名を入力してください。",
      "Lengkapi semua detail alamat sebelum menyimpan.": "保存する前に住所の詳細をすべて入力してください。",
      "Masuk ke akun terlebih dahulu untuk menyimpan alamat.": "住所を保存するにはログインしてください。",
      "Alamat tersimpan di akunmu dan akan terisi otomatis saat checkout.": "住所をアカウントに保存しました。購入手続き時に自動入力されます。",
      "Metode pembayaran utama berhasil disimpan.": "優先する支払い方法を保存しました。",
      "Metode pembayaran tidak dapat disimpan.": "支払い方法を保存できませんでした。",
      "Masuk ke akun terlebih dahulu untuk mengubah password.": "パスワードを変更するにはログインしてください。",
      "Konfirmasi password baru tidak cocok.": "新しいパスワードが一致しません。",
      "Password baru harus memiliki 8–128 karakter.": "新しいパスワードは8～128文字で入力してください。",
      "Password berhasil diperbarui.": "パスワードを更新しました。",
      "Password tidak dapat diperbarui.": "パスワードを更新できませんでした。",
      "Preferensi notifikasi berhasil disimpan.": "通知設定を保存しました。",
      "Preferensi notifikasi tidak dapat disimpan.": "通知設定を保存できませんでした。",
      "Preferensi tersimpan. Email belum terkirim sampai Resend dikonfigurasi di Vercel.": "設定を保存しました。VercelでResendを設定するまでメールは送信されません。",
      "Email transaksi aktif setelah alamat pengirim Resend diverifikasi.": "Resendの送信元アドレスを認証すると、取引メールが有効になります。",
      "Pilihan akan tersimpan. Pengiriman email aktif setelah RESEND_API_KEY dan RESEND_FROM_EMAIL dikonfigurasi di Vercel.": "設定は保存されます。メール送信にはVercelでRESEND_API_KEYとRESEND_FROM_EMAILの設定が必要です。",
      "Notifikasi transaksi memerlukan akun yang sudah masuk.": "取引通知を利用するにはログインしてください。",
      "Bahasa Pengaturan & Akun berhasil diperbarui.": "設定とアカウントページの言語を更新しました。",
      "Bahasa tidak dapat disimpan.": "言語設定を保存できませんでした。",
      "Tema berhasil diperbarui.": "テーマを更新しました。",
      "Tema tidak dapat disimpan.": "テーマを保存できませんでした。",
      "Masuk ke akun terlebih dahulu untuk mengunduh data.": "データをダウンロードするにはログインしてください。",
      "Menyiapkan data akun...": "アカウントデータを準備中...",
      "Salinan data akun berhasil diunduh.": "アカウントデータをダウンロードしました。",
      "Data akun tidak dapat diekspor.": "アカウントデータをエクスポートできませんでした。",
      "Masuk ke akun terlebih dahulu untuk top up demo.": "デモ残高をチャージするにはログインしてください。",
      "Nominal top up harus antara Rp5.000 dan Rp1.000.000.": "チャージ金額はRp5,000～Rp1,000,000で入力してください。",
      "Menyiapkan transaksi sandbox...": "サンドボックス取引を準備中...",
      "Selesaikan simulasi pembayaran di popup Midtrans.": "Midtransのポップアップで支払いシミュレーションを完了してください。",
      "Pembayaran simulasi diterima. Saldo diperbarui setelah notifikasi Midtrans.": "シミュレーション決済を受け付けました。Midtransの通知後に残高が更新されます。",
      "Top up menunggu konfirmasi sandbox.": "チャージはサンドボックスの確認待ちです。",
      "Simulasi top up gagal. Coba lagi.": "チャージのシミュレーションに失敗しました。もう一度お試しください。",
      "Popup ditutup. Saldo belum berubah.": "ポップアップが閉じられました。残高はまだ変更されていません。",
      "Top up demo tidak dapat dimulai.": "デモチャージを開始できませんでした。",
      "Top up demo hanya boleh menggunakan Midtrans sandbox.": "デモチャージにはMidtransサンドボックスのみ利用できます。",
      "Saldo demo tidak dapat dimuat.": "デモ残高を読み込めませんでした。",
      "Masuk ke akun untuk melihat riwayat pesanan.": "注文履歴を表示するにはログインしてください。",
      "Memuat riwayat pesanan…": "注文履歴を読み込み中…",
      "Riwayat pesanan tidak dapat dimuat.": "注文履歴を読み込めませんでした。",
      "Status diperbarui": "ステータスを更新しました",
      "Menunggu pembayaran": "支払い待ち",
      "Dibayar": "支払い済み",
      "Gagal": "失敗",
      "Dikembalikan": "返金済み",
      "Dikembalikan sebagian": "一部返金済み",
      "Dalam sengketa": "異議申し立て中",
      "Pesanan dibayar": "支払い済み",
      "Pesanan diproses": "処理中",
      "Pesanan dikirim": "発送済み",
      "Pesanan selesai": "完了",
      "Pesanan dibatalkan": "キャンセル済み",
      "Harga estimasi saat pembelian": "購入時の推定価格",
      "Rating": "評価",
      "Pilih bintang": "評価を選択",
      "Ulasan (opsional)": "レビュー（任意）",
      "Ceritakan pengalamanmu memakai produk ini": "この商品を使用した感想を入力してください",
      "Kirim rating": "評価を送信",
      "Total": "合計",
      "Saya sudah menerima pesanan": "注文を受け取りました",
      "Memproses...": "処理中...",
      "Pesanan tidak dapat diselesaikan.": "注文を完了できませんでした。",
      "Mengirim...": "送信中...",
      "Rating produk tidak dapat disimpan.": "商品評価を保存できませんでした。",
      "1 produk · 1 barang": "1商品 · 1点",
      "Sesi berakhir. Silakan masuk kembali.": "セッションが終了しました。再度ログインしてください。",
      "Role akun tidak dapat diverifikasi. Muat ulang halaman untuk mencoba lagi.": "アカウントの権限を確認できませんでした。ページを再読み込みしてください。",
    },
  };
  Object.assign(translations.en, {
    "Pengaturan dan informasi akun Kurostore.": "Kurostore account settings and information.",
    "Pengaturan dan informasi akun Kurostore": "Kurostore account settings and information",
    "Kurostore, belanja lebih mudah.": "Kurostore, shopping made easier.",
    "Kurostore | Belanja Lebih Mudah": "Kurostore | Shopping Made Easier",
    "Terima undangan seller Kurostore dan buat kata sandi.": "Accept your Kurostore seller invitation and create a password.",
    "Terima Undangan | Kurostore": "Accept Invitation | Kurostore",
    "Dashboard admin Kurostore untuk memantau toko, produk, stok, dan pengajuan seller.": "Kurostore admin dashboard for monitoring stores, products, inventory, and seller applications.",
    "Dashboard Admin | Kurostore": "Admin Dashboard | Kurostore",
    "Periksa alamat, pesanan, dan pembayaran Kurostore.": "Review your Kurostore address, order, and payment.",
    "Checkout | Kurostore": "Checkout | Kurostore",
    "Lihat detail, harga, stok, dan ulasan produk di Kurostore.": "View product details, prices, stock, and reviews on Kurostore.",
    "Detail Produk | Kurostore": "Product Details | Kurostore",
    "Flash Sale Kurostore akan segera hadir.": "Kurostore Flash Sale is coming soon.",
    "Flash Sale | Kurostore": "Flash Sale | Kurostore",
    "Kelola keranjang belanja dan temukan produk rekomendasi di Kurostore.": "Manage your shopping cart and find recommended products on Kurostore.",
    "Keranjang | Kurostore": "Cart | Kurostore",
    "Kolaborasi eksklusif Kurostore akan segera hadir.": "An exclusive Kurostore collaboration is coming soon.",
    "Kolaborasi | Kurostore": "Collaboration | Kurostore",
    "KuroPay saldo demo untuk menguji pembayaran di Midtrans sandbox.": "Use the KuroPay demo balance to test payments in the Midtrans sandbox.",
    "KuroPay | Kurostore": "KuroPay | Kurostore",
    "Masuk ke akun Kurostore untuk melanjutkan belanja.": "Sign in to your Kurostore account to continue shopping.",
    "Masuk | Kurostore": "Sign In | Kurostore",
    "Ajukan tokomu untuk bergabung sebagai seller Kurostore.": "Apply to join Kurostore as a seller.",
    "Pengajuan Seller | Kurostore": "Seller Application | Kurostore",
    "Pengaturan dan informasi akun Kurostore.": "Kurostore account settings and information.",
    "Pengaturan & Akun | Kurostore": "Settings & Account | Kurostore",
    "Lihat status pembayaran dan riwayat pesanan Kurostore.": "View your Kurostore payment status and order history.",
    "Pesanan Saya | Kurostore": "My Orders | Kurostore",
    "Temukan produk terbaru pilihan seller Kurostore. Segera hadir.": "Discover the latest products from Kurostore sellers. Coming soon.",
    "Produk Baru | Kurostore": "New Products | Kurostore",
    "Simpan dan lihat produk favoritmu di Wishlist Kurostore.": "Save and view your favorite products in your Kurostore wishlist.",
    "Wishlist | Kurostore": "Wishlist | Kurostore",
    "Temukan produk populer pilihan di Kurostore. Segera hadir.": "Discover popular picks on Kurostore. Coming soon.",
    "Produk Populer | Kurostore": "Popular Products | Kurostore",
    "Promo pilihan dan penawaran spesial dari Kurostore. Segera hadir.": "Selected promotions and special offers from Kurostore. Coming soon.",
    "Promo Pilihan | Kurostore": "Featured Promotions | Kurostore",
    "Pilih pulsa, paket data, top up game, dan layanan digital Kurostore.": "Choose mobile credit, data packages, game top-ups, and Kurostore digital services.",
    "Pulsa & Tagihan | Kurostore": "Mobile Credit & Bills | Kurostore",
    "Buat akun Kurostore dan mulai belanja dengan mudah.": "Create a Kurostore account and start shopping with ease.",
    "Daftar | Kurostore": "Sign Up | Kurostore",
    "Rekomendasi produk untukmu dari Kurostore. Segera hadir.": "Product recommendations for you from Kurostore. Coming soon.",
    "Rekomendasi | Kurostore": "Recommendations | Kurostore",
    "Kelola produk, pengiriman, promosi, dan kebutuhan toko melalui Seller Center Kurostore.": "Manage products, shipping, promotions, and store needs in Kurostore Seller Center.",
    "Seller Center | Kurostore": "Seller Center | Kurostore",
    "Kenali Kurostore, ruang belanja yang terus tumbuh bersama komunitas.": "Get to know Kurostore, a shopping space growing with its community.",
    "Tentang Kurostore": "About Kurostore",
    "Tentang Kurostore | Kurostore": "About Kurostore | Kurostore",
    "Jelajahi toko-toko unggulan di Kurostore. Segera hadir.": "Explore featured stores on Kurostore. Coming soon.",
    "Toko Unggulan | Kurostore": "Featured Stores | Kurostore",
    "Lihat voucher resmi Kurostore dan poin demo akunmu.": "View official Kurostore vouchers and your account's demo points.",
    "Voucher Belanja | Kurostore": "Shopping Vouchers | Kurostore",
    "Pengaturan akun": "Account settings",
    "Kembali ke pengaturan": "Back to settings",
    "Pengaturan & Akun": "Settings & Account",
    "Akun & Belanja": "Account & Shopping",
    "Akun dan belanja": "Account and shopping",
    "Keranjang belanja": "Shopping cart",
    "Masuk / Daftar": "Sign in / Sign up",
    "Semua Kategori": "All Categories",
    "Semua produk": "All products",
    "Semua Produk": "All Products",
    "Rekomendasi": "Recommendations",
    "Produk Terbaru": "New Products",
    "Produk Populer": "Popular Products",
    "Produk Baru": "New Products",
    "Detail Produk": "Product Details",
    "Voucher Belanja": "Shopping Vouchers",
    "Voucher & Produk Digital": "Vouchers & Digital Products",
    "Pulsa & Tagihan": "Mobile Credit & Bills",
    "Beranda": "Home",
    "Promo": "Promotions",
    "Promo Pilihan": "Featured Promotions",
    "Kolaborasi": "Collaboration",
    "Kembali ke keranjang": "Back to cart",
    "Lanjut belanja": "Continue shopping",
    "Lihat semua produk": "View all products",
    "Jelajahi katalog": "Browse the catalog",
    "Lihat katalog": "View catalog",
    "Jelajahi": "Explore",
    "Cari": "Search",
    "Cari produk": "Search products",
    "Cari produk yang kamu inginkan...": "Search for products...",
    "Butuh bantuan?": "Need help?",
    "Kembali ke atas": "Back to top",
    "Kembali ke beranda": "Back to home",
    "Kurostore, beranda": "Kurostore home",
    "Kurostore, kembali ke beranda": "Kurostore, back to home",
    "Pengaturan dan akun": "Settings and account",
    "Buka menu navigasi": "Open navigation menu",
    "Navigasi utama": "Main navigation",
    "Navigasi dashboard admin": "Admin dashboard navigation",
    "Dashboard Admin": "Admin Dashboard",
    "Dashboard seller": "Seller dashboard",
    "Menu Seller Center": "Seller Center menu",
    "Tampilkan slide sebelumnya": "Show previous slide",
    "Tampilkan slide berikutnya": "Show next slide",
    "Pilih slide": "Choose a slide",
    "Kontrol banner": "Banner controls",
    "Katalog": "Catalog",
    "Wishlist": "Wishlist",
    "Buka wishlist": "Open wishlist",
    "Buka keranjang": "Open cart",
    "Akun saya": "My account",
    "Akun Saya": "My Account",
    "Akun Tamu": "Guest Account",
    "Selamat datang": "Welcome",
    "Selamat datang di Kurostore": "Welcome to Kurostore",
    "Masuk / Daftar": "Sign in / Sign up",
    "Belanja": "Shopping",
    "Keranjang": "Cart",
    "Keranjang Saya": "My cart",
    "Isi keranjang": "Cart contents",
    "Isi keranjang belanja": "Shopping cart contents",
    "Semua produk dan kategori": "All products and categories",
    "Semua kategori dan produk": "All categories and products",
    "Semua kategori": "All categories",
    "Tampilkan semua kategori": "Show all categories",
    "Lihat semua kategori": "View all categories",
    "Pilih kategori": "Choose a category",
    "Harga terendah": "Lowest price",
    "Harga tertinggi": "Highest price",
    "Urutkan": "Sort",
    "Semua": "All",
    "Memuat produk…": "Loading products…",
    "Memuat produk...": "Loading products...",
    "Memuat produk lainnya…": "Loading more products…",
    "Muat produk lainnya": "Load more products",
    "Produk belum tersedia": "No products available",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "Products could not be loaded. Please reload the page.",
    "Produk aktif akan muncul di sini saat sudah tersedia.": "Active products will appear here when available.",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "Products could not be loaded. Please reload the page.",
    "Periksa koneksi lalu coba muat ulang halaman.": "Check your connection and reload the page.",
    "Tidak ada produk untuk checkout": "No products to check out",
    "Pilih produk di keranjang terlebih dahulu.": "Choose products in your cart first.",
    "Harga terendah": "Lowest price",
    "Harga tertinggi": "Highest price",
    "Belum ada produk": "No products yet",
    "Belum ada produk untuk ditampilkan. Nantikan promo menarik dari Kurostore!": "There are no products to show yet. Stay tuned for Kurostore promotions!",
    "Produk Flash Sale segera hadir": "Flash Sale products are coming soon",
    "Jelajahi pilihan produk menarik dan temukan pengalaman belanja yang nyaman di Kurostore.": "Browse great products and enjoy a comfortable shopping experience at Kurostore.",
    "Temukan yang kamu cari,": "Find what you're looking for,",
    "dengan cara yang mudah.": "the easy way.",
    "Mulai jelajahi": "Start exploring",
    "Pilihan produk untuk menemani harimu": "Products picked for your day",
    "Jelajahi Kurostore": "Explore Kurostore",
    "Semua kategori dan produk": "All categories and products",
    "Elektronik": "Electronics",
    "Gadget dan perangkat": "Gadgets and devices",
    "Baju Pria": "Men's Clothing",
    "Gaya untuk setiap kesempatan": "Styles for every occasion",
    "Baju Wanita": "Women's Clothing",
    "Temukan gaya favoritmu": "Find your favorite style",
    "Sepatu Pria": "Men's Shoes",
    "Langkah nyaman dan keren": "Comfortable, stylish steps",
    "Sepatu Wanita": "Women's Shoes",
    "Lengkapi penampilanmu": "Complete your look",
    "Makanan & Minuman": "Food & Beverages",
    "Camilan hingga minuman favorit": "From snacks to favorite drinks",
    "Hobi & Koleksi": "Hobbies & Collectibles",
    "Temukan barang kesukaanmu": "Find the things you love",
    "Merchandise": "Merchandise",
    "Item spesial dan edisi favorit": "Special items and favorite editions",
    "Voucher & Produk Digital": "Vouchers & Digital Products",
    "Voucher belanja dan hiburan": "Shopping and entertainment vouchers",
    "Tas & Aksesori": "Bags & Accessories",
    "Teman untuk aktivitas harian": "Everyday companions",
    "Kesehatan & Kecantikan": "Health & Beauty",
    "Rawat diri dan jaga kesehatan": "Care for yourself and your health",
    "Rumah & Gaya Hidup": "Home & Lifestyle",
    "Bikin ruang makin nyaman": "Make your space more comfortable",
    "KATALOG KUROSTORE": "KUROSTORE CATALOG",
    "Semua produk": "All products",
    "Produk dari berbagai kategori ditampilkan bersama.": "Products from all categories are shown together.",
    "Produk tersedia": "Products available",
    "Flash Sale": "Flash Sale",
    "PROMO SPESIAL": "SPECIAL OFFER",
    "Berakhir dalam": "Ends in",
    "Jam": "Hours",
    "Menit": "Minutes",
    "Detik": "Seconds",
    "Lihat halaman Flash Sale": "View Flash Sale",
    "KATALOG TERBARU": "LATEST CATALOG",
    "Produk terbaru sedang dimuat": "Loading latest products",
    "Produk dari katalog akan muncul di sini.": "Catalog products will appear here.",
    "PILIHAN KATALOG": "CATALOG PICKS",
    "Pilihan Produk": "Product Picks",
    "Dari katalog": "From the catalog",
    "Pilihan produk sedang dimuat": "Loading product picks",
    "Temukan produk yang tersedia di katalog Kurostore.": "Find products available in the Kurostore catalog.",
    "Jelajahi katalog": "Browse the catalog",
    "PUNYA PRODUK UNTUK DIJUAL?": "HAVE PRODUCTS TO SELL?",
    "Buka tokomu di Kurostore": "Open your store on Kurostore",
    "Jangkau lebih banyak pembeli dan kembangkan bisnismu bersama kami.": "Reach more buyers and grow your business with us.",
    "Mulai jadi seller": "Become a seller",
    "KENALAN DENGAN KAMI": "GET TO KNOW US",
    "Tentang Kurostore": "About Kurostore",
    "Kurostore hadir untuk membuat pengalaman menemukan kebutuhan dan barang favorit terasa lebih mudah.": "Kurostore makes it easier to find your essentials and favorite items.",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "Explore categories from electronics and clothing to food, hobbies, and collectibles. Save items to your wishlist so you can easily find them again.",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "We keep expanding Kurostore's selection and features. Product and promotion details will appear as they become available.",
    "Kenali Kurostore lebih dekat": "Learn more about Kurostore",
    "Hal yang bisa kamu temukan di Kurostore": "What you can find on Kurostore",
    "Ragam kategori": "A wide range of categories",
    "Jelajahi berbagai kebutuhan dan minat.": "Explore products for different needs and interests.",
    "Wishlist praktis": "A convenient wishlist",
    "Simpan barang favorit untuk dilihat lagi.": "Save favorite items to view later.",
    "Promo dan pilihan baru": "Promotions and new picks",
    "Pantau halaman ini untuk pembaruan Kurostore.": "Check this page for Kurostore updates.",
    "Akun & Belanja": "Account & Shopping",
    "Pilihan Pembayaran": "Payment Options",
    "Opsi pembayaran mengikuti metode yang tersedia saat transaksi.": "Payment options depend on the methods available at checkout.",
    "Logo metode pembayaran": "Payment method logos",
    "Semua hak dilindungi.": "All rights reserved.",
    "Selamat datang di Kurostore —": "Welcome to Kurostore —",
    "belanja lebih mudah": "shopping made easier",
    "Kurostore hadir": "Kurostore is here",
    "COMING SOON": "COMING SOON",
    "SEGERA HADIR": "COMING SOON",
    "Segera hadir": "Coming soon",
    "Pilih layanan": "Choose a service",
    "Jadi Seller": "Become a seller",
    "Muat ulang": "Reload",
    "Muat ulang halaman": "Reload page",
    "Produk tidak ditemukan. Silakan kembali ke katalog.": "Product not found. Please return to the catalog.",
    "Detail produk tidak dapat dimuat.": "Product details could not be loaded.",
    "Produk tersedia": "Products available",
    "Stok habis": "Out of stock",
    "Stok": "Stock",
    "Jumlah": "Quantity",
    "Kategori": "Category",
    "Produk": "Product",
    "Deskripsi": "Description",
    "Deskripsi produk": "Product description",
    "Harga": "Price",
    "Harga satuan": "Unit price",
    "Subtotal": "Subtotal",
    "Total": "Total",
    "Tidak tersedia": "Unavailable",
    "Tambah ke keranjang": "Add to cart",
    "Masukkan ke keranjang": "Add to cart",
    "Simpan ke wishlist": "Save to wishlist",
    "Tersimpan di wishlist": "Saved to wishlist",
    "Hapus": "Remove",
    "Estimasi harga": "Estimated price",
    "Estimasi harga pasar": "Estimated market price",
    "Semua kategori": "All categories",
    "Detail produk": "Product details",
    "Informasi produk": "Product information",
    "Kondisi": "Condition",
    "Baru": "New",
    "Stok tersedia": "Available stock",
    "Penilaian produk": "Product ratings",
    "Disediakan oleh": "Provided by",
    "Belanja nyaman, pilihan tepat bersama Kurostore.": "Comfortable shopping and great choices with Kurostore.",
    "Beranda": "Home",
    "KIRIM KE": "SHIP TO",
    "Alamat pengiriman": "Shipping address",
    "Alamat baru": "New address",
    "Nama penerima": "Recipient name",
    "Nomor telepon": "Phone number",
    "Alamat lengkap": "Full address",
    "Nama jalan, nomor rumah, kelurahan, kecamatan": "Street, house number, neighborhood, district",
    "Kota / Kabupaten": "City / region",
    "Kode pos": "Postal code",
    "Email untuk detail pembayaran": "Email for payment details",
    "Atur alamat utama di": "Set your primary address in",
    "agar terisi otomatis saat checkout.": "to fill it in automatically at checkout.",
    "Produk dipesan": "Products ordered",
    "Jumlah": "Quantity",
    "Produk Kurostore": "Kurostore products",
    "Pilihan belanja untukmu": "Shopping picks for you",
    "Opsi pengiriman": "Shipping options",
    "Ongkos kirim belum tersedia; total ini hanya mencakup harga produk.": "Shipping is not available yet; this total includes products only.",
    "Total produk": "Product total",
    "PILIHAN PEMBAYARAN": "PAYMENT OPTIONS",
    "Metode pembayaran": "Payment method",
    "Diproses aman oleh Midtrans": "Securely processed by Midtrans",
    "Semua metode": "All methods",
    "Pilih metode di halaman pembayaran": "Choose a method on the payment page",
    "Virtual account": "Virtual account",
    "Pilih bank yang tersedia di Midtrans": "Choose a bank available in Midtrans",
    "Pembayaran kartu melalui Midtrans": "Card payment through Midtrans",
    "KuroPay demo": "KuroPay demo",
    "Gunakan saldo simulasi sandbox": "Use sandbox demo balance",
    "*Metode yang tampil bergantung pada akun Midtrans. KuroPay demo hanya aktif di sandbox dan bukan uang sungguhan.": "*Available methods depend on the Midtrans account. KuroPay demo is available only in the sandbox and is not real money.",
    "Rincian pembayaran": "Payment details",
    "Tukar poin (": "Redeem points (",
    "tersedia)": "available)",
    "Diskon poin": "Points discount",
    "Ongkos kirim": "Shipping",
    "Belum tersedia": "Not available yet",
    "Total saat ini belum termasuk ongkos kirim. Pilihan kurir dan perhitungannya belum tersedia.": "This total does not include shipping. Courier options and rates are not available yet.",
    "Total pembayaran": "Payment total",
    "Buat pesanan": "Place order",
    "PEMBAYARAN KUROSTORE": "KUROSTORE PAYMENT",
    "Lihat pesanan saya": "View my orders",
    "Keranjang belanja": "Shopping cart",
    "AREA AKUN": "ACCOUNT ACCESS",
    "Masuk untuk melihat keranjang": "Sign in to view your cart",
    "Masuk ke akun Kurostore untuk menyimpan keranjang dan mengaksesnya dari perangkat lain.": "Sign in to save your cart and access it from other devices.",
    "Masuk ke akun": "Sign in",
    "Belum punya akun?": "Don't have an account?",
    "Daftar sekarang": "Sign up",
    "BELANJA KAMU": "YOUR SHOPPING",
    "Keranjang tersimpan di akun Kurostore-mu.": "Your cart is saved to your Kurostore account.",
    "Barang di keranjang": "Items in cart",
    "Pilih semua": "Select all",
    "Hapus pilihan": "Remove selection",
    "Ringkasan belanja": "Shopping summary",
    "Produk dipilih": "Selected products",
    "Checkout": "Checkout",
    "Pembayaran menggunakan Midtrans sandbox. Silakan pilih produk yang ingin dibayar.": "Payments use the Midtrans sandbox. Select the products you want to pay for.",
    "Keranjangmu masih kosong": "Your cart is empty",
    "Yuk, temukan produk atau layanan yang kamu suka.": "Find products or services you like.",
    "Mulai belanja": "Start shopping",
    "PILIHAN UNTUKMU": "PICKS FOR YOU",
    "Kamu mungkin juga suka": "You might also like",
    "Jelajahi toko": "Explore the store",
    "Memuat rekomendasi produk…": "Loading product recommendations…",
    "Belum ada produk yang tersedia untuk direkomendasikan.": "There are no products available to recommend yet.",
    "Rekomendasi belum dapat dimuat. Coba muat ulang halaman.": "Recommendations could not be loaded. Please reload the page.",
    "Masuk ke akun untuk melanjutkan checkout": "Sign in to continue to checkout",
    "Nama jalan, nomor rumah, kelurahan, kecamatan": "Street, house number, neighborhood, district",
    "Harga satuan": "Unit price",
    "Subtotal produk": "Product subtotal",
    "barang": "items",
    "Pilih metode pembayaran": "Choose a payment method",
    "Qris": "QRIS",
    "E-Wallet": "E-wallet",
    "virtual account / transfer bank": "virtual account / bank transfer",
    "Semua metode di Midtrans": "All Midtrans methods",
    "Kartu debit / kredit": "Debit / credit card",
    "Selesai": "Completed",
    "Status diperbarui": "Status updated",
    "Masukkan ke wishlist": "Add to wishlist",
    "Tersimpan": "Saved",
    "Hapus dari Wishlist": "Remove from wishlist",
    "Produk favoritmu di Kurostore.": "Your favorite products on Kurostore.",
    "Produk favoritmu": "Your favorites",
    "produk tersimpan": "saved products",
    "Wishlist kamu masih kosong": "Your wishlist is empty",
    "Barang yang kamu simpan akan muncul di sini.": "Items you save will appear here.",
    "Wishlist tersimpan di akun Kurostore-mu.": "Your wishlist is saved to your Kurostore account.",
    "Masuk ke akun untuk melihat dan menyimpan wishlist.": "Sign in to view and save your wishlist.",
    "Masuk untuk melihat wishlist": "Sign in to view your wishlist",
    "Wishlist tidak bisa dimuat saat ini. Coba muat ulang halaman.": "Your wishlist could not be loaded. Please reload the page.",
    "Produk tidak dapat dihapus dari wishlist.": "The product could not be removed from your wishlist.",
    "Produk tidak dapat ditambahkan ke keranjang.": "The product could not be added to your cart.",
    "Produk belum dapat dimuat": "Products could not be loaded",
    "Periksa koneksi lalu coba muat ulang halaman.": "Check your connection and reload the page.",
    "Semua produk": "All products",
    "Semua kategori": "All categories",
    "Lihat detail produk ini dan temukan pilihan yang cocok untukmu.": "View this product's details and find the right option for you.",
    "Rating": "Rating",
    "ulasan": "reviews",
    "Belum ada ulasan": "No reviews yet",
    "Belum ada ulasan untuk produk ini.": "There are no reviews for this product yet.",
    "Masuk ke akun": "Sign in",
    "Masuk ke akunmu": "Sign in to your account",
    "Masukkan detail akun untuk melanjutkan belanja.": "Enter your account details to continue shopping.",
    "Kata sandi": "Password",
    "Lupa kata sandi?": "Forgot password?",
    "Masukkan kata sandi": "Enter your password",
    "Tampilkan kata sandi": "Show password",
    "Ingat saya": "Remember me",
    "Masuk": "Sign in",
    "Jelajah sebagai tamu": "Browse as guest",
    "Dengan masuk, kamu menyetujui ketentuan layanan dan kebijakan privasi Kurostore.": "By signing in, you agree to Kurostore's terms of service and privacy policy.",
    "SELAMAT DATANG KEMBALI": "WELCOME BACK",
    "GABUNG BERSAMA KUROSTORE": "JOIN KUROSTORE",
    "Buat akun baru": "Create an account",
    "Daftar untuk pengalaman belanja yang lebih mudah.": "Sign up for an easier shopping experience.",
    "Nama lengkap": "Full name",
    "Masukkan nama lengkap": "Enter your full name",
    "Minimal 8 karakter": "At least 8 characters",
    "Konfirmasi kata sandi": "Confirm password",
    "Ulangi kata sandi": "Re-enter your password",
    "Daftar": "Sign up",
    "Sudah punya akun?": "Already have an account?",
    "Masuk di sini": "Sign in here",
    "Dengan mendaftar, kamu menyetujui ketentuan layanan dan kebijakan privasi Kurostore.": "By signing up, you agree to Kurostore's terms of service and privacy policy.",
    "JADI MITRA KUROSTORE": "BECOME A KUROSTORE PARTNER",
    "Mulai tokomu di Kurostore": "Start your store on Kurostore",
    "Ceritakan sedikit tentang tokomu. Tim admin akan meninjau pengajuan sebelum tokomu dapat mulai berjualan.": "Tell us about your store. Our admin team will review your application before you can start selling.",
    "Masuk sebagai buyer untuk mengajukan toko": "Sign in as a buyer to apply for a store",
    "Pengajuan seller hanya dapat dikirim dari akun Kurostore yang sudah masuk.": "Seller applications can only be submitted from a signed-in Kurostore account.",
    "Nama toko": "Store name",
    "Gunakan nama yang akan dilihat calon pembeli.": "Choose the name customers will see.",
    "Tentang tokomu": "About your store",
    "Ceritakan produk atau layanan yang akan kamu jual.": "Describe the products or services you plan to sell.",
    "Maksimal 500 karakter.": "Up to 500 characters.",
    "Kirim pengajuan": "Submit application",
    "RIWAYAT PESANAN TERSEDIA": "ORDER HISTORY AVAILABLE",
    "SEMUA PESANAN, SATU TEMPAT": "ALL YOUR ORDERS IN ONE PLACE",
    "Pesanan": "Orders",
    "punyamu.": "made simple.",
    "Riwayat pesanan dan status pembayaran tersedia di pusat akun Kurostore.": "Order history and payment status are available in your Kurostore account center.",
    "Perlu masuk untuk melihat pesananmu.": "Sign in to view your orders.",
    "Masuk ke akun, lalu buka menu": "Sign in, then open the menu",
    "di Pengaturan & Akun untuk melihat status pembayaran dan rincian transaksi.": "in Settings & Account to view payment status and transaction details.",
    "Buka Pengaturan & Akun": "Open Settings & Account",
    "Belum ada pesanan? Transaksi yang dibuat akan muncul setelah pembayaran diproses.": "No orders yet? Your transactions will appear after payment is processed.",
    "Pilih bahasa untuk seluruh tampilan situs Kurostore.": "Choose the language for the entire Kurostore website.",
    "Choose the language for the entire Settings & Account page.": "Choose the language for the entire Kurostore website.",
    "設定とアカウントページ全体の表示言語を選択してください。": "Kurostoreサイト全体の表示言語を選択してください。",
    "Pilih bahasa untuk seluruh tampilan halaman Pengaturan & Akun.": "Choose the language for the entire Kurostore website.",
    "Pilih bahasa untuk menu dan formulir Pengaturan & Akun.": "Choose the language for the entire Kurostore website.",
  });
  Object.assign(translations.ja, {
    "Kurostore, belanja lebih mudah.": "Kurostore、もっと快適なお買い物。",
    "Kurostore | Belanja Lebih Mudah": "Kurostore | もっと快適なお買い物",
    "Terima undangan seller Kurostore dan buat kata sandi.": "Kurostoreの販売者招待を受け取り、パスワードを作成してください。",
    "Terima Undangan | Kurostore": "招待を受け取る | Kurostore",
    "Dashboard admin Kurostore untuk memantau toko, produk, stok, dan pengajuan seller.": "店舗、商品、在庫、販売者申請を管理するKurostore管理ダッシュボード。",
    "Dashboard Admin | Kurostore": "管理者ダッシュボード | Kurostore",
    "Periksa alamat, pesanan, dan pembayaran Kurostore.": "Kurostoreの住所、注文、支払いを確認します。",
    "Checkout | Kurostore": "購入手続き | Kurostore",
    "Lihat detail, harga, stok, dan ulasan produk di Kurostore.": "Kurostoreの商品詳細、価格、在庫、レビューを確認できます。",
    "Detail Produk | Kurostore": "商品詳細 | Kurostore",
    "Flash Sale Kurostore akan segera hadir.": "Kurostoreのフラッシュセールは近日開催予定です。",
    "Flash Sale | Kurostore": "フラッシュセール | Kurostore",
    "Kelola keranjang belanja dan temukan produk rekomendasi di Kurostore.": "カートを管理し、Kurostoreのおすすめ商品を見つけましょう。",
    "Keranjang | Kurostore": "カート | Kurostore",
    "Kolaborasi eksklusif Kurostore akan segera hadir.": "Kurostore限定コラボレーションは近日公開予定です。",
    "Kolaborasi | Kurostore": "コラボレーション | Kurostore",
    "KuroPay saldo demo untuk menguji pembayaran di Midtrans sandbox.": "KuroPayデモ残高でMidtransサンドボックスの決済をテストできます。",
    "KuroPay | Kurostore": "KuroPay | Kurostore",
    "Masuk ke akun Kurostore untuk melanjutkan belanja.": "Kurostoreにログインしてお買い物を続けましょう。",
    "Masuk | Kurostore": "ログイン | Kurostore",
    "Ajukan tokomu untuk bergabung sebagai seller Kurostore.": "Kurostoreの販売者として店舗を申請してください。",
    "Pengajuan Seller | Kurostore": "販売者申請 | Kurostore",
    "Pengaturan & Akun | Kurostore": "設定とアカウント | Kurostore",
    "Lihat status pembayaran dan riwayat pesanan Kurostore.": "Kurostoreの支払い状況と注文履歴を確認できます。",
    "Pesanan Saya | Kurostore": "注文履歴 | Kurostore",
    "Temukan produk terbaru pilihan seller Kurostore. Segera hadir.": "Kurostore販売者の新商品を見つけましょう。近日公開。",
    "Produk Baru | Kurostore": "新商品 | Kurostore",
    "Simpan dan lihat produk favoritmu di Wishlist Kurostore.": "Kurostoreのウィッシュリストにお気に入り商品を保存できます。",
    "Wishlist | Kurostore": "ウィッシュリスト | Kurostore",
    "Temukan produk populer pilihan di Kurostore. Segera hadir.": "Kurostoreの人気商品を見つけましょう。近日公開。",
    "Produk Populer | Kurostore": "人気商品 | Kurostore",
    "Promo pilihan dan penawaran spesial dari Kurostore. Segera hadir.": "Kurostoreのおすすめキャンペーンや特別オファー。近日公開。",
    "Promo Pilihan | Kurostore": "おすすめキャンペーン | Kurostore",
    "Pilih pulsa, paket data, top up game, dan layanan digital Kurostore.": "Kurostoreで携帯電話のチャージ、データパック、ゲームチャージ、デジタルサービスを選べます。",
    "Pulsa & Tagihan | Kurostore": "携帯電話チャージ・請求 | Kurostore",
    "Buat akun Kurostore dan mulai belanja dengan mudah.": "Kurostoreのアカウントを作成して、簡単にお買い物を始めましょう。",
    "Daftar | Kurostore": "新規登録 | Kurostore",
    "Rekomendasi produk untukmu dari Kurostore. Segera hadir.": "Kurostoreからのおすすめ商品。近日公開。",
    "Rekomendasi | Kurostore": "おすすめ | Kurostore",
    "Kelola produk, pengiriman, promosi, dan kebutuhan toko melalui Seller Center Kurostore.": "Kurostore Seller Centerで商品、配送、キャンペーン、店舗情報を管理できます。",
    "Seller Center | Kurostore": "販売者センター | Kurostore",
    "Kenali Kurostore, ruang belanja yang terus tumbuh bersama komunitas.": "コミュニティとともに成長するショッピングサイト、Kurostoreをご紹介します。",
    "Tentang Kurostore": "Kurostoreについて",
    "Tentang Kurostore | Kurostore": "Kurostoreについて | Kurostore",
    "Jelajahi toko-toko unggulan di Kurostore. Segera hadir.": "Kurostoreの注目ショップをご覧ください。近日公開。",
    "Toko Unggulan | Kurostore": "注目ショップ | Kurostore",
    "Lihat voucher resmi Kurostore dan poin demo akunmu.": "Kurostore公式クーポンとアカウントのデモポイントを確認できます。",
    "Voucher Belanja | Kurostore": "ショッピングクーポン | Kurostore",
    "Pengaturan akun": "アカウント設定",
    "Kembali ke pengaturan": "設定に戻る",
    "Pengaturan & Akun": "設定とアカウント",
    "Akun & Belanja": "アカウントとお買い物",
    "Akun dan belanja": "アカウントとお買い物",
    "Keranjang belanja": "ショッピングカート",
    "Masuk / Daftar": "ログイン / 新規登録",
    "Semua Kategori": "すべてのカテゴリ",
    "Semua Produk": "すべての商品",
    "Rekomendasi": "おすすめ",
    "Produk Terbaru": "新商品",
    "Produk Populer": "人気商品",
    "Produk Baru": "新商品",
    "Detail Produk": "商品詳細",
    "Voucher Belanja": "ショッピングクーポン",
    "Voucher & Produk Digital": "クーポン・デジタル商品",
    "Pulsa & Tagihan": "携帯電話チャージ・請求",
    "Beranda": "ホーム",
    "Promo": "キャンペーン",
    "Promo Pilihan": "おすすめキャンペーン",
    "Kolaborasi": "コラボレーション",
    "Kembali ke keranjang": "カートに戻る",
    "Lanjut belanja": "買い物を続ける",
    "Lihat semua produk": "すべての商品を見る",
    "Jelajahi katalog": "商品一覧を見る",
    "Lihat katalog": "カタログを見る",
    "Jelajahi": "商品を見る",
    "Cari": "検索",
    "Cari produk": "商品を検索",
    "Cari produk yang kamu inginkan...": "商品を検索...",
    "Butuh bantuan?": "お困りですか？",
    "Kembali ke atas": "トップに戻る",
    "Kembali ke beranda": "ホームに戻る",
    "Kurostore, beranda": "Kurostoreホーム",
    "Kurostore, kembali ke beranda": "Kurostore、ホームに戻る",
    "Pengaturan dan akun": "設定とアカウント",
    "Buka menu navigasi": "ナビゲーションメニューを開く",
    "Navigasi utama": "メインナビゲーション",
    "Navigasi dashboard admin": "管理ダッシュボードのナビゲーション",
    "Dashboard Admin": "管理者ダッシュボード",
    "Menu Seller Center": "販売者センターメニュー",
    "Tampilkan slide sebelumnya": "前のスライドを表示",
    "Tampilkan slide berikutnya": "次のスライドを表示",
    "Pilih slide": "スライドを選択",
    "Kontrol banner": "バナー操作",
    "Katalog": "カタログ",
    "Buka wishlist": "ウィッシュリストを開く",
    "Buka keranjang": "カートを開く",
    "Akun saya": "マイアカウント",
    "Akun Saya": "マイアカウント",
    "Akun Tamu": "ゲストアカウント",
    "Selamat datang": "ようこそ",
    "Selamat datang di Kurostore": "Kurostoreへようこそ",
    "Belanja": "ショッピング",
    "Keranjang": "カート",
    "Keranjang Saya": "カート",
    "Isi keranjang": "カートの中身",
    "Semua produk dan kategori": "すべての商品とカテゴリ",
    "Semua kategori dan produk": "すべてのカテゴリと商品",
    "Semua kategori": "すべてのカテゴリ",
    "Tampilkan semua kategori": "すべてのカテゴリを表示",
    "Lihat semua kategori": "すべてのカテゴリを見る",
    "Pilih kategori": "カテゴリを選択",
    "Harga terendah": "価格の安い順",
    "Harga tertinggi": "価格の高い順",
    "Urutkan": "並べ替え",
    "Semua": "すべて",
    "Memuat produk…": "商品を読み込み中…",
    "Memuat produk...": "商品を読み込み中...",
    "Memuat produk lainnya…": "さらに商品を読み込み中…",
    "Muat produk lainnya": "さらに商品を読み込む",
    "Produk belum tersedia": "商品はありません",
    "Produk aktif akan muncul di sini saat sudah tersedia.": "販売中の商品がここに表示されます。",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "商品を読み込めませんでした。ページを再読み込みしてください。",
    "Periksa koneksi lalu coba muat ulang halaman.": "接続を確認して、ページを再読み込みしてください。",
    "Tidak ada produk untuk checkout": "購入する商品がありません",
    "Pilih produk di keranjang terlebih dahulu.": "先にカートから商品を選択してください。",
    "Belum ada produk": "商品はまだありません",
    "Belum ada produk untuk ditampilkan. Nantikan promo menarik dari Kurostore!": "表示できる商品はまだありません。Kurostoreのお得なキャンペーンをお楽しみに！",
    "Produk Flash Sale segera hadir": "フラッシュセール商品は近日公開",
    "Jelajahi pilihan produk menarik dan temukan pengalaman belanja yang nyaman di Kurostore.": "魅力的な商品を見つけて、Kurostoreで快適にお買い物をお楽しみください。",
    "Temukan yang kamu cari,": "お探しのものを、",
    "dengan cara yang mudah.": "簡単に見つけましょう。",
    "Mulai jelajahi": "商品を見る",
    "Pilihan produk untuk menemani harimu": "毎日に寄り添う商品",
    "Jelajahi Kurostore": "Kurostoreを見てみる",
    "Elektronik": "電子機器",
    "Gadget dan perangkat": "ガジェット・デバイス",
    "Baju Pria": "メンズファッション",
    "Gaya untuk setiap kesempatan": "さまざまなシーンに合うスタイル",
    "Baju Wanita": "レディースファッション",
    "Temukan gaya favoritmu": "お気に入りのスタイルを見つけよう",
    "Sepatu Pria": "メンズシューズ",
    "Langkah nyaman dan keren": "快適でスタイリッシュな一歩",
    "Sepatu Wanita": "レディースシューズ",
    "Lengkapi penampilanmu": "コーディネートを完成させよう",
    "Makanan & Minuman": "食品・飲料",
    "Camilan hingga minuman favorit": "お菓子からお気に入りの飲み物まで",
    "Hobi & Koleksi": "趣味・コレクション",
    "Temukan barang kesukaanmu": "お気に入りのアイテムを見つけよう",
    "Merchandise": "グッズ",
    "Item spesial dan edisi favorit": "特別なアイテムや限定版",
    "Voucher & Produk Digital": "クーポン・デジタル商品",
    "Voucher belanja dan hiburan": "ショッピング・エンタメクーポン",
    "Tas & Aksesori": "バッグ・アクセサリー",
    "Teman untuk aktivitas harian": "毎日の暮らしにぴったり",
    "Kesehatan & Kecantikan": "健康・美容",
    "Rawat diri dan jaga kesehatan": "自分を大切に、健康に過ごそう",
    "Rumah & Gaya Hidup": "ホーム・ライフスタイル",
    "Bikin ruang makin nyaman": "居心地のよい空間づくり",
    "KATALOG KUROSTORE": "KUROSTOREカタログ",
    "Produk dari berbagai kategori ditampilkan bersama.": "さまざまなカテゴリの商品をまとめて表示します。",
    "Produk tersedia": "販売中の商品",
    "Flash Sale": "フラッシュセール",
    "PROMO SPESIAL": "特別キャンペーン",
    "Berakhir dalam": "終了まで",
    "Jam": "時間",
    "Menit": "分",
    "Detik": "秒",
    "Lihat halaman Flash Sale": "フラッシュセールを見る",
    "KATALOG TERBARU": "新着カタログ",
    "Produk terbaru sedang dimuat": "新商品を読み込み中",
    "Produk dari katalog akan muncul di sini.": "カタログの商品がここに表示されます。",
    "PILIHAN KATALOG": "おすすめ商品",
    "Pilihan Produk": "おすすめ商品",
    "Dari katalog": "カタログから",
    "Pilihan produk sedang dimuat": "おすすめ商品を読み込み中",
    "Temukan produk yang tersedia di katalog Kurostore.": "Kurostoreのカタログから商品を見つけましょう。",
    "PUNYA PRODUK UNTUK DIJUAL?": "販売したい商品がありますか？",
    "Buka tokomu di Kurostore": "Kurostoreにショップを開こう",
    "Jangkau lebih banyak pembeli dan kembangkan bisnismu bersama kami.": "より多くのお客様に届けて、一緒にビジネスを成長させましょう。",
    "Mulai jadi seller": "販売者になる",
    "KENALAN DENGAN KAMI": "Kurostoreについて",
    "Kurostore hadir untuk membuat pengalaman menemukan kebutuhan dan barang favorit terasa lebih mudah.": "Kurostoreは、必要なものやお気に入りの商品を簡単に見つけられる場所です。",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "家電、衣料品、食品・飲料、趣味やコレクションなど、さまざまなカテゴリをご覧ください。気になる商品をウィッシュリストに保存して、いつでも見つけられます。",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "家電、衣料品、食品・飲料、趣味やコレクションなど、さまざまなカテゴリをご覧ください。気になる商品をウィッシュリストに保存すれば、いつでも簡単に見つけられます。",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "電子機器、衣類、食品、趣味やコレクションなど、さまざまなカテゴリをご覧ください。気になる商品をウィッシュリストに保存して、いつでも見つけられます。",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "Kurostoreでは商品や機能を拡充しています。商品やキャンペーンの情報は準備ができ次第お知らせします。",
    "Kenali Kurostore lebih dekat": "Kurostoreについて詳しく見る",
    "Hal yang bisa kamu temukan di Kurostore": "Kurostoreで見つかるもの",
    "Ragam kategori": "豊富なカテゴリ",
    "Jelajahi berbagai kebutuhan dan minat.": "さまざまなニーズや興味に合った商品を探せます。",
    "Wishlist praktis": "便利なウィッシュリスト",
    "Simpan barang favorit untuk dilihat lagi.": "お気に入りの商品を保存して、あとで確認できます。",
    "Promo dan pilihan baru": "キャンペーンと新商品",
    "Pantau halaman ini untuk pembaruan Kurostore.": "Kurostoreの最新情報はこちらをご確認ください。",
    "Pilihan Pembayaran": "お支払い方法",
    "Opsi pembayaran mengikuti metode yang tersedia saat transaksi.": "お支払い方法は決済時に利用可能な方法から選べます。",
    "Logo metode pembayaran": "決済方法のロゴ",
    "Semua hak dilindungi.": "無断転載を禁じます。",
    "Selamat datang di Kurostore —": "Kurostoreへようこそ —",
    "belanja lebih mudah": "もっと快適なお買い物",
    "COMING SOON": "近日公開",
    "SEGERA HADIR": "近日公開",
    "Segera hadir": "近日公開",
    "Pilih layanan": "サービスを選択",
    "Jadi Seller": "販売者になる",
    "Muat ulang": "再読み込み",
    "Muat ulang halaman": "ページを再読み込み",
    "Produk tidak ditemukan. Silakan kembali ke katalog.": "商品が見つかりません。カタログに戻ってください。",
    "Detail produk tidak dapat dimuat.": "商品詳細を読み込めませんでした。",
    "Stok habis": "在庫切れ",
    "Stok": "在庫",
    "Jumlah": "数量",
    "Kategori": "カテゴリ",
    "Produk": "商品",
    "Deskripsi": "説明",
    "Deskripsi produk": "商品説明",
    "Harga": "価格",
    "Harga satuan": "単価",
    "Subtotal": "小計",
    "Total": "合計",
    "Tidak tersedia": "利用できません",
    "Tambah ke keranjang": "カートに追加",
    "Masukkan ke keranjang": "カートに追加",
    "Simpan ke wishlist": "ウィッシュリストに保存",
    "Tersimpan di wishlist": "ウィッシュリストに保存済み",
    "Hapus": "削除",
    "Estimasi harga": "価格の目安",
    "Estimasi harga pasar": "市場価格の目安",
    "Detail produk": "商品詳細",
    "Informasi produk": "商品情報",
    "Kondisi": "状態",
    "Baru": "新品",
    "Stok tersedia": "在庫数",
    "Penilaian produk": "商品評価",
    "Disediakan oleh": "販売者",
    "Belanja nyaman, pilihan tepat bersama Kurostore.": "Kurostoreで快適なお買い物を。",
    "KIRIM KE": "配送先",
    "Alamat baru": "新しい住所",
    "Nama jalan, nomor rumah, kelurahan, kecamatan": "町名、番地、地区",
    "Email untuk detail pembayaran": "支払い情報を受け取るメールアドレス",
    "Atur alamat utama di": "メインの住所を設定",
    "agar terisi otomatis saat checkout.": "すると購入手続き時に自動入力されます。",
    "Produk dipesan": "注文商品",
    "Produk Kurostore": "Kurostoreの商品",
    "Pilihan belanja untukmu": "おすすめ商品",
    "Opsi pengiriman": "配送方法",
    "Ongkos kirim belum tersedia; total ini hanya mencakup harga produk.": "配送料は未対応のため、合計には商品価格のみが含まれます。",
    "Total produk": "商品合計",
    "PILIHAN PEMBAYARAN": "お支払い方法",
    "Metode pembayaran": "お支払い方法",
    "Diproses aman oleh Midtrans": "Midtransで安全に処理されます",
    "Semua metode": "すべての方法",
    "Pilih metode di halaman pembayaran": "支払い画面で方法を選択",
    "Virtual account": "バーチャルアカウント",
    "Pilih bank yang tersedia di Midtrans": "Midtransで利用可能な銀行を選択",
    "Pembayaran kartu melalui Midtrans": "Midtransによるカード決済",
    "Gunakan saldo simulasi sandbox": "サンドボックスのデモ残高を使用",
    "*Metode yang tampil bergantung pada akun Midtrans. KuroPay demo hanya aktif di sandbox dan bukan uang sungguhan.": "*利用可能な方法はMidtransアカウントによって異なります。KuroPayデモはサンドボックス専用で、実際のお金ではありません。",
    "Rincian pembayaran": "お支払い明細",
    "Diskon poin": "ポイント割引",
    "Ongkos kirim": "配送料",
    "Belum tersedia": "未対応",
    "Total saat ini belum termasuk ongkos kirim. Pilihan kurir dan perhitungannya belum tersedia.": "現在の合計には配送料が含まれていません。配送業者と料金の計算は未対応です。",
    "Total pembayaran": "お支払い合計",
    "Buat pesanan": "注文する",
    "PEMBAYARAN KUROSTORE": "KUROSTORE決済",
    "Lihat pesanan saya": "注文を確認",
    "Masuk untuk melihat keranjang": "ログインしてカートを表示",
    "Masuk ke akun Kurostore untuk menyimpan keranjang dan mengaksesnya dari perangkat lain.": "ログインするとカートが保存され、他のデバイスからも利用できます。",
    "Keranjang tersimpan di akun Kurostore-mu.": "カートはKurostoreアカウントに保存されます。",
    "Barang di keranjang": "カート内の商品",
    "Pilih semua": "すべて選択",
    "Hapus pilihan": "選択を解除",
    "Ringkasan belanja": "注文概要",
    "Produk dipilih": "選択した商品",
    "Pembayaran menggunakan Midtrans sandbox. Silakan pilih produk yang ingin dibayar.": "お支払いにはMidtransサンドボックスを使用します。商品を選択してください。",
    "Yuk, temukan produk atau layanan yang kamu suka.": "お気に入りの商品やサービスを見つけましょう。",
    "PILIHAN UNTUKMU": "おすすめ",
    "Kamu mungkin juga suka": "こちらもおすすめ",
    "Jelajahi toko": "ショップを見る",
    "Memuat rekomendasi produk…": "おすすめ商品を読み込み中…",
    "Belum ada produk yang tersedia untuk direkomendasikan.": "おすすめできる商品はまだありません。",
    "Rekomendasi belum dapat dimuat. Coba muat ulang halaman.": "おすすめ商品を読み込めません。ページを再読み込みしてください。",
    "Masuk ke akun untuk melanjutkan checkout": "ログインして購入手続きを続ける",
    "Subtotal produk": "商品小計",
    "E-wallet": "電子ウォレット",
    "virtual account / transfer bank": "銀行振込 / バーチャルアカウント",
    "Selesai": "完了",
    "Masukkan ke wishlist": "ウィッシュリストに追加",
    "Tersimpan": "保存済み",
    "Hapus dari Wishlist": "ウィッシュリストから削除",
    "Produk favoritmu di Kurostore.": "Kurostoreのお気に入り商品。",
    "produk tersimpan": "件を保存済み",
    "Wishlist kamu masih kosong": "ウィッシュリストは空です",
    "Barang yang kamu simpan akan muncul di sini.": "保存した商品がここに表示されます。",
    "Wishlist tersimpan di akun Kurostore-mu.": "ウィッシュリストはKurostoreアカウントに保存されます。",
    "Masuk ke akun untuk melihat dan menyimpan wishlist.": "ログインしてウィッシュリストを表示・保存してください。",
    "Masuk untuk melihat wishlist": "ログインしてウィッシュリストを表示",
    "Wishlist tidak bisa dimuat saat ini. Coba muat ulang halaman.": "ウィッシュリストを読み込めませんでした。ページを再読み込みしてください。",
    "Produk tidak dapat dihapus dari wishlist.": "商品をウィッシュリストから削除できませんでした。",
    "Produk tidak dapat ditambahkan ke keranjang.": "商品をカートに追加できませんでした。",
    "Produk belum dapat dimuat": "商品を読み込めませんでした",
    "Lihat detail produk ini dan temukan pilihan yang cocok untukmu.": "商品詳細を確認して、お気に入りを見つけましょう。",
    "ulasan": "件のレビュー",
    "Belum ada ulasan": "レビューはまだありません",
    "Belum ada ulasan untuk produk ini.": "この商品のレビューはまだありません。",
    "Masuk ke akunmu": "アカウントにログイン",
    "Masukkan detail akun untuk melanjutkan belanja.": "アカウント情報を入力してお買い物を続けてください。",
    "Kata sandi": "パスワード",
    "Lupa kata sandi?": "パスワードをお忘れですか？",
    "Masukkan kata sandi": "パスワードを入力",
    "Tampilkan kata sandi": "パスワードを表示",
    "Ingat saya": "ログイン状態を保持",
    "Masuk": "ログイン",
    "Jelajah sebagai tamu": "ゲストとして閲覧",
    "Dengan masuk, kamu menyetujui ketentuan layanan dan kebijakan privasi Kurostore.": "ログインすると、Kurostoreの利用規約とプライバシーポリシーに同意したことになります。",
    "SELAMAT DATANG KEMBALI": "おかえりなさい",
    "GABUNG BERSAMA KUROSTORE": "KUROSTOREに参加",
    "Buat akun baru": "アカウントを作成",
    "Daftar untuk pengalaman belanja yang lebih mudah.": "簡単にお買い物を楽しむために登録しましょう。",
    "Nama lengkap": "氏名",
    "Masukkan nama lengkap": "氏名を入力",
    "Minimal 8 karakter": "8文字以上",
    "Konfirmasi kata sandi": "パスワードを確認",
    "Ulangi kata sandi": "パスワードを再入力",
    "Daftar": "登録",
    "Sudah punya akun?": "すでにアカウントをお持ちですか？",
    "Masuk di sini": "こちらからログイン",
    "Dengan mendaftar, kamu menyetujui ketentuan layanan dan kebijakan privasi Kurostore.": "登録すると、Kurostoreの利用規約とプライバシーポリシーに同意したことになります。",
    "JADI MITRA KUROSTORE": "KUROSTOREのパートナーになる",
    "Mulai tokomu di Kurostore": "Kurostoreにショップを開く",
    "Ceritakan sedikit tentang tokomu. Tim admin akan meninjau pengajuan sebelum tokomu dapat mulai berjualan.": "ショップについて教えてください。販売開始前に管理チームが申請を確認します。",
    "Masuk sebagai buyer untuk mengajukan toko": "購入者としてログインしてショップを申請",
    "Pengajuan seller hanya dapat dikirim dari akun Kurostore yang sudah masuk.": "販売者申請はログイン済みのKurostoreアカウントからのみ送信できます。",
    "Nama toko": "ショップ名",
    "Gunakan nama yang akan dilihat calon pembeli.": "購入者に表示する名前を入力してください。",
    "Tentang tokomu": "ショップについて",
    "Ceritakan produk atau layanan yang akan kamu jual.": "販売する商品やサービスについて説明してください。",
    "Maksimal 500 karakter.": "500文字以内。",
    "Kirim pengajuan": "申請を送信",
    "RIWAYAT PESANAN TERSEDIA": "注文履歴",
    "SEMUA PESANAN, SATU TEMPAT": "注文をまとめて管理",
    "Pesanan": "注文",
    "punyamu.": "をここで確認。",
    "Riwayat pesanan dan status pembayaran tersedia di pusat akun Kurostore.": "注文履歴と支払い状況はKurostoreアカウントセンターで確認できます。",
    "Perlu masuk untuk melihat pesananmu.": "注文を確認するにはログインしてください。",
    "Masuk ke akun, lalu buka menu": "ログインして、メニューを開きます",
    "di Pengaturan & Akun untuk melihat status pembayaran dan rincian transaksi.": "設定とアカウントで支払い状況と取引詳細を確認できます。",
    "Buka Pengaturan & Akun": "設定とアカウントを開く",
    "Belum ada pesanan? Transaksi yang dibuat akan muncul setelah pembayaran diproses.": "注文はまだありません。決済完了後に取引が表示されます。",
    "Pilih bahasa untuk seluruh tampilan situs Kurostore.": "Kurostoreサイト全体の表示言語を選択してください。",
    "Choose the language for the entire Settings & Account page.": "Kurostoreサイト全体の表示言語を選択してください。",
    "設定とアカウントページ全体の表示言語を選択してください。": "Kurostoreサイト全体の表示言語を選択してください。",
    "Pilih bahasa untuk seluruh tampilan halaman Pengaturan & Akun.": "Kurostoreサイト全体の表示言語を選択してください。",
    "Pilih bahasa untuk menu dan formulir Pengaturan & Akun.": "Kurostoreサイト全体の表示言語を選択してください。",
  });
  Object.assign(translations.en, {
    "Flash Sale Kurostore belum dimulai. Kami sedang menyiapkan penawaran dan produk pertamanya—tanpa hitung mundur palsu.": "Kurostore Flash Sale has not started yet. We're preparing the first offers and products—no fake countdowns.",
    "WAKTU YANG TEPAT, TEMUAN YANG PAS": "THE RIGHT TIME, THE RIGHT FIND",
    "Nanti dulu.": "Not just yet.",
    "Biar makin seru.": "Let's make it worth the wait.",
    "Lihat pilihan yang tersedia": "Browse available products",
    "Flash Sale segera hadir": "Flash Sale is coming soon",
    "Waktunya akan tiba": "The time will come",
    "PILIHAN TERBATAS": "LIMITED PICKS",
    "WAKTU SPESIAL": "SPECIAL TIMING",
    "SEGERA HADIR": "COMING SOON",
    "Ketika dua": "When two",
    "cerita": "stories",
    "bertemu.": "come together.",
    "Kami sedang menyiapkan sesuatu bersama. Nama partnernya? Ssst… belum boleh dibocorkan.": "We're preparing something together. Who's our partner? Shhh… we can't reveal it yet.",
    "Informasi kolaborasi": "Collaboration information",
    "Bukan sekadar tempel logo.": "More than just putting logos together.",
    "Kolaborasi ini sedang dibentuk dari ide, gaya, dan hal-hal yang kami suka bareng.": "This collaboration is taking shape around the ideas, style, and things we enjoy together.",
    "DETAIL MENYUSUL": "MORE DETAILS SOON",
    "Stay curious. Ceritanya segera dibuka.": "Stay curious. The story will be revealed soon.",
    "Coba saldo demo.": "Try the demo balance.",
    "Tetap aman.": "It's safe to try.",
    "KuroPay demo memakai Midtrans sandbox untuk menguji top up dan pembayaran. Saldo ini bukan uang sungguhan, tidak dapat dicairkan, dan otomatis dinonaktifkan saat mode produksi aktif.": "KuroPay demo uses the Midtrans sandbox to test top-ups and payments. The balance is not real money, cannot be withdrawn, and is automatically disabled in production mode.",
    "SANDBOX SAJA": "SANDBOX ONLY",
    "BUKAN UANG SUNGGUHAN": "NOT REAL MONEY",
    "Kelola saldo demo": "Manage demo balance",
    "Pratinjau kartu KuroPay": "KuroPay card preview",
    "KUROSTORE MEMBER": "KUROSTORE MEMBER",
    "YOUR EVERYDAY": "YOUR EVERYDAY",
    "SHOPPING SIDEKICK": "SHOPPING SIDEKICK",
    "Rencana pengalaman KuroPay": "KuroPay experience roadmap",
    "Isi saldo simulasi": "Add demo balance",
    "Top up melalui pembayaran sandbox gratis.": "Top up using a sandbox payment simulation.",
    "Gunakan saat checkout": "Use at checkout",
    "Pilih KuroPay demo atau tukar poin demo.": "Choose KuroPay demo or redeem demo points.",
    "Uji alurnya": "Test the flow",
    "Transaksi tidak memindahkan uang sungguhan.": "Transactions do not move real money.",
    "Jangan mengirim uang ke siapa pun atas nama KuroPay. Gunakan hanya metode simulasi yang dibuka oleh Midtrans sandbox.": "Never send money to anyone claiming to represent KuroPay. Use only payment simulations provided by the Midtrans sandbox.",
    "Mode demo hanya untuk pengujian.": "Demo mode is for testing only.",
    "THE REVEAL IS COMING": "THE REVEAL IS COMING",
    "SOMETHING": "SOMETHING",
    "IN THE WORKS": "IN THE WORKS",
    "Belum kenal,": "Not here yet,",
    "sebentar lagi.": "but coming soon.",
    "Sudut untuk barang-barang baru yang bikin kamu berhenti scroll. Etalasenya sedang kami rapikan.": "A place for new finds worth stopping your scroll for. We're getting the showcase ready.",
    "Koleksi pertama sedang disiapkan": "The first collection is on its way",
    "something": "something",
    "good is coming": "good is coming",
    "Tentang produk baru": "About new products",
    "Temuan segar dari seller Kurostore": "Fresh finds from Kurostore sellers",
    "Lintas kategori, satu tempat": "Across categories, all in one place",
    "Sambil menunggu, lihat katalog": "While you wait, browse the catalog",
    "Yang baru akan segera mampir.": "Something new is coming soon.",
    "TOP": "TOP",
    "PILIHAN YANG BANYAK DICARI": "POPULAR PICKS",
    "Favorit banyak orang.": "A favorite for many.",
    "Segera di sini.": "Coming soon.",
    "Daftar produk populer akan terbentuk dari produk aktif dan minat pembeli. Saat ini belum ada produk untuk ditampilkan.": "Popular products will be selected based on active listings and shopper interest. There are no products to show yet.",
    "Belum ada produk populer": "No popular products yet",
    "Harga turun.": "Prices down.",
    "Mood naik.": "Moods up.",
    "Halaman promo lagi pemanasan. Kami sedang menyiapkan penawaran yang layak ditunggu.": "Promotions are warming up. We're preparing offers worth waiting for.",
    "PROMO SEGERA HADIR": "PROMOTIONS COMING SOON",
    "worth the wait": "worth the wait",
    "Belum ada promo aktif.": "There are no active promotions yet.",
    "Belanja dengan harga produk yang tertera di katalog untuk sekarang.": "For now, shop at the prices shown in the catalog.",
    "Cari barang incaranmu": "Find what you're looking for",
    "Promo Pilihan — biar belanja makin happy.": "Featured promotions — make shopping more fun.",
    "FOR": "FOR",
    "YOU": "YOU",
    "DIRACIK UNTUK KAMU": "PICKED FOR YOU",
    "Belum ada rekomendasi.": "No recommendations yet.",
    "Tapi sebentar lagi.": "But they are coming soon.",
    "Rekomendasi akan hadir setelah produk tersedia. Belum ada barang contoh yang kami tampilkan—yang muncul nanti adalah pilihan sungguhan.": "Recommendations will appear once products are available. We don't show sample items—only real products will appear here.",
    "Lihat beranda": "View home",
    "Temukan kebutuhan dan barang favoritmu dengan lebih mudah bersama Kurostore.": "Find your essentials and favorite items more easily with Kurostore.",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "Explore categories from electronics and clothing to food, hobbies, and collectibles. Save items to your wishlist so you can easily find them again.",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "We keep expanding Kurostore's selection and features. Product and promotion details will appear as they become available.",
    "Toko unggulan": "Featured stores",
    "Voucher resmi Kurostore": "Official Kurostore vouchers",
    "Tidak ada voucher contoh yang dapat digunakan.": "There are no sample vouchers to use.",
    "Kurostore — belanja lebih mudah.": "Kurostore — shopping made easier.",
  });
  Object.assign(translations.ja, {
    "Flash Sale Kurostore belum dimulai. Kami sedang menyiapkan penawaran dan produk pertamanya—tanpa hitung mundur palsu.": "Kurostoreのフラッシュセールはまだ始まっていません。偽のカウントダウンではなく、最初の商品とお得な情報を準備中です。",
    "WAKTU YANG TEPAT, TEMUAN YANG PAS": "ちょうどいい時に、ぴったりの商品を",
    "Nanti dulu.": "もう少しお待ちください。",
    "Biar makin seru.": "もっと楽しい企画を準備中です。",
    "Lihat pilihan yang tersedia": "販売中の商品を見る",
    "Flash Sale segera hadir": "フラッシュセールは近日開催",
    "Waktunya akan tiba": "まもなく開催",
    "PILIHAN TERBATAS": "数量限定",
    "WAKTU SPESIAL": "特別な時間",
    "SEGERA HADIR": "近日公開",
    "Ketika dua": "ふたつの",
    "cerita": "物語が",
    "bertemu.": "出会う。",
    "Kami sedang menyiapkan sesuatu bersama. Nama partnernya? Ssst… belum boleh dibocorkan.": "パートナーと一緒に企画を準備中です。相手は誰でしょう？まだ秘密です。",
    "Informasi kolaborasi": "コラボレーション情報",
    "Bukan sekadar tempel logo.": "ロゴを並べるだけではありません。",
    "Kolaborasi ini sedang dibentuk dari ide, gaya, dan hal-hal yang kami suka bareng.": "このコラボレーションは、私たちが一緒に好きなアイデアやスタイルから生まれます。",
    "DETAIL MENYUSUL": "詳細は近日公開",
    "Stay curious. Ceritanya segera dibuka.": "どうぞお楽しみに。まもなく全貌を公開します。",
    "Coba saldo demo.": "デモ残高を試してみましょう。",
    "Tetap aman.": "安心してお試しください。",
    "KuroPay demo memakai Midtrans sandbox untuk menguji top up dan pembayaran. Saldo ini bukan uang sungguhan, tidak dapat dicairkan, dan otomatis dinonaktifkan saat mode produksi aktif.": "KuroPayデモはMidtransサンドボックスを使用してチャージや決済をテストします。実際のお金ではなく、出金できません。本番モードでは自動的に無効になります。",
    "SANDBOX SAJA": "サンドボックス専用",
    "BUKAN UANG SUNGGUHAN": "実際のお金ではありません",
    "Kelola saldo demo": "デモ残高を管理",
    "Pratinjau kartu KuroPay": "KuroPayカードのプレビュー",
    "Rencana pengalaman KuroPay": "KuroPayの利用方法",
    "Isi saldo simulasi": "デモ残高をチャージ",
    "Top up melalui pembayaran sandbox gratis.": "サンドボックス決済で無料チャージ。",
    "Gunakan saat checkout": "購入時に利用",
    "Pilih KuroPay demo atau tukar poin demo.": "KuroPayデモを選ぶか、デモポイントを利用します。",
    "Uji alurnya": "決済の流れをテスト",
    "Transaksi tidak memindahkan uang sungguhan.": "実際のお金は移動しません。",
    "Jangan mengirim uang ke siapa pun atas nama KuroPay. Gunakan hanya metode simulasi yang dibuka oleh Midtrans sandbox.": "KuroPayを名乗る相手に送金しないでください。Midtransサンドボックスの決済シミュレーションのみを利用してください。",
    "Mode demo hanya untuk pengujian.": "デモモードはテスト専用です。",
    "THE REVEAL IS COMING": "まもなく発表",
    "SOMETHING": "何かが",
    "IN THE WORKS": "進行中",
    "Belum kenal,": "まだ見ぬ商品が、",
    "sebentar lagi.": "まもなく登場。",
    "Sudut untuk barang-barang baru yang bikin kamu berhenti scroll. Etalasenya sedang kami rapikan.": "スクロールを止めたくなる新商品を集めたコーナーです。現在準備中です。",
    "Koleksi pertama sedang disiapkan": "最初のコレクションを準備中",
    "something": "何か",
    "good is coming": "素敵なものがやってくる",
    "Tentang produk baru": "新商品のご案内",
    "Temuan segar dari seller Kurostore": "Kurostoreの販売者から届く新商品",
    "Lintas kategori, satu tempat": "さまざまなカテゴリをひとつの場所に",
    "Sambil menunggu, lihat katalog": "お待ちの間にカタログを見る",
    "Yang baru akan segera mampir.": "新商品は近日登場します。",
    "TOP": "トップ",
    "PILIHAN YANG BANYAK DICARI": "人気の商品",
    "Favorit banyak orang.": "みんなのお気に入り。",
    "Segera di sini.": "近日公開。",
    "Daftar produk populer akan terbentuk dari produk aktif dan minat pembeli. Saat ini belum ada produk untuk ditampilkan.": "商品一覧と購入者の関心に基づいて人気商品を紹介します。現在、表示できる商品はありません。",
    "Belum ada produk populer": "人気商品はまだありません",
    "Harga turun.": "価格はお得に。",
    "Mood naik.": "気分はアップ。",
    "Halaman promo lagi pemanasan. Kami sedang menyiapkan penawaran yang layak ditunggu.": "キャンペーンを準備中です。お楽しみにお待ちください。",
    "PROMO SEGERA HADIR": "キャンペーン近日公開",
    "worth the wait": "待つ価値があります",
    "Belum ada promo aktif.": "開催中のキャンペーンはありません。",
    "Belanja dengan harga produk yang tertera di katalog untuk sekarang.": "現在はカタログに表示されている価格でご購入いただけます。",
    "Cari barang incaranmu": "お目当ての商品を探す",
    "Promo Pilihan — biar belanja makin happy.": "おすすめキャンペーン — お買い物をもっと楽しく。",
    "FOR": "あなたに",
    "YOU": "おすすめ",
    "DIRACIK UNTUK KAMU": "あなたへのおすすめ",
    "Belum ada rekomendasi.": "おすすめ商品はまだありません。",
    "Tapi sebentar lagi.": "まもなく登場します。",
    "Rekomendasi akan hadir setelah produk tersedia. Belum ada barang contoh yang kami tampilkan—yang muncul nanti adalah pilihan sungguhan.": "商品が登録されるとおすすめを表示します。サンプル商品は表示せず、実際の商品だけをご紹介します。",
    "Lihat beranda": "ホームを見る",
    "Temukan kebutuhan dan barang favoritmu dengan lebih mudah bersama Kurostore.": "Kurostoreで必要なものやお気に入りを簡単に見つけましょう。",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "電子機器、衣類、食品、趣味やコレクションなど、さまざまなカテゴリをご覧ください。気になる商品をウィッシュリストに保存して、いつでも見つけられます。",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "Kurostoreでは商品や機能を拡充しています。商品やキャンペーンの情報は準備ができ次第お知らせします。",
    "Toko unggulan": "注目ショップ",
    "Voucher resmi Kurostore": "Kurostore公式クーポン",
    "Tidak ada voucher contoh yang dapat digunakan.": "利用できるサンプルクーポンはありません。",
  });
  Object.assign(translations.en, {
    "UNDANGAN SELLER KUROSTORE": "KUROSTORE SELLER INVITATION",
    "Aktifkan akun seller": "Activate seller account",
    "Buat kata sandi untuk menyelesaikan penerimaan undangan.": "Create a password to finish accepting your invitation.",
    "Kata sandi baru": "New password",
    "Konfirmasi kata sandi": "Confirm password",
    "Aktifkan akun": "Activate account",
    "Akun seller berhasil diaktifkan.": "Your seller account has been activated.",
    "Masuk ke Kurostore": "Sign in to Kurostore",
    "Tautan undangan tidak valid atau sudah kedaluwarsa. Minta admin mengirim undangan baru.": "This invitation link is invalid or expired. Ask an admin to send a new invitation.",
    "Dashboard ini hanya tersedia untuk akun dengan role admin.": "This dashboard is available to admin accounts only.",
    "PUSAT ADMIN": "ADMIN CENTER",
    "Semua tentang tokomu,": "Everything about your store,",
    "dalam satu tempat.": "all in one place.",
    "Selamat datang di pusat kendali Kurostore. Berikut kabar terbaru dari tokomu.": "Welcome to the Kurostore control center. Here are the latest updates about your store.",
    "Admin Kurostore": "Kurostore Admin",
    "Menunggu data terbaru": "Waiting for the latest data",
    "Muat ulang data": "Reload data",
    "Masuk sebagai admin": "Sign in as admin",
    "Masuk ke akun admin": "Sign in to the admin account",
    "Akses admin diperlukan": "Admin access required",
    "Akunmu tidak memiliki akses ke dashboard admin.": "Your account does not have access to the admin dashboard.",
    "Ringkasan toko": "Store overview",
    "Pengajuan menunggu": "Pending applications",
    "Lihat pengajuan seller": "View seller applications",
    "Lihat pengajuan": "View applications",
    "Seller aktif": "Active sellers",
    "toko terdaftar": "registered stores",
    "Produk aktif": "Active products",
    "Kategori aktif": "Active categories",
    "siap digunakan": "ready to use",
    "Stok menipis": "Low stock",
    "Cek stok": "Check stock",
    "PANTAU LAYANAN": "SERVICE MONITORING",
    "Kondisi sistem": "System status",
    "Pengecekan koneksi layanan yang digunakan Kurostore.": "Connection checks for services used by Kurostore.",
    "Memeriksa layanan…": "Checking services…",
    "API di Vercel": "Vercel API",
    "Memeriksa fungsi aplikasi…": "Checking application functions…",
    "Memeriksa": "Checking",
    "Database Supabase": "Supabase database",
    "Memeriksa koneksi database…": "Checking database connection…",
    "Supabase Auth": "Supabase Auth",
    "Memeriksa autentikasi admin…": "Checking admin authentication…",
    "Payment gateway": "Payment gateway",
    "Belum terintegrasi; pembayaran belum dapat diproses.": "Not integrated yet; payments cannot be processed.",
    "Belum aktif": "Inactive",
    "Status layanan diperbarui otomatis setiap 10 detik.": "Service status refreshes automatically every 10 seconds.",
    "TINDAKAN ADMIN": "ADMIN ACTIONS",
    "Pengajuan seller": "Seller applications",
    "Memuat pengajuan…": "Loading applications…",
    "Cari pengajuan seller": "Search seller applications",
    "Cari nama atau deskripsi toko": "Search store name or description",
    "Semua pengajuan sudah ditinjau": "All applications have been reviewed",
    "Pengajuan seller baru akan muncul di halaman ini.": "New seller applications will appear here.",
    "PEMBERITAHUAN": "ALERTS",
    "Perlu perhatian": "Needs attention",
    "Memeriksa kondisi toko…": "Checking store status…",
    "Belum ada hal yang perlu ditindaklanjuti.": "There is nothing that needs attention.",
    "INVENTARIS": "INVENTORY",
    "Produk aktif dengan stok 5 atau kurang.": "Active products with stock of 5 or less.",
    "Semua aman. Belum ada produk yang stoknya menipis.": "Everything looks good. No products are low on stock.",
    "JELAJAHI": "EXPLORE",
    "Akses cepat": "Quick access",
    "Lihat produk yang tersedia": "View available products",
    "Etalase toko": "Storefront",
    "Lihat Kurostore sebagai pembeli": "View Kurostore as a shopper",
    "Tidak ada pengajuan seller yang menunggu.": "There are no seller applications awaiting review.",
    "Pengajuan tidak dapat dimuat.": "Applications could not be loaded.",
    "Toko berkembang,": "Grow your store,",
    "mulai dari sini.": "starting here.",
    "Kelola produk dan pantau performa tokomu di Kurostore.": "Manage products and track your store's performance on Kurostore.",
    "Menunggu data katalog": "Waiting for catalog data",
    "Perbarui katalog": "Refresh catalog",
    "Masuk ke akun seller": "Sign in to your seller account",
    "Masuk untuk mengelola produk dan melihat ringkasan tokomu.": "Sign in to manage products and view your store overview.",
    "Akses seller diperlukan": "Seller access required",
    "Akunmu belum memiliki akses ke Seller Center.": "Your account does not have access to Seller Center.",
    "Ajukan tokomu": "Apply for a store",
    "Menu Seller Center": "Seller Center menu",
    "TOKO SAYA": "MY STORE",
    "Ringkasan": "Overview",
    "OPERASIONAL": "OPERATIONS",
    "Pesanan": "Orders",
    "Segera": "Soon",
    "Pengiriman": "Shipping",
    "Aktif": "Active",
    "KEMBANGKAN TOKO": "GROW YOUR STORE",
    "Promosi": "Promotions",
    "Keuangan": "Finances",
    "Analitik": "Analytics",
    "Pelanggan": "Customers",
    "Pengaturan toko": "Store settings",
    "Fitur Seller Center dikembangkan bertahap untuk tokomu.": "Seller Center features are being developed in stages for your store.",
    "Ringkasan toko": "Store overview",
    "Pantau katalog dan akses semua kebutuhan tokomu dari sini.": "Monitor your catalog and access your store tools here.",
    "Ringkasan produk": "Product overview",
    "Produk dimuat": "Products loaded",
    "maksimal 100 terbaru": "up to the 100 latest",
    "tampil di katalog": "shown in the catalog",
    "stok 5 atau kurang": "stock of 5 or less",
    "Total terjual": "Total sold",
    "akumulasi produk": "product total",
    "AKSES CEPAT": "QUICK ACCESS",
    "Apa yang ingin kamu kelola?": "What would you like to manage?",
    "Atur katalog, harga, dan stok": "Manage catalog, prices, and stock",
    "Bisa digunakan": "Available",
    "Pantau proses pesanan pembeli": "Track customer orders",
    "Segera hadir": "Coming soon",
    "Rencanakan promo dan diskon toko": "Plan store promotions and discounts",
    "Kenali perkembangan tokomu": "See how your store is growing",
    "Menu yang berlabel “Segera” belum memiliki layanan aktif. Data pesanan, saldo, dan performa tidak ditampilkan sebelum sumber datanya tersedia.": "Menus marked “Soon” are not active yet. Order, balance, and performance data will appear when their data sources are available.",
    "Alur pesanan akan tersedia setelah proses checkout dan penyimpanan pesanan Kurostore aktif.": "Order workflows will be available when Kurostore checkout and order storage are active.",
    "STATUS PESANAN": "ORDER STATUS",
    "Belum dibayar": "Unpaid",
    "Daftar pesanan yang menunggu pembayaran.": "Orders awaiting payment.",
    "Belum tersedia": "Not available yet",
    "Perlu dikirim": "Ready to ship",
    "Pesanan yang perlu disiapkan dan diserahkan ke kurir.": "Orders to prepare and hand over to the courier.",
    "Sedang dikirim": "In transit",
    "Pantau pesanan yang sedang dalam perjalanan.": "Track orders on their way.",
    "Selesai": "Completed",
    "Riwayat pesanan yang telah diterima pembeli.": "Orders received by customers.",
    "Dibatalkan": "Cancelled",
    "Periksa pesanan yang dibatalkan dan alasan pembatalannya.": "Review cancelled orders and the reasons for cancellation.",
    "Pengembalian": "Returns",
    "Tinjau permintaan retur dan pengembalian dana secara transparan.": "Review return and refund requests transparently.",
    "BANTUAN PESANAN": "ORDER SUPPORT",
    "Pengajuan pembatalan": "Cancellation requests",
    "Tinjau permintaan pembatalan sebelum keputusan diteruskan ke pembeli.": "Review cancellation requests before sharing a decision with the customer.",
    "PUSAT PENYELESAIAN": "RESOLUTION CENTER",
    "Bukti retur & sengketa": "Return evidence & disputes",
    "Tinjau bukti dari pembeli dan ajukan peninjauan ke tim bantuan Kurostore bila diperlukan.": "Review customer evidence and ask Kurostore support to investigate when needed.",
    "Pengiriman dan pelacakan akan terhubung saat integrasi pesanan dan kurir tersedia.": "Shipping and tracking will be connected when order and courier integrations are available.",
    "PENGIRIMAN MASSAL": "BULK SHIPPING",
    "Proses dan cetak dokumen": "Process and print documents",
    "Kelola ratusan resi, airway bill, picking list, packing list, dan permintaan pick-up bersama.": "Manage hundreds of shipping labels, airway bills, picking lists, packing lists, and pickup requests together.",
    "PILIHAN KURIR": "COURIER OPTIONS",
    "Layanan kirim & COD": "Shipping & cash on delivery",
    "Atur layanan reguler, hemat, kargo, same-day, instan, serta opsi bayar di tempat jika didukung kurir.": "Set up regular, economy, cargo, same-day, and instant delivery, plus cash on delivery where supported.",
    "PELACAKAN": "TRACKING",
    "Riwayat pengiriman": "Shipping history",
    "Identifikasi paket terlambat dan pantau perkembangan pengiriman.": "Identify delayed packages and track shipments.",
    "KATALOG TOKO": "STORE CATALOG",
    "Tambah dan perbarui nama, deskripsi, kategori, harga, stok, serta status produk.": "Add and update product names, descriptions, categories, prices, stock, and status.",
    "Fitur aktif": "Active feature",
    "Produk tokomu": "Your products",
    "Produk aktif akan tampil di katalog Kurostore.": "Active products appear in the Kurostore catalog.",
    "Cari produk toko": "Search store products",
    "Cari produk...": "Search products...",
    "Tambah produk": "Add product",
    "Memuat produk tokomu…": "Loading your products…",
    "PENGEMBANGAN KATALOG": "CATALOG DEVELOPMENT",
    "Variasi, foto, dan video": "Variants, photos, and videos",
    "Tambah ukuran, warna, media produk, dan panduan ukuran yang lebih lengkap.": "Add sizes, colors, product media, and detailed size guides.",
    "PENGELOLAAN MASSAL": "BULK MANAGEMENT",
    "Impor & edit massal": "Bulk import & editing",
    "Perbarui katalog dengan template Kurostore setelah format impor tersedia.": "Update your catalog with a Kurostore template when import is available.",
    "KUALITAS KATALOG": "CATALOG QUALITY",
    "Status & evaluasi produk": "Product status & review",
    "Pantau produk aktif, stok habis, arsip, serta peninjauan hak cipta, spam kata kunci, dan barang yang dibatasi.": "Track active, out-of-stock, and archived products, as well as copyright, keyword spam, and restricted-item reviews.",
    "Pusat promosi": "Promotion center",
    "Rencanakan kampanye untuk menjangkau lebih banyak pembeli Kurostore.": "Plan campaigns to reach more Kurostore shoppers.",
    "PROMOSI DASAR": "BASIC PROMOTIONS",
    "Voucher & diskon": "Vouchers & discounts",
    "Siapkan voucher pengikut atau toko, diskon produk, dan paket hemat.": "Create follower or store vouchers, product discounts, and bundles.",
    "PROMOSI TOKO": "STORE PROMOTIONS",
    "Flash Sale, kombo & poin": "Flash Sale, bundles & points",
    "Buat promo berbatas waktu, produk tambahan, dan program poin atau koin loyalitas.": "Create limited-time deals, add-on products, and loyalty point or coin programs.",
    "KAMPANYE KUROSTORE": "KUROSTORE CAMPAIGNS",
    "Program & gratis ongkir": "Programs & free shipping",
    "Ikuti kampanye pilihan dan program subsidi ongkir atau cashback saat tersedia.": "Join selected campaigns and shipping subsidy or cashback programs when available.",
    "JANGKAUAN": "REACH",
    "Iklan & afiliasi": "Ads & affiliates",
    "Kelola promosi berbayar, kata kunci, dan kerja sama kreator secara transparan.": "Manage paid promotions, keywords, and creator partnerships transparently.",
    "SIARAN TOKO": "STORE BROADCAST",
    "Live & konten video": "Live & video content",
    "Kenalkan produk melalui sesi siaran dan konten toko jika fitur media tersedia.": "Showcase products through live streams and store content when media features become available.",
    "KEUANGAN": "FINANCES",
    "Keuangan toko": "Store finances",
    "Ringkasan pendapatan dan pencairan akan ditampilkan setelah transaksi Kurostore tercatat.": "Earnings and payouts will be shown after Kurostore transactions are recorded.",
    "TRANSPARANSI": "TRANSPARENCY",
    "Pendapatan & biaya": "Earnings & fees",
    "Lihat rincian transaksi, biaya layanan, serta dana yang siap dicairkan.": "View transaction details, service fees, and funds available for payout.",
    "PENCAIRAN": "PAYOUTS",
    "Saldo & penarikan": "Balance & withdrawals",
    "Pantau saldo penjual dan kelola jadwal pencairan dana.": "Track seller balances and manage payout schedules.",
    "PEMBAYARAN": "PAYMENTS",
    "Rekening bank": "Bank account",
    "Daftarkan rekening penerima dan verifikasi data pencairan secara aman.": "Register a receiving bank account and securely verify payout details.",
    "DATA & ANALISIS": "DATA & ANALYTICS",
    "Analitik bisnis": "Business analytics",
    "Data performa hanya akan muncul dari kunjungan dan transaksi yang benar-benar tercatat.": "Performance data will appear only for recorded visits and transactions.",
    "PERFORMA TOKO": "STORE PERFORMANCE",
    "Omzet & konversi": "Revenue & conversion",
    "Pelajari tren penjualan, pesanan, kunjungan, dan rasio pembelian.": "Review sales, orders, visits, and conversion trends.",
    "PERFORMA PRODUK": "PRODUCT PERFORMANCE",
    "Produk dilihat & dibeli": "Product views & purchases",
    "Temukan produk yang perlu diperbaiki dari data minat pembeli.": "Use customer interest data to identify products to improve.",
    "KESEHATAN TOKO": "STORE HEALTH",
    "Kualitas layanan": "Service quality",
    "Pantau ketepatan pemrosesan, penyelesaian pesanan, dan indikator layanan lain.": "Track processing times, order completion, and other service indicators.",
    "PERFORMA KONTEN": "CONTENT PERFORMANCE",
    "Evaluasi kunjungan dan penjualan yang berasal dari konten toko.": "Review visits and sales from store content.",
    "LAYANAN PELANGGAN": "CUSTOMER SERVICE",
    "Pelanggan & ulasan": "Customers & reviews",
    "Kelola percakapan dan tanggapan pelanggan melalui pengalaman yang aman.": "Manage conversations and customer responses securely.",
    "PERCAKAPAN": "CONVERSATIONS",
    "Pesan & jawaban cepat": "Messages & quick replies",
    "Siapkan pesan sambutan, balasan otomatis, dan pintasan jawaban.": "Set up welcome messages, automatic replies, and quick response shortcuts.",
    "BANTUAN TOKO": "STORE SUPPORT",
    "Asisten balasan": "Reply assistant",
    "Bantu menjawab pertanyaan tentang ketersediaan dan detail produk dengan informasi terverifikasi.": "Answer questions about product availability and details with verified information.",
    "REPUTASI": "REPUTATION",
    "Ulasan pembeli": "Customer reviews",
    "Tinjau dan tanggapi ulasan pembeli setelah fitur ulasan tersedia.": "Review and respond to customer reviews when the feature becomes available.",
    "IDENTITAS TOKO": "STORE IDENTITY",
    "Atur tampilan toko dan preferensi operasional Kurostore.": "Manage your store's appearance and Kurostore operating preferences.",
    "TAMPILAN TOKO": "STORE APPEARANCE",
    "Etalase & dekorasi": "Storefront & design",
    "Atur banner, susunan produk, dan tampilan halaman toko.": "Manage banners, product layout, and your store page.",
    "ORGANISASI": "ORGANIZATION",
    "Kategori khusus toko": "Custom store categories",
    "Buat koleksi agar pembeli lebih mudah menjelajahi katalog.": "Create collections to help customers browse your catalog.",
    "Mode libur": "Holiday mode",
    "Atur ketersediaan tokomu saat tidak dapat memproses pesanan.": "Set your store availability when you cannot process orders.",
    "AKSES TOKO": "STORE ACCESS",
    "Tim & akses pengguna": "Team & user access",
    "Kelola akses staf secara bertahap dengan izin yang sesuai tugasnya.": "Manage staff access with permissions suited to each role.",
    "INFORMASI KATALOG": "CATALOG INFORMATION",
    "Tutup": "Close",
    "Nama produk": "Product name",
    "Jelaskan detail produkmu.": "Describe your product.",
    "URL foto produk (opsional)": "Product photo URL (optional)",
    "Atau unggah foto dari perangkat (maks. 10 MB)": "Or upload a photo from your device (max. 10 MB)",
    "Pratinjau foto produk": "Product photo preview",
    "Tanpa kategori": "No category",
    "Harga (Rp)": "Price (Rp)",
    "Stok": "Stock",
    "Status produk": "Product status",
    "Draft — belum ditampilkan": "Draft — not displayed",
    "Aktif — tampil di katalog": "Active — shown in catalog",
    "Batal": "Cancel",
    "Simpan produk": "Save product",
    "Memuat data katalog…": "Loading catalog data…",
    "Produk berhasil ditambahkan.": "Product added successfully.",
    "Produk berhasil diperbarui.": "Product updated successfully.",
    "Produk tidak dapat disimpan.": "The product could not be saved.",
    "Perubahan produk berhasil disimpan.": "Product changes saved successfully.",
    "Perubahan produk tidak dapat disimpan.": "Product changes could not be saved.",
    "Tidak ada produk di tokomu.": "You have no products in your store.",
    "Gagal memuat produk tokomu.": "Your products could not be loaded.",
  });
  Object.assign(translations.ja, {
    "UNDANGAN SELLER KUROSTORE": "KUROSTORE販売者招待",
    "Aktifkan akun seller": "販売者アカウントを有効化",
    "Buat kata sandi untuk menyelesaikan penerimaan undangan.": "招待を完了するためにパスワードを作成してください。",
    "Kata sandi baru": "新しいパスワード",
    "Konfirmasi kata sandi": "パスワードを確認",
    "Aktifkan akun": "アカウントを有効化",
    "Akun seller berhasil diaktifkan.": "販売者アカウントが有効になりました。",
    "Masuk ke Kurostore": "Kurostoreにログイン",
    "Tautan undangan tidak valid atau sudah kedaluwarsa. Minta admin mengirim undangan baru.": "招待リンクが無効、または期限切れです。管理者に新しい招待を依頼してください。",
    "Dashboard ini hanya tersedia untuk akun dengan role admin.": "このダッシュボードは管理者アカウントのみ利用できます。",
    "PUSAT ADMIN": "管理センター",
    "Semua tentang tokomu,": "ショップに関するすべてを、",
    "dalam satu tempat.": "ここで管理。",
    "Selamat datang di pusat kendali Kurostore. Berikut kabar terbaru dari tokomu.": "Kurostore管理センターへようこそ。ショップの最新情報を確認できます。",
    "Admin Kurostore": "Kurostore管理者",
    "Menunggu data terbaru": "最新データを待機中",
    "Muat ulang data": "データを再読み込み",
    "Masuk sebagai admin": "管理者としてログイン",
    "Masuk ke akun admin": "管理者アカウントにログイン",
    "Akses admin diperlukan": "管理者権限が必要です",
    "Akunmu tidak memiliki akses ke dashboard admin.": "このアカウントには管理ダッシュボードへのアクセス権がありません。",
    "Ringkasan toko": "ショップ概要",
    "Pengajuan menunggu": "審査待ちの申請",
    "Lihat pengajuan seller": "販売者申請を見る",
    "Lihat pengajuan": "申請を見る",
    "Seller aktif": "有効な販売者",
    "toko terdaftar": "登録済みショップ",
    "Produk aktif": "販売中の商品",
    "Kategori aktif": "有効なカテゴリ",
    "siap digunakan": "利用可能",
    "Stok menipis": "在庫僅少",
    "Cek stok": "在庫を確認",
    "PANTAU LAYANAN": "サービス状況",
    "Kondisi sistem": "システム状況",
    "Pengecekan koneksi layanan yang digunakan Kurostore.": "Kurostoreが利用するサービスへの接続を確認します。",
    "Memeriksa layanan…": "サービスを確認中…",
    "API di Vercel": "Vercel API",
    "Memeriksa fungsi aplikasi…": "アプリの機能を確認中…",
    "Memeriksa": "確認中",
    "Database Supabase": "Supabaseデータベース",
    "Memeriksa koneksi database…": "データベース接続を確認中…",
    "Supabase Auth": "Supabase Auth",
    "Memeriksa autentikasi admin…": "管理者認証を確認中…",
    "Payment gateway": "決済ゲートウェイ",
    "Belum terintegrasi; pembayaran belum dapat diproses.": "未連携のため、決済を処理できません。",
    "Belum aktif": "無効",
    "Status layanan diperbarui otomatis setiap 10 detik.": "サービス状況は10秒ごとに自動更新されます。",
    "TINDAKAN ADMIN": "管理者操作",
    "Pengajuan seller": "販売者申請",
    "Memuat pengajuan…": "申請を読み込み中…",
    "Cari pengajuan seller": "販売者申請を検索",
    "Cari nama atau deskripsi toko": "ショップ名または説明で検索",
    "Semua pengajuan sudah ditinjau": "すべての申請を確認済みです",
    "Pengajuan seller baru akan muncul di halaman ini.": "新しい販売者申請がここに表示されます。",
    "PEMBERITAHUAN": "お知らせ",
    "Perlu perhatian": "要確認",
    "Memeriksa kondisi toko…": "ショップ状況を確認中…",
    "Belum ada hal yang perlu ditindaklanjuti.": "対応が必要な項目はありません。",
    "INVENTARIS": "在庫",
    "Produk aktif dengan stok 5 atau kurang.": "在庫が5個以下の販売中商品。",
    "Semua aman. Belum ada produk yang stoknya menipis.": "問題ありません。在庫が少ない商品はありません。",
    "JELAJAHI": "メニュー",
    "Akses cepat": "クイックアクセス",
    "Lihat produk yang tersedia": "販売中の商品を見る",
    "Etalase toko": "ショップページ",
    "Lihat Kurostore sebagai pembeli": "購入者としてKurostoreを見る",
    "Toko berkembang,": "ショップの成長を、",
    "mulai dari sini.": "ここから始めましょう。",
    "Kelola produk dan pantau performa tokomu di Kurostore.": "Kurostoreで商品を管理し、ショップの実績を確認できます。",
    "Menunggu data katalog": "カタログデータを待機中",
    "Perbarui katalog": "カタログを更新",
    "Masuk ke akun seller": "販売者アカウントにログイン",
    "Masuk untuk mengelola produk dan melihat ringkasan tokomu.": "ログインして商品を管理し、ショップ概要を確認してください。",
    "Akses seller diperlukan": "販売者権限が必要です",
    "Akunmu belum memiliki akses ke Seller Center.": "このアカウントには販売者センターへのアクセス権がありません。",
    "Ajukan tokomu": "ショップを申請",
    "TOKO SAYA": "マイショップ",
    "Ringkasan": "概要",
    "OPERASIONAL": "運営",
    "Pesanan": "注文",
    "Segera": "近日",
    "Pengiriman": "配送",
    "Aktif": "有効",
    "KEMBANGKAN TOKO": "ショップを成長させる",
    "Promosi": "プロモーション",
    "Keuangan": "財務",
    "Analitik": "分析",
    "Pelanggan": "顧客",
    "Pengaturan toko": "ショップ設定",
    "Fitur Seller Center dikembangkan bertahap untuk tokomu.": "販売者センターの機能は順次追加されます。",
    "Pantau katalog dan akses semua kebutuhan tokomu dari sini.": "ここからカタログを確認し、ショップ機能にアクセスできます。",
    "Ringkasan produk": "商品概要",
    "Produk dimuat": "読み込まれた商品数",
    "maksimal 100 terbaru": "最新100件まで",
    "tampil di katalog": "カタログに表示",
    "stok 5 atau kurang": "在庫5個以下",
    "Total terjual": "販売数",
    "akumulasi produk": "商品合計",
    "AKSES CEPAT": "クイックアクセス",
    "Apa yang ingin kamu kelola?": "何を管理しますか？",
    "Atur katalog, harga, dan stok": "カタログ、価格、在庫を管理",
    "Bisa digunakan": "利用可能",
    "Pantau proses pesanan pembeli": "購入者の注文を確認",
    "Segera hadir": "近日公開",
    "Rencanakan promo dan diskon toko": "ショップのキャンペーンや割引を計画",
    "Kenali perkembangan tokomu": "ショップの成長を確認",
    "Menu yang berlabel “Segera” belum memiliki layanan aktif. Data pesanan, saldo, dan performa tidak ditampilkan sebelum sumber datanya tersedia.": "「近日」表示のメニューはまだ有効ではありません。注文、残高、実績のデータは、情報源が利用可能になるまで表示されません。",
    "Alur pesanan akan tersedia setelah proses checkout dan penyimpanan pesanan Kurostore aktif.": "Kurostoreの購入手続きと注文保存が有効になると、注文管理を利用できます。",
    "STATUS PESANAN": "注文状況",
    "Belum dibayar": "未払い",
    "Daftar pesanan yang menunggu pembayaran.": "支払い待ちの注文。",
    "Belum tersedia": "未対応",
    "Perlu dikirim": "発送準備中",
    "Pesanan yang perlu disiapkan dan diserahkan ke kurir.": "梱包して配送業者に渡す注文。",
    "Sedang dikirim": "配送中",
    "Pantau pesanan yang sedang dalam perjalanan.": "配送中の注文を追跡します。",
    "Selesai": "完了",
    "Riwayat pesanan yang telah diterima pembeli.": "購入者が受け取った注文履歴。",
    "Dibatalkan": "キャンセル",
    "Periksa pesanan yang dibatalkan dan alasan pembatalannya.": "キャンセルされた注文とその理由を確認します。",
    "Pengembalian": "返品",
    "Tinjau permintaan retur dan pengembalian dana secara transparan.": "返品・返金申請を確認します。",
    "BANTUAN PESANAN": "注文サポート",
    "Pengajuan pembatalan": "キャンセル申請",
    "Tinjau permintaan pembatalan sebelum keputusan diteruskan ke pembeli.": "購入者に回答する前にキャンセル申請を確認します。",
    "PUSAT PENYELESAIAN": "問題解決センター",
    "Bukti retur & sengketa": "返品証拠と異議申し立て",
    "Tinjau bukti dari pembeli dan ajukan peninjauan ke tim bantuan Kurostore bila diperlukan.": "購入者からの証拠を確認し、必要に応じてKurostoreサポートに調査を依頼します。",
    "Pengiriman dan pelacakan akan terhubung saat integrasi pesanan dan kurir tersedia.": "注文と配送業者の連携が利用可能になると、配送と追跡を利用できます。",
    "PENGIRIMAN MASSAL": "一括配送",
    "Proses dan cetak dokumen": "書類の処理と印刷",
    "Kelola ratusan resi, airway bill, picking list, packing list, dan permintaan pick-up bersama.": "配送伝票、航空貨物運送状、ピッキングリスト、梱包リスト、集荷依頼をまとめて管理します。",
    "PILIHAN KURIR": "配送業者の選択",
    "Layanan kirim & COD": "配送と代金引換",
    "Atur layanan reguler, hemat, kargo, same-day, instan, serta opsi bayar di tempat jika didukung kurir.": "通常、エコノミー、貨物、当日、即時配送や、対応業者の代金引換を設定します。",
    "PELACAKAN": "追跡",
    "Riwayat pengiriman": "配送履歴",
    "Identifikasi paket terlambat dan pantau perkembangan pengiriman.": "遅延荷物を確認し、配送状況を追跡します。",
    "KATALOG TOKO": "ショップカタログ",
    "Tambah dan perbarui nama, deskripsi, kategori, harga, stok, serta status produk.": "商品名、説明、カテゴリ、価格、在庫、ステータスを追加・更新します。",
    "Fitur aktif": "利用可能な機能",
    "Produk tokomu": "ショップの商品",
    "Produk aktif akan tampil di katalog Kurostore.": "販売中の商品はKurostoreのカタログに表示されます。",
    "Cari produk toko": "ショップの商品を検索",
    "Cari produk...": "商品を検索...",
    "Tambah produk": "商品を追加",
    "Memuat produk tokomu…": "ショップの商品を読み込み中…",
    "Variasi, foto, dan video": "バリエーション、写真、動画",
    "Tambah ukuran, warna, media produk, dan panduan ukuran yang lebih lengkap.": "サイズ、色、商品画像、詳しいサイズガイドを追加します。",
    "Impor & edit massal": "一括インポート・編集",
    "Perbarui katalog dengan template Kurostore setelah format impor tersedia.": "インポート機能の提供後、Kurostoreのテンプレートでカタログを更新します。",
    "Status & evaluasi produk": "商品ステータスと審査",
    "Pantau produk aktif, stok habis, arsip, serta peninjauan hak cipta, spam kata kunci, dan barang yang dibatasi.": "販売中、在庫切れ、アーカイブ商品や、著作権、キーワードスパム、禁止商品の審査状況を確認します。",
    "Pusat promosi": "プロモーションセンター",
    "Rencanakan kampanye untuk menjangkau lebih banyak pembeli Kurostore.": "キャンペーンを計画して、より多くのKurostore利用者に届けましょう。",
    "Voucher & diskon": "クーポンと割引",
    "Siapkan voucher pengikut atau toko, diskon produk, dan paket hemat.": "フォロワー・ショップクーポン、商品割引、お得なセットを作成します。",
    "Flash Sale, kombo & poin": "フラッシュセール、セット、ポイント",
    "Buat promo berbatas waktu, produk tambahan, dan program poin atau koin loyalitas.": "期間限定キャンペーン、追加商品、ポイント・コインプログラムを作成します。",
    "Program & gratis ongkir": "キャンペーンと送料無料",
    "Ikuti kampanye pilihan dan program subsidi ongkir atau cashback saat tersedia.": "利用可能なキャンペーン、送料補助、キャッシュバックに参加します。",
    "Iklan & afiliasi": "広告とアフィリエイト",
    "Kelola promosi berbayar, kata kunci, dan kerja sama kreator secara transparan.": "有料プロモーション、キーワード、クリエイターとの提携を管理します。",
    "Live & konten video": "ライブ配信と動画",
    "Kenalkan produk melalui sesi siaran dan konten toko jika fitur media tersedia.": "メディア機能の提供後、配信やショップ動画で商品を紹介します。",
    "Keuangan toko": "ショップの財務",
    "Ringkasan pendapatan dan pencairan akan ditampilkan setelah transaksi Kurostore tercatat.": "Kurostoreで取引が記録されると、売上と出金の概要が表示されます。",
    "Pendapatan & biaya": "売上と手数料",
    "Lihat rincian transaksi, biaya layanan, serta dana yang siap dicairkan.": "取引明細、サービス手数料、出金可能な金額を確認します。",
    "Saldo & penarikan": "残高と出金",
    "Pantau saldo penjual dan kelola jadwal pencairan dana.": "販売者残高と出金スケジュールを管理します。",
    "Rekening bank": "銀行口座",
    "Daftarkan rekening penerima dan verifikasi data pencairan secara aman.": "受取口座を登録し、出金情報を安全に確認します。",
    "Analitik bisnis": "ビジネス分析",
    "Data performa hanya akan muncul dari kunjungan dan transaksi yang benar-benar tercatat.": "実際に記録された訪問と取引のみが実績データに反映されます。",
    "Omzet & konversi": "売上とコンバージョン",
    "Pelajari tren penjualan, pesanan, kunjungan, dan rasio pembelian.": "販売、注文、訪問、購入率の傾向を確認します。",
    "Produk dilihat & dibeli": "閲覧・購入された商品",
    "Temukan produk yang perlu diperbaiki dari data minat pembeli.": "購入者の関心データから改善が必要な商品を見つけます。",
    "Kualitas layanan": "サービス品質",
    "Pantau ketepatan pemrosesan, penyelesaian pesanan, dan indikator layanan lain.": "処理時間、注文完了率などのサービス指標を確認します。",
    "Evaluasi kunjungan dan penjualan yang berasal dari konten toko.": "ショップコンテンツからの訪問と売上を評価します。",
    "Pelanggan & ulasan": "顧客とレビュー",
    "Kelola percakapan dan tanggapan pelanggan melalui pengalaman yang aman.": "安全な環境で顧客とのやり取りや返信を管理します。",
    "Pesan & jawaban cepat": "メッセージとクイック返信",
    "Siapkan pesan sambutan, balasan otomatis, dan pintasan jawaban.": "ウェルカムメッセージ、自動返信、返信ショートカットを設定します。",
    "Asisten balasan": "返信アシスタント",
    "Bantu menjawab pertanyaan tentang ketersediaan dan detail produk dengan informasi terverifikasi.": "確認済みの情報を使って、在庫や商品の詳細に関する質問に回答します。",
    "Ulasan pembeli": "購入者レビュー",
    "Tinjau dan tanggapi ulasan pembeli setelah fitur ulasan tersedia.": "レビュー機能の提供後、購入者のレビューを確認して返信します。",
    "Atur tampilan toko dan preferensi operasional Kurostore.": "ショップの外観とKurostoreの運営設定を管理します。",
    "Etalase & dekorasi": "ショップページとデザイン",
    "Atur banner, susunan produk, dan tampilan halaman toko.": "バナー、商品配置、ショップページの表示を設定します。",
    "Kategori khusus toko": "ショップ独自カテゴリ",
    "Buat koleksi agar pembeli lebih mudah menjelajahi katalog.": "購入者が商品を探しやすいコレクションを作成します。",
    "Mode libur": "休業モード",
    "Atur ketersediaan tokomu saat tidak dapat memproses pesanan.": "注文を処理できない期間のショップ状況を設定します。",
    "Tim & akses pengguna": "チームとユーザー権限",
    "Kelola akses staf secara bertahap dengan izin yang sesuai tugasnya.": "役割に応じた権限でスタッフのアクセスを管理します。",
    "INFORMASI KATALOG": "カタログ情報",
    "Tutup": "閉じる",
    "Nama produk": "商品名",
    "Jelaskan detail produkmu.": "商品の詳細を入力してください。",
    "URL foto produk (opsional)": "商品写真URL（任意）",
    "Atau unggah foto dari perangkat (maks. 10 MB)": "または端末から写真をアップロード（最大10MB）",
    "Pratinjau foto produk": "商品写真のプレビュー",
    "Tanpa kategori": "カテゴリなし",
    "Harga (Rp)": "価格（Rp）",
    "Status produk": "商品ステータス",
    "Draft — belum ditampilkan": "下書き — 非表示",
    "Aktif — tampil di katalog": "有効 — カタログに表示",
    "Batal": "キャンセル",
    "Simpan produk": "商品を保存",
    "Memuat data katalog…": "カタログデータを読み込み中…",
    "Produk berhasil ditambahkan.": "商品を追加しました。",
    "Produk berhasil diperbarui.": "商品を更新しました。",
    "Produk tidak dapat disimpan.": "商品を保存できませんでした。",
    "Perubahan produk berhasil disimpan.": "商品情報を保存しました。",
    "Perubahan produk tidak dapat disimpan.": "商品情報を保存できませんでした。",
    "Tidak ada produk di tokomu.": "ショップに商品はありません。",
    "Gagal memuat produk tokomu.": "ショップの商品を読み込めませんでした。",
  });
  Object.assign(translations.en, {
    "Banner layanan Kurostore": "Kurostore services banner",
    "1 dari 2: Pulsa dan Tagihan": "1 of 2: Mobile Credit and Bills",
    "2 dari 2: Top Up All Games": "2 of 2: Top Up All Games",
    "Pulsa dan Tagihan Kurostore: top up pulsa dan bayar berbagai tagihan dengan cepat, aman, dan praktis.": "Kurostore mobile credit and bills: top up mobile credit and pay bills quickly, safely, and easily.",
    "KUROSTORE · DIGITAL GAME": "KUROSTORE · DIGITAL GAMES",
    "TOP UP": "TOP UP",
    "ALL GAMES": "ALL GAMES",
    "Diamond, Robux, Lunite, dan lainnya. Siapkan petualanganmu bersama game favorit.": "Diamonds, Robux, Lunite, and more. Get ready for your next favorite game.",
    "GAME LIBRARY": "GAME LIBRARY",
    "06 TITLES": "6 GAMES",
    "MOBA": "MOBA",
    "DIAMOND": "DIAMONDS",
    "WUTHERING": "WUTHERING",
    "WAVES": "WAVES",
    "GENSHIN": "GENSHIN",
    "IMPACT": "IMPACT",
    "YOUR NEXT ADVENTURE": "YOUR NEXT ADVENTURE",
    "KUROSTORE DIGITAL SERVICE": "KUROSTORE DIGITAL SERVICES",
    "Top up dan bayar kebutuhan digitalmu": "Top up and pay for digital services",
    "Pilih layanan, masukkan nomor tujuan, lalu pilih produk yang sesuai.": "Choose a service, enter the destination number, then select a product.",
    "Layanan digital": "Digital services",
    "Katalog sedang diperbarui. Produk dan harga belum tersedia untuk transaksi.": "The catalog is being updated. Products and prices are not available for purchase yet.",
    "KOMUNIKASI": "COMMUNICATION",
    "Pulsa & Komunikasi": "Mobile Credit & Communication",
    "Pulsa": "Mobile credit",
    "Paket Data": "Data packages",
    "Telepon & SMS": "Calls & SMS",
    "HIBURAN & DIGITAL": "ENTERTAINMENT & DIGITAL",
    "Game & Voucher": "Games & Vouchers",
    "Top Up Game": "Game top-up",
    "Voucher Streaming": "Streaming vouchers",
    "Voucher Digital": "Digital vouchers",
    "E-Wallet": "E-wallet",
    "TAGIHAN & LAYANAN": "BILLS & SERVICES",
    "Rumah & Lainnya": "Home & More",
    "Token Listrik": "Electricity tokens",
    "Tagihan Listrik": "Electricity bills",
    "PDAM": "Water bills",
    "Internet & TV Kabel": "Internet & Cable TV",
    "BPJS": "BPJS",
    "Pajak": "Taxes",
    "Tiket & Transportasi": "Tickets & Transportation",
    "PILIHAN LAYANAN": "SERVICE OPTIONS",
    "Kembali": "Back",
    "Katalog dan harga sedang diperbarui. Pemesanan belum tersedia.": "The catalog and prices are being updated. Ordering is not available yet.",
    "PILIH GAME": "CHOOSE A GAME",
    "Pilih game yang ingin di-top up": "Choose a game to top up",
    "Pilih salah satu game untuk melihat pilihan nominal.": "Choose a game to view available amounts.",
    "Mobile Legends": "Mobile Legends",
    "Diamond": "Diamonds",
    "Free Fire": "Free Fire",
    "Roblox": "Roblox",
    "Robux": "Robux",
    "Genshin Impact": "Genshin Impact",
    "Genesis Crystal": "Genesis Crystals",
    "Honkai: Star Rail": "Honkai: Star Rail",
    "Oneiric Shard": "Oneiric Shards",
    "Wuthering Waves": "Wuthering Waves",
    "Lunite": "Lunite",
    "Ganti game": "Change game",
    "DETAIL PEMBELIAN": "PURCHASE DETAILS",
    "Pilih operator": "Choose an operator",
    "Nomor tujuan / ID pelanggan": "Destination number / customer ID",
    "Masuk ke akun Kurostore": "Sign in to your Kurostore account",
    "Ulangi pengecekan": "Check again",
    "PILIH PRODUK": "CHOOSE A PRODUCT",
    "Pilih nominal": "Choose an amount",
    "Harga belum tersedia": "Price not available",
    "Pilih produk": "Choose a product",
    "Pilih nominal yang Anda inginkan. Harga ditampilkan setelah katalog tersedia.": "Choose your preferred amount. Prices will appear when the catalog is available.",
    "Produk dipilih": "Selected product",
    "Belum dipilih": "Not selected",
    "Lanjutkan": "Continue",
    "Layanan belum tersedia": "Service not available",
    "Ubah pilihan": "Change selection",
    "Produk digital dan pembayaran akan tersedia setelah katalog diperbarui.": "Digital products and payments will be available after the catalog is updated.",
    "alt Mobile Legends": "Mobile Legends",
    "Mobile Legends": "Mobile Legends",
    "Free Fire": "Free Fire",
    "Roblox": "Roblox",
    "Genshin Impact": "Genshin Impact",
    "Honkai: Star Rail": "Honkai: Star Rail",
    "Wuthering Waves": "Wuthering Waves",
    "Selesai": "Completed",
    "Nomor tujuan tidak valid.": "Invalid destination number.",
    "Silakan masuk ke akun Kurostore.": "Please sign in to your Kurostore account.",
    "Layanan pengecekan belum tersedia.": "The verification service is not available yet.",
    "Memeriksa akun game…": "Checking game account…",
    "Memeriksa nomor tujuan…": "Checking destination number…",
    "Nama akun berhasil ditemukan.": "Account name found.",
    "Nama akun tidak ditemukan.": "Account name not found.",
    "Pengecekan nama akun gagal. Coba lagi nanti.": "Account name verification failed. Please try again later.",
    "Pilih layanan terlebih dahulu.": "Choose a service first.",
    "Pilih game terlebih dahulu.": "Choose a game first.",
    "Masukkan UID atau nomor tujuan.": "Enter a UID or destination number.",
    "Pastikan UID dan server sudah benar.": "Make sure the UID and server are correct.",
    "Pilih layanan streaming": "Choose a streaming service",
    "Pilih provider": "Choose a provider",
    "Masukkan nomor meter": "Enter the meter number",
    "Masukkan ID pelanggan": "Enter the customer ID",
    "Masukkan nomor pelanggan": "Enter the customer number",
    "Masukkan nomor peserta": "Enter the membership number",
    "Masukkan nomor tagihan": "Enter the bill number",
    "Masukkan kode booking atau nama": "Enter the booking code or name",
    "Masukkan User ID": "Enter your User ID",
    "Masukkan Zone ID": "Enter your Zone ID",
    "Masukkan Player ID": "Enter your Player ID",
    "Masukkan username Roblox": "Enter your Roblox username",
    "Masukkan UID Genshin Impact": "Enter your Genshin Impact UID",
    "Masukkan UID Honkai: Star Rail": "Enter your Honkai: Star Rail UID",
    "Masukkan UID Wuthering Waves": "Enter your Wuthering Waves UID",
    "Pilih salah satu": "Choose one",
    "Masukkan nomor tujuan dengan format yang valid.": "Enter a valid destination number.",
    "Belum ada API publik yang bisa memeriksa nickname Wuthering Waves dari UID. Pastikan nickname langsung di dalam game.": "There is no public API to check Wuthering Waves nicknames by UID. Please verify your nickname in the game.",
    "Kurostore, kembali ke beranda": "Kurostore, back to home",
    "Kurostore | Belanja Lebih Mudah": "Kurostore | Shop with Ease",
    "Selamat datang di Kurostore": "Welcome to Kurostore",
    "belanja lebih mudah": "shop with ease",
    "Belanja lebih mudah": "Shop with ease",
    "Kurostore, beranda": "Kurostore, home",
    "Cari produk yang kamu inginkan...": "Search for products...",
    "Selamat datang": "Welcome",
    "Masuk / Daftar": "Sign in / Register",
    "Keranjang belanja": "Shopping cart",
    "Pengaturan dan akun": "Settings and account",
    "Buka menu navigasi": "Open navigation menu",
    "Navigasi utama": "Main navigation",
    "Beranda": "Home",
    "Semua Kategori": "All Categories",
    "Produk Terbaru": "New Arrivals",
    "Promo": "Promotions",
    "Butuh bantuan?": "Need help?",
    "Sorotan Kurostore": "Kurostore Highlights",
    "Temukan yang kamu cari, dengan cara yang mudah.": "Find what you are looking for, the easy way.",
    "Jelajahi pilihan produk menarik dan temukan pengalaman belanja yang nyaman di Kurostore.": "Explore great products and enjoy a convenient shopping experience at Kurostore.",
    "Mulai jelajahi": "Start exploring",
    "Logo Kurostore": "Kurostore logo",
    "Banner kolaborasi spesial Kurostore dan Wuthering Waves: koleksi merchandise eksklusif": "Special Kurostore and Wuthering Waves collaboration: exclusive merchandise collection",
    "Kolaborasi Kurostore dan Wuthering Waves": "Kurostore and Wuthering Waves collaboration",
    "Kontrol banner": "Banner controls",
    "Tampilkan slide sebelumnya": "Show previous slide",
    "Pilih slide": "Choose a slide",
    "Tampilkan slide berikutnya": "Show next slide",
    "Jelajahi Kurostore": "Explore Kurostore",
    "Buka wishlist": "Open wishlist",
    "Produk baru, segera hadir": "New products coming soon",
    "Produk Baru": "New Products",
    "Segera hadir": "Coming soon",
    "Promo pilihan, segera hadir": "Featured promotions coming soon",
    "Promo Pilihan": "Featured Promotions",
    "Kolaborasi eksklusif, segera hadir": "Exclusive collaboration coming soon",
    "Toko unggulan, segera hadir": "Featured stores coming soon",
    "Toko Unggulan": "Featured Stores",
    "Toko Unggulan": "Featured Stores",
    "KuroPay, segera hadir": "KuroPay coming soon",
    "Voucher belanja, segera hadir": "Shopping vouchers coming soon",
    "Pulsa dan tagihan, pilih layanan": "Mobile credit and bills, choose a service",
    "Semua kategori dan produk": "All categories and products",
    "Elektronik": "Electronics",
    "Gadget dan perangkat": "Gadgets and devices",
    "Baju Pria": "Men's Clothing",
    "Gaya untuk setiap kesempatan": "Styles for every occasion",
    "Baju Wanita": "Women's Clothing",
    "Temukan gaya favoritmu": "Find your favorite style",
    "Sepatu Pria": "Men's Shoes",
    "Langkah nyaman dan keren": "Comfortable, stylish steps",
    "Sepatu Wanita": "Women's Shoes",
    "Lengkapi penampilanmu": "Complete your look",
    "Makanan & Minuman": "Food & Drinks",
    "Camilan hingga minuman favorit": "From snacks to favorite drinks",
    "Hobi & Koleksi": "Hobbies & Collectibles",
    "Temukan barang kesukaanmu": "Find the things you love",
    "Merchandise": "Merchandise",
    "Item spesial dan edisi favorit": "Special items and favorite editions",
    "Voucher & Produk Digital": "Vouchers & Digital Products",
    "Voucher belanja dan hiburan": "Shopping and entertainment vouchers",
    "Tas & Aksesori": "Bags & Accessories",
    "Teman untuk aktivitas harian": "Everyday companions",
    "Kesehatan & Kecantikan": "Health & Beauty",
    "Rawat diri dan jaga kesehatan": "Care for yourself and your health",
    "Rumah & Gaya Hidup": "Home & Lifestyle",
    "Bikin ruang makin nyaman": "Make your space more comfortable",
    "KATALOG KUROSTORE": "KUROSTORE CATALOG",
    "Semua produk": "All products",
    "Produk dari berbagai kategori ditampilkan bersama.": "Products from all categories are shown together.",
    "Urutkan": "Sort",
    "Harga terendah": "Lowest price",
    "Harga tertinggi": "Highest price",
    "Tampilkan semua kategori": "Show all categories",
    "Produk belum tersedia": "No products available",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "Products could not be loaded. Please reload the page.",
    "Produk aktif akan muncul di sini saat sudah tersedia.": "Active products will appear here when available.",
    "Muat produk lainnya": "Load more products",
    "PROMO SPESIAL": "SPECIAL PROMOTIONS",
    "Flash Sale": "Flash Sale",
    "Berakhir dalam": "Ends in",
    "Waktu tersisa Flash Sale": "Time remaining in Flash Sale",
    "Jam": "Hours",
    "Menit": "Minutes",
    "Detik": "Seconds",
    "Produk Flash Sale segera hadir": "Flash Sale products coming soon",
    "Lihat halaman Flash Sale": "View Flash Sale",
    "KATALOG TERBARU": "LATEST CATALOG",
    "Produk tersedia": "Available products",
    "Produk terbaru sedang dimuat": "Loading new products",
    "Produk dari katalog akan muncul di sini.": "Catalog products will appear here.",
    "Lihat semua produk": "View all products",
    "PILIHAN KATALOG": "CATALOG PICKS",
    "Pilihan Produk": "Product Picks",
    "Dari katalog": "From the catalog",
    "Pilihan produk sedang dimuat": "Loading product picks",
    "Temukan produk yang tersedia di katalog Kurostore.": "Find products available in the Kurostore catalog.",
    "Jelajahi katalog": "Explore the catalog",
    "PUNYA PRODUK UNTUK DIJUAL?": "HAVE PRODUCTS TO SELL?",
    "Buka tokomu di Kurostore": "Open your store on Kurostore",
    "Jangkau lebih banyak pembeli dan kembangkan bisnismu bersama kami.": "Reach more buyers and grow your business with us.",
    "Mulai jadi seller": "Become a seller",
    "KENALAN DENGAN KAMI": "GET TO KNOW US",
    "Tentang Kurostore": "About Kurostore",
    "Kurostore hadir untuk membuat pengalaman menemukan kebutuhan dan barang favorit terasa lebih mudah.": "Kurostore makes it easier to find everyday essentials and favorite items.",
    "Jelajahi berbagai kategori, mulai dari elektronik, pakaian, makanan dan minuman, hingga hobi dan koleksi. Simpan barang yang kamu inginkan ke Wishlist agar mudah ditemukan kembali.": "Explore categories from electronics and clothing to food, drinks, hobbies, and collectibles. Save items to your wishlist so you can easily find them again.",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "We continue to expand Kurostore's selection and features. Product and promotion details will appear as they become available.",
    "Kenali Kurostore lebih dekat": "Learn more about Kurostore",
    "Hal yang bisa kamu temukan di Kurostore": "What you can find on Kurostore",
    "Ragam kategori": "A wide range of categories",
    "Jelajahi berbagai kebutuhan dan minat.": "Explore products for different needs and interests.",
    "Wishlist praktis": "A convenient wishlist",
    "Promo dan pilihan baru": "Promotions and new picks",
    "Pantau halaman ini untuk pembaruan Kurostore.": "Check back here for Kurostore updates.",
    "Jelajahi": "Explore",
    "Semua Produk": "All Products",
    "Detail Produk": "Product Details",
    "Akun & Belanja": "Account & Shopping",
    "Pesanan Saya": "My Orders",
    "Jadi Seller": "Become a Seller",
    "SELLER CENTER": "SELLER CENTER",
    "01 / PILIHAN TERBATAS": "01 / LIMITED PICKS",
    "02 / WAKTU SPESIAL": "02 / SPECIAL TIMING",
    "03 / SEGERA HADIR": "03 / COMING SOON",
    "Voucher hanya akan muncul jika diterbitkan resmi oleh Kurostore. Poin demo akunmu dapat digunakan saat checkout di mode sandbox.": "Vouchers will only appear if officially issued by Kurostore. Your demo account points can be used at checkout in sandbox mode.",
    "Lihat poin akun": "View account points",
    "Belum ada voucher di sini": "No vouchers here yet",
    "Kalau sudah tersedia, voucher aktif dan syarat pakainya akan muncul di halaman ini.": "Active vouchers and their terms will appear here when available.",
    "Jangan gunakan kode voucher dari pihak tidak resmi.": "Do not use voucher codes from unauthorized sources.",
    "TOKO-TOKO PILIHAN": "FEATURED STORES",
    "Di balik barang bagus,": "Behind every great product,",
    "ada toko hebat.": "there is a great store.",
    "Kami sedang memilih cerita dan karya seller yang pantas mendapat panggung.": "We are choosing seller stories and products that deserve the spotlight.",
    "Direktori toko sedang disiapkan": "The store directory is being prepared",
    "Barang harian": "Everyday items",
    "Yang kecil-kecil tapi bikin hari lebih praktis.": "Small things that make every day easier.",
    "Temukan sentuhan khas dari seller lokal.": "Discover the distinctive touch of local sellers.",
    "Ide sederhana untuk bikin rumah terasa pulang.": "Simple ideas to make your house feel like home.",
    "Direktori belum dibuka, tapi katalog sudah bisa dijelajahi.": "The directory is not open yet, but you can explore the catalog.",
    "Dukung seller lokal, temukan cerita baru.": "Support local sellers and discover new stories.",
    "Belanja lebih mudah.": "Shop with ease.",
    "Tumbuh bersama.": "Grow together.",
    "Belanja lebih mudah. Tumbuh bersama.": "Shop with ease. Grow together.",
    "CERITA KAMI · 01": "OUR STORY · 01",
    "Kurostore adalah ruang untuk menemukan produk menarik dan mendukung seller lokal—dengan pengalaman belanja yang terasa sederhana.": "Kurostore is a place to discover great products and support local sellers through a simple shopping experience.",
    "SEDANG BERTUMBUH": "GROWING TOGETHER",
    "01 / TEMUKAN": "01 / DISCOVER",
    "Pilihan yang terasa dekat.": "Choices that feel close to home.",
    "Temukan barang untuk kebutuhan dan minatmu dari satu tempat.": "Find products for your needs and interests in one place.",
    "02 / DUKUNG": "02 / SUPPORT",
    "Ruang untuk seller.": "A place for sellers.",
    "Kami menyiapkan etalase agar seller dapat memperkenalkan produknya.": "We are building a storefront where sellers can introduce their products.",
    "03 / BERTUMBUH": "03 / GROW",
    "Selangkah demi selangkah.": "One step at a time.",
    "Kurostore masih berkembang. Fitur dan pilihan produk akan bertambah seiring waktu.": "Kurostore is still growing. Features and product selections will expand over time.",
    "Kurostore — perjalanan belanja yang terus berkembang.": "Kurostore — a shopping journey that keeps growing.",
    "Buka pusat akun →": "Open account center →",
    "Buka pusat akun": "Open account center",
    "VOUCHER RESMI": "OFFICIAL VOUCHERS",
    "Hanya kode resmi.": "Official codes only.",
    "Tanpa voucher palsu.": "No fake vouchers.",
    "TIDAK ADA VOUCHER AKTIF": "NO ACTIVE VOUCHERS",
    "Voucher berlaku hanya setelah diterbitkan resmi.": "Vouchers are valid only when officially issued.",
    "Pengaturan akun": "Account Settings",
    "Pilihan Pembayaran": "Payment Methods",
    "Opsi pembayaran mengikuti metode yang tersedia saat transaksi.": "Payment options depend on the methods available at checkout.",
    "Logo metode pembayaran": "Payment method logos",
    "Kurostore. Semua hak dilindungi.": "Kurostore. All rights reserved.",
    "Kembali ke atas": "Back to top",
    "PESANANMU": "YOUR ORDER",
    "Pembayaran aman dengan Midtrans": "Secure payment with Midtrans",
    "Tahapan pemesanan": "Checkout steps",
    "KIRIM KE": "SHIP TO",
    "Pembayaran": "Payment",
    "Masuk ke akun terlebih dahulu untuk memuat keranjang dan melanjutkan checkout.": "Sign in first to load your cart and continue checkout.",
  });
  Object.assign(translations.ja, {
    "Banner layanan Kurostore": "Kurostoreサービスのバナー",
    "1 dari 2: Pulsa dan Tagihan": "1 / 2：携帯電話チャージと請求",
    "2 dari 2: Top Up All Games": "2 / 2：すべてのゲームをチャージ",
    "Pulsa dan Tagihan Kurostore: top up pulsa dan bayar berbagai tagihan dengan cepat, aman, dan praktis.": "Kurostoreで携帯電話のチャージや各種料金のお支払いを、簡単・安全・スピーディーに。",
    "KUROSTORE · DIGITAL GAME": "KUROSTORE · デジタルゲーム",
    "TOP UP": "チャージ",
    "ALL GAMES": "すべてのゲーム",
    "Diamond, Robux, Lunite, dan lainnya. Siapkan petualanganmu bersama game favorit.": "Diamond、Robux、Luniteなど。お気に入りのゲームを楽しみましょう。",
    "GAME LIBRARY": "ゲーム一覧",
    "06 TITLES": "6タイトル",
    "MOBA": "MOBA",
    "DIAMOND": "ダイヤモンド",
    "WUTHERING": "WUTHERING",
    "WAVES": "WAVES",
    "GENSHIN": "GENSHIN",
    "IMPACT": "IMPACT",
    "YOUR NEXT ADVENTURE": "次の冒険へ",
    "KUROSTORE DIGITAL SERVICE": "KUROSTOREデジタルサービス",
    "Top up dan bayar kebutuhan digitalmu": "デジタルサービスをチャージ・支払い",
    "Pilih layanan, masukkan nomor tujuan, lalu pilih produk yang sesuai.": "サービスを選び、宛先番号を入力して商品を選択してください。",
    "Layanan digital": "デジタルサービス",
    "Katalog sedang diperbarui. Produk dan harga belum tersedia untuk transaksi.": "カタログを更新中です。商品と価格はまだ購入できません。",
    "KOMUNIKASI": "通信",
    "Pulsa & Komunikasi": "携帯電話チャージ・通信",
    "Pulsa": "携帯電話チャージ",
    "Paket Data": "データパック",
    "Telepon & SMS": "通話・SMS",
    "HIBURAN & DIGITAL": "エンタメ・デジタル",
    "Game & Voucher": "ゲーム・クーポン",
    "Top Up Game": "ゲームチャージ",
    "Voucher Streaming": "動画配信クーポン",
    "Voucher Digital": "デジタルクーポン",
    "E-Wallet": "電子ウォレット",
    "TAGIHAN & LAYANAN": "請求・サービス",
    "Rumah & Lainnya": "暮らし・その他",
    "Token Listrik": "電気トークン",
    "Tagihan Listrik": "電気料金",
    "PDAM": "水道料金",
    "Internet & TV Kabel": "インターネット・ケーブルテレビ",
    "BPJS": "BPJS",
    "Pajak": "税金",
    "Tiket & Transportasi": "チケット・交通",
    "PILIHAN LAYANAN": "サービス一覧",
    "Kembali": "戻る",
    "Katalog dan harga sedang diperbarui. Pemesanan belum tersedia.": "カタログと価格を更新中です。注文はまだ利用できません。",
    "PILIH GAME": "ゲームを選択",
    "Pilih game yang ingin di-top up": "チャージするゲームを選択",
    "Pilih salah satu game untuk melihat pilihan nominal.": "ゲームを選ぶとチャージ金額が表示されます。",
    "Diamond": "ダイヤモンド",
    "Genshin Impact": "原神",
    "Genesis Crystal": "創世結晶",
    "Oneiric Shard": "星玉",
    "Ganti game": "ゲームを変更",
    "DETAIL PEMBELIAN": "購入情報",
    "Pilih operator": "通信事業者を選択",
    "Nomor tujuan / ID pelanggan": "宛先番号 / 顧客ID",
    "Masuk ke akun Kurostore": "Kurostoreにログイン",
    "Ulangi pengecekan": "再確認",
    "PILIH PRODUK": "商品を選択",
    "Pilih nominal": "金額を選択",
    "Harga belum tersedia": "価格未設定",
    "Pilih produk": "商品を選択",
    "Pilih nominal yang Anda inginkan. Harga ditampilkan setelah katalog tersedia.": "希望する金額を選択してください。カタログ公開後に価格が表示されます。",
    "Produk dipilih": "選択した商品",
    "Belum dipilih": "未選択",
    "Lanjutkan": "続ける",
    "Layanan belum tersedia": "サービスは利用できません",
    "Ubah pilihan": "選択を変更",
    "Produk digital dan pembayaran akan tersedia setelah katalog diperbarui.": "カタログ更新後、デジタル商品と決済が利用可能になります。",
    "Selesai": "完了",
    "Nomor tujuan tidak valid.": "宛先番号が無効です。",
    "Silakan masuk ke akun Kurostore.": "Kurostoreにログインしてください。",
    "Layanan pengecekan belum tersedia.": "確認サービスは利用できません。",
    "Memeriksa akun game…": "ゲームアカウントを確認中…",
    "Memeriksa nomor tujuan…": "宛先番号を確認中…",
    "Nama akun berhasil ditemukan.": "アカウント名が見つかりました。",
    "Nama akun tidak ditemukan.": "アカウント名が見つかりません。",
    "Pengecekan nama akun gagal. Coba lagi nanti.": "アカウント名を確認できませんでした。後でもう一度お試しください。",
    "Pilih layanan terlebih dahulu.": "先にサービスを選択してください。",
    "Pilih game terlebih dahulu.": "先にゲームを選択してください。",
    "Masukkan UID atau nomor tujuan.": "UIDまたは宛先番号を入力してください。",
    "Pastikan UID dan server sudah benar.": "UIDとサーバーが正しいことを確認してください。",
    "Pilih layanan streaming": "動画配信サービスを選択",
    "Pilih provider": "プロバイダーを選択",
    "Masukkan nomor meter": "メーター番号を入力",
    "Masukkan ID pelanggan": "顧客IDを入力",
    "Masukkan nomor pelanggan": "顧客番号を入力",
    "Masukkan nomor peserta": "会員番号を入力",
    "Masukkan nomor tagihan": "請求番号を入力",
    "Masukkan kode booking atau nama": "予約コードまたは名前を入力",
    "Masukkan User ID": "ユーザーIDを入力",
    "Masukkan Zone ID": "ゾーンIDを入力",
    "Masukkan Player ID": "プレイヤーIDを入力",
    "Masukkan username Roblox": "Robloxユーザー名を入力",
    "Masukkan UID Genshin Impact": "原神UIDを入力",
    "Masukkan UID Honkai: Star Rail": "崩壊：スターレイルのUIDを入力",
    "Masukkan UID Wuthering Waves": "鳴潮UIDを入力",
    "Pilih salah satu": "いずれかを選択",
    "Masukkan nomor tujuan dengan format yang valid.": "正しい形式の宛先番号を入力してください。",
    "Belum ada API publik yang bisa memeriksa nickname Wuthering Waves dari UID. Pastikan nickname langsung di dalam game.": "UIDから鳴潮のニックネームを確認できる公開APIはありません。ゲーム内でニックネームをご確認ください。",
    "Kurostore, kembali ke beranda": "Kurostore、ホームに戻る",
    "Kurostore | Belanja Lebih Mudah": "Kurostore | もっと簡単にお買い物",
    "Selamat datang di Kurostore": "Kurostoreへようこそ",
    "belanja lebih mudah": "もっと簡単にお買い物",
    "Belanja lebih mudah": "もっと簡単にお買い物",
    "Kurostore, beranda": "Kurostoreホーム",
    "Cari produk yang kamu inginkan...": "お探しの商品を検索...",
    "Selamat datang": "ようこそ",
    "Masuk / Daftar": "ログイン / 新規登録",
    "Keranjang belanja": "ショッピングカート",
    "Pengaturan dan akun": "設定とアカウント",
    "Buka menu navigasi": "ナビゲーションメニューを開く",
    "Navigasi utama": "メインナビゲーション",
    "Beranda": "ホーム",
    "Semua Kategori": "すべてのカテゴリ",
    "Produk Terbaru": "新商品",
    "Promo": "キャンペーン",
    "Butuh bantuan?": "お困りですか？",
    "Sorotan Kurostore": "Kurostoreのおすすめ",
    "Temukan yang kamu cari, dengan cara yang mudah.": "お探しのものを、簡単に見つけましょう。",
    "Jelajahi pilihan produk menarik dan temukan pengalaman belanja yang nyaman di Kurostore.": "魅力的な商品を見つけて、Kurostoreで快適にお買い物をお楽しみください。",
    "Mulai jelajahi": "商品を見る",
    "Logo Kurostore": "Kurostoreロゴ",
    "Banner kolaborasi spesial Kurostore dan Wuthering Waves: koleksi merchandise eksklusif": "Kurostoreと鳴潮の特別コラボ：限定グッズコレクション",
    "Kolaborasi Kurostore dan Wuthering Waves": "Kurostoreと鳴潮のコラボレーション",
    "Kontrol banner": "バナー操作",
    "Tampilkan slide sebelumnya": "前のスライドを表示",
    "Pilih slide": "スライドを選択",
    "Tampilkan slide berikutnya": "次のスライドを表示",
    "Jelajahi Kurostore": "Kurostoreを見てみる",
    "Buka wishlist": "ウィッシュリストを開く",
    "Produk baru, segera hadir": "新商品、近日公開",
    "Produk Baru": "新商品",
    "Segera hadir": "近日公開",
    "Promo pilihan, segera hadir": "おすすめキャンペーン、近日公開",
    "Promo Pilihan": "おすすめキャンペーン",
    "Kolaborasi eksklusif, segera hadir": "限定コラボ、近日公開",
    "Toko unggulan, segera hadir": "注目ショップ、近日公開",
    "Toko Unggulan": "注目ショップ",
    "Toko Unggulan": "注目ショップ",
    "KuroPay, segera hadir": "KuroPay、近日公開",
    "Voucher belanja, segera hadir": "ショッピングクーポン、近日公開",
    "Pulsa dan tagihan, pilih layanan": "携帯電話チャージ・請求、サービスを選択",
    "Semua kategori dan produk": "すべてのカテゴリと商品",
    "Elektronik": "電子機器",
    "Gadget dan perangkat": "ガジェット・デバイス",
    "Baju Pria": "メンズファッション",
    "Gaya untuk setiap kesempatan": "あらゆるシーンに合うスタイル",
    "Baju Wanita": "レディースファッション",
    "Temukan gaya favoritmu": "お気に入りのスタイルを見つけよう",
    "Sepatu Pria": "メンズシューズ",
    "Langkah nyaman dan keren": "快適でスタイリッシュな一歩",
    "Sepatu Wanita": "レディースシューズ",
    "Lengkapi penampilanmu": "コーディネートを完成",
    "Makanan & Minuman": "食品・飲料",
    "Camilan hingga minuman favorit": "お菓子からお気に入りの飲み物まで",
    "Hobi & Koleksi": "趣味・コレクション",
    "Temukan barang kesukaanmu": "お気に入りのアイテムを見つけよう",
    "Merchandise": "グッズ",
    "Item spesial dan edisi favorit": "特別なアイテムや限定版",
    "Voucher & Produk Digital": "クーポン・デジタル商品",
    "Voucher belanja dan hiburan": "ショッピング・エンタメクーポン",
    "Tas & Aksesori": "バッグ・アクセサリー",
    "Teman untuk aktivitas harian": "毎日の暮らしにぴったり",
    "Kesehatan & Kecantikan": "健康・美容",
    "Rawat diri dan jaga kesehatan": "自分を大切に、健康に過ごそう",
    "Rumah & Gaya Hidup": "ホーム・ライフスタイル",
    "Bikin ruang makin nyaman": "お部屋をもっと快適に",
    "KATALOG KUROSTORE": "KUROSTOREカタログ",
    "Semua produk": "すべての商品",
    "Produk dari berbagai kategori ditampilkan bersama.": "さまざまなカテゴリの商品をまとめて表示します。",
    "Urutkan": "並べ替え",
    "Harga terendah": "価格の安い順",
    "Harga tertinggi": "価格の高い順",
    "Tampilkan semua kategori": "すべてのカテゴリを表示",
    "Produk belum tersedia": "商品はまだありません",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "商品を読み込めませんでした。ページを再読み込みしてください。",
    "Produk tidak dapat dimuat. Coba muat ulang halaman.": "商品を読み込めませんでした。ページを再読み込みしてください。",
    "Produk aktif akan muncul di sini saat sudah tersedia.": "販売中の商品がここに表示されます。",
    "Muat produk lainnya": "さらに商品を読み込む",
    "PROMO SPESIAL": "特別キャンペーン",
    "Flash Sale": "フラッシュセール",
    "Berakhir dalam": "終了まで",
    "Waktu tersisa Flash Sale": "フラッシュセールの残り時間",
    "Jam": "時間",
    "Menit": "分",
    "Detik": "秒",
    "Produk Flash Sale segera hadir": "フラッシュセール商品は近日公開",
    "Lihat halaman Flash Sale": "フラッシュセールを見る",
    "KATALOG TERBARU": "新着カタログ",
    "Produk tersedia": "販売中の商品",
    "Produk terbaru sedang dimuat": "新商品を読み込み中",
    "Produk dari katalog akan muncul di sini.": "カタログの商品がここに表示されます。",
    "Lihat semua produk": "すべての商品を見る",
    "PILIHAN KATALOG": "おすすめ商品",
    "Pilihan Produk": "おすすめ商品",
    "Dari katalog": "カタログから",
    "Pilihan produk sedang dimuat": "おすすめ商品を読み込み中",
    "Temukan produk yang tersedia di katalog Kurostore.": "Kurostoreのカタログから商品を見つけましょう。",
    "Jelajahi katalog": "カタログを見る",
    "PUNYA PRODUK UNTUK DIJUAL?": "商品を販売しませんか？",
    "Buka tokomu di Kurostore": "Kurostoreにショップを開こう",
    "Jangkau lebih banyak pembeli dan kembangkan bisnismu bersama kami.": "より多くのお客様に届けて、一緒にビジネスを成長させましょう。",
    "Mulai jadi seller": "販売者になる",
    "KENALAN DENGAN KAMI": "Kurostoreについて",
    "Tentang Kurostore": "Kurostoreについて",
    "Kurostore hadir untuk membuat pengalaman menemukan kebutuhan dan barang favorit terasa lebih mudah.": "Kurostoreは、必要なものやお気に入りの商品を簡単に見つけられる場所です。",
    "Kami terus mengembangkan pilihan dan fitur di Kurostore. Informasi produk dan promo akan ditampilkan seiring ketersediaannya, supaya kamu bisa mengetahui apa yang sedang tersedia.": "Kurostoreでは商品や機能を拡充しています。商品やキャンペーンの情報は、利用可能になり次第ご案内します。",
    "Kenali Kurostore lebih dekat": "Kurostoreについて詳しく見る",
    "Hal yang bisa kamu temukan di Kurostore": "Kurostoreで見つかるもの",
    "Ragam kategori": "豊富なカテゴリ",
    "Jelajahi berbagai kebutuhan dan minat.": "さまざまなニーズや興味に合った商品を探せます。",
    "Wishlist praktis": "便利なウィッシュリスト",
    "Promo dan pilihan baru": "キャンペーンと新商品",
    "Pantau halaman ini untuk pembaruan Kurostore.": "Kurostoreの最新情報はこちらをご確認ください。",
    "Jelajahi": "商品を見る",
    "Semua Produk": "すべての商品",
    "Detail Produk": "商品詳細",
    "Akun & Belanja": "アカウントとお買い物",
    "Pesanan Saya": "注文履歴",
    "Jadi Seller": "販売者になる",
    "SELLER CENTER": "セラーセンター",
    "01 / PILIHAN TERBATAS": "01 / 数量限定",
    "02 / WAKTU SPESIAL": "02 / 特別な時間",
    "03 / SEGERA HADIR": "03 / 近日公開",
    "Voucher hanya akan muncul jika diterbitkan resmi oleh Kurostore. Poin demo akunmu dapat digunakan saat checkout di mode sandbox.": "クーポンはKurostoreが正式に発行した場合のみ表示されます。デモアカウントのポイントはサンドボックスモードで購入時に利用できます。",
    "Lihat poin akun": "アカウントのポイントを見る",
    "Belum ada voucher di sini": "クーポンはまだありません",
    "Kalau sudah tersedia, voucher aktif dan syarat pakainya akan muncul di halaman ini.": "クーポンが利用可能になると、有効なクーポンと利用条件がここに表示されます。",
    "Jangan gunakan kode voucher dari pihak tidak resmi.": "非公式な相手からのクーポンコードは使用しないでください。",
    "TOKO-TOKO PILIHAN": "おすすめショップ",
    "Di balik barang bagus,": "素敵な商品には、",
    "ada toko hebat.": "素敵なお店があります。",
    "Kami sedang memilih cerita dan karya seller yang pantas mendapat panggung.": "注目に値するセラーのストーリーや商品を選んでいます。",
    "Direktori toko sedang disiapkan": "ショップ一覧を準備中",
    "Barang harian": "日用品",
    "Yang kecil-kecil tapi bikin hari lebih praktis.": "毎日を便利にする、ちょっとしたアイテム。",
    "Temukan sentuhan khas dari seller lokal.": "地元セラーならではの魅力を見つけましょう。",
    "Ide sederhana untuk bikin rumah terasa pulang.": "家をもっと居心地よくするシンプルなアイデア。",
    "Direktori belum dibuka, tapi katalog sudah bisa dijelajahi.": "ショップ一覧は準備中ですが、カタログはご覧いただけます。",
    "Dukung seller lokal, temukan cerita baru.": "地元セラーを応援して、新しいストーリーを見つけましょう。",
    "Belanja lebih mudah.": "もっと簡単にお買い物。",
    "Tumbuh bersama.": "一緒に成長しましょう。",
    "Belanja lebih mudah. Tumbuh bersama.": "もっと簡単にお買い物。一緒に成長しましょう。",
    "CERITA KAMI · 01": "私たちのストーリー · 01",
    "Kurostore adalah ruang untuk menemukan produk menarik dan mendukung seller lokal—dengan pengalaman belanja yang terasa sederhana.": "Kurostoreは、魅力的な商品を見つけ、地元のセラーを応援しながら、シンプルにお買い物を楽しめる場所です。",
    "SEDANG BERTUMBUH": "成長中",
    "01 / TEMUKAN": "01 / 見つける",
    "Pilihan yang terasa dekat.": "身近に感じる商品選び。",
    "Temukan barang untuk kebutuhan dan minatmu dari satu tempat.": "必要なものや興味に合った商品を一か所で見つけられます。",
    "02 / DUKUNG": "02 / 応援する",
    "Ruang untuk seller.": "セラーのための場所。",
    "Kami menyiapkan etalase agar seller dapat memperkenalkan produknya.": "セラーが商品を紹介できるショップページを準備しています。",
    "03 / BERTUMBUH": "03 / 成長する",
    "Selangkah demi selangkah.": "一歩ずつ。",
    "Kurostore masih berkembang. Fitur dan pilihan produk akan bertambah seiring waktu.": "Kurostoreは成長を続けています。機能や商品は今後さらに増えていきます。",
    "Kurostore — perjalanan belanja yang terus berkembang.": "Kurostore — 成長し続けるショッピング体験。",
    "Buka pusat akun →": "アカウントセンターを開く →",
    "Buka pusat akun": "アカウントセンターを開く",
    "VOUCHER RESMI": "公式クーポン",
    "Hanya kode resmi.": "公式コードのみ。",
    "Tanpa voucher palsu.": "偽クーポンはありません。",
    "TIDAK ADA VOUCHER AKTIF": "有効なクーポンはありません",
    "Voucher berlaku hanya setelah diterbitkan resmi.": "クーポンは正式に発行された場合のみ有効です。",
    "Pengaturan akun": "アカウント設定",
    "Pilihan Pembayaran": "お支払い方法",
    "Opsi pembayaran mengikuti metode yang tersedia saat transaksi.": "お支払い方法は決済時に利用可能な方法から選べます。",
    "Logo metode pembayaran": "決済方法のロゴ",
    "Kurostore. Semua hak dilindungi.": "Kurostore. 無断複製・転載を禁じます。",
    "Kembali ke atas": "トップに戻る",
    "Checkout": "購入手続き",
    "PESANANMU": "ご注文",
    "Pembayaran aman dengan Midtrans": "Midtransで安全にお支払い",
    "Tahapan pemesanan": "購入手順",
    "KIRIM KE": "お届け先",
    "Pembayaran": "お支払い",
    "Masuk ke akun terlebih dahulu untuk memuat keranjang dan melanjutkan checkout.": "ログインしてカートを読み込み、購入手続きを続けてください。",
  });

  const dictionary = translations[language];
  if (!dictionary) return;

  const localizeText = (source, targetLanguage = language) => {
    if (targetLanguage === "id") return source;
    const originalText = source.trim();
    if (!originalText) return source;
    const text = originalText.replace(/\s+/g, " ");
    const leading = source.match(/^\s*/)?.[0] ?? "";
    const trailing = source.match(/\s*$/)?.[0] ?? "";
    const targetDictionary = translations[targetLanguage] ?? {};
    let translated = targetDictionary[text] ?? originalText;

    const cartSummary = text.match(/^(\d+) produk · (\d+) barang$/);
    const pointsAmount = text.match(/^([+-]?\d+) poin$/);
    const itemPrice = text.match(/^(.+) \/ item$/);
    const cartCount = text.match(/^(\d+) barang di keranjang$/);
    const savedCount = text.match(/^(\d+) produk tersimpan$/);
    const reviewCount = text.match(/^(\d+) ulasan$/);
    const availableCount = text.match(/^(\d+) tersedia$/);
    const stockCount = text.match(/^Stok (\d+)$/);
    const chooseItem = text.match(/^Pilih (.+)$/);
    const decreaseItem = text.match(/^Kurangi jumlah (.+)$/);
    const increaseItem = text.match(/^Tambah jumlah (.+)$/);
    const removeCartItem = text.match(/^Hapus (.+) dari keranjang$/);
    const removeWishlistItem = text.match(/^Hapus (.+) dari wishlist$/);
    const productDetails = text.match(/^Lihat detail (.+)$/);
    const slideLabel = text.match(/^Tampilkan slide (\d+)$/);
    const categoryCount = text.match(/^Lihat semua kategori \((\d+)\)$/);
    if (!targetDictionary[text] && cartSummary) {
      translated = targetLanguage === "en"
        ? `${cartSummary[1]} ${Number(cartSummary[1]) === 1 ? "product" : "products"} · ${cartSummary[2]} ${Number(cartSummary[2]) === 1 ? "item" : "items"}`
        : `${cartSummary[1]}商品 · ${cartSummary[2]}点`;
    } else if (!targetDictionary[text] && pointsAmount) {
      translated = targetLanguage === "en" ? `${pointsAmount[1]} points` : `${pointsAmount[1]}ポイント`;
    } else if (!targetDictionary[text] && itemPrice) {
      translated = targetLanguage === "en" ? `${itemPrice[1]} / item` : `${itemPrice[1]} / 点`;
    } else if (!targetDictionary[text] && cartCount) {
      translated = targetLanguage === "en"
        ? `${cartCount[1]} ${Number(cartCount[1]) === 1 ? "item" : "items"} in cart`
        : `カート内の商品${cartCount[1]}点`;
    } else if (!targetDictionary[text] && savedCount) {
      translated = targetLanguage === "en" ? `${savedCount[1]} products saved` : `${savedCount[1]}件保存済み`;
    } else if (!targetDictionary[text] && reviewCount) {
      translated = targetLanguage === "en" ? `${reviewCount[1]} reviews` : `${reviewCount[1]}件のレビュー`;
    } else if (!targetDictionary[text] && availableCount) {
      translated = targetLanguage === "en" ? `${availableCount[1]} available` : `${availableCount[1]}点利用可能`;
    } else if (!targetDictionary[text] && stockCount) {
      translated = targetLanguage === "en" ? `Stock ${stockCount[1]}` : `在庫 ${stockCount[1]}`;
    } else if (!targetDictionary[text] && chooseItem) {
      translated = targetLanguage === "en" ? `Select ${chooseItem[1]}` : `${chooseItem[1]}を選択`;
    } else if (!targetDictionary[text] && decreaseItem) {
      translated = targetLanguage === "en" ? `Decrease quantity of ${decreaseItem[1]}` : `${decreaseItem[1]}の数量を減らす`;
    } else if (!targetDictionary[text] && increaseItem) {
      translated = targetLanguage === "en" ? `Increase quantity of ${increaseItem[1]}` : `${increaseItem[1]}の数量を増やす`;
    } else if (!targetDictionary[text] && removeCartItem) {
      translated = targetLanguage === "en" ? `Remove ${removeCartItem[1]} from cart` : `${removeCartItem[1]}をカートから削除`;
    } else if (!targetDictionary[text] && removeWishlistItem) {
      translated = targetLanguage === "en" ? `Remove ${removeWishlistItem[1]} from wishlist` : `${removeWishlistItem[1]}をウィッシュリストから削除`;
    } else if (!targetDictionary[text] && productDetails) {
      translated = targetLanguage === "en" ? `View details for ${productDetails[1]}` : `${productDetails[1]}の詳細を見る`;
    } else if (!targetDictionary[text] && slideLabel) {
      translated = targetLanguage === "en" ? `Show slide ${slideLabel[1]}` : `スライド${slideLabel[1]}を表示`;
    } else if (!targetDictionary[text] && categoryCount) {
      translated = targetLanguage === "en" ? `View all categories (${categoryCount[1]})` : `すべてのカテゴリを見る（${categoryCount[1]}）`;
    }

    return `${leading}${translated}${trailing}`;
  };

  const textSources = window.accountLanguageTextSources
    || (window.accountLanguageTextSources = new WeakMap());
  const attributeSources = window.accountLanguageAttributeSources
    || (window.accountLanguageAttributeSources = new WeakMap());
  const translateTextNode = (node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!textSources.has(node)) textSources.set(node, node.nodeValue ?? "");
    const translated = localizeText(textSources.get(node));
    if (node.nodeValue !== translated) node.nodeValue = translated;
  };
  const translateAttributes = (element) => {
    for (const name of ["aria-label", "placeholder", "title", "alt", "content"]) {
      if (!element.hasAttribute(name)) continue;
      let sources = attributeSources.get(element);
      if (!sources) {
        sources = new Map();
        attributeSources.set(element, sources);
      }
      const current = element.getAttribute(name) ?? "";
      if (!sources.has(name)) {
        sources.set(name, current);
      } else {
        const source = sources.get(name);
        const knownTranslation = ["id", "en", "ja"].some((targetLanguage) =>
          localizeText(source, targetLanguage) === current);
        if (!knownTranslation) sources.set(name, current);
      }
      const source = sources.get(name);
      const translated = localizeText(source);
      if (current !== translated) element.setAttribute(name, translated);
    }
  };
  const translateSubtree = (root) => {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement?.closest("script, style")) translateTextNode(root);
      return;
    }
    if (!(root instanceof Element)) return;
    translateAttributes(root);
    const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let element = elementWalker.nextNode();
    while (element) {
      translateAttributes(element);
      element = elementWalker.nextNode();
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (!node.parentElement?.closest("script, style")) translateTextNode(node);
      node = walker.nextNode();
    }
  };

  window.accountLanguageTranslateSubtree = translateSubtree;
  translateSubtree(document.body);
  translateSubtree(document.head);
  document.documentElement.lang = language;

  if (!window.accountLanguageObserver) {
    window.accountLanguageObserver = new MutationObserver((records) => {
      const activeLanguage = currentAccountPreferences.language;
      if (activeLanguage === "id") return;
      records.forEach((record) => {
        if (record.type === "characterData") {
          window.accountLanguageTranslateSubtree?.(record.target);
        } else if (record.type === "attributes") {
          window.accountLanguageTranslateSubtree?.(record.target);
        } else {
          record.addedNodes.forEach((node) => window.accountLanguageTranslateSubtree?.(node));
        }
      });
    });
    window.accountLanguageObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "placeholder", "title", "alt", "content"],
    });
  }
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
  document.documentElement.lang = next.language;
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
      enableProductCardNavigation(card, product.id);
      const artwork = document.createElement("div");
      artwork.className = "product-card-art product-art-controller all-product-art";
      artwork.innerHTML = '<span class="product-art-orb"></span><svg viewBox="0 0 120 96"><path d="M27 33c3-8 9-12 17-12h32c8 0 14 4 17 12l8 24c3 9-3 15-10 12l-13-9H42l-13 9c-7 3-13-3-10-12l8-24Z"></path><path d="M40 43v14m-7-7h14m28-4h.01M84 52h.01"></path></svg>';
      const artworkLink = document.createElement("a");
      artworkLink.className = "product-art-link";
      artworkLink.href = productDetailHref(product.id);
      artworkLink.setAttribute("aria-label", `Lihat detail ${product.name}`);
      appendProductImage(artworkLink, product.image_url, product.name);
      const fallbackArt = artwork.querySelector("svg");
      if (fallbackArt) {
        fallbackArt.setAttribute("aria-hidden", "true");
        artworkLink.append(fallbackArt);
      }
      const artworkOrb = artwork.querySelector(".product-art-orb");
      if (artworkOrb) {
        artworkOrb.setAttribute("aria-hidden", "true");
        artworkLink.prepend(artworkOrb);
      }
      artwork.append(artworkLink);

      const copy = document.createElement("div");
      copy.className = "product-card-copy";
      const category = document.createElement("span");
      category.className = "product-card-category";
      category.dataset.productCategoryId = product.category_id || "";
      category.textContent = categoriesById.get(product.category_id) || "Semua kategori";
      const name = document.createElement("h3");
      const nameLink = document.createElement("a");
      nameLink.href = productDetailHref(product.id);
      nameLink.textContent = product.name;
      name.append(nameLink);
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

      const wishlistButton = document.createElement("button");
      wishlistButton.type = "button";
      wishlistButton.className = "all-product-add-button";
      wishlistButton.textContent = wishlistIds.has(product.id) ? "Tersimpan di wishlist" : "Simpan ke wishlist";
      wishlistButton.setAttribute("aria-pressed", String(wishlistIds.has(product.id)));
      wishlistButton.dataset.wishlistProduct = product.id;

      copy.append(category, name, description, rating, bottom, estimate, wishlistButton);
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

  });

  if (window.location.hash === "#all-products-page"
    || (searchInput instanceof HTMLInputElement && searchInput.value.trim())) {
    initializeCatalog();
    void loadProducts();
  }
}

if (productDetailPage) {
  const content = productDetailPage.querySelector("#product-detail-content");
  const feedback = productDetailPage.querySelector("#product-detail-feedback");
  const image = productDetailPage.querySelector("#product-detail-image");
  const title = productDetailPage.querySelector("#product-detail-title");
  const category = productDetailPage.querySelector("#product-detail-category");
  const price = productDetailPage.querySelector("#product-detail-price");
  const estimate = productDetailPage.querySelector("#product-detail-estimate");
  const stock = productDetailPage.querySelector("#product-detail-stock");
  const description = productDetailPage.querySelector("#product-detail-description");
  const seller = productDetailPage.querySelector("#product-detail-seller");
  const quantityInput = productDetailPage.querySelector("#product-detail-quantity");
  const addCartButton = productDetailPage.querySelector("#product-detail-add-cart");
  const wishlistButton = productDetailPage.querySelector("#product-detail-wishlist");
  const actionFeedback = productDetailPage.querySelector("#product-detail-action-feedback");
  const productId = new URLSearchParams(window.location.search).get("id") || "";
  let currentProduct = null;
  const formatPrice = (amount) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

  const setActionFeedback = (message, isError = false, loginNext = "") => {
    if (!(actionFeedback instanceof HTMLElement)) return;
    actionFeedback.replaceChildren(document.createTextNode(message));
    actionFeedback.classList.toggle("is-error", isError);
    if (loginNext) {
      const link = document.createElement("a");
      link.href = `login.html?next=${encodeURIComponent(loginNext)}`;
      link.textContent = " Masuk ke akun";
      actionFeedback.append(link);
    }
  };

  const renderReviews = (reviews, rating, count) => {
    const list = productDetailPage.querySelector("#product-detail-reviews");
    const summary = productDetailPage.querySelector("#product-detail-reviews-summary");
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    if (summary) {
      summary.textContent = count > 0 ? `★ ${rating.toFixed(1)} dari 5 · ${count} ulasan` : "Belum ada ulasan";
    }

    const validReviews = Array.isArray(reviews)
      ? reviews.filter((review) => review
        && Number.isInteger(review.rating)
        && review.rating >= 1
        && review.rating <= 5
        && typeof review.created_at === "string")
      : [];
    if (validReviews.length === 0) {
      const empty = document.createElement("p");
      empty.className = "product-detail-reviews-empty";
      empty.textContent = "Belum ada ulasan untuk produk ini.";
      list.append(empty);
      return;
    }

    validReviews.forEach((review) => {
      const row = document.createElement("article");
      row.className = "product-detail-review";
      const header = document.createElement("header");
      const score = document.createElement("strong");
      score.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
      const date = document.createElement("time");
      const parsedDate = new Date(review.created_at);
      if (!Number.isNaN(parsedDate.getTime())) {
        date.dateTime = parsedDate.toISOString();
        date.textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(parsedDate);
      }
      header.append(score, date);
      row.append(header);
      if (typeof review.comment === "string" && review.comment.trim()) {
        const comment = document.createElement("p");
        comment.textContent = review.comment;
        row.append(comment);
      }
      list.append(row);
    });
  };

  const getQuantity = () => {
    const quantity = quantityInput instanceof HTMLInputElement ? Number(quantityInput.value) : 1;
    const maximum = Math.max(1, Number(currentProduct?.stock) || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) return null;
    return quantity;
  };

  const loadProductDetail = async () => {
    if (!productId) {
      if (feedback) {
        feedback.textContent = "Produk tidak ditemukan. Silakan kembali ke katalog.";
        feedback.classList.add("is-error");
      }
      return;
    }

    try {
      const result = await requestApi(`/api/products?product_id=${encodeURIComponent(productId)}`, { cache: "no-store" });
      const product = result.product;
      if (!product || product.id !== productId || typeof product.name !== "string") {
        throw new Error("Produk tidak ditemukan atau sudah tidak tersedia.");
      }
      currentProduct = product;
      const productName = product.name;
      const productPrice = Number(product.price);
      const productStock = Number(product.stock);
      const rating = Number(product.rating_average) || 0;
      const ratingCount = Number(product.rating_count) || 0;
      const categoryName = typeof product.category_name === "string" ? product.category_name : "Semua kategori";

      if (title) title.textContent = productName;
      if (category) category.textContent = categoryName;
      if (price) price.textContent = formatPrice(productPrice);
      if (estimate instanceof HTMLElement) estimate.hidden = product.price_is_estimate !== true;
      if (stock) stock.textContent = productStock > 0 ? `${productStock} tersedia` : "Stok habis";
      if (description) description.textContent = product.description || "Belum ada deskripsi produk.";
      if (seller) seller.textContent = typeof product.seller_name === "string" ? product.seller_name : "Seller Kurostore";
      const breadcrumb = productDetailPage.querySelector("#product-detail-breadcrumb");
      if (breadcrumb) breadcrumb.textContent = productName;
      const ratingValue = productDetailPage.querySelector("#product-detail-rating-value");
      const ratingCountLabel = productDetailPage.querySelector("#product-detail-rating-count");
      if (ratingValue) ratingValue.textContent = ratingCount > 0 ? `★ ${rating.toFixed(1)} / 5` : "Belum ada rating";
      if (ratingCountLabel) ratingCountLabel.textContent = `${ratingCount} ulasan`;
      const informationCategory = productDetailPage.querySelector("#product-detail-information-category");
      const informationStock = productDetailPage.querySelector("#product-detail-information-stock");
      if (informationCategory) informationCategory.textContent = categoryName;
      if (informationStock) informationStock.textContent = String(productStock);
      if (image instanceof HTMLElement) appendProductImage(image, product.image_url, `Foto ${productName}`);
      if (quantityInput instanceof HTMLInputElement) {
        quantityInput.max = String(Math.max(1, productStock));
        quantityInput.value = "1";
        quantityInput.disabled = productStock <= 0;
      }
      if (addCartButton instanceof HTMLButtonElement) addCartButton.disabled = productStock <= 0;
      renderReviews(result.reviews, rating, ratingCount);
      if (content instanceof HTMLElement) content.hidden = false;
      if (feedback) feedback.textContent = "";
      document.title = `${productName} | Kurostore`;

      if (accountIsAuthenticated && wishlistButton instanceof HTMLButtonElement) {
        void authenticatedRequestApi("/api/account-data/wishlist").then((wishlist) => {
          if (!Array.isArray(wishlist.items)) throw new Error("Data wishlist tidak valid.");
          const saved = wishlist.items.some((item) => item?.id === productId);
          wishlistButton.setAttribute("aria-pressed", String(saved));
          wishlistButton.textContent = saved ? "Tersimpan di wishlist" : "Simpan ke wishlist";
        }).catch((error) => {
          console.error("Unable to load product wishlist state:", error);
          setActionFeedback(error instanceof Error ? error.message : "Status wishlist tidak dapat dimuat.", true);
        });
      }
    } catch (error) {
      console.error("Unable to load product detail:", error);
      if (feedback) {
        feedback.textContent = error instanceof Error ? error.message : "Detail produk tidak dapat dimuat.";
        feedback.classList.add("is-error");
      }
    }
  };

  productDetailPage.querySelector("#product-quantity-decrease")?.addEventListener("click", () => {
    if (!(quantityInput instanceof HTMLInputElement)) return;
    quantityInput.value = String(Math.max(1, (Number(quantityInput.value) || 1) - 1));
  });
  productDetailPage.querySelector("#product-quantity-increase")?.addEventListener("click", () => {
    if (!(quantityInput instanceof HTMLInputElement) || !currentProduct) return;
    const maximum = Number(currentProduct.stock);
    quantityInput.value = String(Math.min(maximum, (Number(quantityInput.value) || 1) + 1));
  });

  addCartButton?.addEventListener("click", async () => {
    if (!currentProduct) return;
    const quantity = getQuantity();
    if (!quantity) {
      setActionFeedback("Masukkan jumlah yang tersedia.", true);
      return;
    }
    if (!accountIsAuthenticated) {
      setActionFeedback("Masuk untuk menambahkan produk ke keranjang.", true, `detail-produk.html?id=${productId}`);
      return;
    }

    addCartButton.disabled = true;
    try {
      await authenticatedRequestApi("/api/account-data/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      notifyCartUpdated();
      setActionFeedback(`${currentProduct.name} berhasil ditambahkan ke keranjang.`);
    } catch (error) {
      console.error("Unable to add product to cart:", error);
      setActionFeedback(error instanceof Error ? error.message : "Produk tidak dapat ditambahkan ke keranjang.", true);
    } finally {
      addCartButton.disabled = Number(currentProduct.stock) <= 0;
    }
  });

  wishlistButton?.addEventListener("click", async () => {
    if (!currentProduct || !(wishlistButton instanceof HTMLButtonElement)) return;
    if (!accountIsAuthenticated) {
      setActionFeedback("Masuk untuk menyimpan produk ke wishlist.", true, `detail-produk.html?id=${productId}`);
      return;
    }
    const shouldRemove = wishlistButton.getAttribute("aria-pressed") === "true";
    wishlistButton.disabled = true;
    try {
      await authenticatedRequestApi("/api/account-data/wishlist", {
        method: shouldRemove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      wishlistButton.setAttribute("aria-pressed", String(!shouldRemove));
      wishlistButton.textContent = shouldRemove ? "Simpan ke wishlist" : "Tersimpan di wishlist";
      setActionFeedback(shouldRemove ? "Produk dihapus dari wishlist." : "Produk disimpan ke wishlist.");
    } catch (error) {
      console.error("Unable to update product wishlist:", error);
      setActionFeedback(error instanceof Error ? error.message : "Wishlist tidak dapat diperbarui.", true);
    } finally {
      wishlistButton.disabled = false;
    }
  });

  void loadProductDetail();
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
    enableProductCardNavigation(card, product.id);

    const categoryInfo = categoriesById.get(product.category_id);
    const artwork = document.createElement("div");
    artwork.className = "product-card-art all-product-art home-featured-product-art";
    artwork.dataset.artworkCategory = categoryInfo?.slug || "";
    artwork.innerHTML = `<span class="product-art-orb"></span><svg viewBox="0 0 120 112">${homeProductArtwork[categoryInfo?.slug] || fallbackArtwork}</svg>`;

    const artworkLink = document.createElement("a");
    artworkLink.className = "product-art-link";
    artworkLink.href = productDetailHref(product.id);
    artworkLink.setAttribute("aria-label", `Lihat detail ${product.name}`);
    appendProductImage(artworkLink, product.image_url, product.name);
    const fallbackArt = artwork.querySelector("svg");
    if (fallbackArt) {
      fallbackArt.setAttribute("aria-hidden", "true");
      artworkLink.append(fallbackArt);
    }
    const artworkOrb = artwork.querySelector(".product-art-orb");
    if (artworkOrb) {
      artworkOrb.setAttribute("aria-hidden", "true");
      artworkLink.prepend(artworkOrb);
    }
    artwork.append(artworkLink);

    const copy = document.createElement("div");
    copy.className = "product-card-copy";
    const category = document.createElement("span");
    category.className = "home-featured-product-category";
    category.textContent = categoryInfo?.name || "Produk tersedia";
    const name = document.createElement("h3");
    const nameLink = document.createElement("a");
    nameLink.href = productDetailHref(product.id);
    nameLink.textContent = product.name;
    name.append(nameLink);
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

    const wishlistButton = document.createElement("button");
    wishlistButton.type = "button";
    wishlistButton.className = "all-product-add-button";
    wishlistButton.dataset.homeWishlistProduct = product.id;
    wishlistButton.textContent = homeWishlistIds.has(product.id) ? "Tersimpan di wishlist" : "Simpan ke wishlist";
    wishlistButton.setAttribute("aria-pressed", String(homeWishlistIds.has(product.id)));

    copy.append(category, name, description, rating, bottom, estimate, wishlistButton);
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
        enableProductCardNavigation(card, item.id, true);

        const artwork = document.createElement("div");
        artwork.className = "product-card-art product-art-controller all-product-art";
        artwork.innerHTML = '<svg viewBox="0 0 120 96" aria-hidden="true"><path d="m60 14 39 22v44L60 102 21 80V36l39-22Z"></path><path d="m22 37 38 22 38-22M60 59v42"></path></svg>';
        const artworkLink = document.createElement("a");
        artworkLink.className = "product-art-link";
        artworkLink.href = productDetailHref(item.id, true);
        artworkLink.setAttribute("aria-label", `Lihat detail ${item.name}`);
        appendProductImage(artworkLink, item.image_url, item.name);
        const fallbackArt = artwork.querySelector("svg");
        if (fallbackArt) artworkLink.append(fallbackArt);
        artwork.append(artworkLink);

        const copy = document.createElement("div");
        copy.className = "product-card-copy";
        const label = document.createElement("span");
        label.className = "product-card-category";
        label.textContent = "Tersimpan";
        const name = document.createElement("h3");
        const nameLink = document.createElement("a");
        nameLink.href = productDetailHref(item.id, true);
        nameLink.textContent = item.name;
        name.append(nameLink);
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
        card.append(artwork, copy);
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

const googleSignInButton = document.querySelector("#google-signin-button");
const googleSetupMessage = document.querySelector("#google-login-setup");
const googleFeedback = document.querySelector("#google-login-feedback");

if (googleSignInButton instanceof HTMLElement
  && googleSetupMessage instanceof HTMLElement
  && googleFeedback instanceof HTMLElement) {
  const googleClientId = document.querySelector('meta[name="google-client-id"]')?.getAttribute("content")?.trim();

  if (googleClientId) {
    const googleScript = document.createElement("script");
    googleScript.src = "https://accounts.google.com/gsi/client";
    googleScript.async = true;
    googleScript.onload = () => {
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity) {
        googleSetupMessage.textContent = "Layanan login Google tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.";
        return;
      }

      googleSetupMessage.hidden = true;
      googleSignInButton.replaceChildren();
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            googleFeedback.textContent = "Google tidak mengirim kredensial. Coba lagi.";
            return;
          }

          googleFeedback.textContent = "Menghubungkan akun Google...";
          try {
            const data = await requestApi("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: response.credential }),
            });
            saveAuthSession(data);
            window.location.href = authReturnTarget();
          } catch (error) {
            googleFeedback.textContent = error instanceof Error
              ? error.message
              : "Login Google gagal. Coba lagi.";
          }
        },
      });
      googleIdentity.renderButton(googleSignInButton, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(400, Math.max(120, googleSignInButton.clientWidth)),
      });
    };
    googleScript.onerror = () => {
      googleSetupMessage.textContent = "Layanan login Google tidak dapat dimuat. Periksa koneksi lalu muat ulang halaman.";
    };
    document.head.append(googleScript);
  }
}

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
  const imageUrlInput = document.querySelector("#seller-product-image-url");
  const imageFileInput = document.querySelector("#seller-product-image-file");
  const imagePreview = document.querySelector("#seller-product-image-preview");
  const categoryInput = document.querySelector("#seller-product-category");
  const priceInput = document.querySelector("#seller-product-price");
  const stockInput = document.querySelector("#seller-product-stock");
  const statusInput = document.querySelector("#seller-product-status");
  const saveButton = document.querySelector("#seller-product-save");
  const accessToken = sessionStorage.getItem("kurostore-access-token");
  let products = [];
  let loading = false;
  let localImagePreviewUrl = "";

  const updateProductImagePreview = (url) => {
    if (!(imagePreview instanceof HTMLImageElement)) return;
    if (localImagePreviewUrl && localImagePreviewUrl !== url) {
      URL.revokeObjectURL(localImagePreviewUrl);
      localImagePreviewUrl = "";
    }
    imagePreview.hidden = !url;
    if (url) {
      imagePreview.src = url;
      imagePreview.onerror = () => {
        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");
      };
    } else {
      imagePreview.removeAttribute("src");
    }
  };

  const encodeProductImage = async (file) => {
    if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran foto maksimal 10 MB.");
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error("Resolusi foto terlalu besar. Gunakan foto maksimal 40 megapiksel.");
    }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Foto tidak dapat diproses di browser ini.");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!(blob instanceof Blob) || blob.size > 3_000_000) {
      throw new Error("Foto tetap terlalu besar setelah dikompres. Pilih foto yang lebih kecil.");
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { image_base64: btoa(binary), image_content_type: blob.type };
  };

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
    if (imageUrlInput instanceof HTMLInputElement) imageUrlInput.value = product?.image_url || "";
    if (imageFileInput instanceof HTMLInputElement) imageFileInput.value = "";
    updateProductImagePreview(product?.image_url || "");
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
      || !(imageUrlInput instanceof HTMLInputElement)
      || !(imageFileInput instanceof HTMLInputElement)
      || !(categoryInput instanceof HTMLSelectElement)
      || !(priceInput instanceof HTMLInputElement)
      || !(stockInput instanceof HTMLInputElement)
      || !(statusInput instanceof HTMLSelectElement)
      || !(saveButton instanceof HTMLButtonElement)) return;

    saveButton.disabled = true;
    if (dialogFeedback) dialogFeedback.textContent = "";
    const productId = productIdInput.value;
    try {
      const selectedImage = imageFileInput.files?.[0];
      const encodedImage = selectedImage ? await encodeProductImage(selectedImage) : {};
      await requestApi("/api/seller/products", {
        method: productId ? "PATCH" : "POST",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(productId ? { product_id: productId } : {}),
          name: nameInput.value,
          description: descriptionInput.value,
          image_url: imageUrlInput.value.trim() || null,
          ...encodedImage,
          category_id: categoryInput.value || null,
          price: Number(priceInput.value),
          stock: Number(stockInput.value),
          status: statusInput.value,
        }),
      });

      imageFileInput?.addEventListener("change", () => {
        if (!(imageFileInput instanceof HTMLInputElement)) return;
        const file = imageFileInput.files?.[0];
        if (!file) return;
        if (localImagePreviewUrl) URL.revokeObjectURL(localImagePreviewUrl);
        localImagePreviewUrl = URL.createObjectURL(file);
        updateProductImagePreview(localImagePreviewUrl);
      });

      imageUrlInput?.addEventListener("input", () => {
        if (!(imageUrlInput instanceof HTMLInputElement) || imageFileInput?.files?.length) return;
        updateProductImagePreview(imageUrlInput.value.trim());
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
