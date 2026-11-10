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

## Menjalankan lokal dan deploy

- `npm install`
- `npm run typecheck`
- Isi variabel Midtrans di `.env.local` dari `.env.example` sebelum menjalankan server.
- `npx vercel dev`
- Deploy proyek ke Vercel dengan root proyek ini; tambahkan variabel dari `.env.example` pada pengaturan Environment Variables Vercel.
- Backend membutuhkan Node.js 22 atau lebih baru.
- Endpoint admin memakai satu catch-all Serverless Function agar jumlah fungsi tetap sesuai batas Hobby Vercel.

## Endpoint yang tersedia

| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/login` | Publik |
| POST | `/api/auth/register` | Publik |
| GET | `/api/auth/me` | Pengguna masuk |
| GET | `/api/categories` | Publik |
| GET | `/api/products` | Publik; `q`, `category_id`, `sort=newest\|popular\|price_low\|price_high`, `page`, `page_size` |
| GET, POST | `/api/seller/applications` | Pengguna masuk; POST khusus buyer |
| GET, PATCH | `/api/admin/seller-applications` | Admin |
| GET | `/api/admin/overview` | Admin |
| GET | `/api/admin/system-health` | Admin; memeriksa API, database/auth Supabase, dan status integrasi pembayaran |
| POST | `/api/admin/bootstrap` | Email admin bootstrap yang terverifikasi dan token bootstrap |
| GET, POST, PATCH, DELETE | `/api/seller/products` | Seller; DELETE mengarsipkan produk |
| GET | `/api/payments/config` | Publik; mengembalikan client key dan environment Midtrans |
| POST | `/api/payments/create` | Pengguna masuk; memvalidasi produk aktif, menyimpan pesanan, dan membuat transaksi Snap |
| POST | `/api/payments/notification` | Notifikasi Midtrans; memvalidasi signature dan memperbarui status pesanan |
| GET | `/api/orders` | Pengguna masuk; mengembalikan maksimal 50 pesanan milik akun |

Endpoint menerima `Authorization: Bearer <supabase access token>`. Body JSON seller application memakai `store_name` dan `store_description`. Keputusan admin memakai `application_id`, `decision` (`approved` atau `rejected`), dan `rejection_reason` bila ditolak. Operasi produk memakai `product_id` untuk PATCH/DELETE.

Halaman checkout mengumpulkan alamat penerima dan menyimpan pesanan untuk pengguna yang masuk sebelum membuat transaksi Midtrans Snap. Pilihan checkout menyediakan semua metode Midtrans, e-wallet, virtual account, atau kartu; QRIS tetap dapat dipilih langsung dari Midtrans melalui pilihan semua metode. Status pembayaran diperbarui oleh notifikasi Midtrans di `/api/payments/notification` dan riwayat tampil di menu Pesanan Saya. Jalankan migrasi `20261103000000_midtrans_order_tracking.sql` dan atur URL notifikasi Midtrans ke `https://<domain>/api/payments/notification` sebelum mengaktifkan alur ini di deployment. Alamat utama dapat disimpan dari Pengaturan & Akun di penyimpanan lokal browser dan terisi otomatis saat checkout. Untuk keamanan, nama dan harga produk diambil ulang dari database server, bukan dipercaya dari browser. Biaya pengiriman belum terintegrasi. Layanan pulsa/tagihan juga belum diaktifkan. Form masuk, daftar, dan pengajuan seller menggunakan API autentikasi Supabase.

Dashboard admin memeriksa apakah fungsi API merespons, mengukur waktu respons dari browser, menguji koneksi database Supabase, dan menampilkan bahwa autentikasi admin berhasil diverifikasi. Status serta latensi diperbarui otomatis setiap 10 detik selama halaman terbuka. Payment gateway ditandai belum aktif sampai integrasi pembayaran benar-benar tersedia; indikator ini bukan pemantauan uptime eksternal Vercel atau provider pembayaran.

Dashboard admin menampilkan pemberitahuan untuk pengajuan seller yang menunggu, stok menipis, dan layanan yang bermasalah. Data operasional diperbarui otomatis setiap 30 detik selama dashboard terbuka.

## Halaman placeholder

Bagian Semua Kategori di beranda menampilkan seluruh produk aktif tanpa filter kategori, dengan pencarian, pengurutan umum, dan pagination. Endpoint produk menerima `page` (mulai dari 1) dan `page_size` (1–50), serta mengembalikan total data dan halaman. Halaman keranjang menyimpan pilihan barang secara lokal di browser, menampilkan rekomendasi produk aktif, dan menyediakan kontrol jumlah serta hapus. Checkout menampilkan ringkasan pilihan serta form penerima, lalu membuka pembayaran Midtrans; alamat utama tersimpan di browser dan otomatis dipakai ulang. Ikon Produk Baru, Promo Pilihan, Toko Unggulan, Kolaborasi, KuroPay, Voucher Belanja, dan Pulsa & Tagihan membuka halaman informasi dengan label “Segera Hadir”; transaksi untuk layanan-layanan tersebut belum aktif. Wishlist tetap memakai penyimpanan browser. Halaman pengajuan seller dan pengaturan akun juga sudah menyediakan alur yang tersedia.

Dashboard dipisah berdasarkan peran:

- `public/pages/admin/dashboard.html` adalah dashboard admin untuk melihat ringkasan seller, produk dan kategori aktif, stok menipis, serta pengajuan seller; admin dapat mencari serta menyetujui atau menolak pengajuan. Tautan khusus admin tersedia di menu Pengaturan & Akun.
- `public/pages/seller/dashboard.html` adalah Seller Center dengan menu Ringkasan, Pesanan, Pengiriman, Produk, Promosi, Keuangan, Analitik, Pelanggan, dan Pengaturan Toko. Pengelolaan dasar produk dan stok sudah aktif; modul lain ditandai “Segera hadir” sampai API dan alur transaksinya tersedia.
- `public/pages/pengajuan-seller.html` menyediakan form pengajuan dan status pengajuan seller untuk buyer yang masuk.

Pemisahan folder hanya untuk merapikan struktur, bukan kontrol akses. Berkas HTML statis di Vercel dapat dibuka melalui URL langsung, tetapi data dan tindakan dashboard dilindungi API yang memeriksa role admin atau seller. Dashboard admin meninjau pengajuan seller; Seller Center saat ini mengelola produk melalui endpoint seller yang tersedia. Pesanan Kurostore belum dicatat sebagai transaksi sehingga fitur pesanan, pengiriman, promosi, keuangan, analitik, layanan pelanggan, dan pengaturan toko selain katalog belum aktif. Endpoint `/api/auth/me` mengembalikan seluruh akses dalam properti `roles`.
