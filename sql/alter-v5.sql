-- ============================================================
-- MIGRASI v5 — bersihkan kolom notifikasi yang sudah mati di tabel
-- `settings`, dan pastikan tabel rahasia `notify_secrets` terkunci.
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor.
-- Prasyarat: sql/alter-v3.sql sudah dijalankan (tabel notify_secrets ada).
-- Bila langkah 1 gagal dengan "relation notify_secrets does not exist":
-- jalankan sql/alter-v3.sql dulu, lalu ulangi file ini (aman diulang).
-- Aman diulang; kode lama maupun baru tetap jalan setelah migrasi ini.
-- ============================================================

-- ─ 1. jaga-jaga database yang tabel notify_secrets-nya dibuat versi lama
--       (tanpa kolom notify_provider) — src/lib/notify-secrets.ts membacanya.
alter table notify_secrets add column if not exists notify_provider
  text not null default 'off';

-- ── 2. pastikan hanya service key (API Next.js) yang bisa membacanya.
--       Tanpa RLS aktif, grant anon dari Supabase membuat token terbaca.
alter table notify_secrets enable row level security;

-- ── 3. pindahkan pilihan provider dari settings → notify_secrets (sekali saja)
--       agar pilihan pemilik tidak hilang saat kolom lama dibuang di langkah 4.
do $$
begin
  if to_regclass('public.notify_secrets') is not null
     and exists (
       select 1 from information_schema.columns
        where table_schema = current_schema()
          and table_name   = 'settings'
          and column_name  = 'notify_provider'
     )
  then
    execute $q$
      insert into notify_secrets (id, notify_provider)
      select 1, s.notify_provider
        from settings s
       where s.id = 1
         and s.notify_provider in ('fonnte','telegram')
      on conflict (id) do nothing
    $q$;
  end if;
end $$;

-- ── 4. buang kolom notifikasi lama di `settings`.
--       Sejak v3 pilihan provider + token + target tinggal di notify_secrets;
--       tabel settings terbaca publik sehingga tidak boleh menyimpan data ini.
alter table settings drop column if exists notify_provider;
alter table settings drop column if exists notify_token;
alter table settings drop column if exists notify_target;

-- Setelah ini: Admin → Pengaturan → Metode Notifikasi + token/target
-- disimpan ke notify_secrets (tidak ada lagi salinan di settings).
--
-- Catatan: jangan jalankan ulang sql/alter-v2.sql setelah file ini — file
-- lama itu akan menambahkan kembali kolom notify_* yang baru dibuang.