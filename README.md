# LEMBANG ONLINE MART 🛒

Warung online warga Lembang — belanja kebutuhan harian (mie instan, minyak,
sembako, popok, kebersihan, dll) diantar sampai rumah. Tampilan ala Alfagift
tapi lebih sederhana, dengan nuansa warna **merah – putih – biru**.

## Menjalankan Website

```bash
npm install        # sekali saja
npm run build      # build produksi
npm run start      # buka http://localhost:3000
```

Untuk mode pengembangan (hot reload saat diubah-ubah): `npm run dev`.

## Halaman

| Halaman | URL | Fungsi |
|---|---|---|
| Beranda | `/` | Banner promo, kategori, promo & terlaris, semua produk |
| Kategori | `/kategori` dan `/kategori/[slug]` | Jelajah per kategori + urutkan harga |
| Detail produk | `/produk/[id]` | Harga, diskon, stok, jumlah, beli |
| Pencarian | `/cari?q=...` | Cari produk + filter kategori |
| Keranjang | `/keranjang` | Atur jumlah, ringkasan, tombol pesan |
| Checkout | `/checkout` | Form alamat + layanan antar (Reguler/Xpress) + voucher + kode agen + COD/transfer |
| Riwayat | `/pesanan` | Daftar pesanan + tombol konfirmasi WhatsApp |
| Favorit | `/favorit` | Produk yang ditandai ♥ |
| Admin | `/admin` | Kelola produk, pesanan, voucher, agen & pengaturan (password: `admin123`) |
| Info | `/tentang`, `/cara-pesan` | Profil toko & panduan pemesanan |

## Notifikasi Pesanan & Laporan

- **🔔 Notifikasi pesanan masuk** (Admin → Pengaturan): setiap pesanan baru
  dari form checkout dikirim otomatis ke pemilik via **WhatsApp (Fonnte)** 
  atau **Telegram Bot** — lengkap dengan kode pesanan, nama, alamat, dan
  total. Ada tombol "Kirim Pesan Tes". Aktif penuh di mode database; di mode
  lokal demo hanya tampil konfigurasinya. Kredensial (token & tujuan) maupun
  pilihan penyedia disimpan di tabel `notify_secrets` yang dikunci RLS —
  tabel `settings` bisa dibaca publik sehingga tidak boleh menyimpan rahasia.
- **📊 Laporan** (Admin → Laporan): omzet, jumlah transaksi, barang terjual,
  dan produk paling laris — per hari ini / 7 hari / 30 hari / semua.
  Pesanan dibatalkan tidak ikut dihitung.
- **Pembatalan pesanan** (Admin → Pesanan): tombol "Batalkan" mengembalikan
  stok yang sudah dikurangi dan mencatatnya di riwayat stok.
- **Kebijakan Privasi** (`/privasi`): halaman wajib karena situs mengumpulkan
  nama, No. HP, dan alamat pelanggan (sesuai UU PDP).

## Layanan Antar, Voucher & Struk (v4)

- **Pilihan layanan antar di checkout**: *Reguler (antar warung)* — gratis
  di atas batas minimum, atau *Xpress/Instan* (biaya sesuai pengaturan,
  label & harga diatur pemilik di Admin → Pengaturan).
- **Keterangan ongkir** (kurir, area, estimasi) tampil di keranjang &
  checkout, isinya diedit dari Admin → Pengaturan.
- **Voucher**: Admin → 🎟️ Voucher — kode (persen/nominal), minimum belanja,
  kuota, masa berlaku. Pembeli mengetik kode di checkout; **potongan
  dihitung ulang oleh server** (tidak bisa dimanipulasi dari browser).
  Contoh kode sudah dibuatkan migrasi: `HEMAT10`, `ONGKIR5K`.
- **Cetak struk** (🖨 button): di halaman sukses pesanan, tiap kartu
  riwayat pesanan, dan tiap pesanan di admin — struk 80mm siap print lewat
  dialog cetak browser (Chrome/Edge sudah mendukung printer Thermal/Epson).
- Notifikasi WhatsApp/Telegram kini mencantumkan layanan antar & potongan
  voucher.

> ⚠️ **Sebelum deploy versi ini**: jalankan `sql/alter-v4.sql` sekali di
> Supabase SQL Editor (kolom `ship_option`, `discount`, `coupon_code` di
> orders; tabel `coupons`; fungsi `create_order` versi baru). Tanpa
> migrasi, website TETAP jalan penuh untuk pesanan reguler tanpa voucher —
> checkout voucher/Xpress menampilkan pesan "database belum dimigrasi".

## Harga Grosir & Program Agen (v6)

- **Harga grosir bertingkat** (Admin → Produk → edit → "🏷️ Harga Grosir"):
  tentukan tingkat jumlah & harga lebih murah, mis. beli ≥5 Rp19.200.
  Berlaku untuk semua pembeli — badge muncul di kartu produk, halaman
  produk, keranjang, dan checkout. Harga yang dipakai = tingkat dengan
  jumlah minimum terbesar yang tercapai; dihitung ulang oleh server dan
  fungsi database `create_order`, jadi tidak bisa dimanipulasi dari browser.
