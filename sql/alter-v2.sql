-- ============================================================
-- TAMBAHAN SKEMA v2 — jalankan HANYA bila Anda sudah menjalankan
-- sql/schema.sql versi lama (sebelum fitur notifikasi & pembatalan).
-- Kalau database dibuat dari schema.sql versi baru, file ini tidak
-- perlu dijalankan.
-- ============================================================

-- status pesanan kini punya 'dibatalkan'
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('menunggu','diproses','selesai','dibatalkan'));

-- riwayat stok kini mencatat pembatalan
alter table stock_movements drop constraint if exists stock_movements_reason_check;
alter table stock_movements add constraint stock_movements_reason_check
  check (reason in ('order','receive','adjust','set','cancel'));

-- kolom notifikasi pada pengaturan
alter table settings add column if not exists notify_provider
  text not null default 'off';
alter table settings add column if not exists notify_token
  text not null default '';
alter table settings add column if not exists notify_target
  text not null default '';
