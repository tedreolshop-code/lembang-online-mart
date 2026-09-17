import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { newAgentCode, normalizeAgentCode, rowToAgent } from "@/lib/agent";
import { formatWaDigits } from "@/lib/config";
import type { Agent } from "@/lib/types";

/** Program agen (v6). Semua tulis-hapus khusus admin; tabel terkunci RLS
    sehingga hanya service key (file ini) yang bisa mengaksesnya. */

const AGENTS_MIGRATION_MSG =
  "Tabel agen belum ada — jalankan sql/alter-v6.sql di Supabase SQL Editor.";
const isMissing = (msg: string) =>
  /agents|commission|relation|Could not find|does not exist/i.test(msg);

/** Bersihkan input admin → baris DB. null = tidak valid. */
function agentToRow(a: Partial<Agent>): Record<string, unknown> | null {
  const nama = String(a.nama ?? "").trim().slice(0, 80);
  const wa = formatWaDigits(String(a.wa ?? ""));
  if (!nama || wa.length < 8) return null;
  const pct =
    a.commissionPercent == null || Number.isNaN(Number(a.commissionPercent))
      ? null
      : Math.min(20, Math.max(1, Math.round(Number(a.commissionPercent))));
  return {
    code: normalizeAgentCode(a.code) || newAgentCode(),
    nama,
    wa,
    alamat: String(a.alamat ?? "").trim().slice(0, 200),
    pay_method: a.payMethod === "transfer" ? "transfer" : "ewallet",
    pay_target: String(a.payTarget ?? "").trim().slice(0, 80),
    commission_percent: pct,
    // mode komisi (v9) — penanda UI; perhitungan tetap di create_order
    commission_mode: a.commissionMode === "price" ? "price" : "percent",
    status:
      a.status === "aktif" || a.status === "nonaktif" ? a.status : "pending",
    updated_at: new Date().toISOString(),
  };
}

/** GET: daftar agen (admin) */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { data, error } = await db()
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? AGENTS_MIGRATION_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json((data ?? []).map(rowToAgent));
}

/** POST: tambah/perbarui agen. Kode kosong → otomatis. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json().catch(() => null);
  const row = agentToRow(body ?? {});
  if (!row) {
    return Response.json(
      { error: "Nama & nomor WhatsApp (min. 8 digit) wajib diisi." },
      { status: 400 },
    );
  }

  // total_klik tidak boleh hilang saat admin mengedit agen
  const code = row.code as string;
  const { data: existing } = await db()
    .from("agents")
    .select("total_klik")
    .eq("code", code)
    .maybeSingle();
  const payload: Record<string, unknown> = existing
    ? { ...row, total_klik: existing.total_klik }
    : row;

  let { error } = await db().from("agents").upsert(payload);
  let warning: string | undefined;
  // kolom commission_mode (v9) hanya ada setelah alter-v9.sql — bila belum,
  // simpan ulang tanpa kolom itu supaya agen tetap bisa disimpan admin
  if (error && /commission_mode/i.test(error.message)) {
    const tanpaMode = { ...payload };
    delete tanpaMode.commission_mode;
    error = (await db().from("agents").upsert(tanpaMode)).error;
    warning =
      "Mode komisi belum tersimpan — jalankan sql/alter-v9.sql di Supabase SQL Editor.";
  }
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? AGENTS_MIGRATION_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, code, warning });
}

/** DELETE: ?code= — hanya bila agen belum punya riwayat komisi.
    Kalau sudah ada, arahkan admin menonaktifkan ( ledger menjaga integritas). */
export async function DELETE(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const code = normalizeAgentCode(new URL(req.url).searchParams.get("code"));
  if (!code) return Response.json({ error: "Kode agen kosong." }, { status: 400 });

  const { data: used } = await db()
    .from("agent_commissions")
    .select("id")
    .eq("agent_code", code)
    .limit(1);
  if (used && used.length > 0) {
    return Response.json(
      {
        error:
          "Agen ini punya riwayat komisi — ubah status jadi Nonaktif, jangan hapus.",
      },
      { status: 409 },
    );
  }
  const { error } = await db().from("agents").delete().eq("code", code);
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? AGENTS_MIGRATION_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
