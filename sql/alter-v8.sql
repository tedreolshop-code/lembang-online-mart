-- ============================================================
-- MIGRASI v8 — akun pelanggan (No. WA + nama) + agen daftar mandiri
--              + notifikasi Discord webhook
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================

-- ── 1. tabel pelanggan ────────────────────────────────────────────
-- No. WhatsApp sebagai identitas utama (bukan email).
-- Tanpa OTP/PIN di fase awal — login cukup No. WA + nama.
-- Riwayat pesanan pelanggan tetap di tabel orders (dipakai customer_phone).
create table if not exists customers (
  phone        text primary key,           -- normalisasi 628xxx
  name         text not null,
  address      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table customers enable row level security;

-- ── 2. kolom tambahan untuk agen ────────────────────────────────────
-- Agen bisa mendaftar mandiri dan (nanti) login.
alter table agents add column if not exists email text;
alter table agents add column if not exists pin_hash text;

-- ── 3. kolom Discord webhook di notify_secrets ─────────────────────
-- Satu webhook URL untuk notifikasi ke channel Discord.
alter table notify_secrets add column if not exists discord_webhook text not null default '';

-- ── 4. RLS tetap: customers hanya bisa dibaca/ditulis via service key ──
-- (API Next.js memvalidasi; browser tidak kontak DB langsung)
