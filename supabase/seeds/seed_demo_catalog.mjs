import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { demoSellerStores } from './demo_seller_stores.mjs';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
}

const categories = [
  {
    slug: 'elektronik',
    productDescriptions: [
      'Headset nirkabel untuk mendengarkan musik, menonton, atau mengikuti panggilan sehari-hari. Pastikan koneksinya sesuai dengan perangkat yang digunakan.',
      'Earbud Bluetooth berukuran ringkas untuk mendengarkan audio saat beraktivitas. Periksa dukungan Bluetooth pada perangkat sebelum membeli.',
      'Keyboard mekanikal dengan tata letak 87 tombol untuk mengetik dan bermain game. Periksa jenis konektor serta kompatibilitas sistem sebelum memesan.',
      'Mouse nirkabel dengan klik senyap untuk bekerja atau belajar tanpa kabel yang mengganggu meja. Pastikan perangkat mendukung koneksi mouse yang digunakan.',
      'Webcam beresolusi Full HD untuk panggilan video dan perekaman dari komputer. Periksa kompatibilitas sistem operasi dan aplikasi yang digunakan.',
      'Speaker portabel dengan koneksi Bluetooth untuk memutar audio dari perangkat yang kompatibel. Sesuai untuk digunakan di rumah maupun dibawa bepergian.',
      'Hub USB-C dengan enam port untuk menghubungkan aksesori tambahan ke perangkat yang memiliki port USB-C. Periksa jenis port dan dukungan perangkat terlebih dahulu.',
      'Charger USB-C berdaya hingga 30 W untuk perangkat yang mendukung pengisian melalui USB-C. Kecepatan pengisian bergantung pada perangkat dan kabel yang digunakan.',
      'Power bank berkapasitas 10.000 mAh untuk mengisi daya perangkat saat jauh dari stopkontak. Kapasitas pemakaian aktual bergantung pada perangkat dan kondisi penggunaan.',
      'Kabel USB-C berlapis anyaman dengan panjang 1,5 m untuk menghubungkan perangkat berport USB-C. Periksa dukungan pengisian dan transfer data sesuai kebutuhan.',
      'Lampu meja LED dengan kontrol sentuh untuk membantu menerangi area kerja atau belajar. Letakkan di permukaan datar dan gunakan adaptor yang sesuai.',
      'Stand laptop berbahan aluminium untuk menopang laptop di meja kerja. Periksa ukuran laptop agar sesuai dengan dudukan.',
      'Mikrofon USB untuk merekam suara atau digunakan dalam panggilan melalui komputer yang kompatibel. Pilih perangkat input mikrofon pada aplikasi yang digunakan.',
      'Cooling pad berprofil ramping untuk ditempatkan di bawah laptop saat digunakan di meja. Periksa ukuran laptop dan kebutuhan koneksi dayanya.',
      'Enclosure untuk SSD NVMe yang kompatibel agar SSD dapat digunakan sebagai penyimpanan eksternal. Pastikan jenis dan ukuran SSD sesuai sebelum pemasangan.',
      'Tripod ponsel dengan posisi yang dapat disesuaikan untuk membantu mengambil foto, video, atau panggilan video tanpa memegang ponsel.',
      'Router Wi-Fi dual band untuk membagikan koneksi jaringan ke perangkat yang kompatibel. Ketersediaan internet tetap memerlukan layanan dari penyedia jaringan.',
      'Gamepad nirkabel untuk mengendalikan permainan pada perangkat yang kompatibel. Periksa dukungan platform dan metode koneksi sebelum membeli.',
      'Smartwatch Basic Fit untuk melihat informasi waktu dan menggunakan fitur kebugaran dasar yang tersedia pada perangkat. Periksa kompatibilitas ponsel.',
      'Kit pembersih layar untuk membantu merawat layar perangkat. Ikuti petunjuk penggunaan pada kemasan dan pastikan cairan pembersih cocok untuk jenis layarnya.',
    ],
    products: [
      ['Headset Wireless X1', 799000],
      ['Earbud Bluetooth Compact', 249000],
      ['Keyboard Mechanical 87-Key', 689000],
      ['Mouse Wireless Silent', 159000],
      ['Webcam Full HD', 349000],
      ['Speaker Bluetooth Portable', 299000],
      ['USB-C Hub 6-Port', 379000],
      ['Charger USB-C 30W', 179000],
      ['Power Bank 10000mAh', 289000],
      ['Kabel USB-C Braided 1.5m', 69000],
      ['Lampu Meja LED Touch', 219000],
      ['Stand Laptop Aluminum', 289000],
      ['Mikrofon USB Desktop', 499000],
      ['Cooling Pad Laptop Slim', 199000],
      ['Enclosure SSD NVMe', 229000],
      ['Tripod Ponsel Adjustable', 149000],
      ['Router Wi-Fi Dual Band', 579000],
      ['Gamepad Wireless Universal', 329000],
      ['Smartwatch Basic Fit', 459000],
      ['Kit Pembersih Layar', 59000],
    ],
  },
  {
    slug: 'makanan-dan-minuman',
    productDescriptions: [
      'Kopi arabika bubuk dalam kemasan 200 g untuk diseduh dengan metode pilihanmu. Simpan kemasan tertutup setelah dibuka.',
      'Teh melati dalam 50 kantong celup untuk diseduh per cangkir. Ikuti takaran dan waktu seduh sesuai selera.',
      'Granola dengan madu dalam kemasan 300 g, cocok disajikan sebagai sarapan atau camilan. Periksa komposisi dan informasi alergen pada kemasan.',
      'Biskuit gandum dalam kemasan 250 g untuk teman minum teh atau camilan. Periksa komposisi dan informasi alergen sebelum dikonsumsi.',
      'Kacang panggang dalam kemasan 200 g untuk camilan di rumah maupun saat bepergian. Simpan tertutup dan periksa informasi alergen pada kemasan.',
      'Cokelat susu dalam kemasan 100 g untuk dinikmati sebagai camilan. Periksa komposisi dan informasi alergen sebelum dikonsumsi.',
      'Madu hutan dalam kemasan 250 ml untuk campuran minuman atau sajian sesuai selera. Periksa informasi produk pada label kemasan.',
      'Keripik pisang dalam kemasan 180 g sebagai camilan praktis. Tutup kembali kemasan setelah dibuka agar isi tetap terlindungi.',
      'Pasta kering dalam kemasan 500 g untuk diolah menjadi berbagai hidangan. Masak mengikuti petunjuk pada kemasan.',
      'Saus sambal dalam kemasan 250 ml sebagai pelengkap makanan. Sesuaikan jumlah pemakaian dengan selera.',
      'Selai stroberi dalam kemasan 200 g untuk olesan roti atau pelengkap sajian. Simpan sesuai petunjuk pada label setelah dibuka.',
      'Sereal jagung dalam kemasan 300 g untuk pilihan sarapan atau camilan. Dapat disajikan dengan susu sesuai selera.',
      'Jahe instan dalam 10 sachet untuk diseduh dengan air. Ikuti petunjuk penyajian yang tertera pada kemasan.',
      'Teh hijau dalam 25 kantong celup untuk diseduh di rumah atau dibawa bepergian. Atur waktu seduh sesuai selera.',
      'Kurma dalam kemasan 250 g untuk camilan atau sajian. Periksa kondisi kemasan dan informasi produk sebelum dikonsumsi.',
      'Kerupuk ikan dalam kemasan 200 g sebagai camilan atau pelengkap hidangan. Ikuti petunjuk penyajian pada kemasan.',
      'Sirup buah dalam kemasan 500 ml untuk dicampur dengan air atau digunakan sebagai pelengkap sajian. Sesuaikan takaran dengan selera.',
      'Bubuk kakao dalam kemasan 200 g untuk campuran minuman atau bahan olahan. Periksa petunjuk penggunaan pada label.',
      'Makaroni panggang dalam kemasan 150 g sebagai camilan siap santap. Tutup kemasan kembali setelah dibuka.',
      'Biji kopi blend dalam kemasan 250 g untuk diseduh menggunakan alat dan metode pilihanmu. Sesuaikan tingkat giling dengan cara seduh.',
    ],
    products: [
      ['Kopi Arabika Bubuk 200 g', 85000],
      ['Teh Melati 50 Kantong', 42000],
      ['Granola Madu 300 g', 68000],
      ['Biskuit Gandum 250 g', 39000],
      ['Kacang Panggang 200 g', 45000],
      ['Cokelat Susu 100 g', 32000],
      ['Madu Hutan 250 ml', 79000],
      ['Keripik Pisang 180 g', 28000],
      ['Pasta Kering 500 g', 36000],
      ['Saus Sambal 250 ml', 27000],
      ['Selai Stroberi 200 g', 41000],
      ['Sereal Jagung 300 g', 52000],
      ['Jahe Instan 10 Sachet', 35000],
      ['Teh Hijau 25 Kantong', 38000],
      ['Kurma Premium 250 g', 62000],
      ['Kerupuk Ikan 200 g', 33000],
      ['Sirup Buah 500 ml', 44000],
      ['Bubuk Kakao 200 g', 57000],
      ['Makaroni Panggang 150 g', 26000],
      ['Biji Kopi Blend 250 g', 99000],
    ],
  },
  {
    slug: 'tas-dan-aksesori',
    productDescriptions: [
      'Tas travel untuk membawa pakaian dan perlengkapan saat bepergian. Periksa ukuran tas dan kebutuhan kapasitas sebelum memesan.',
      'Backpack Urban berkapasitas 20 L untuk membawa barang kebutuhan harian. Atur isi tas agar beban nyaman dibawa.',
      'Tote bag berbahan kanvas untuk membawa barang ringan saat beraktivitas. Periksa dimensi produk untuk memastikan muat dengan kebutuhanmu.',
      'Sling bag bergaya minimalis untuk membawa barang penting dengan praktis. Periksa ukuran dan jumlah kompartemen sebelum membeli.',
      'Waist bag berukuran compact untuk menyimpan barang kecil saat bepergian atau beraktivitas. Periksa dimensi dan cara pemakaian.',
      'Dompet lipat untuk menyimpan uang dan kartu dalam satu tempat. Periksa ukuran serta susunan kompartemen sebelum memesan.',
      'Card holder berbahan kulit sintetis untuk membawa kartu secara ringkas. Bersihkan dengan kain lembut dan hindari paparan cairan berlebih.',
      'Ikat pinggang bergaya casual sebagai pelengkap pakaian sehari-hari. Periksa panjang dan pilihan ukuran sebelum membeli.',
      'Payung lipat otomatis untuk dibawa sebagai perlengkapan saat cuaca berubah. Keringkan sebelum disimpan setelah digunakan.',
      'Syal polos serbaguna sebagai pelengkap pakaian atau aksesori harian. Pilih warna yang sesuai dengan gaya berpakaianmu.',
      'Topi baseball basic untuk melengkapi penampilan saat beraktivitas di luar ruangan. Periksa ukuran atau sistem penyetelannya.',
      'Hardcase kacamata untuk membantu menyimpan dan melindungi kacamata saat tidak digunakan. Cocokkan ukuran case dengan bentuk kacamatamu.',
      'Luggage strap adjustable untuk membantu mengikat koper saat bepergian. Sesuaikan panjang tali dengan ukuran koper.',
      'Organizer kabel travel untuk merapikan kabel dan aksesori kecil di dalam tas. Atur barang agar mudah ditemukan saat perjalanan.',
      'Tas laptop 14 inci untuk membawa laptop dan perlengkapan kerja. Pastikan dimensi laptop sesuai dengan ruang penyimpanan tas.',
      'Pouch serbaguna dengan ritsleting untuk menyimpan perlengkapan kecil. Gunakan untuk merapikan barang di rumah atau di dalam tas.',
      'Gantungan kunci berbahan metal untuk mengumpulkan kunci dalam satu tempat. Pasang pada kunci atau aksesori yang sesuai.',
      'Strap jam tangan universal sebagai pengganti tali jam. Periksa lebar pengait dan kompatibilitas dengan model jam tanganmu.',
      'Tas botol minum untuk membawa botol saat bepergian atau beraktivitas. Cocokkan ukuran tas dengan botol yang akan dibawa.',
      'Organizer paspor travel untuk menyimpan paspor dan dokumen perjalanan dalam satu tempat. Periksa ukuran kompartemen sebelum digunakan.',
    ],
    products: [
      ['Tas Travel Premium', 450000],
      ['Backpack Urban 20L', 329000],
      ['Tote Bag Kanvas', 99000],
      ['Sling Bag Minimalis', 189000],
      ['Waist Bag Compact', 139000],
      ['Dompet Lipat Harian', 159000],
      ['Card Holder Kulit Sintetis', 79000],
      ['Ikat Pinggang Casual', 119000],
      ['Payung Lipat Otomatis', 149000],
      ['Syal Polos Serbaguna', 89000],
      ['Topi Baseball Basic', 109000],
      ['Hardcase Kacamata', 59000],
      ['Luggage Strap Adjustable', 69000],
      ['Organizer Kabel Travel', 49000],
      ['Tas Laptop 14 Inch', 279000],
      ['Pouch Serbaguna Ritsleting', 65000],
      ['Gantungan Kunci Metal', 35000],
      ['Strap Jam Tangan Universal', 85000],
      ['Tas Botol Minum', 55000],
      ['Organizer Paspor Travel', 75000],
    ],
  },
  {
    slug: 'kesehatan-dan-kecantikan',
    productDescriptions: [
      'Rangkaian skin care dengan vitamin C untuk melengkapi rutinitas perawatan wajah. Periksa komposisi, petunjuk pemakaian, dan kecocokan kulit pada kemasan.',
      'Pembersih wajah gentle dalam kemasan 100 ml untuk digunakan dalam rutinitas membersihkan wajah. Gunakan sesuai petunjuk pada label.',
      'Pelembap wajah Daily dalam kemasan 50 ml untuk melengkapi rutinitas perawatan kulit. Periksa komposisi dan petunjuk pemakaian sebelum digunakan.',
      'Sunscreen wajah SPF 30 dalam nama produk untuk digunakan sebagai bagian dari perawatan kulit siang hari. Ikuti petunjuk pemakaian pada kemasan.',
      'Serum hyaluronic dalam kemasan 30 ml untuk melengkapi rangkaian perawatan wajah. Gunakan sesuai petunjuk dan periksa komposisi produk.',
      'Toner wajah Hydrating dalam kemasan 100 ml untuk digunakan dalam rutinitas perawatan kulit. Periksa petunjuk pemakaian dan kecocokan kulit.',
      'Masker wajah clay dalam kemasan 75 g untuk digunakan sebagai bagian dari perawatan wajah. Ikuti durasi pemakaian yang tertera pada kemasan.',
      'Body lotion Daily dalam kemasan 200 ml untuk digunakan pada kulit tubuh. Periksa petunjuk dan komposisi sebelum pemakaian.',
      'Sabun mandi cair dalam kemasan 250 ml untuk membersihkan tubuh saat mandi. Gunakan sesuai petunjuk pada label.',
      'Sampo Daily Care dalam kemasan 250 ml untuk membersihkan rambut. Pilih produk sesuai kebutuhan dan kondisi rambutmu.',
      'Conditioner Daily Care dalam kemasan 200 ml sebagai bagian dari rutinitas perawatan rambut. Ikuti petunjuk pemakaian pada kemasan.',
      'Lip balm Natural dalam kemasan 4 g untuk perawatan bibir. Gunakan sesuai kebutuhan dan periksa komposisi produk.',
      'Hand cream dalam kemasan 50 ml untuk perawatan kulit tangan. Praktis dibawa dan digunakan sesuai petunjuk pada label.',
      'Sikat rambut cushion untuk merapikan rambut saat bersiap atau bepergian. Bersihkan sikat secara berkala setelah digunakan.',
      'Handuk microfiber untuk mengeringkan tubuh atau rambut setelah digunakan. Ikuti petunjuk pencucian pada label produk.',
      'Botol semprot travel 50 ml untuk membawa cairan dalam ukuran praktis. Pastikan cairan yang dimasukkan sesuai dengan bahan botol.',
      'Paket perawatan kuku berisi perlengkapan untuk merapikan kuku. Gunakan setiap alat sesuai fungsinya dan jaga kebersihannya.',
      'Sisir lipat compact yang mudah disimpan di tas untuk merapikan rambut saat bepergian.',
      'Kapas wajah isi 100 lembar untuk membantu pemakaian produk perawatan atau membersihkan wajah. Gunakan satu lembar dalam kondisi bersih.',
      'Pouch perawatan diri untuk merapikan perlengkapan kecil saat di rumah maupun bepergian. Periksa ukuran sebelum mengatur isi.',
    ],
    products: [
      ['Skin Care Vitamin C', 220000],
      ['Pembersih Wajah Gentle 100 ml', 79000],
      ['Pelembap Wajah Daily 50 ml', 99000],
      ['Sunscreen Wajah SPF 30', 115000],
      ['Serum Hyaluronic 30 ml', 139000],
      ['Toner Wajah Hydrating 100 ml', 89000],
      ['Masker Wajah Clay 75 g', 75000],
      ['Body Lotion Daily 200 ml', 68000],
      ['Sabun Mandi Cair 250 ml', 52000],
      ['Sampo Daily Care 250 ml', 59000],
      ['Conditioner Daily Care 200 ml', 61000],
      ['Lip Balm Natural 4 g', 35000],
      ['Hand Cream 50 ml', 47000],
      ['Sikat Rambut Cushion', 65000],
      ['Handuk Microfiber', 49000],
      ['Botol Semprot Travel 50 ml', 25000],
      ['Paket Perawatan Kuku', 78000],
      ['Sisir Lipat Compact', 29000],
      ['Kapas Wajah 100 Lembar', 22000],
      ['Pouch Perawatan Diri', 55000],
    ],
  },
  {
    slug: 'baju-pria',
    productDescriptions: [
      'Kaos pria basic untuk tampilan santai sehari-hari dan mudah dipadukan dengan berbagai bawahan. Periksa pilihan ukuran sebelum memesan.',
      'Kemeja Oxford bergaya casual untuk dipakai saat kegiatan harian atau acara santai. Padukan dengan celana pilihanmu.',
      'Polo shirt untuk pilihan pakaian harian dengan tampilan rapi namun tetap santai. Periksa ukuran yang tersedia sebelum membeli.',
      'Hoodie pria classic sebagai lapisan pakaian untuk kegiatan santai. Pilih ukuran yang nyaman untuk gaya pemakaianmu.',
      'Jaket windbreaker untuk melengkapi pakaian saat beraktivitas di luar. Periksa ukuran dan petunjuk perawatan pada label.',
      'Celana chino potongan regular untuk pilihan pakaian kerja santai atau kegiatan harian. Periksa ukuran pinggang dan panjang sebelum memesan.',
      'Celana jeans potongan straight yang mudah dipadukan dengan kaos maupun kemeja. Periksa ukuran yang tersedia.',
      'Celana pendek casual untuk dipakai saat bersantai atau kegiatan sehari-hari. Pilih ukuran yang sesuai sebelum membeli.',
      'Kemeja flanel motif kotak untuk melengkapi gaya kasual. Dapat dikenakan sendiri atau dipadukan dengan kaos.',
      'Kaos lengan panjang untuk pilihan pakaian harian atau sebagai lapisan tambahan. Periksa ukuran pada pilihan produk.',
      'Sweater crewneck dengan model leher bundar untuk dipadukan dengan pakaian kasual. Ikuti petunjuk perawatan pada label.',
      'Jaket denim basic untuk melengkapi gaya kasual dan dipadukan dengan berbagai pakaian. Periksa ukuran sebelum memesan.',
      'Celana jogger pria untuk kegiatan santai dan pemakaian sehari-hari. Periksa ukuran serta potongan sebelum membeli.',
      'Kemeja linen santai untuk pilihan busana kasual. Padukan dengan celana panjang atau pendek sesuai kebutuhan.',
      'Kaos graphic minimal dengan desain grafis sederhana untuk gaya sehari-hari. Periksa ukuran dan tampilan desain sebelum memesan.',
      'Rompi outdoor ringan sebagai lapisan pakaian tambahan saat beraktivitas. Pastikan ukuran sesuai dengan pakaian yang akan dipadukan.',
      'Set baju tidur pria untuk digunakan saat beristirahat di rumah. Periksa isi set dan ukuran pada pilihan produk.',
      'Singlet pria dalam paket 2 potong sebagai pilihan pakaian dalam atau lapisan. Periksa ukuran yang tersedia.',
      'Kemeja kerja potongan slim untuk tampilan rapi di lingkungan kerja. Pastikan ukuran sesuai dengan potongan slim.',
      'Jaket track sport untuk melengkapi pakaian saat berolahraga atau bersantai. Periksa ukuran dan petunjuk perawatan sebelum digunakan.',
    ],
    products: [
      ['Kaos Pria Basic', 129000],
      ['Kemeja Oxford Casual', 249000],
      ['Polo Shirt Harian', 189000],
      ['Hoodie Pria Classic', 329000],
      ['Jaket Windbreaker', 379000],
      ['Celana Chino Regular', 299000],
      ['Celana Jeans Straight', 359000],
      ['Celana Pendek Casual', 149000],
      ['Kemeja Flanel Kotak', 279000],
      ['Kaos Lengan Panjang', 159000],
      ['Sweater Crewneck', 289000],
      ['Jaket Denim Basic', 399000],
      ['Celana Jogger Pria', 219000],
      ['Kemeja Linen Santai', 269000],
      ['Kaos Graphic Minimal', 179000],
      ['Rompi Outdoor Ringan', 259000],
      ['Baju Tidur Pria Set', 199000],
      ['Singlet Pria 2-Pack', 99000],
      ['Kemeja Kerja Slim', 319000],
      ['Jaket Track Sport', 299000],
    ],
  },
  {
    slug: 'baju-wanita',
    productDescriptions: [
      'Baju wanita bergaya casual untuk dipakai sehari-hari dan mudah dipadukan dengan berbagai bawahan. Periksa ukuran sebelum memesan.',
      'Blus basic untuk pilihan busana harian yang mudah dipadukan dengan rok atau celana. Pilih ukuran yang sesuai.',
      'Tunik daily wear untuk pilihan pakaian santai maupun kegiatan harian. Periksa panjang dan ukuran yang tersedia.',
      'Dress midi polos dengan panjang midi untuk dipakai pada berbagai kesempatan. Padukan dengan aksesori pilihanmu.',
      'Kemeja wanita dengan potongan relaxed untuk tampilan santai dan nyaman bergerak. Periksa ukuran sebelum membeli.',
      'Cardigan rajut ringan sebagai lapisan tambahan untuk melengkapi pakaian. Ikuti petunjuk perawatan pada label.',
      'Hoodie wanita oversize dengan potongan longgar untuk gaya kasual. Pilih ukuran sesuai tampilan yang diinginkan.',
      'Rok plisket midi dengan lipit-lipit sebagai pilihan busana harian atau acara santai. Periksa ukuran sebelum memesan.',
      'Celana kulot basic dengan potongan lebar untuk dipadukan dengan atasan favorit. Periksa ukuran dan panjang celana.',
      'Celana jeans wanita untuk melengkapi pakaian kasual. Cocokkan ukuran pinggang dan potongan sebelum membeli.',
      'Kaos wanita lengan panjang untuk pilihan pakaian harian atau lapisan tambahan. Periksa ukuran yang tersedia.',
      'Outerwear kimono casual sebagai lapisan luar untuk melengkapi tampilan santai. Padukan dengan atasan sederhana.',
      'Blus lengan puff dengan detail lengan mengembang untuk variasi gaya busana. Periksa ukuran sebelum memesan.',
      'Set piyama wanita untuk digunakan saat beristirahat di rumah. Periksa isi set dan ukuran yang tersedia.',
      'Jaket denim wanita untuk melengkapi gaya kasual. Padukan dengan dress, rok, maupun celana.',
      'Atasan knit tanpa lengan untuk pilihan busana yang dapat dipadukan dengan outer atau bawahan favorit.',
      'Rok A-line casual dengan siluet melebar untuk dipadukan dengan berbagai atasan. Periksa panjang dan ukuran.',
      'Celana jogger wanita untuk kegiatan santai dan pemakaian sehari-hari. Pilih ukuran yang nyaman.',
      'Dress kemeja santai dengan tampilan terinspirasi kemeja untuk pilihan busana praktis. Periksa ukuran sebelum membeli.',
      'Sweater wanita crewneck dengan leher bundar untuk melengkapi gaya santai. Ikuti petunjuk perawatan pada label.',
    ],
    products: [
      ['Baju Wanita Casual', 180000],
      ['Blus Wanita Basic', 169000],
      ['Tunik Daily Wear', 229000],
      ['Dress Midi Polos', 299000],
      ['Kemeja Wanita Relaxed', 219000],
      ['Cardigan Rajut Ringan', 249000],
      ['Hoodie Wanita Oversize', 319000],
      ['Rok Plisket Midi', 189000],
      ['Celana Kulot Basic', 199000],
      ['Celana Jeans Wanita', 329000],
      ['Kaos Wanita Lengan Panjang', 159000],
      ['Outerwear Kimono Casual', 239000],
      ['Blus Lengan Puff', 209000],
      ['Set Piyama Wanita', 219000],
      ['Jaket Denim Wanita', 369000],
      ['Atasan Knit Sleeveless', 149000],
      ['Rok A-Line Casual', 179000],
      ['Celana Jogger Wanita', 189000],
      ['Dress Kemeja Santai', 279000],
      ['Sweater Wanita Crewneck', 269000],
    ],
  },
  {
    slug: 'sepatu-pria',
    productDescriptions: [
      'Sepatu Pria Urban untuk melengkapi penampilan saat bekerja atau beraktivitas di kota. Periksa ukuran kaki dan panduan ukuran sebelum memesan.',
      'Sneakers pria basic untuk dipadukan dengan pakaian kasual sehari-hari. Pilih ukuran yang sesuai dengan kaki.',
      'Sepatu kanvas model low-top dengan potongan di bawah mata kaki untuk gaya santai. Periksa ukuran sebelum membeli.',
      'Sepatu lari Daily untuk digunakan saat berlari atau berolahraga. Pilih ukuran yang nyaman dan sesuai dengan bentuk kaki.',
      'Sepatu formal model Derby untuk melengkapi pakaian kerja atau acara resmi. Periksa ukuran dan warna yang tersedia.',
      'Slip-on casual pria yang mudah dikenakan untuk kegiatan harian. Pastikan ukuran sesuai sebelum memesan.',
      'Sandal slide pria dengan model praktis untuk kegiatan santai. Pilih ukuran yang pas agar nyaman dipakai.',
      'Sandal outdoor pria untuk digunakan saat beraktivitas di luar ruangan. Periksa ukuran dan kondisi penggunaan yang disarankan.',
      'Sepatu loafer casual untuk pilihan gaya rapi yang tetap santai. Padukan dengan celana pilihanmu dan periksa ukuran sebelum membeli.',
      'Sepatu boots pendek untuk melengkapi gaya kasual maupun semi-formal. Periksa ukuran dan tinggi model sebelum memesan.',
      'Sepatu training ringan untuk mendukung kegiatan latihan dan olahraga. Pilih ukuran yang nyaman untuk bergerak.',
      'Sepatu kerja pria untuk melengkapi pakaian saat bekerja. Periksa ukuran, model, dan ketentuan penggunaan sebelum membeli.',
      'Sneakers knit pria dengan bagian atas bergaya rajut untuk pemakaian kasual. Periksa ukuran yang tersedia.',
      'Sepatu hiking basic untuk digunakan saat menjelajah jalur luar ruang. Sesuaikan ukuran dan perlengkapan dengan kondisi jalur.',
      'Sepatu skate casual untuk dipadukan dengan gaya kasual sehari-hari. Periksa ukuran sebelum memesan.',
      'Sandal rumah pria untuk dipakai di dalam rumah. Pilih ukuran yang sesuai dengan kaki.',
      'Sepatu driving moc dengan model moccasin untuk digunakan saat berkendara atau kegiatan santai. Periksa ukuran sebelum membeli.',
      'Sepatu slip-resistant dengan sol yang dirancang untuk membantu mengurangi risiko terpeleset. Sesuaikan dengan kebutuhan dan kondisi permukaan.',
      'Sneakers retro pria dengan tampilan terinspirasi gaya klasik untuk pemakaian kasual. Periksa ukuran yang tersedia.',
      'Sepatu airy mesh dengan bagian atas bermaterial mesh sesuai nama produk untuk kegiatan harian. Pilih ukuran yang pas.',
    ],
    products: [
      ['Sepatu Pria Urban', 620000],
      ['Sneakers Pria Basic', 489000],
      ['Sepatu Kanvas Low-Top', 299000],
      ['Sepatu Lari Daily', 579000],
      ['Sepatu Formal Derby', 699000],
      ['Slip-On Casual Pria', 349000],
      ['Sandal Slide Pria', 159000],
      ['Sandal Outdoor Pria', 279000],
      ['Sepatu Loafer Casual', 549000],
      ['Sepatu Boots Pendek', 729000],
      ['Sepatu Training Ringan', 529000],
      ['Sepatu Kerja Pria', 649000],
      ['Sneakers Knit Pria', 459000],
      ['Sepatu Hiking Basic', 799000],
      ['Sepatu Skate Casual', 399000],
      ['Sandal Rumah Pria', 99000],
      ['Sepatu Driving Moc', 579000],
      ['Sepatu Slip-Resistant', 619000],
      ['Sneakers Retro Pria', 569000],
      ['Sepatu Airy Mesh', 429000],
    ],
  },
  {
    slug: 'sepatu-wanita',
    productDescriptions: [
      'Sneakers wanita Daily untuk dipadukan dengan pakaian kasual saat beraktivitas. Pilih ukuran yang sesuai dengan kaki.',
      'Flat shoes basic dengan model datar untuk kegiatan harian atau acara santai. Periksa ukuran sebelum memesan.',
      'Sepatu ballet casual untuk tampilan feminin saat berkegiatan. Pilih ukuran yang pas agar nyaman digunakan.',
      'Loafer wanita minimal untuk melengkapi gaya rapi maupun kasual. Periksa ukuran dan pilihan warna sebelum membeli.',
      'Sepatu lari wanita untuk menemani kegiatan berlari atau olahraga. Pilih ukuran yang nyaman untuk bergerak.',
      'Sandal tali wanita untuk melengkapi pakaian saat bersantai atau bepergian. Periksa ukuran sebelum memesan.',
      'Sandal slide wanita dengan model praktis untuk kegiatan santai. Pastikan ukuran sesuai dengan kaki.',
      'Heels blok dengan tinggi sedang untuk acara atau kegiatan yang membutuhkan tampilan lebih rapi. Periksa tinggi hak dan ukuran.',
      'Wedges casual dengan model hak menyatu untuk melengkapi gaya sehari-hari. Pilih ukuran yang sesuai.',
      'Sepatu Mary Jane dengan detail tali di bagian atas untuk tampilan klasik. Padukan dengan rok atau dress.',
      'Slip-on knit wanita yang praktis dikenakan untuk kegiatan harian. Periksa ukuran dan bentuk sepatu sebelum membeli.',
      'Sepatu boots ankle dengan tinggi sekitar mata kaki untuk melengkapi gaya kasual. Pilih ukuran yang pas.',
      'Sepatu kerja wanita untuk dipadukan dengan pakaian kerja atau busana rapi. Periksa ukuran dan model yang tersedia.',
      'Sandal outdoor wanita untuk digunakan saat beraktivitas di luar ruangan. Pilih ukuran yang sesuai dengan kebutuhan.',
      'Sneakers kanvas wanita untuk gaya kasual sehari-hari. Periksa ukuran sebelum memesan.',
      'Mules wanita basic dengan bagian belakang terbuka agar mudah dikenakan. Pastikan ukuran sesuai sebelum membeli.',
      'Sepatu training wanita untuk menemani sesi latihan atau olahraga. Pilih ukuran yang mendukung kenyamanan bergerak.',
      'Sandal rumah wanita untuk dipakai di dalam rumah. Periksa ukuran dan bentuk sol sebelum memesan.',
      'Sepatu pesta low heel dengan hak rendah untuk melengkapi busana acara. Pilih ukuran yang pas untuk pemakaian.',
      'Sneakers retro wanita dengan gaya klasik untuk dipadukan dengan pakaian kasual. Periksa ukuran yang tersedia.',
    ],
    products: [
      ['Sneakers Wanita Daily', 459000],
      ['Flat Shoes Basic', 249000],
      ['Sepatu Ballet Casual', 279000],
      ['Loafer Wanita Minimal', 389000],
      ['Sepatu Lari Wanita', 549000],
      ['Sandal Tali Wanita', 199000],
      ['Sandal Slide Wanita', 149000],
      ['Heels Blok Medium', 399000],
      ['Wedges Casual', 359000],
      ['Sepatu Mary Jane', 329000],
      ['Slip-On Knit Wanita', 349000],
      ['Sepatu Boots Ankle', 629000],
      ['Sepatu Kerja Wanita', 429000],
      ['Sandal Outdoor Wanita', 269000],
      ['Sneakers Kanvas Wanita', 299000],
      ['Mules Wanita Basic', 319000],
      ['Sepatu Training Wanita', 519000],
      ['Sandal Rumah Wanita', 89000],
      ['Sepatu Pesta Low Heel', 479000],
      ['Sneakers Retro Wanita', 499000],
    ],
  },
  {
    slug: 'hobi-dan-koleksi',
    productDescriptions: [
      'Set cat air berisi 24 warna untuk melukis di atas kertas atau media yang sesuai. Gunakan kuas terpisah dan tutup kembali setelah dipakai.',
      'Buku sketsa ukuran A4 untuk membuat gambar, ilustrasi, atau rancangan. Pilih alat gambar yang sesuai dengan jenis kertas.',
      'Marker art berisi 12 warna untuk membuat ilustrasi dan memberi warna pada karya. Uji warna di kertas sebelum digunakan.',
      'Puzzle lanskap dengan 500 keping untuk aktivitas menyusun gambar di waktu luang. Letakkan keping di permukaan rata agar mudah dirapikan.',
      'Album koleksi kartu untuk menyimpan dan menata kartu koleksi. Cocokkan ukuran kartu dengan kantong album.',
      'Sleeve kartu berisi 100 lembar untuk membantu menyimpan kartu koleksi. Pastikan ukuran sleeve sesuai dengan kartu.',
      'Kit sulam pemula untuk mencoba kegiatan menyulam. Periksa isi kit dan ikuti petunjuk penggunaan yang disertakan.',
      'Benang rajut dalam paket 5 gulung untuk membuat proyek rajutan sesuai pola dan ukuran yang dipilih.',
      'Set kuas lukis berisi 10 buah untuk digunakan dengan media lukis yang sesuai. Bersihkan kuas setelah digunakan.',
      'Model kit pesawat mini untuk dirakit sebagai kegiatan hobi atau koleksi. Periksa isi paket dan petunjuk perakitan.',
      'Miniatur kendaraan die-cast untuk dipajang atau ditambahkan ke koleksi. Periksa skala dan detail produk pada kemasan.',
      'Board game keluarga untuk dimainkan bersama di rumah. Baca jumlah pemain dan aturan permainan yang tercantum pada kemasan.',
      'Kamera film disposable untuk mengambil foto menggunakan film yang tersedia di dalam kamera. Proses film mengikuti petunjuk pada kemasan.',
      'Tripod mini fotografi untuk menopang kamera kecil atau ponsel yang kompatibel saat mengambil gambar.',
      'Set origami berisi 100 lembar kertas untuk melipat bentuk dan membuat kerajinan. Ikuti pola lipatan pilihanmu.',
      'Kertas scrapbook berisi 20 lembar untuk menyusun album, kartu, atau proyek kerajinan kertas.',
      'Papan catur lipat yang dapat disimpan lebih ringkas setelah permainan. Simpan seluruh bidak di tempat yang aman.',
      'Set kaligrafi pemula untuk berlatih membuat tulisan dekoratif. Periksa alat yang termasuk dalam paket dan ikuti panduan penggunaannya.',
      'Kotak penyimpanan koleksi untuk menata barang kecil agar mudah dicari. Pastikan ukuran kotak sesuai dengan koleksi.',
      'Lensa pembesar meja untuk membantu melihat objek kecil saat membaca atau mengerjakan hobi. Letakkan pada permukaan yang stabil.',
    ],
    products: [
      ['Set Cat Air 24 Warna', 149000],
      ['Buku Sketsa A4', 59000],
      ['Marker Art 12 Warna', 99000],
      ['Puzzle Lanskap 500 Keping', 129000],
      ['Album Koleksi Kartu', 85000],
      ['Sleeve Kartu 100 Lembar', 39000],
      ['Kit Sulam Pemula', 119000],
      ['Benang Rajut 5 Gulung', 79000],
      ['Set Kuas Lukis 10-Piece', 68000],
      ['Model Kit Pesawat Mini', 179000],
      ['Miniatur Kendaraan Die-Cast', 99000],
      ['Board Game Keluarga', 229000],
      ['Kamera Film Disposable', 189000],
      ['Tripod Mini Fotografi', 89000],
      ['Set Origami 100 Lembar', 45000],
      ['Kertas Scrapbook 20 Lembar', 65000],
      ['Papan Catur Lipat', 159000],
      ['Set Kaligrafi Pemula', 139000],
      ['Kotak Penyimpanan Koleksi', 109000],
      ['Lensa Pembesar Meja', 75000],
    ],
  },
  {
    slug: 'merchandise',
    productDescriptions: [
      'Kaos merchandise Kurostore untuk dipakai sehari-hari atau sebagai koleksi. Periksa desain dan ukuran yang tersedia sebelum membeli.',
      'Tote bag Kurostore untuk membawa barang saat beraktivitas atau berbelanja. Periksa ukuran tas sesuai barang yang ingin dibawa.',
      'Mug keramik Kurostore untuk digunakan menyajikan minuman atau dipajang sebagai koleksi. Tangani dengan hati-hati.',
      'Gantungan kunci Kurostore untuk menandai dan mengumpulkan kunci dalam satu tempat.',
      'Topi berlogo Kurostore sebagai pelengkap pakaian kasual atau koleksi merchandise. Periksa ukuran dan sistem penyetelannya.',
      'Lanyard Kurostore untuk menggantung kartu akses atau tanda pengenal. Pasang barang dengan pengait yang sesuai.',
      'Paket stiker Kurostore untuk menghias buku, laptop, atau barang pribadi. Tempelkan pada permukaan yang bersih dan kering.',
      'Desk mat Kurostore untuk melapisi area meja kerja atau belajar. Periksa ukuran meja agar alas terpasang dengan sesuai.',
      'Botol minum Kurostore untuk membawa minuman saat beraktivitas. Periksa kapasitas dan petunjuk perawatan pada produk.',
      'Notebook Kurostore ukuran A5 untuk mencatat ide, tugas, atau agenda sehari-hari.',
      'Set pin Kurostore untuk dipasang sebagai aksesori pada tas atau pakaian. Pastikan pengait terpasang dengan aman.',
      'Pouch Kurostore untuk menyimpan perlengkapan kecil agar lebih rapi di dalam tas.',
      'Kaos kaki Kurostore sebagai pelengkap pakaian dan alas kaki sehari-hari. Periksa ukuran yang tersedia.',
      'Phone grip Kurostore untuk membantu pegangan ponsel saat digunakan. Pastikan permukaan ponsel atau casing cocok sebelum dipasang.',
      'Poster Kurostore ukuran A3 untuk menghias ruang atau melengkapi koleksi merchandise.',
      'Tas belanja lipat Kurostore yang dapat disimpan ringkas saat tidak digunakan. Bawa sebagai tas tambahan saat berbelanja.',
      'Travel cup Kurostore untuk membawa minuman saat bepergian. Periksa kapasitas dan cara perawatan sebelum digunakan.',
      'Mouse pad Kurostore sebagai alas mouse di meja kerja atau bermain. Periksa ukuran area meja yang tersedia.',
      'Acrylic stand Kurostore untuk dipajang di meja atau rak sebagai koleksi.',
      'Hoodie merchandise Kurostore untuk melengkapi pakaian kasual dan koleksi penggemar. Periksa desain serta ukuran sebelum memesan.',
    ],
    products: [
      ['Kaos Merchandise Kurostore', 179000],
      ['Tote Bag Kurostore', 89000],
      ['Mug Keramik Kurostore', 69000],
      ['Gantungan Kunci Kurostore', 35000],
      ['Topi Logo Kurostore', 119000],
      ['Lanyard Kurostore', 39000],
      ['Paket Stiker Kurostore', 29000],
      ['Desk Mat Kurostore', 99000],
      ['Botol Minum Kurostore', 109000],
      ['Notebook Kurostore A5', 49000],
      ['Set Pin Kurostore', 45000],
      ['Pouch Kurostore', 59000],
      ['Kaos Kaki Kurostore', 39000],
      ['Phone Grip Kurostore', 35000],
      ['Poster Kurostore A3', 65000],
      ['Tas Belanja Lipat Kurostore', 55000],
      ['Travel Cup Kurostore', 129000],
      ['Mouse Pad Kurostore', 59000],
      ['Acrylic Stand Kurostore', 79000],
      ['Hoodie Merchandise Kurostore', 349000],
    ],
  },
  {
    slug: 'rumah-dan-gaya-hidup',
    productDescriptions: [
      'Lampu meja bergaya minimalis untuk menerangi meja kerja, belajar, atau area samping tempat tidur. Periksa jenis sumber daya sebelum digunakan.',
      'Organizer laci modular untuk membantu mengelompokkan barang kecil di dalam laci. Susun modul sesuai ruang penyimpanan.',
      'Sarung bantal dekoratif untuk memberi aksen pada sofa atau tempat tidur. Periksa ukuran sarung agar sesuai dengan bantal.',
      'Set sprei ukuran Queen untuk melapisi kasur dengan ukuran yang sesuai. Periksa dimensi kasur dan isi set sebelum membeli.',
      'Handuk mandi berbahan cotton sesuai nama produk untuk digunakan setelah mandi. Ikuti petunjuk pencucian pada label.',
      'Keset pintu dengan fitur antiselip untuk diletakkan di area masuk rumah. Pastikan permukaan lantai dan bagian bawah keset tetap bersih.',
      'Rak dinding serbaguna untuk menata barang atau dekorasi di dinding. Gunakan pemasangan dan pengait yang sesuai dengan kondisi dinding.',
      'Keranjang penyimpanan lipat untuk merapikan barang dan dapat dilipat saat tidak digunakan. Periksa ukuran sebelum memilih tempat penyimpanan.',
      'Gelas minum kaca dalam paket 2 buah untuk menyajikan minuman di rumah. Tangani dan cuci dengan hati-hati.',
      'Botol minum insulated untuk membawa minuman saat bepergian. Periksa kapasitas dan petunjuk penggunaan pada produk.',
      'Tatakan gelas cork dalam paket 4 buah untuk melapisi permukaan meja saat meletakkan gelas.',
      'Set tempat bumbu dapur untuk menata bumbu agar mudah dijangkau saat memasak. Periksa jumlah wadah dan ukurannya.',
      'Sarung kursi minimalis untuk memperbarui tampilan kursi. Ukur kursi terlebih dahulu agar sarung sesuai.',
      'Diffuser aroma ruangan untuk menyebarkan wewangian di dalam ruangan. Gunakan cairan dan ikuti petunjuk pada kemasan.',
      'Vas keramik dekoratif untuk menata bunga atau menjadi aksen di meja dan rak. Letakkan pada permukaan yang stabil.',
      'Jam dinding bergaya modern untuk membantu melihat waktu sekaligus melengkapi dekorasi ruangan. Periksa kebutuhan baterai pada produk.',
      'Bakul laundry lipat untuk mengumpulkan pakaian sebelum dicuci dan disimpan lebih ringkas saat tidak digunakan.',
      'Kotak penyimpanan kabel untuk merapikan kabel dan aksesori kecil di rumah atau meja kerja.',
      'Tirai jendela basic untuk menutup jendela dan melengkapi ruangan. Ukur lebar serta tinggi jendela sebelum memesan.',
      'Alas meja makan dalam paket 4 buah untuk melindungi dan menata permukaan meja saat waktu makan.',
    ],
    products: [
      ['Lampu Meja Minimalis', 159000],
      ['Organizer Laci Modular', 89000],
      ['Sarung Bantal Dekoratif', 75000],
      ['Set Sprei Katun Queen', 399000],
      ['Handuk Mandi Cotton', 119000],
      ['Keset Pintu Antiselip', 69000],
      ['Rak Dinding Serbaguna', 179000],
      ['Keranjang Penyimpanan Lipat', 99000],
      ['Gelas Minum Kaca 2-Piece', 85000],
      ['Botol Minum Insulated', 189000],
      ['Tatakan Gelas Cork 4-Piece', 49000],
      ['Tempat Bumbu Dapur Set', 129000],
      ['Sarung Kursi Minimalis', 139000],
      ['Diffuser Aroma Ruangan', 229000],
      ['Vas Keramik Dekoratif', 149000],
      ['Jam Dinding Modern', 199000],
      ['Bakul Laundry Lipat', 109000],
      ['Kotak Penyimpanan Kabel', 59000],
      ['Tirai Jendela Basic', 249000],
      ['Alas Meja Makan 4-Piece', 79000],
    ],
  },
  {
    slug: 'voucher-dan-produk-digital',
    productDescriptions: [],
    products: [],
  },
];

