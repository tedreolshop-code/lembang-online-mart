import { db, isCloud, cloudRequired } from "@/lib/db";
import {
  normalizeAgentCode,
  rowToAgentPrice,
  rowToCommissionSettings,
} from "@/lib/agent";

/** POST (publik): pembeli membuka link referral agen → catat klik +
    kembalikan info singkat untuk banner "Ditujuk oleh …" beserta harga
    khusus agen (v9) agar keranjang/checkout memakai angka yang sama dengan
    tagihan `create_order`.
    Data pribadi agen (rekening dsb.) TIDAK pernah dikirim ke sini. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  const body = await req.json().catch(() => null);
  const code = normalizeAgentCode(
    body?.code ?? new URL(req.url).searchParams.get("code"),
  );
  if (!code) return Response.json({ ok: false });

  const { data: agent } = await db()
    .from("agents")
    .select("code,nama,status,total_klik")
    .eq("code", code)
    .maybeSingle();
  if (!agent || agent.status !== "aktif") return Response.json({ ok: false });

  // klik dicatat best-effort — kegagalan tidak boleh merusak halaman
  void db()
    .from("agents")
    .update({ total_klik: Number(agent.total_klik ?? 0) + 1 })
    .eq("code", code)
    .then(() => {}, () => {});

  // harga khusus (v9) — best-effort: tabelnya mungkin belum dimigrasi, dan
  // tanpa harga khusus pembeli tetap memakai harga normal/grosir
  const { data: prices } = await db()
    .from("agent_prices")
    .select("agent_code,product_id,price")
    .eq("agent_code", code)
    .order("product_id", { ascending: true });

  const { data: cs } = await db()
    .from("commission_settings")
    .select("link_days")
    .eq("id", 1)
    .maybeSingle();
  return Response.json({
    ok: true,
    nama: agent.nama,
    linkDays: rowToCommissionSettings(cs ?? null).linkDays,
    prices: (prices ?? []).map((r) => {
      const p = rowToAgentPrice(r);
      return { productId: p.productId, price: p.price };
    }),
  });
}
