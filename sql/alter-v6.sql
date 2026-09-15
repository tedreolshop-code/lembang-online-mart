-- ============================================================
-- MIGRASI v6 — harga grosir (semua pembeli) + program agen & komisi
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor. Aman diulang.
-- Kode lama tetap jalan: kolom baru punya nilai default dan create_order
-- versi baru memakai parameter default (p_agent_code) sehingga pemanggil
-- lama tidak perlu diubah.
-- ============================================================

-- ── 1. harga modal (HPP) — disiapkan walau belum ada datanya ────────
-- 0 = pemilik belum mengisi; dipakai nanti untuk laporan laba kotor.
alter table products add column if not exists cost_price int not null default 0;

-- ── 2. harga grosir: satu produk boleh punya beberapa tingkat jumlah ─
-- Harga yang dipakai = tier dengan min_qty terbesar yang <= jumlah dibeli.
-- Kosong = grosir tidak aktif untuk produk itu (harga normal berlaku).
create table if not exists product_tiers (
  id         bigint generated always as identity primary key,
  product_id text not null references products(id) on delete cascade,
  min_qty    int  not null check (min_qty > 1),
  price      int  not null check (price >= 0),
  unique (product_id, min_qty)
);
create index if not exists product_tiers_product_idx on product_tiers (product_id);

-- ── 3. aturan komisi agen (baris tunggal, diatur pemilik) ────────────
create table if not exists commission_settings (
  id               int primary key default 1 check (id = 1),
  aktif            boolean not null default true,
  kind             text not null default 'percent' check (kind in ('percent','fixed')),
  value            int  not null default 5,      -- persen 1–20 atau Rp tetap per pesanan
  basis            text not null default 'after_discount'
                     check (basis in ('subtotal','after_discount')),
  min_amount       int not null default 0,       -- lantai komisi per pesanan (0 = tanpa)
  max_amount       int not null default 20000,   -- plafon komisi per pesanan (0 = tanpa)
  min_order_amount int not null default 0,       -- minimum nilai pesanan agar dapat komisi
  link_days        int not null default 30,      -- masa berlaku kode dari link (hari)
  hold_days        int not null default 7,       -- masa tunggu sebelum bisa dicairkan
  updated_at       timestamptz not null default now()
);
insert into commission_settings (id) values (1) on conflict (id) do nothing;

