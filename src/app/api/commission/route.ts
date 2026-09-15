import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToCommission, rowToCommissionSettings } from "@/lib/agent";
import type { CommissionSettings } from "@/lib/types";

/** Pengaturan komisi + ledger pencairan (v6) — khusus admin. */

const MIGRATION_MSG =
  "Tabel komisi belum ada — jalankan sql/alter-v6.sql di Supabase SQL Editor.";
const isMissing = (msg: string) =>
  /commission|agents|relation|Could not find|does not exist/i.test(msg);

/** Bersihkan input admin → nilai valid (batas sama seperti kolom DB). */
function sanitizeSettings(body: Record<string, unknown>): CommissionSettings {
  const int = (v: unknown, fb: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fb;
  };
  const kind = body.kind === "fixed" ? "fixed" : "percent";
  return {
    aktif: body.aktif !== false,
    kind,
    // percent 1–20 (check DB) · fixed bebas asal >= 0
    value:
      kind === "percent"
        ? Math.min(20, Math.max(1, int(body.value, 5)))
        : int(body.value, 0),
    basis: body.basis === "subtotal" ? "subtotal" : "after_discount",
    minAmount: int(body.minAmount, 0),
    maxAmount: int(body.maxAmount, 0),
    minOrderAmount: int(body.minOrderAmount, 0),
    linkDays: Math.max(1, int(body.linkDays, 30)),
    holdDays: int(body.holdDays, 7),
  };
}

/** GET: { settings, commissions } — ledger terbaru 200 baris */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const [{ data: cs }, { data: rows, error }] = await Promise.all([
    db().from("commission_settings").select("*").eq("id", 1).maybeSingle(),
    db()
      .from("agent_commissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? MIGRATION_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({
    settings: rowToCommissionSettings(cs ?? null),
    commissions: (rows ?? []).map(rowToCommission),
  });
}

/** PUT: simpan aturan komisi global */
export async function PUT(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await req.json().catch(() => ({}))) ?? {};
  const s = sanitizeSettings(body);

  const { error } = await db()
    .from("commission_settings")
    .update({
      aktif: s.aktif,
      kind: s.kind,
      value: s.value,
      basis: s.basis,
      min_amount: s.minAmount,
      max_amount: s.maxAmount,
      min_order_amount: s.minOrderAmount,
      link_days: s.linkDays,
      hold_days: s.holdDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    // baris default belum ada (DB dibuat sebelum v6 tapi alter jalan tanpa
    // insert?) → upsert sederhana
    const { error: err2 } = await db().from("commission_settings").upsert({
      id: 1,
      aktif: s.aktif,
      kind: s.kind,
      value: s.value,
      basis: s.basis,
      min_amount: s.minAmount,
      max_amount: s.maxAmount,
      min_order_amount: s.minOrderAmount,
      link_days: s.linkDays,
      hold_days: s.holdDays,
    });
    if (err2) {
      return Response.json(
        { error: isMissing(err2.message) ? MIGRATION_MSG : err2.message },
        { status: 500 },
      );
    }
  }
  return Response.json({ ok: true, settings: s });
}

/** PATCH: aksi ledger — { id, action: "bayar" | "batal" | "ulang" }
    atau koreksi manual { id, override: number|null }.
    Nilai komisi tersimpan (snapshot) tidak diubah — hanya status/koreksi. */
export async function PATCH(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await req.json().catch(() => ({}))) ?? {};
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "id komisi tidak valid." }, { status: 400 });
  }

  const { data: cur, error: cerr } = await db()
    .from("agent_commissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cerr) {
    return Response.json(
      { error: isMissing(cerr.message) ? MIGRATION_MSG : cerr.message },
      { status: 500 },
    );
  }
  if (!cur) return Response.json({ error: "Komisi tidak ditemukan." }, { status: 404 });
  const c = rowToCommission(cur);

  const patch: Record<string, unknown> = {};
  if (body.override !== undefined) {
    patch.override_amount =
      body.override === null ? null : Math.max(0, Math.round(Number(body.override)));
  } else if (body.action === "bayar") {
    if (c.status !== "pending") {
      return Response.json({ error: "Hanya komisi berstatus Menunggu yang bisa dibayar." }, { status: 409 });
    }
    patch.status = "dibayar";
    patch.paid_at = new Date().toISOString();
  } else if (body.action === "batal") {
    patch.status = "batal";
  } else if (body.action === "ulang") {
    // kembalikan ke pending (mis. salah batal) — hanya baris nilai > 0
    if ((c.overrideAmount ?? c.amount) <= 0) {
      return Response.json({ error: "Komisi bernilai 0 tidak bisa diaktifkan lagi." }, { status: 409 });
    }
    patch.status = "pending";
  } else {
    return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  }

  const { error } = await db().from("agent_commissions").update(patch).eq("id", id);
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? MIGRATION_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
