-- ============================================================
-- MIGRASI v16 — cabut hak EXECUTE fungsi transaksi dari publik
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================
-- Fungsi yang dibuat lewat `create function` mewarisi GRANT EXECUTE default
-- ke PUBLIC, sehingga siapa pun yang memegang anon key bisa memanggilnya
-- langsung lewat PostgREST (di luar API Next.js). Fungsi berjalan sebagai
-- pemanggil (bukan SECURITY DEFINER) sehingga RLS tetap menahan penulisan,
-- tetapi menutup jalur ini adalah lapis pertahanan tambahan.
--
-- Hanya service_role (dipakai API Next.js di server) yang boleh mengeksekusi.
-- ============================================================

revoke execute on function
  create_order(text, text, jsonb, text, jsonb, int, int, text, text, text)
  from public, anon, authenticated;
grant execute on function
  create_order(text, text, jsonb, text, jsonb, int, int, text, text, text)
  to service_role;

revoke execute on function delete_product(text)
  from public, anon, authenticated;
grant execute on function delete_product(text) to service_role;