-- ── 4. agen ──────────────────────────────────────────────────────────
-- pay_target (no. rekening / e-wallet) = data pribadi → tabel dikunci RLS.
create table if not exists agents (
  code               text primary key,
  nama               text not null,
  wa                 text not null,
  alamat             text not null default '',
  pay_method         text not null default 'ewallet'
                       check (pay_method in ('transfer','ewallet')),
  pay_target         text not null default '',
  commission_percent int check (commission_percent is null
                                or (commission_percent between 1 and 20)),
  status             text not null default 'pending'
                       check (status in ('pending','aktif','nonaktif')),
  total_klik         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── 5. ledger komisi: SNAPSHOT saat pesanan dibuat ───────────────────
-- Sengaja menyimpan angka hasil (basis_amount, percent_used, amount) supaya
-- mengubah aturan komisi TIDAK mengubah komisi pesanan yang sudah terjadi.
-- "siap dibayar" dihitung dari ready_at (diisi saat pesanan selesai +
-- hold_days) sehingga tidak butuh scheduler/cron.
create table if not exists agent_commissions (
  id              bigint generated always as identity primary key,
  order_id        text not null unique references orders(id) on delete cascade,
  agent_code      text not null references agents(code),
  basis_amount    int  not null default 0,
  percent_used    int  not null default 0,
  amount          int  not null default 0,
  override_amount int,                          -- koreksi manual oleh admin
  status          text not null default 'pending'
                    check (status in ('pending','dibayar','batal')),
  ready_at        timestamptz,
  paid_at         timestamptz,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists agent_commissions_agent_idx
  on agent_commissions (agent_code, status);

-- ── 6. pesanan mencatat agen & komisi yang tercatat ──────────────────
alter table orders add column if not exists agent_code text;
alter table orders add column if not exists agent_commission int not null default 0;

-- ── 7. RLS: tanpa policy → hanya service key (API Next.js) ───────────
alter table product_tiers       enable row level security;
alter table commission_settings enable row level security;
alter table agents              enable row level security;
alter table agent_commissions   enable row level security;

-- ── 8. create_order v6: harga grosir + catat agen & komisi ───────────
-- Versi lama (9 argumen) dibuang supaya pemanggil yang tidak mengirim
-- p_agent_code tetap memakai fungsi ini (kalau keduanya ada, PostgreSQL
-- memilih versi lama dan komisi tidak akan tercatat).
drop function if exists create_order(text, text, jsonb, text, jsonb, int);
drop function if exists create_order(text, text, jsonb, text, jsonb, int, int, text, text);

create or replace function create_order(
  p_id       text,
  p_channel  text,
  p_customer jsonb,   -- {name, phone, address, note}
  p_payment  text,
  p_items    jsonb,   -- [{productId, qty}]
  p_shipping int,
  p_discount     int  default 0,
  p_coupon_code  text default null,
  p_ship_option  text default 'reguler',
  p_agent_code   text default null
) returns int language plpgsql as $$
declare
  v_item     jsonb;
  v_lines    jsonb := '[]'::jsonb;   -- item + harga efektif (termasuk grosir)
  v_product  products%rowtype;
  v_qty      int;
  v_price    int;
  v_tier     int;
  v_subtotal int := 0;
  v_total    int;
  v_agent    agents%rowtype;
  v_cs       commission_settings%rowtype;
  v_code     text;
  v_basis    int := 0;
  v_pct      int := 0;
  v_komisi   int := 0;
  v_note     text := '';
  v_phone    text;
  v_agenwa   text;
begin
  if exists (select 1 from orders where id = p_id) then
    raise exception 'kode pesanan sudah terpakai';
  end if;

  -- validasi stok & hitung subtotal dari harga di DB (harga grosir ikut)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = v_item->>'productId' for update;
    if not found then
      raise exception 'produk tidak ditemukan: %', v_item->>'productId';
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_product.stock < v_qty then
      raise exception 'stok tidak cukup: %', v_product.name;
    end if;

    -- harga grosir = tier dengan min_qty terbesar yang <= jumlah dibeli
    v_tier := null;
    select t.price into v_tier from product_tiers t
      where t.product_id = v_product.id and t.min_qty <= v_qty
      order by t.min_qty desc limit 1;
    v_price := v_product.price;
    if v_tier is not null and v_tier < v_price then
      v_price := v_tier;
    end if;

    v_subtotal := v_subtotal + v_price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'productId', v_product.id, 'qty', v_qty, 'price', v_price);
  end loop;

  v_total := greatest(
    0,
    v_subtotal + coalesce(p_shipping, 0) - coalesce(p_discount, 0)
  );

  -- ── komisi agen: dihitung SEKALI di sini lalu disimpan (snapshot) ──
  v_code := nullif(upper(regexp_replace(coalesce(p_agent_code, ''),
                                        '[^A-Za-z0-9]', '', 'g')), '');
  if v_code is not null then
    select * into v_agent from agents where code = v_code;
    if not found then
      v_code := null;                        -- kode tidak dikenal → tanpa atribusi
    else
      v_phone := regexp_replace(coalesce(p_customer->>'phone', ''), '[^0-9]', '', 'g');
      if v_phone like '0%' then v_phone := '62' || substring(v_phone from 2); end if;
      v_agenwa := regexp_replace(coalesce(v_agent.wa, ''), '[^0-9]', '', 'g');
      if v_agenwa like '0%' then v_agenwa := '62' || substring(v_agenwa from 2); end if;

      select * into v_cs from commission_settings where id = 1;
      if not coalesce(v_cs.aktif, false) then
        v_note := 'program komisi sedang tidak aktif';
      elsif v_agent.status <> 'aktif' then
        v_note := 'agen belum aktif';
      elsif v_phone <> '' and v_phone = v_agenwa then
        v_note := 'pembelian sendiri — komisi 0';
      else
        v_basis := case when v_cs.basis = 'subtotal'
                        then v_subtotal
                        else greatest(0, v_subtotal - coalesce(p_discount, 0)) end;
        if v_basis < v_cs.min_order_amount then
          v_note := 'di bawah minimum belanja untuk komisi';
        elsif v_agent.commission_percent is not null then
          v_pct := v_agent.commission_percent;      -- komisi khusus agen ini
          v_komisi := round(v_basis * v_pct / 100.0 / 100) * 100;
        elsif v_cs.kind = 'percent' then
          v_pct := v_cs.value;
          v_komisi := round(v_basis * v_pct / 100.0 / 100) * 100;
        else
          v_komisi := v_cs.value;                   -- nominal tetap per pesanan
        end if;
        if v_cs.min_amount > 0 and v_komisi < v_cs.min_amount then
          v_komisi := v_cs.min_amount;
        end if;
        if v_cs.max_amount > 0 and v_komisi > v_cs.max_amount then
          v_komisi := v_cs.max_amount;
        end if;
      end if;
    end if;
  end if;

  insert into orders (id, channel, status, stock_applied,
                      customer_name, customer_phone, customer_address,
                      note, payment, ship_option, subtotal, discount,
                      coupon_code, shipping, total,
                      agent_code, agent_commission)
  values (p_id, p_channel, 'menunggu', true,
          p_customer->>'name', p_customer->>'phone', p_customer->>'address',
          p_customer->>'note', p_payment,
          coalesce(nullif(p_ship_option, ''), 'reguler'),
          v_subtotal, coalesce(p_discount, 0), p_coupon_code,
          coalesce(p_shipping, 0), v_total, v_code, v_komisi);

  -- baris komisi dibuat begitu ada agen yang tercatat, walau nilainya 0
  -- (supaya alasan 0-nya terekam: pembelian sendiri, agen nonaktif, dst.)
  if v_code is not null then
    insert into agent_commissions
      (order_id, agent_code, basis_amount, percent_used, amount, status, note)
    values (p_id, v_code, v_basis, v_pct, v_komisi,
            case when v_komisi > 0 then 'pending' else 'batal' end, v_note);
  end if;

  if p_coupon_code is not null then
    update coupons
      set used_count = used_count + 1
      where upper(code) = upper(p_coupon_code);
  end if;

  for v_item in select * from jsonb_array_elements(v_lines) loop
    select * into v_product from products where id = v_item->>'productId';

    insert into order_items (order_id, product_id, name, price, qty, unit, emoji)
    values (p_id, v_product.id, v_product.name, (v_item->>'price')::int,
            (v_item->>'qty')::int, v_product.unit, v_product.emoji);

    update products
      set stock = stock - (v_item->>'qty')::int, updated_at = now()
      where id = v_product.id;

    insert into stock_movements (product_id, delta, reason, order_id)
    values (v_product.id, -((v_item->>'qty')::int), 'order', p_id);
  end loop;

  return v_total;
end; $$;

-- Catatan untuk API (Langkah 2):
-- * p_agent_code diisi dari kode agen yang diketik pembeli atau tersimpan
--   dari link referral (?ref=KODE); validitas & atribusi diputus di sini.
-- * saat pesanan diubah jadi 'selesai', API mengisi agent_commissions.ready_at
--   = now() + hold_days → komisi "siap dibayar" = ready_at sudah lewat.
-- * saat pesanan 'dibatalkan', API mengubah baris komisi terkait jadi 'batal'.
