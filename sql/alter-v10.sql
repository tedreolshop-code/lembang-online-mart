-- ============================================================
-- MIGRASI v10 — foto KTP agen + bucket storage
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================

-- ── 1. kolom ktp_url di tabel agents ───────────────────────────
-- URL foto KTP agen di Supabase Storage. Diunggah admin saat
-- mendaftarkan agen. Bisa null bila belum diunggah.
alter table agents add column if not exists ktp_url text;

-- ── 2. bucket storage untuk KTP agen ─────────────────────────────
-- Folder privat: hanya service key (admin) yang bisa baca/tulis.
-- Akses publik diblokir lewat RLS di bawah.
insert into storage.buckets (id, name, public)
values ('agent-ktp', 'agent-ktp', false)
on conflict (id) do nothing;

-- ── 3. RLS storage: blokir akses anon ───────────────────────────
-- Hanya service role yang bisa upload/read/delete foto KTP.
drop policy if exists "agent-ktp no public access" on storage.objects;
create policy "agent-ktp no public access" on storage.objects
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
