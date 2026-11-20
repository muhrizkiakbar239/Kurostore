# Kurostore backend

Backend untuk Supabase dan Vercel. Form masuk, daftar, dan pengajuan seller terhubung ke API backend.

## Komponen

- Supabase Auth menangani akun dan sesi.
- Migrasi PostgreSQL membuat profil buyer secara otomatis, katalog/kategori, wishlist, keranjang, pesanan, Flash Sale, dan data toko.
- Role utama tersimpan di `profiles.role`: `buyer`, `seller`, atau `admin`. Pendaftaran biasa selalu menjadi buyer. Akun admin `muhrizkiakbar239@gmail.com` juga mendapat akses seller setelah memiliki baris `seller_profiles`; akun lain tidak memperoleh akses ganda tersebut.
- Buyer dapat mengirim pengajuan toko. Hanya admin yang dapat menyetujui; persetujuan mengubah role menjadi seller secara atomik.
- Seller dapat mengelola produk milik tokonya melalui API. Produk publik hanya menampilkan status `active`.
- RLS membatasi data antar-pengguna. Kunci service role hanya digunakan di fungsi server dan tidak boleh dimasukkan ke frontend.

## Menyiapkan Supabase

1. Buat proyek Supabase.
2. Jalankan semua file di `supabase/migrations/` secara berurutan berdasarkan nama melalui Supabase SQL Editor atau Supabase CLI.
3. Aktifkan verifikasi email pada Supabase Auth.
4. Salin `.env.example` menjadi `.env.local` untuk pengembangan lokal, kemudian isi URL, anon key, service role key, email bootstrap admin, dan token bootstrap yang kuat.
5. Buat akun untuk alamat email admin bootstrap dan verifikasi emailnya.
6. Setelah fungsi Vercel berjalan, panggil `POST /api/admin/bootstrap` dengan access token akun tersebut dan header `x-admin-bootstrap-token`. Bootstrap hanya berhasil jika belum ada admin.

Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` atau `ADMIN_BOOTSTRAP_TOKEN` di berkas frontend atau repositori.

## Katalog seed dan harga

Setelah migrasi selesai dan toko `kurostore-demo` tersedia, isi katalog dengan 20 produk untuk setiap kategori yang memiliki produk demo. Kategori Voucher dan Produk Digital sengaja dibiarkan tanpa produk sampai layanan digital tersedia:

1. Pastikan `.env.local` berisi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
2. Jalankan `node supabase\seeds\seed_demo_catalog.mjs`.

Seed dapat dijalankan ulang tanpa menggandakan produk. Gunakan `node supabase\seeds\seed_demo_catalog.mjs --descriptions-only` untuk memperbarui hanya keterangan produk tanpa mengubah harga atau stok. Harga katalog ditandai sebagai estimasi pasar, bukan harga resmi yang telah diverifikasi.

Terapkan semua file SQL di `supabase/migrations` secara berurutan berdasarkan timestamp. Untuk alamat checkout, penanda harga estimasi, dan rating, pastikan migrasi `20261119000000_account_saved_data.sql` dan `20261119140000_catalog_estimates_and_ratings.sql` sudah dijalankan.

Untuk memindahkan aset [public/images](public/images) ke Supabase Storage:

1. Jalankan `20261119160000_asset_storage.sql` di Supabase SQL Editor.
2. Jalankan `node supabase/seeds/migrate_static_assets.mjs`.

Script membuat atau memperbarui bucket publik `kurostore-assets`, mengunggah gambar, mencatat metadata di tabel `asset_files`, dan mengganti referensi frontend dengan URL Supabase. Berkas lokal tetap disimpan sebagai cadangan sampai hasil URL diverifikasi.

## Menjalankan lokal dan deploy

- `npm install`
- `npm run typecheck`
- Isi variabel Midtrans di `.env.local` dari `.env.example` sebelum menjalankan server.
- `npx vercel dev`
- Deploy proyek ke Vercel dengan root proyek ini; tambahkan variabel dari `.env.example` pada pengaturan Environment Variables Vercel.
- Backend membutuhkan Node.js 22 atau lebih baru.
- Endpoint admin dan data akun memakai catch-all Serverless Function agar jumlah fungsi tetap sesuai batas Hobby Vercel.

## Endpoint yang tersedia

| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/login` | Publik |
| POST | `/api/auth/register` | Publik |
| POST | `/api/auth/refresh` | Pengguna masuk; memperbarui sesi dengan refresh token |
| GET | `/api/auth/me` | Pengguna masuk |
| GET | `/api/categories` | Publik; cache CDN 5 menit |
| GET | `/api/products` | Publik; `q`, `category_id`, `sort=newest\|popular\|price_low\|price_high`, `page`, `page_size`; cache CDN 30 detik |
| GET, POST | `/api/seller/applications` | Pengguna masuk; POST khusus buyer |
| GET, POST, PATCH, DELETE | `/api/account-data/cart` | Pengguna masuk; keranjang tersimpan per akun |
| GET, POST, DELETE | `/api/account-data/wishlist` | Pengguna masuk; wishlist tersimpan per akun |
| GET, PUT | `/api/account-data/address` | Pengguna masuk; alamat pengiriman tersimpan per akun |
| GET, PUT | `/api/account-data/profile` | Pengguna masuk; nama dan nomor telepon profil |
| GET, PUT | `/api/account-data/preferences` | Pengguna masuk; metode pembayaran utama, email transaksi, bahasa, dan tema |
| GET | `/api/account-data/wallet` | Pengguna masuk; saldo KuroPay demo dan riwayat poin |
| POST | `/api/account-data/wallet-topup` | Pengguna masuk; membuat top up sandbox Rp5.000–Rp1.000.000 |
| GET | `/api/account-data/export` | Pengguna masuk; mengunduh salinan data akun |
| POST | `/api/account-data/complete-order` | Pembeli; mengonfirmasi pesanan sudah diterima setelah pembayaran |
| POST | `/api/account-data/ratings` | Pengguna masuk; rating 1–5 hanya untuk produk dari pesanan lunas yang sudah diselesaikan |
| POST | `/api/auth/change-password` | Pengguna masuk; memverifikasi password saat ini sebelum perubahan |
| GET, PATCH | `/api/admin/seller-applications` | Admin |
| GET | `/api/admin/overview` | Admin |
| GET | `/api/admin/system-health` | Admin; memeriksa API, database/auth Supabase, dan status integrasi pembayaran |
| POST | `/api/admin/bootstrap` | Email admin bootstrap yang terverifikasi dan token bootstrap |
| GET, POST, PATCH, DELETE | `/api/seller/products` | Seller; DELETE mengarsipkan produk; mendukung URL foto HTTPS atau unggahan foto JPEG/PNG/WebP |
| GET | `/api/payments/config` | Publik; mengembalikan client key dan environment Midtrans |
| POST | `/api/payments/create` | Pengguna masuk; memvalidasi produk aktif, menyimpan pesanan, dan membuat transaksi Snap |
| POST | `/api/payments/notification` | Notifikasi Midtrans; memvalidasi signature dan memperbarui status pesanan |
| GET | `/api/orders` | Pengguna masuk; mengembalikan maksimal 50 pesanan milik akun |
| POST | `/api/game/check` | Pengguna masuk; memeriksa Roblox, Genshin/HSR, Mobile Legends, dan Free Fire melalui API publik/komunitas |

