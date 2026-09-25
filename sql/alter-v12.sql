-- ============================================================
-- MIGRASI v12 — akun pelanggan berpassword + lupa password
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================

-- password_hash: hash scrypt password pelanggan (format "s1$salt$hash").
--   Kosong '' = akun lama yang belum punya password → wajib lewat
--   alur "lupa password" untuk membuat password pertama.
-- reset_hash / reset_expires / reset_attempts: kode 6 digit untuk
--   lupa password — disimpan sebagai hash, kedaluwarsa 15 menit,
--   maksimal 5 percobaan salah sebelum kode hangus.
alter table customers add column if not exists password_hash text not null default '';
alter table customers add column if not exists reset_hash text not null default '';
alter table customers add column if not exists reset_expires timestamptz;
alter table customers add column if not exists reset_attempts int not null default 0;
