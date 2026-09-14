import { db, isCloud, cloudRequired } from "@/lib/db";
import { couponDiscount, rowToCoupon } from "@/lib/coupon";
import type { Coupon } from "@/lib/types";

/** POST (publik): cek kode voucher terhadap subtotal.
    Mengembalikan data voucher bila berlaku; hanya memvalidasi — potongan
    final tetap dihitung ulang saat pesanan dibuat. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  const body = await req.json();
  const code = String(body?.code ?? "").toUpperCase().trim();
  const subtotal = Math.max(0, Number(body?.subtotal ?? 0));
  if (!code) {
    return Response.json({ error: "Masukkan kode voucher dulu ya." }, { status: 400 });
  }

  const { data, error } = await db()
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return Response.json(
      {
        error: /coupons|relation/i.test(error.message)
          ? "Voucher belum tersedia — database perlu dimigrasi (sql/alter-v4.sql)."
          : error.message,
      },
      { status: 500 },
    );
  }
  if (!data) {
    return Response.json({ error: "Voucher tidak ditemukan." }, { status: 404 });
  }

  const coupon = rowToCoupon(data);
  const res = couponDiscount(coupon, subtotal);
  if (!res.ok || res.discount == null) {
    return Response.json({ error: res.error ?? "Voucher tidak berlaku." }, { status: 400 });
  }
  return Response.json({
    coupon: { ...coupon, discount: res.discount } satisfies Coupon & {
      discount: number;
    },
  });
}
