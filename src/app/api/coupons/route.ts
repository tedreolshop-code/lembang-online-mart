import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { normalizeCoupon, rowToCoupon, couponToRow } from "@/lib/coupon";
import type { Coupon } from "@/lib/types";

/** Voucher — khusus admin (mode cloud). */

/** GET: daftar voucher */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { data, error } = await db()
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return Response.json(
      {
        error: /coupons/i.test(error.message)
          ? "Tabel vouchers belum ada — jalankan sql/alter-v4.sql di Supabase SQL Editor."
          : error.message,
      },
      { status: 500 },
    );
  }
  const list: Coupon[] = (data ?? []).map(rowToCoupon);
  return Response.json(list);
}

/** POST: tambah/perbarui satu voucher */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  let coupon: Coupon;
  try {
    coupon = normalizeCoupon(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Voucher tidak valid." },
      { status: 400 },
    );
  }

  const { data: existing } = await db()
    .from("coupons")
    .select("used_count")
    .eq("code", coupon.code)
    .maybeSingle();

  const row: Record<string, unknown> = { ...couponToRow(coupon) };
  if (existing) {
    // pemakaian lama tidak boleh hilang saat admin mengedit voucher
    delete row.used_count;
  }
  const { error } = await db().from("coupons").upsert(row);
  if (error) {
    return Response.json(
      {
        error: /coupons|relation/i.test(error.message)
          ? "Tabel vouchers belum ada — jalankan sql/alter-v4.sql di Supabase SQL Editor."
          : error.message,
      },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, coupon: { ...coupon, usedCount: existing?.used_count ?? coupon.usedCount } });
}

/** DELETE: hapus voucher (?code=XXX) */
export async function DELETE(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const code = new URL(req.url).searchParams.get("code")?.toUpperCase();
  if (!code) return Response.json({ error: "Kode voucher kosong." }, { status: 400 });
  const { error } = await db().from("coupons").delete().eq("code", code);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