const legacyProductIds = new Map([
  ['elektronik:0', '00000000-0000-4000-8000-000000000001'],
  ['tas-dan-aksesori:0', '00000000-0000-4000-8000-000000000002'],
  ['kesehatan-dan-kecantikan:0', '00000000-0000-4000-8000-000000000003'],
  ['sepatu-pria:0', '00000000-0000-4000-8000-000000000004'],
  ['baju-wanita:0', '00000000-0000-4000-8000-000000000005'],
]);

const descriptionChecklists = new Map([
  ['elektronik', 'jenis port dan koneksi, kompatibilitas perangkat, kebutuhan daya, isi paket, serta garansi jika memang tercantum pada produk'],
  ['makanan-dan-minuman', 'berat bersih, komposisi, informasi alergen, kondisi segel, tanggal kedaluwarsa, dan cara penyimpanan pada kemasan'],
  ['tas-dan-aksesori', 'ukuran atau dimensi, bahan, kapasitas, jumlah kompartemen, pilihan warna, dan kelengkapan barang'],
  ['kesehatan-dan-kecantikan', 'komposisi, petunjuk pemakaian, kecocokan dengan kebutuhan kulit atau rambut, kondisi kemasan, dan tanggal kedaluwarsa'],
  ['baju-pria', 'panduan ukuran, ukuran badan yang sesuai, bahan, warna, model potongan, dan cara perawatan pakaian'],
  ['baju-wanita', 'panduan ukuran, ukuran badan yang sesuai, bahan, warna, model potongan, dan cara perawatan pakaian'],
  ['sepatu-pria', 'panduan ukuran dalam sentimeter, panjang kaki, bahan, bentuk sol, dan kecocokan untuk aktivitas yang dimaksud'],
  ['sepatu-wanita', 'panduan ukuran dalam sentimeter, panjang kaki, bahan, bentuk sol, dan kecocokan untuk aktivitas yang dimaksud'],
  ['hobi-dan-koleksi', 'ukuran, bahan, kondisi barang, kelengkapan, model atau seri, serta batas usia jika relevan'],
  ['merchandise', 'varian model, ukuran, bahan, kelengkapan, kondisi barang, dan informasi lisensi hanya jika dinyatakan oleh seller'],
  ['rumah-dan-gaya-hidup', 'dimensi, bahan, kebutuhan perakitan atau daya, cara perawatan, dan kelengkapan yang diterima'],
]);

