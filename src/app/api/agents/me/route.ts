import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifySecret } from "@/lib/password";
import { normalizeAgentCode, rowToAgent, rowToCommission, effectiveCommission, isCommissionReady } from "@/lib/agent";

/** Dashboard agen — data profil + ringkasan komisi + riwayat pesanan.
    Agen login dengan No. WA + kode agen + PIN. Kode agen tampil publik di
    tautan referral, jadi DIA TIDAK RAHASIA — PIN-lah kuncinya. */

/** Batas per IP: endpoint memverifikasi WA + kode + PIN, jadi tanpa batas laju
    kredensial itu bisa digempur sampai ketemu. */
const AGEN_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 };

type AgentRow = Parameters<typeof rowToAgent>[0];

/** Verifikasi kredensial agen (WA + kode + PIN). Mengembalikan baris agen bila
    valid, atau Response error siap dikirim.
    Kredensial datang lewat HEADER (bukan query string) agar tidak ikut tercatat
    di access log server, riwayat browser, atau Referer. */
async function verifyAgent(
  wa: string,
  code: string,
  pin: string,
): Promise<{ row: AgentRow } | Response> {
  if (!wa || wa.length < 8) {
    return Response.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
  }
  if (!code) {
    return Response.json({ error: "Kode agen wajib diisi." }, { status: 400 });
  }
  if (!pin) {
    return Response.json({ error: "PIN wajib diisi." }, { status: 400 });
  }
  const { data: row, error } = await db()
    .from("agents")
    .select("*")
    .eq("code", code)
    .eq("wa", wa)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "Gagal mengambil data agen." }, { status: 500 });
  }
  if (!row) {
    return Response.json(
      { error: "Nomor WhatsApp atau kode agen tidak cocok." },
      { status: 404 },
    );
  }
  if (!row.pin_hash) {
    return Response.json(
      { error: "PIN belum diatur. Minta admin membuatkan PIN." },
      { status: 403 },
    );
  }
  if (!verifySecret(pin, row.pin_hash)) {
    return Response.json({ error: "PIN salah." }, { status: 401 });
  }
  return { row: row as AgentRow };
}

export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = await hitRateLimit(`agen-me:${clientIp(req)}`, AGEN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const wa = formatWaDigits(req.headers.get("x-agent-wa") ?? "");
  const code = normalizeAgentCode(req.headers.get("x-agent-code") ?? "");
  const pin = String(req.headers.get("x-agent-pin") ?? "");

  const auth = await verifyAgent(wa, code, pin);
  if (auth instanceof Response) return auth;
  const agentRow = auth.row;

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

  const tunggu = await hitRateLimit(`agen-me:${clientIp(req)}`, AGEN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const wa = formatWaDigits(String(body.wa ?? ""));
  const code = normalizeAgentCode(body.code ?? "");
  const pin = String(body.pin ?? "");

  // verifikasi kepemilikan (WA + kode + PIN)
  const auth = await verifyAgent(wa, code, pin);
  if (auth instanceof Response) return auth;

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
