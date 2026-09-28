-- ============================================================
-- MIGRASI v13 — produk bisa dihapus meski pernah masuk pesanan / stok
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- ============================================================

-- order_items sudah menyimpan snapshot (name, price, unit, emoji, cost_price),
-- jadi link ke products boleh di-set NULL saat produk dihapus.
alter table order_items
  drop constraint if exists order_items_product_id_fkey;

alter table order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references products(id) on delete set null;

-- Riwayat pergerakan stok ikut dihapus bersama produk yang dihapus.
alter table stock_movements
  drop constraint if exists stock_movements_product_id_fkey;

alter table stock_movements
  add constraint stock_movements_product_id_fkey
  foreign key (product_id) references products(id) on delete cascade;

-- Fungsi hapus produk secara atomik untuk API Next.js.
create or replace function delete_product(p_id text)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  delete from products where id = p_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
