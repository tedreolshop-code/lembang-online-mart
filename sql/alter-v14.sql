-- ============================================================
-- MIGRASI v14 — perkuat create_order (jalankan SEKALI, aman diulang)
-- ============================================================
-- Perubahan pada fungsi create_order (satu-satunya sumber kebenaran harga):
--   1. Kuota voucher dijaga ATOMIK: baris coupon dikunci (SELECT ... FOR UPDATE)
--      lalu diverifikasi (ada, aktif, belum kedaluwarsa, kuota masih ada, min
--      belanja tercapai) SEBELUM used_count dinaikkan. Sebelumnya kenaikan
--      dilakukan tanpa cek sehingga kuota bisa oversell saat permintaan
--      bersamaan (validasi hanya di Node).
--   2. Harga khusus agen hanya dipakai bila LEBIH MURAH dari harga efektif
--      (normal/grosir) — mencegah pembeli ditagih lebih mahal dari harga toko
--      karena salah set harga agen.
--   3. Jumlah item divalidasi: qty harus bilangan bulat > 0 (cegah subtotal
--      negatif dari qty negatif).
--
-- API Node (src/app/api/orders/route.ts) tetap memvalidasi lebih dulu untuk
-- pesan error yang ramah; fungsi ini adalah pengaman terakhir yang tidak bisa
-- dilewati permintaan bersamaan.
--
-- Prasyarat: skema sudah punya tabel `coupons` (sql/alter-v4.sql).
-- ============================================================

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
  v_adj      jsonb := '[]'::jsonb;   -- v_lines setelah harga agen ditimpa
  v_product  products%rowtype;
  v_qty      int;
  v_price    int;
  v_tier     int;
  v_aprice   int;
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
  v_coupon   coupons%rowtype;
begin
  if exists (select 1 from orders where id = p_id) then
    raise exception 'kode pesanan sudah terpakai';
  end if;

  -- validasi stok & susun baris pesanan dari harga di DB (harga grosir ikut);
  -- subtotal dihitung setelah harga khusus agen (v9) diterapkan
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from products
      where id = v_item->>'productId' for update;
    if not found then
      raise exception 'produk tidak ditemukan: %', v_item->>'productId';
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'jumlah tidak valid';
    end if;
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

    v_lines := v_lines || jsonb_build_object(
      'productId', v_product.id, 'qty', v_qty, 'price', v_price);
  end loop;

  -- ── (v9) harga khusus agen: berlaku bila agen aktif & bukan pembelian
  -- sendiri. Harga ditimpa di v_lines supaya subtotal, order_items, dan
  -- komisi semuanya memakai angka yang benar-benar ditagih.
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

      if v_agent.status = 'aktif'
         and not (v_phone <> '' and v_phone = v_agenwa) then
        v_adj := '[]'::jsonb;
        for v_item in select * from jsonb_array_elements(v_lines) loop
          v_aprice := null;
          select ap.price into v_aprice
            from agent_prices ap
            where ap.agent_code = v_code
              and ap.product_id = v_item->>'productId';
          -- harga khusus agen hanya dipakai bila LEBIH MURAH dari harga
          -- efektif saat itu (normal/grosir) — pembeli tak bisa ditagih lebih
          -- mahal dari harga toko karena salah set harga agen.
          if v_aprice is not null and v_aprice > 0
             and v_aprice < (v_item->>'price')::int then
            v_item := jsonb_set(v_item, '{price}', to_jsonb(v_aprice));
          end if;
          v_adj := v_adj || v_item;
        end loop;
        v_lines := v_adj;             -- harga final agen (menimpa normal/grosir)
      end if;
    end if;
  end if;

  -- subtotal dihitung dari harga yang benar-benar ditagih
  v_subtotal := 0;
  for v_item in select * from jsonb_array_elements(v_lines) loop
    v_subtotal := v_subtotal + (v_item->>'price')::int * (v_item->>'qty')::int;
  end loop;

  -- ── komisi agen: dihitung SEKALI di sini lalu disimpan (snapshot) ──
  if v_code is not null then
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

  -- total dihitung SETELAH harga khusus agen (v9) ikut diperhitungkan
  v_total := greatest(
    0,
    v_subtotal + coalesce(p_shipping, 0) - coalesce(p_discount, 0)
  );

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

  -- kuota voucher dijaga ATOMIK di sini (SELECT ... FOR UPDATE): validasi di
  -- Node bisa dilewati oleh permintaan bersamaan sehingga kuota bisa oversell.
  if p_coupon_code is not null then
    select * into v_coupon from coupons
      where upper(code) = upper(p_coupon_code) for update;
    if not found then
      raise exception 'voucher tidak ditemukan';
    end if;
    if not v_coupon.active then
      raise exception 'voucher sedang tidak aktif';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then
      raise exception 'voucher sudah kedaluwarsa';
    end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'kuota voucher habis';
    end if;
    if v_coupon.min_subtotal > 0 and v_subtotal < v_coupon.min_subtotal then
      raise exception 'belanja belum mencapai minimum voucher';
    end if;
    update coupons
      set used_count = used_count + 1
      where upper(code) = upper(p_coupon_code);
  end if;

  for v_item in select * from jsonb_array_elements(v_lines) loop
    select * into v_product from products where id = v_item->>'productId';

    insert into order_items (order_id, product_id, name, price, qty, unit, emoji, cost_price)
    values (p_id, v_product.id, v_product.name, (v_item->>'price')::int,
            (v_item->>'qty')::int, v_product.unit, v_product.emoji,
            v_product.cost_price);

    update products
      set stock = stock - (v_item->>'qty')::int, updated_at = now()
      where id = v_product.id;

    insert into stock_movements (product_id, delta, reason, order_id)
    values (v_product.id, -((v_item->>'qty')::int), 'order', p_id);
  end loop;

  return v_total;
end; $$;
