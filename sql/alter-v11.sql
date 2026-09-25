-- ============================================================
-- MIGRASI v11 — metode pembayaran diatur dari Admin
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================

-- ── 1. kolom pembayaran di tabel settings ──────────────────────
-- cod_enabled: apakah COD (bayar di tempat) ditawarkan ke pembeli.
-- payment_methods: daftar metode transfer/e-wallet aktif (jsonb),
--   bentuk: [{"id":"transfer","label":"Transfer Bank",
--             "detail":"BCA 1234567890 a.n. Toko","note":"..."}]
--   Dikelola dari Admin → Pengaturan; kosong [] = tidak ada metode transfer.
alter table settings add column if not exists cod_enabled boolean not null default true;
alter table settings add column if not exists payment_methods jsonb not null default
  '[{"id":"transfer","label":"Transfer Bank","detail":"BCA 1234567890 a.n. Lembang Store","note":"Kirim bukti transfer ke WhatsApp warung"}]'::jsonb;