- **Program agen** (Admin → 🤝 Agen): daftarkan agen (kode otomatis,
  mis. `AGX7K2M`, bisa diganti manual), atur komisi global — persen atau
  nominal tetap per pesanan, dasar sebelum/sesudah voucher, lantai & plafon,
  masa berlaku tautan, masa tunggu cair — lalu aktifkan agen per orang.
  Tiap agen boleh punya komisi khusus (%) yang menang atas aturan global.
- **Tautan referral**: tombol 🔗 Tautan menyalin alamat `/?ref=KODE`.
  Pengunjung yang datang dari tautan itu otomatis terisi kode agennya di
  checkout (boleh juga diketik manual). Setiap pesanan dengan kode agen
  mencatat `agent_code` + nilai komisi sebagai **snapshot** — mengubah
  aturan komisi tidak mengubah pesanan lama.
- **Pencairan** (Admin → 🤝 Agen): komisi berstatus *menunggu* sampai masa
  tunggu (`hold_days`) sesudah pesanan **selesai** terlewat, lalu ditandai
  **Bayar**; tersedia koreksi manual per baris. Nomor rekening agen
  (`pay_target`) tidak pernah tampil ke pembeli — tabelnya terkunci RLS.
- **Anti-akal-akalan**: pembelian sendiri (No. WA pembeli = WA agen), agen
  belum aktif, atau program nonaktif → komisi 0 **beserta alasannya**
  tercatat di ledger; kode tak dikenal → pesanan jalan tanpa atribusi.

> ⚠️ **Sebelum deploy versi ini**: jalankan `sql/alter-v6.sql` sekali di
> Supabase SQL Editor — menambah tabel `product_tiers`, `commission_settings`,
> `agents`, `agent_commissions`; kolom `products.cost_price` dan
> `orders.agent_code/agent_commission`; serta `create_order` versi baru
> (pemanggil lama tidak perlu diubah). Tanpa migrasi, website TETAP jalan
> penuh — harga grosir & kode agen hanya menampilkan pesan "database belum
> dimigrasi" saat dipakai. Kolom `cost_price` (HPP) sengaja disiapkan untuk
> laporan laba kotor nanti dan belum dipakai UI mana pun.

## Manajemen Stok

- **Pesanan form checkout** otomatis mengurangi stok produk saat pesanan
  dibuat.
- **Pesanan WhatsApp** datang di luar sistem — di admin → Pesanan ada tombol
  "Terima & kurangi stok" yang ditekan setelah pelanggan konfirmasi; stok
  berkurang dan status jadi "diproses".
- **Admin → 📦 Stok**: produk stok paling sedikit tampil paling atas, badge
  MENIPIS (≤5) dan HABIS (0), tombol −1/+1 dan kolom "Set" untuk barang
  masuk/opname.
- Stok 0 otomatis tampil "STOK HABIS" di toko dan tidak bisa dibeli.
- Batas: stok tidak bisa minus; pembatalan pesanan belum mengembalikan stok
  (lakukan lewat tombol +1/Set di tab Stok).

## Usulan Tahap 2 (POS / Kasir)

Belum dibangun, siap dikerjakan saat klien setuju:

- Halaman `/kasir`: grid produk besar untuk ketuk cepat, keranjang kasir,
  hitung uang tunai & kembalian, struk.
- Penjualan kasir otomatis mengurangi stok dan masuk laporan penjualan harian
  (omzet, jumlah transaksi, produk terjual).
- Catatan arsitektur: sinkronisasi nyata antara kasir di laptop warung dan
  pesanan online dari pelanggan membutuhkan database sungguhan — data layer
  (`src/lib/store.ts`) sudah diisolasi agar migrasinya mulus.

## Pengaturan Toko (tanpa ngoding)

Pemilik warung mengatur semuanya dari **halaman Admin** (`/admin`) → tab
**⚙️ Pengaturan**:

1. **Nomor WhatsApp pesanan** — ketik `08…`, otomatis dirapikan jadi `62…`.
2. **Password admin** — berlaku untuk login berikutnya.
3. **Alamat & jam buka** — tampil di halaman Tentang Kami.
4. **Ongkir, batas gratis ongkir, ongkir Xpress, & keterangannya** —
   langsung dipakai di keranjang & checkout.
5. Nama toko & slogan.

Perubahan tersimpan di browser tempat mengedit (localStorage). Nilai bawaan
kalau data belum ada ada di `src/lib/config.ts` (`DEFAULT_SETTINGS`).

## Logo Sementara

Logo aktif adalah placeholder buatan sendiri (tas belanja merah-putih-biru
dengan huruf "L") di `src/components/Logo.tsx` + favicon `src/app/icon.svg`.
Saat logo final dari desainer sudah ada: ganti isi kedua file itu (atau
ganti komponen Logo dengan `<img src="/logo.png">`) — semua tempat otomatis
ikut karena memakai satu komponen yang sama.

