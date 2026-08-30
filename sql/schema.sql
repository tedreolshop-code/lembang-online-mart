-- ============================================================
-- LEMBANG ONLINE STORE — skema database (PostgreSQL / Supabase)
-- Cara pakai: buka Supabase Dashboard → SQL Editor → tempel &
-- jalankan seluruh file ini sekali.
-- ============================================================

create extension if not exists "pgcrypto";

-- ── tabel ────────────────────────────────────────────────────
create table if not exists categories (
  slug text primary key,
  name text not null,
  emoji text not null default '🛒',
  tint  text not null default '#f1f5f9',
  sort  int  not null default 0
);

create table if not exists products (
  id            text primary key,               -- slug, mis. "indomie-goreng-pcs"
  name          text not null,
  category_slug text references categories(slug),
  price         int  not null check (price >= 0),
  old_price     int,
  unit          text not null default '1 pcs',
  emoji         text not null default '🛒',
  image_url     text,                           -- URL foto (opsional)
  stock         int  not null default 0 check (stock >= 0),
  is_promo      boolean not null default false,
  is_bestseller boolean not null default false,
  is_new        boolean not null default false,
  description   text,
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_category_idx on products (category_slug);

create table if not exists orders (
  id             text primary key,               -- "LMB-xxxx"
  created_at     timestamptz not null default now(),
  channel        text not null check (channel in ('whatsapp','form')),
  status         text not null default 'menunggu'
                 check (status in ('menunggu','diproses','selesai','dibatalkan')),
  stock_applied  boolean not null default false,
  customer_name  text not null,
  customer_phone text not null,
  customer_address text not null,
  note           text,
  payment        text not null check (payment in ('COD','Transfer Bank')),
  subtotal       int not null default 0,
  shipping       int not null default 0,
  total          int not null default 0
);

create table if not exists order_items (
  id         bigint generated always as identity primary key,
  order_id   text not null references orders(id) on delete cascade,
  product_id text references products(id),
  name       text not null,                     -- snapshot saat pesanan
  price      int  not null,
  qty        int  not null check (qty > 0),
  unit       text not null,
  emoji      text not null default '🛒'
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists settings (
  id             int primary key default 1 check (id = 1),
  name           text not null,
  tagline        text not null,
  whatsapp       text not null,
  address        text not null,
  hours          text not null,
  ongkir         int not null default 5000,
  free_ongkir_min int not null default 50000,
  -- notifikasi pesanan masuk ke pemilik (Fonnte WA / Telegram)
  notify_provider text not null default 'off'
                  check (notify_provider in ('off','fonnte','telegram')),
  notify_token    text not null default '',
  notify_target   text not null default ''
);

create table if not exists stock_movements (
  id         bigint generated always as identity primary key,
  product_id text not null references products(id),
  delta      int not null,
  reason     text not null check (reason in ('order','receive','adjust','set','cancel')),
  order_id   text references orders(id),
  created_at timestamptz not null default now()
);

-- ── fungsi transaksi: buat pesanan + kurangi stok atomik ─────
-- Mengembalikan total pesanan. Melempar error bila stok kurang
-- (diterjemahkan API menjadi HTTP 409).
create or replace function create_order(
  p_id       text,
  p_channel  text,
  p_customer jsonb,   -- {name, phone, address, note}
  p_payment  text,
  p_items    jsonb,   -- [{productId, qty}]
  p_shipping int
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

  v_total := v_subtotal + coalesce(p_shipping, 0);

  insert into orders (id, channel, status, stock_applied,
                      customer_name, customer_phone, customer_address,
                      note, payment, subtotal, shipping, total)
  values (p_id, p_channel, 'menunggu', true,
          p_customer->>'name', p_customer->>'phone', p_customer->>'address',
          p_customer->>'note', p_payment, v_subtotal,
          coalesce(p_shipping, 0), v_total);

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products where id = v_item->>'productId';

    insert into order_items (order_id, product_id, name, price, qty, unit, emoji)
    values (p_id, v_product.id, v_product.name, v_product.price,
            (v_item->>'qty')::int, v_product.unit, v_product.emoji);

    update products
      set stock = stock - (v_item->>'qty')::int, updated_at = now()
      where id = v_product.id;

    insert into stock_movements (product_id, delta, reason, order_id)
    values (v_product.id, -((v_item->>'qty')::int), 'order', p_id);
  end loop;

  return v_total;
end; $$;

-- ── keamanan (RLS) ───────────────────────────────────────────
-- Browser tidak pernah mengakses DB langsung: semua lewat API Next.js
-- yang memakai service key di server. RLS dipasang sebagai lapis kedua.
alter table categories      enable row level security;
alter table products        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table settings        enable row level security;
alter table stock_movements enable row level security;

-- publik boleh membaca katalog & pengaturan
drop policy if exists "publik baca kategori" on categories;
create policy "publik baca kategori" on categories
  for select using (true);
drop policy if exists "publik baca produk" on products;
create policy "publik baca produk" on products
  for select using (true);
drop policy if exists "publik baca pengaturan" on settings;
create policy "publik baca pengaturan" on settings
  for select using (true);

-- orders/items/movements & semua penulisan: hanya service key (API).
-- Sengaja TIDAK ada policy untuk anon → tertolak otomatis.

-- ── bucket foto produk (Storage) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "publik baca foto produk" on storage.objects;
create policy "publik baca foto produk" on storage.objects
  for select using (bucket_id = 'product-images');
-- upload hanya lewat API (service key) → tidak ada policy upload anon.
