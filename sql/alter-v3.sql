-- ============================================================
-- TAMBAHAN SKEMA v3 — kustomisasi tampilan dari Admin.
-- Jalankan di Supabase SQL Editor SEKALI (aman diulang).
-- ============================================================

-- kolom tampilan pada pengaturan: warna tema, logo, banner promo
alter table settings add column if not exists color_primary
  text not null default '#f97316';
alter table settings add column if not exists color_dark
  text not null default '#0a3472';
alter table settings add column if not exists logo_url
  text not null default '';
alter table settings add column if not exists banners
  jsonb not null default '[]'::jsonb;

-- ── v3.1: kredensial notifikasi dipindah ke tabel terkunci ──
-- Tabel settings terbaca publik (RLS select for all) sehingga token
-- Fonnte/Telegram bisa bocor lewat anon key yang memang publik.
create table if not exists notify_secrets (
  id            int primary key default 1 check (id = 1),
  notify_token  text not null default '',
  notify_target text not null default ''
);

-- RLS + tanpa policy → hanya service key (API Next.js) yang dapat akses.
alter table notify_secrets enable row level security;

-- kosongkan salinan lama di settings (bila pernah terisi)
update settings set notify_token = '', notify_target = '' where id = 1;
