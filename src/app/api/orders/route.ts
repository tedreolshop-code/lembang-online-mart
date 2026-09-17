import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToOrder, rowToSettings, orderWithoutCostPrice } from "@/lib/rows";
import { couponDiscount, rowToCoupon } from "@/lib/coupon";
import { unitPriceWithAgent } from "@/lib/pricing";
import type { AgentPriceLine } from "@/lib/types";
import { tiersForProducts } from "@/lib/product-tiers";
import { normalizeAgentCode, normalizeWa } from "@/lib/agent";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { newOrderId } from "@/lib/format";
import { sendOrderNotification } from "@/lib/notify";
import { withSecrets } from "@/lib/notify-secrets";
import { after } from "next/server";

/** GET: semua pesanan — khusus admin (mode cloud) */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { data, error } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(rowToOrder));
}

/** POST: buat pesanan (publik) — harga, stok, ongkir, dan voucher
    divalidasi server; stok berkurang atomik lewat fungsi create_order */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const body = await req.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ error: "Pesanan kosong." }, { status: 400 });
  }
  const c = body?.customer ?? {};
  if (!c.name?.trim() || !c.phone?.trim() || !c.address?.trim()) {
    return Response.json(
      { error: "Nama, nomor HP, dan alamat wajib diisi." },
      { status: 400 },
    );
  }
  const shipOption = body.shipOption === "xpress" ? "xpress" : "reguler";

  // pengaturan ongkir dari DB
  const { data: sRow } = await db().from("settings").select("*").eq("id", 1).single();
  const s = sRow ?? {
    ongkir: DEFAULT_SETTINGS.ongkir,
    free_ongkir_min: DEFAULT_SETTINGS.freeOngkirMin,
  };

  // subtotal dihitung server dari harga di DB (tidak percaya client)
  const ids = items.map((i: { productId: string }) => i.productId);
  const { data: prows, error: perr } = await db()
    .from("products")
    .select("id, price, stock, name")
    .in("id", ids);
  if (perr) return Response.json({ error: perr.message }, { status: 500 });
  // harga grosir (v6): tempelkan tier ke tiap produk agar server memakai
  // harga efektif yang SAMA dengan create_order
  const tierMap = await tiersForProducts(
    db(),
    (prows ?? []).map((p) => p.id),
  );
  const byId = new Map(
    (prows ?? []).map((p) => [p.id, { ...p, tiers: tierMap.get(p.id) }]),
  );
  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p) return Response.json({ error: "Produk tidak ditemukan." }, { status: 400 });
    if (p.stock < i.qty) {
      return Response.json(
        { error: `Stok tidak cukup untuk ${p.name}.` },
        { status: 409 },
      );
    }
  }
  const agentCode = normalizeAgentCode(body.agentCode);
  // harga khusus agen (v9): pembeli dari tautan agen membayar harga ini, dan
  // pratinjau server (ongkir & voucher) harus memakai angka yang sama dengan
  // create_order. Data diambil dari DB — client tidak dipercaya.
  let agentPrices: AgentPriceLine[] = [];
  if (agentCode) {
    const { data: arow } = await db()
      .from("agents")
      .select("code, wa, status")
      .eq("code", agentCode)
      .maybeSingle();
    const selfPurchase =
      arow != null && normalizeWa(c.phone) === normalizeWa(arow.wa);
    if (arow && arow.status === "aktif" && !selfPurchase) {
      const { data: prow } = await db()
        .from("agent_prices")
        .select("product_id, price")
        .eq("agent_code", agentCode);
      agentPrices = (prow ?? []).map((r) => ({
        productId: r.product_id as string,
        price: Number(r.price),
      }));
    }
  }

  const subtotal = items.reduce(
    (a: number, i: { productId: string; qty: number }) => {
      const p = byId.get(i.productId);
      if (!p) return a;
      // harga grosir (v6) + harga khusus agen (v9) ikut dihitung di server —
      // sama aturannya dengan create_order; tanpa harga client sama sekali
      return a + unitPriceWithAgent(p, i.qty, agentPrices) * i.qty;
    },
    0,
  );
  const xpressOngkir = Number.isFinite(sRow?.xpress_ongkir)
    ? sRow!.xpress_ongkir
    : DEFAULT_SETTINGS.xpressOngkir;
  const shipping =
    shipOption === "xpress"
      ? Math.max(0, xpressOngkir)
      : subtotal >= s.free_ongkir_min
        ? 0
        : s.ongkir;

  // voucher divalidasi ulang di sini — client tidak pernah dipercaya
  let discount = 0;
  let couponCode: string | null = null;
  const wantedCoupon = String(body.couponCode ?? "").toUpperCase().trim();
  if (wantedCoupon) {
    const { data: crow, error: cerr } = await db()
      .from("coupons")
      .select("*")
      .eq("code", wantedCoupon)
      .maybeSingle();
    if (cerr) {
      return Response.json(
        {
          error: /coupons|relation/i.test(cerr.message)
            ? "Voucher belum tersedia — jalankan sql/alter-v4.sql di Supabase SQL Editor."
            : cerr.message,
        },
        { status: 500 },
      );
    }
    if (!crow) {
      return Response.json({ error: "Voucher tidak ditemukan." }, { status: 400 });
    }
    const res = couponDiscount(rowToCoupon(crow), subtotal);
    if (!res.ok) {
      return Response.json({ error: res.error ?? "Voucher tidak berlaku." }, { status: 400 });
    }
    discount = res.discount ?? 0;
    couponCode = wantedCoupon;
  }

  // kode pesanan unik dengan percobaan ulang bila bentrok
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newOrderId();
    const baseArgs = {
      p_id: id,
      p_channel: body.channel === "whatsapp" ? "whatsapp" : "form",
      p_customer: {
        name: String(c.name).trim(),
        phone: String(c.phone).trim(),
        address: String(c.address).trim(),
        note: c.note ? String(c.note).trim() : null,
      },
      p_payment: body.payment === "Transfer Bank" ? "Transfer Bank" : "COD",
      p_items: items.map((i: { productId: string; qty: number }) => ({
        productId: i.productId,
        qty: i.qty,
      })),
      p_shipping: shipping,
    };
    // versi v4 (diskon + voucher + opsi antar) dengan fallback ke
    // fungsi lama bila database belum dimigrasi
    let { error, data } = await db().rpc("create_order", {
      ...baseArgs,
      p_discount: discount,
      p_coupon_code: couponCode,
      p_ship_option: shipOption,
      p_agent_code: agentCode || null,
    });
    if (error && /find the function|does not exist/i.test(error.message)) {
      if (couponCode || shipOption === "xpress") {
        return Response.json(
          {
            error:
              "Database belum dimigrasi — minta pemilik menjalankan sql/alter-v4.sql di Supabase SQL Editor.",
          },
          { status: 503 },
        );
      }
      if (agentCode) {
        return Response.json(
          {
            error:
              "Database belum dimigrasi — kode agen butuh sql/alter-v6.sql dijalankan pemilik di Supabase SQL Editor.",
          },
          { status: 503 },
        );
      }
      ({ error, data } = await db().rpc("create_order", baseArgs));
    }
    if (!error) {
      const { data: rows } = await db()
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .single();
      const order = rowToOrder(rows!);
      // notifikasi ke pemilik — dikirim setelah respons selesai, best-effort
      const settings = sRow
        ? await withSecrets(rowToSettings(sRow))
        : DEFAULT_SETTINGS;
      after(async () => {
        await sendOrderNotification(settings, order);
      });
      // endpoint ini publik → HPP yang ikut tersimpan di order_items
      // dibuang sebelum dikirim balik ke pembeli.
      return Response.json({
        order: orderWithoutCostPrice(order),
        total: data,
      });
    }
    lastError = error.message;
    if (!lastError.includes("kode pesanan sudah terpakai")) break;
  }
  return Response.json({ error: lastError }, { status: 409 });
}
