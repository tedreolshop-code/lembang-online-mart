# LEMBANG ONLINE STORE 🛒

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
| Checkout | `/checkout` | Form alamat + COD/transfer → tersimpan di riwayat |
| Riwayat | `/pesanan` | Daftar pesanan + tombol konfirmasi WhatsApp |
| Favorit | `/favorit` | Produk yang ditandai ♥ |
| Admin | `/admin` | Kelola produk & pesanan (password: `admin123`) |
| Info | `/tentang`, `/cara-pesan` | Profil toko & panduan pemesanan |

## Notifikasi Pesanan & Laporan

- **🔔 Notifikasi pesanan masuk** (Admin → Pengaturan): setiap pesanan baru
  dari form checkout dikirim otomatis ke pemilik via **WhatsApp (Fonnte)** 
  atau **Telegram Bot** — lengkap dengan kode pesanan, nama, alamat, dan
  total. Ada tombol "Kirim Pesan Tes". Aktif penuh di mode database; di mode
  lokal demo hanya tampil konfigurasinya.
- **📊 Laporan** (Admin → Laporan): omzet, jumlah transaksi, barang terjual,
  dan produk paling laris — per hari ini / 7 hari / 30 hari / semua.
  Pesanan dibatalkan tidak ikut dihitung.
- **Pembatalan pesanan** (Admin → Pesanan): tombol "Batalkan" mengembalikan
  stok yang sudah dikurangi dan mencatatnya di riwayat stok.
- **Kebijakan Privasi** (`/privasi`): halaman wajib karena situs mengumpulkan
  nama, No. HP, dan alamat pelanggan (sesuai UU PDP).

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
3. **Alamat & jam buka** — tampil di footer dan halaman Tentang.
4. **Ongkir & batas gratis ongkir** — langsung dipakai di keranjang & checkout.
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
3. Dashboard → **Authentication → Users → Add user** → buat akun admin
   (email + password) untuk login halaman admin.
4. Salin `.env.example` menjadi `.env`, isi 3 kredensial dari
   Project Settings → API.
5. Dashboard → **Storage → product-images** (sudah dibuat skema) untuk foto.
6. `npm run build && npm run start` — lalu masuk `/admin`: jika database
   masih kosong, muncul tombol **"Muat Data Awal ke Database"**.

Detail teknis: semua akses DB lewat API Next.js (`src/app/api/**`) memakai
service key di server — kredensial tidak pernah sampai browser. Pesanan
dibuat lewat transaksi database (`create_order`) sehingga stok tidak pernah
minus walau banyak pesanan bersamaan. Data layer (`src/lib/store.ts`)
menyediakan hook yang sama untuk kedua mode.

## Struktur Kode

```
src/
  app/          → halaman (App Router) + API routes (src/app/api/**)
  components/   → Header, BottomNav, ProductCard, BannerCarousel, Footer, …
  lib/          → store.ts (data layer mode ganda), db.ts (Supabase server),
                  auth.ts (sesi admin), cart.tsx, config.ts, whatsapp.ts
  data/seed.ts  → kategori + produk awal
sql/schema.sql  → skema database Supabase (tabel, RLS, transaksi stok)
scripts/        → shots.mjs (screenshot), fetch-images.mjs (foto produk)
```
