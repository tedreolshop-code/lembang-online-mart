-- ============================================================
-- MIGRASI v19 — label kemasan produk (pack & dus)
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================
-- Masalah: harga grosir bertingkat (v6) hanya menyebut angka jumlah, jadi
-- pembeli melihat "Grosir ≥10: Rp3.400" tanpa tahu itu 1 pack dan harus
-- mengetik 10 (atau 40) pcs sendiri supaya harga itu aktif.
-- Solusi: dua kolom isi kemasan — berapa pcs dalam 1 pack / 1 dus. Kolom ini
-- HANYA untuk label & bantuan belanja di tampilan: harga tetap dihitung per
-- pcs (products.price + product_tiers) persis seperti sebelumnya, sehingga
-- fungsi create_order TIDAK berubah sama sekali dan harga yang ditagih tetap
-- divalidasi server. Null = produk tidak dijual dalam kemasan itu.
--
-- Aditif murni: kolom baru boleh null, tidak ada data lama yang diubah, dan
-- kode versi sebelumnya tetap jalan tanpa kolom ini.
-- ============================================================

alter table products add column if not exists pack_size int;  -- isi 1 pack (pcs)
alter table products add column if not exists dus_size  int;  -- isi 1 dus (pcs)

-- Isi kemasan 1 pcs tidak masuk akal (satuan sudah = harga jual) → tolak.
alter table products drop constraint if exists products_pack_size_check;
alter table products add constraint products_pack_size_check
  check (pack_size is null or pack_size > 1);

alter table products drop constraint if exists products_dus_size_check;
alter table products add constraint products_dus_size_check
  check (dus_size is null or dus_size > 1);