function completeProductDescription(categorySlug, description) {
  const checklist = descriptionChecklists.get(categorySlug);
  if (!checklist) throw new Error(`Missing product description checklist for category ${categorySlug}.`);
  return `${description} Sebelum memesan, periksa juga ${checklist} pada detail produk. Jika informasi yang dibutuhkan belum dicantumkan, tanyakan kepada seller terlebih dahulu.`;
}

function stableUuid(value) {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const expectedProductCount = (slug) => slug === 'voucher-dan-produk-digital' ? 0 : 20;
const invalidCategoryCounts = categories
  .filter(({ slug, products, productDescriptions }) => products.length !== expectedProductCount(slug)
    || productDescriptions.length !== expectedProductCount(slug)
    || productDescriptions.some((description) => typeof description !== 'string' || description.trim().length < 20))
  .map(({ slug, products, productDescriptions }) =>
    `${slug}: ${products.length} products, ${productDescriptions.length} descriptions`);
if (categories.length !== 12 || invalidCategoryCounts.length > 0) {
  throw new Error(`Demo catalog has invalid product or description counts. Invalid counts: ${invalidCategoryCounts.join(', ') || 'category count'}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: sellers, error: sellersError } = await supabase
  .from('seller_profiles')
  .select('user_id, store_slug')
  .in('store_slug', demoSellerStores.map(({ storeSlug }) => storeSlug));

if (sellersError) throw new Error(`Unable to verify demo seller stores: ${sellersError.message}`);
const sellerIdsBySlug = new Map((sellers ?? []).map(({ user_id, store_slug }) => [store_slug, user_id]));
if (sellerIdsBySlug.size !== demoSellerStores.length) {
  throw new Error(`Expected ${demoSellerStores.length} demo seller stores. Run seed_demo_sellers.mjs first.`);
}

const { data: categoryRows, error: categoryError } = await supabase
  .from('categories')
  .select('id, slug')
  .eq('is_active', true)
  .in('slug', categories.map(({ slug }) => slug));

if (categoryError) throw new Error(`Unable to load categories: ${categoryError.message}`);

const categoryIds = new Map((categoryRows ?? []).map(({ id, slug }) => [slug, id]));
if (categoryIds.size !== categories.length) {
  throw new Error('One or more catalog categories are missing or inactive.');
}

const products = categories.flatMap((category, categoryIndex) =>
  category.products.map(([name, price], productIndex) => {
    const key = `${category.slug}:${productIndex}`;
    const digitalProduct = category.slug === 'voucher-dan-produk-digital';
    const stock = digitalProduct ? 0 : 8 + ((categoryIndex * 13 + productIndex * 5) % 37);
    return {
      id: legacyProductIds.get(key) ?? stableUuid(`kurostore-demo:${key}`),
      seller_id: sellerIdsBySlug.get(demoSellerStores[productIndex].storeSlug),
      category_id: categoryIds.get(category.slug),
      name,
      description: completeProductDescription(category.slug, category.productDescriptions[productIndex]),
      image_url: `https://loremflickr.com/640/640/${encodeURIComponent(name.replace(/[^a-zA-Z0-9 ]/g, ''))}?lock=${categoryIndex * 20 + productIndex + 1000}`,
      price,
      price_is_estimate: true,
      stock,
      status: 'active',
    };
  }),
);