## Data Produk

Data awal ada di `src/data/seed.ts` (±40 produk, 7 kategori). Data produk,
pesanan, favorit, dan keranjang disimpan di **localStorage browser** — tanpa
database, jadi mudah didemokan di mana saja.

Catatan: data produk yang diedit lewat halaman admin hanya tersimpan di
browser yang dipakai. Saat nanti dipindah ke database sungguhan (mis.
Supabase/SQLite), cukup ganti isi `src/lib/store.ts` — halaman lain tidak
perlu diubah.

## Foto Produk

Produk tanpa foto otomatis tampil sebagai ikon emoji. Ada 2 cara memasang
foto, keduanya tanpa ngoding:

1. **Taruh file di folder `public/products/`** dengan nama
   `<id-produk>.jpg` — foto langsung muncul otomatis di semua halaman.
   Daftar lengkap nama file per produk:
   `public/products/DAFTAR-NAMA-FILE.txt`.
   Contoh yang sudah terpasang: `public/products/indomie-goreng-pcs.jpg`
   (masih gambar contoh — tinggal ditimpa dengan foto asli, nama sama).
2. **Via halaman admin** — edit produk → isi kolom "URL Foto" dengan
   alamat gambar dari internet (praktis kalau mengambil gambar dari situs
   resmi merek atau katalog distributor).

> Catatan: kalau foto baru ditambahkan **selagi server produksi sudah
> jalan**, restart servernya (`npm run start` lagi) — tidak perlu build
> ulang. Di mode `npm run dev` foto baru langsung terlihat.

Sumber gambar yang disarankan: situs resmi merek (Indofood, Wings, Mayora,
Sania/MMS, dsb.), aset katalog distributor, atau foto sendiri pakai HP.
Spesifikasi ideal: latar putih/seragam, rasio persegi, ±600×600 px,
format JPG di bawah 100 KB.

## Migrasi Database (Supabase)

Website punya **dua mode** yang otomatis terpilih:

- **Mode lokal** (tanpa `.env`): data di localStorage per-browser — untuk
  demo/jaringan pengaman.
- **Mode cloud** (kredensial terisi): data terpusat di Supabase Postgres —
  stok & pesanan sinkron antar semua perangkat.

Cara mengaktifkan mode cloud:

1. Buat project gratis di [supabase.com](https://supabase.com).
2. Dashboard → **SQL Editor** → tempel & jalankan seluruh `sql/schema.sql`
   (membuat tabel, fungsi transaksi `create_order`, keamanan RLS, dan bucket
   foto `product-images`).
   - Database yang sudah dibuat dengan skema versi lama: jalankan migrasi
     berurutan `sql/alter-v2.sql` → `sql/alter-v3.sql` → `sql/alter-v4.sql`
     → `sql/alter-v5.sql` → `sql/alter-v6.sql`. Semua file itu aman diulang
     (idempotent).
3. Dashboard → **Authentication → Users → Add user** → buat akun admin
   (email + password) untuk login halaman admin.
4. Salin `.env.example` menjadi `.env`, isi 3 kredensial dari
   Project Settings → API.
5. Dashboard → **Storage → product-images** (sudah dibuat skema) untuk foto.
6. `npm run build && npm run start` — lalu masuk `/admin`: jika database
   masih kosong, muncul tombol **"Muat Data Awal ke Database"**.

> 🔐 **Migrasi v5 (`sql/alter-v5.sql`)** — membuang kolom notifikasi lama di
> tabel `settings` (`notify_provider`, `notify_token`, `notify_target`) yang
> sudah tidak dibaca kode mana pun; pilihan penyedia dipindahkan lebih dulu
> ke `notify_secrets` (yang juga dipastikan RLS-nya aktif) sehingga tidak ada
> data yang hilang. Setelah migrasi, token/target cukup diisi sekali lagi
> dari Admin → Pengaturan → Metode Notifikasi.

Detail teknis: semua akses DB lewat API Next.js (`src/app/api/**`) memakai
service key di server — kredensial tidak pernah sampai browser. Pesanan
dibuat lewat transaksi database (`create_order`) sehingga stok tidak pernah
minus walau banyak pesanan bersamaan. Data layer (`src/lib/store.ts`)
menyediakan hook yang sama untuk kedua mode.

## Struktur Kode

```
src/
  app/          → halaman (App Router) + API routes (src/app/api/**)
  components/   → Header, BottomNav, ProductCard, BannerCarousel, …
  lib/          → store.ts (data layer mode ganda), db.ts (Supabase server),
                  auth.ts (sesi admin), cart.tsx, config.ts, whatsapp.ts,
                  pricing.ts (harga grosir), agent.ts (logika komisi agen)
  data/seed.ts  → kategori + produk awal
sql/schema.sql  → skema database Supabase (tabel, RLS, transaksi stok)
sql/alter-v*.sql → migrasi bertahap untuk database yang sudah jalan (v6 terakhir)
scripts/        → shots.mjs (screenshot), fetch-images.mjs (foto produk)
```
