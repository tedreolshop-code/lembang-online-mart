import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { normalizeAgentCode, rowToAgent, rowToCommission, effectiveCommission, isCommissionReady } from "@/lib/agent";

/** Dashboard agen — data profil + ringkasan komisi + riwayat pesanan.
    Agen login dengan No. WA + kode unik (diberikan saat daftar disetujui).
    Tidak butuh admin auth — kode agen adalah kuncinya. */

/** Batas per IP: endpoint ini memverifikasi pasangan No. WA + kode agen, jadi
    tanpa batas laju pasangan itu bisa digempur sampai ketemu. */
const AGEN_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 };

export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = hitRateLimit(`agen-me:${clientIp(req)}`, AGEN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const url = new URL(req.url);
  const wa = formatWaDigits(url.searchParams.get("wa") ?? "");
  const code = normalizeAgentCode(url.searchParams.get("code") ?? "");

  if (!wa || wa.length < 8) {
    return Response.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: "Kode agen wajib diisi." }, { status: 400 });
  }

  // ambil data agen — harus cocok WA + kode
  const { data: agentRow, error: aErr } = await db()
    .from("agents")
    .select("*")
    .eq("code", code)
    .eq("wa", wa)
    .maybeSingle();

  if (aErr) {
    return Response.json({ error: "Gagal mengambil data agen." }, { status: 500 });
  }
  if (!agentRow) {
    return Response.json({ error: "Kode agen atau No. WhatsApp tidak cocok." }, { status: 404 });
  }

  const agent = rowToAgent(agentRow);

  // ambil komisi agen ini (maks. 100 baris terbaru)
  const { data: commRows, error: cErr } = await db()
    .from("agent_commissions")
    .select("*")
    .eq("agent_code", code)
    .order("created_at", { ascending: false })
    .limit(100);

  if (cErr) {
    return Response.json({ error: "Gagal mengambil data komisi." }, { status: 500 });
  }

  const commissions = (commRows ?? []).map(rowToCommission);

  // ringkasan komisi
  const now = Date.now();
  let totalPending = 0;
  let totalReady = 0;
  let totalPaid = 0;
  let totalCancelled = 0;

  for (const c of commissions) {
    const val = effectiveCommission(c);
    if (c.status === "pending" && isCommissionReady(c, now)) {
      totalReady += val;
    } else if (c.status === "pending") {
      totalPending += val;
    } else if (c.status === "dibayar") {
      totalPaid += val;
    } else if (c.status === "batal") {
      totalCancelled += val;
    }
  }

  // ambil pesanan yang membawa kode agen ini (maks. 50)
  const { data: orderRows, error: oErr } = await db()
    .from("orders")
    .select("id, created_at, status, customer_name, customer_phone, total, agent_commission, order_items(*)")
    .eq("agent_code", code)
    .order("created_at", { ascending: false })
    .limit(50);

  if (oErr) {
    return Response.json({ error: "Gagal mengambil riwayat pesanan." }, { status: 500 });
  }

  const orders = (orderRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    createdAt: new Date(r.created_at as string).getTime(),
    status: r.status as string,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string,
    total: Number(r.total ?? 0),
    commission: r.agent_commission == null ? 0 : Number(r.agent_commission),
    itemCount: Array.isArray(r.order_items) ? r.order_items.length : 0,
  }));

  return Response.json({
    agent,
    summary: {
      totalPending,
      totalReady,
      totalPaid,
      totalCancelled,
      totalOrders: orders.length,
      totalKlik: agent.totalKlik,
    },
    commissions,
    orders,
  });
}

/** PATCH: agen edit profil sendiri (nama, alamat, payMethod, payTarget, email).
    Tidak boleh ubah kode, status, atau commissionPercent. */
export async function PATCH(req: Request) {
  if (!isCloud) return cloudRequired();
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const wa = formatWaDigits(String(body.wa ?? ""));
  const code = normalizeAgentCode(body.code ?? "");
  if (!wa || !code) {
    return Response.json({ error: "No. WhatsApp dan kode agen wajib diisi." }, { status: 400 });
  }

  // verifikasi kepemilikan
  const { data: existing } = await db()
    .from("agents")
    .select("code, wa, status")
    .eq("code", code)
    .eq("wa", wa)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Kode agen atau No. WhatsApp tidak cocok." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.nama !== undefined) {
    const nama = String(body.nama).trim().slice(0, 80);
    if (!nama) return Response.json({ error: "Nama wajib diisi." }, { status: 400 });
    patch.nama = nama;
  }
  if (body.alamat !== undefined) {
    patch.alamat = String(body.alamat).trim().slice(0, 200);
  }
  if (body.payMethod !== undefined) {
    patch.pay_method = body.payMethod === "transfer" ? "transfer" : "ewallet";
  }
  if (body.payTarget !== undefined) {
    const pt = String(body.payTarget).trim().slice(0, 80);
    if (!pt) return Response.json({ error: "Tujuan pembayaran wajib diisi." }, { status: 400 });
    patch.pay_target = pt;
  }
  if (body.email !== undefined) {
    patch.email = body.email ? String(body.email).trim().slice(0, 120) : null;
  }

  const { error } = await db().from("agents").update(patch).eq("code", code).eq("wa", wa);
  if (error) {
    return Response.json({ error: "Gagal menyimpan perubahan." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