Endpoint menerima `Authorization: Bearer <supabase access token>`. Frontend memperbarui access token yang kedaluwarsa menggunakan refresh token dan mengulang permintaan satu kali; jika refresh token juga tidak berlaku, pengguna perlu masuk kembali. Body JSON seller application memakai `store_name` dan `store_description`. Keputusan admin memakai `application_id`, `decision` (`approved` atau `rejected`), dan `rejection_reason` bila ditolak. Operasi produk memakai `product_id` untuk PATCH/DELETE.

Halaman checkout mengumpulkan alamat penerima dan menyimpan pesanan untuk pengguna yang masuk sebelum membuat transaksi Midtrans Snap. Pilihan checkout menyediakan semua metode Midtrans, e-wallet, virtual account, kartu, atau saldo KuroPay demo; QRIS tetap dapat dipilih langsung dari Midtrans melalui pilihan semua metode. KuroPay demo dan poin hanya tersedia ketika `MIDTRANS_IS_PRODUCTION=false`; saldo demo dapat diisi melalui pembayaran Midtrans sandbox dan tidak dapat dicairkan. Top up demo tidak mendapatkan poin. Pesanan sandbox dengan pembayaran minimal Rp5.000 mendapat 100 poin; 100 poin bernilai diskon Rp1.000, tidak kedaluwarsa, dan diskon tidak boleh melebihi subtotal. Status pembayaran diperbarui oleh notifikasi Midtrans di `/api/payments/notification` dan riwayat tampil di menu Pesanan Saya. Pembeli dapat mengonfirmasi penerimaan pesanan lunas lalu memberi satu rating 1–5 per produk; ulasan opsional. Jalankan migrasi `20261103000000_midtrans_order_tracking.sql`, `20261119000000_account_saved_data.sql`, `20261119140000_catalog_estimates_and_ratings.sql`, dan `20261120100000_account_settings_demo_wallet.sql`, lalu atur URL notifikasi Midtrans ke `https://<domain>/api/payments/notification` sebelum mengaktifkan alur ini di deployment. Untuk pengujian KuroPay, gunakan key sandbox dan jangan mengaktifkan `MIDTRANS_IS_PRODUCTION=true`. Keranjang, wishlist, alamat, profil, dan preferensi tersimpan di Supabase per akun; pengguna harus masuk untuk memakai fitur simpan tersebut. Tema tersimpan lintas halaman, sedangkan pilihan bahasa saat ini diterapkan pada menu dan formulir Pengaturan & Akun (Indonesia, Inggris, Jepang). Preferensi metode pembayaran hanya menyimpan pilihan kanal, bukan nomor kartu/CVV/rekening. Ekspor data akun tidak menyertakan password, token sesi, atau rahasia pembayaran. Email status pesanan dikirim hanya jika `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, dan preferensi email akun aktif; isi kedua variabel itu di environment Vercel, jangan di source code. Paket gratis Resend saat dokumentasi ini diperiksa memiliki kuota 3.000 email/bulan dan maksimal 100 email/hari; kuota dapat berubah dan SMS tidak termasuk. Pilihan produk checkout sementara tetap berada di sessionStorage selama proses checkout. Untuk keamanan, nama dan harga produk diambil ulang dari database server, bukan dipercaya dari browser. Harga seed diberi label estimasi. Biaya pengiriman belum terintegrasi. Midtrans sandbox hanya untuk pengujian, bukan pembayaran uang sungguhan. Halaman Pulsa & Tagihan memakai Roblox, Enka.Network (Genshin/HSR), dan Isan API (Mobile Legends/Free Fire) untuk pengecekan nama akun; profil game harus tersedia di provider. Nama akun yang berhasil diperiksa disimpan tanpa TTL di memori instance API (maksimal 200 entri); cache hilang saat instance dimulai ulang dan nama yang tersimpan mungkin tidak ikut berubah ketika nama akun berganti. Isan API tidak resmi dan berlisensi CC BY-NC-SA 4.0 (non-komersial); layanan dapat berubah, membatasi permintaan, atau tidak tersedia sewaktu-waktu. Semua provider pihak ketiga dapat berubah, membatasi permintaan, atau tidak tersedia sewaktu-waktu. Wuthering Waves belum memiliki API publik yang bisa memeriksa nickname umum dari UID, sehingga perlu diverifikasi langsung di dalam game. Pilihan nominal belum memiliki harga provider dan pemesanan atau pembayaran pulsa/tagihan/game belum diproses. Form masuk, daftar, dan pengajuan seller menggunakan API autentikasi Supabase.

Dashboard admin memeriksa apakah fungsi API merespons, mengukur waktu respons dari browser, menguji koneksi database Supabase, dan menampilkan bahwa autentikasi admin berhasil diverifikasi. Status serta latensi diperbarui otomatis setiap 10 detik selama halaman terbuka. Payment gateway ditandai belum aktif sampai integrasi pembayaran benar-benar tersedia; indikator ini bukan pemantauan uptime eksternal Vercel atau provider pembayaran.

Dashboard admin menampilkan pemberitahuan untuk pengajuan seller yang menunggu, stok menipis, dan layanan yang bermasalah. Data operasional diperbarui otomatis setiap 30 detik selama dashboard terbuka.

## Halaman placeholder

Bagian Semua Kategori di beranda menampilkan seluruh produk aktif tanpa filter kategori, dengan pencarian, pengurutan umum, dan pagination. Endpoint produk menerima `page` (mulai dari 1) dan `page_size` (1–50), serta mengembalikan total data dan halaman. Keranjang akun tersimpan di database, menampilkan rekomendasi produk aktif, dan menyediakan kontrol jumlah serta hapus; masuk diperlukan untuk menyimpan barang. Checkout menampilkan ringkasan pilihan serta form penerima, lalu membuka pembayaran Midtrans; alamat utama tersimpan di database dan otomatis dipakai ulang. Wishlist juga tersimpan di database akun dan dapat ditambahkan dari katalog. KuroPay menyediakan saldo dan pembayaran demo sandbox, bukan saldo uang sungguhan. Voucher hanya tampil jika kode resmi diterbitkan; tidak ada voucher demo yang di-seed. Poin demo dapat dilihat dan ditukar saat checkout sesuai aturan di atas. Ikon Produk Baru, Promo Pilihan, Toko Unggulan, dan Kolaborasi masih membuka halaman informasi. Halaman Pulsa & Tagihan menyediakan panel pilihan operator, nominal pulsa/tagihan, serta katalog game bergambar. Pemeriksaan otomatis tersedia untuk Roblox, profil publik Genshin/HSR, Mobile Legends, dan Free Fire; Wuthering Waves belum memiliki provider UID-to-nickname yang dapat dipakai umum dan perlu diverifikasi manual di dalam game. Harga produk dan transaksi pulsa/tagihan/game belum tersedia. Halaman pengajuan seller dan pengaturan akun juga sudah menyediakan alur yang tersedia.

Dashboard dipisah berdasarkan peran:

- `public/pages/admin/dashboard.html` adalah dashboard admin untuk melihat ringkasan seller, produk dan kategori aktif, stok menipis, serta pengajuan seller; admin dapat mencari serta menyetujui atau menolak pengajuan. Tautan khusus admin tersedia di menu Pengaturan & Akun.
- `public/pages/seller/dashboard.html` adalah Seller Center dengan menu Ringkasan, Pesanan, Pengiriman, Produk, Promosi, Keuangan, Analitik, Pelanggan, dan Pengaturan Toko. Pengelolaan dasar produk dan stok sudah aktif; modul lain ditandai “Segera hadir” sampai API dan alur transaksinya tersedia.
- `public/pages/pengajuan-seller.html` menyediakan form pengajuan dan status pengajuan seller untuk buyer yang masuk.

Seller dapat menambahkan foto produk melalui URL HTTPS atau memilih berkas dari perangkat; foto diunggah ke bucket publik `kurostore-assets` setelah dikompres di browser. Jalankan migrasi `20261119160000_asset_storage.sql` sebelum memakai unggah foto. Foto produk ditampilkan pada katalog, wishlist, dan halaman detail produk.

Pemisahan folder hanya untuk merapikan struktur, bukan kontrol akses. Berkas HTML statis di Vercel dapat dibuka melalui URL langsung, tetapi data dan tindakan dashboard dilindungi API yang memeriksa role admin atau seller. Dashboard admin meninjau pengajuan seller; Seller Center saat ini mengelola produk melalui endpoint seller yang tersedia. Pesanan Kurostore belum dicatat sebagai transaksi sehingga fitur pesanan, pengiriman, promosi, keuangan, analitik, layanan pelanggan, dan pengaturan toko selain katalog belum aktif. Endpoint `/api/auth/me` mengembalikan seluruh akses dalam properti `roles`.
