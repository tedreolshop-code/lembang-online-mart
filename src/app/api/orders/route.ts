import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToOrder, rowToSettings } from "@/lib/rows";
import { DEFAULT_SETTINGS } from "@/lib/config";
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

/** POST: buat pesanan (publik) — harga & stok divalidasi server, stok
    berkurang atomik lewat fungsi create_order di database */
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
  const byId = new Map((prows ?? []).map((p) => [p.id, p]));
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
  const subtotal = items.reduce(
    (a: number, i: { productId: string; qty: number }) =>
      a + (byId.get(i.productId)?.price ?? 0) * i.qty,
    0,
  );
  const shipping = subtotal >= s.free_ongkir_min ? 0 : s.ongkir;

  // kode pesanan unik dengan percobaan ulang bila bentrok
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `LMB-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error, data } = await db().rpc("create_order", {
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
    });
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
      return Response.json({ order, total: data });
    }
    lastError = error.message;
    if (!lastError.includes("kode pesanan sudah terpakai")) break;
  }
  return Response.json({ error: lastError }, { status: 409 });
}
