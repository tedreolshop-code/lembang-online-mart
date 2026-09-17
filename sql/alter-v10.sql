-- ═══════════════════════════════════════════════════════════════════════
-- v10: tutup kebocoran HPP (harga beli) dari anon key
-- Jalankan SEKALI di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════
--
-- MASALAH
-- Policy "publik baca produk" (schema.sql) mengizinkan anon membaca seluruh
-- baris `products`, termasuk kolom `cost_price`. Anon key bersifat publik —
-- ikut terkirim ke browser setiap pengunjung — jadi siapa pun bisa langsung
-- menjalankan:
--
--     supabase.from('products').select('cost_price')
--
-- dan melihat modal usaha tanpa lewat API Next.js sama sekali.
--
-- CATATAN PENTING SOAL URUTAN
-- RLS mengatur BARIS, bukan KOLOM. Selama hak baca tingkat TABEL masih ada,
-- `revoke select (cost_price)` tidak berpengaruh apa pun — grant tingkat
-- tabel menang. Karena itu hak baca tabel dicabut dulu, baru diberikan ulang
-- per kolom: seluruh kolom katalog tetap terbaca, `cost_price` tidak.

revoke select on products from anon, authenticated;

grant select (
  id, name, category_slug, price, old_price, unit, emoji,
  image_url, stock, is_promo, is_bestseller, is_new, description, position,
  created_at, updated_at
) on products to anon, authenticated;

-- `order_items` menyimpan snapshot `cost_price` tiap item. Tabel ini sudah
-- terkunci RLS tanpa policy untuk anon, jadi praktiknya tidak terbaca —
-- pencabutan ini lapis kedua agar tidak bergantung pada RLS saja.
revoke select on order_items from anon, authenticated;

-- ── verifikasi (jalankan manual, jangan ikut disimpan) ────────────────
-- set role anon;
--   select cost_price from products limit 1;  -- harus GAGAL permission denied
--   select id, price from products limit 1;   -- harus BERHASIL
-- reset role;
