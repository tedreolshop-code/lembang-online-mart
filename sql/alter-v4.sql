-- ============================================================
-- MIGRASI v4 — keterangan & pilihan ongkir, voucher, struk
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor SEBELUM
-- deploy versi aplikasi terbaru. Kode lama tetap jalan setelah
-- migrasi ini (semua kolom baru punya nilai default).
-- ============================================================

-- ── 1. pengaturan baru: opsi Xpress + keterangan ongkir ──────
alter table settings add column if not exists xpress_ongkir int  not null default 15000;
alter table settings add column if not exists xpress_label  text not null default 'Xpress / Instan (hari yang sama)';
alter table settings add column if not exists ongkir_note   text not null default '';

-- warna gelap default tidak lagi biru navy (biar tidak ada "flash biru")
alter table settings alter column color_dark set default '#b91c1c';

-- ── 2. pesanan: simpan pilihan layanan antar & potongan voucher
alter table orders add column if not exists ship_option text not null default 'reguler'
  check (ship_option in ('reguler','xpress'));
alter table orders add column if not exists discount    int  not null default 0;
alter table orders add column if not exists coupon_code text;

-- ── 3. tabel voucher ──────────────────────────────────────────
create table if not exists coupons (
  code         text primary key,
  label        text not null default '',
  kind         text not null default 'percent' check (kind in ('percent','fixed')),
  value        int  not null check (value > 0),
  min_subtotal int  not null default 0,
  max_uses     int,
  used_count   int  not null default 0,
  active       boolean not null default true,
  expires_at   date,
  created_at   timestamptz not null default now()
);
alter table coupons enable row level security;
-- sengaja TANPA policy baca/tulis → hanya service key (API server)

-- ── 4. create_order v2: terima diskon, kode voucher, opsi antar
-- fungsi; kuota voucher ikut dinaikkan di dalam transaksi.
drop function if exists create_order(text, text, jsonb, text, jsonb, int);

create or replace function create_order(
  p_id       text,
  p_channel  text,
  p_customer jsonb,   -- {name, phone, address, note}
  p_payment  text,
  p_items    jsonb,   -- [{productId, qty}]
  p_shipping int,
  p_discount    int  default 0,
  p_coupon_code text default null,
  p_ship_option text default 'reguler'
) returns int language plpgsql as $$
declare
  v_item     jsonb;
  v_product  products%rowtype;
  v_subtotal int := 0;
  v_total    int;
begin
  if exists (select 1 from orders where id = p_id) then
    raise exception 'kode pesanan sudah terpakai';
  end if;

  -- validasi stok & hitung subtotal dari harga di DB (bukan dari client)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = v_item->>'productId' for update;
    if not found then
      raise exception 'produk tidak ditemukan: %', v_item->>'productId';
    end if;
    if v_product.stock < (v_item->>'qty')::int then
      raise exception 'stok tidak cukup: %', v_product.name;
    end if;
    v_subtotal := v_subtotal + v_product.price * (v_item->>'qty')::int;
  end loop;

  v_total := greatest(
    0,
    v_subtotal + coalesce(p_shipping, 0) - coalesce(p_discount, 0)
  );

  insert into orders (id, channel, status, stock_applied,
                      customer_name, customer_phone, customer_address,
                      note, payment, ship_option, subtotal, discount,
                      coupon_code, shipping, total)
  values (p_id, p_channel, 'menunggu', true,
          p_customer->>'name', p_customer->>'phone', p_customer->>'address',
          p_customer->>'note', p_payment,
          coalesce(nullif(p_ship_option, ''), 'reguler'),
          v_subtotal, coalesce(p_discount, 0), p_coupon_code,
          coalesce(p_shipping, 0), v_total);

  if p_coupon_code is not null then
    update coupons
      set used_count = used_count + 1
      where upper(code) = upper(p_coupon_code);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = v_item->>'productId';

    insert into order_items (order_id, product_id, name, price, qty, unit, emoji)
    values (p_id, v_product.id, v_product.name, v_product.price,
            (v_item->>'qty')::int, v_product.unit, v_product.emoji);

    update products
      set stock = stock - (v_item->>'qty')::int, updated_at = now()
      where id = v_item->>'productId';

    insert into stock_movements (product_id, delta, reason, order_id)
    values (v_product.id, -((v_item->>'qty')::int), 'order', p_id);
  end loop;

  return v_total;
end; $$;

-- ── 5. contoh voucher (silakan ubah / hapus) ──────────────────
insert into coupons (code, label, kind, value, min_subtotal, expires_at)
values
  ('HEMAT10', 'Voucher warga Lembang', 'percent', 10, 30000, null),
  ('ONGKIR5K', 'Potongan ongkir peluncuran', 'fixed', 5000, 20000, null)
on conflict (code) do nothing;