if (process.argv.includes('--descriptions-only')) {
  for (let offset = 0; offset < products.length; offset += 20) {
    const batch = products.slice(offset, offset + 20);
    const results = await Promise.all(batch.map((product) =>
      supabase
        .from('products')
        .update({ description: product.description })
        .eq('id', product.id)
        .select('id')
        .maybeSingle()));

    results.forEach(({ data, error }, index) => {
      if (error) throw new Error(`Unable to update description for ${batch[index].name}: ${error.message}`);
      if (!data) throw new Error(`Product not found while updating description: ${batch[index].id}`);
    });
  }
} else {
  for (let offset = 0; offset < products.length; offset += 100) {
    const { error } = await supabase
      .from('products')
      .upsert(products.slice(offset, offset + 100), { onConflict: 'id' });

    if (error) throw new Error(`Unable to save demo catalog: ${error.message}`);
  }
}

const productIds = products.map(({ id }) => id);
const { data: savedProducts, error: verificationError } = await supabase
  .from('products')
  .select('seller_id, category_id, description')
  .in('id', productIds);

if (verificationError) throw new Error(`Unable to verify saved catalog: ${verificationError.message}`);

const counts = new Map();
const sellerCounts = new Map();
const sellerCategoryCounts = new Map();
for (const product of savedProducts ?? []) {
  counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
  sellerCounts.set(product.seller_id, (sellerCounts.get(product.seller_id) ?? 0) + 1);
  const key = `${product.seller_id}:${product.category_id}`;
  sellerCategoryCounts.set(key, (sellerCategoryCounts.get(key) ?? 0) + 1);
}

if (savedProducts?.length !== 220 || categories.some(({ slug }) =>
  (counts.get(categoryIds.get(slug)) ?? 0) !== expectedProductCount(slug))) {
  throw new Error('Catalog verification failed: expected 20 demo products in each supported category and none for vouchers.');
}

if (demoSellerStores.some(({ storeSlug }) => {
  const sellerId = sellerIdsBySlug.get(storeSlug);
  return (sellerCounts.get(sellerId) ?? 0) !== 11
    || categories.some(({ slug }) =>
      (sellerCategoryCounts.get(`${sellerId}:${categoryIds.get(slug)}`) ?? 0) !== expectedProductCount(slug) / 20);
})) {
  throw new Error('Seller allocation verification failed: each seller must have one product in every supported category (11 total).');
}

if (savedProducts.some(({ description }) =>
  typeof description !== 'string' || description.length < 100 || /produk contoh|data contoh/i.test(description))) {
  throw new Error('Catalog verification failed: a product description is empty or still generic.');
}

console.log(`${process.argv.includes('--descriptions-only') ? 'Updated descriptions for' : 'Saved and verified'} ${savedProducts.length} products across ${categories.length} categories and ${demoSellerStores.length} sellers.`);
