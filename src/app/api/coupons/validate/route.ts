import { db, isCloud, cloudRequired } from "@/lib/db";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { couponDiscount, rowToCoupon } from "@/lib/coupon";
import type { Coupon } from "@/lib/types";

/** Batas cek voucher per IP — menahan penebakan kode beruntun. */
const VALIDATE_LIMIT = { max: 20, windowMs: 60 * 1000 };

/** POST (publik): cek kode voucher terhadap subtotal.
    Mengembalikan data voucher bila berlaku; hanya memvalidasi — potongan
    final tetap dihitung ulang saat pesanan dibuat.
    Semua kegagalan memakai pesan yang SAMA agar endpoint tidak bisa dipakai
    menebak kode mana yang ada (oracle keberadaan voucher). */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = await hitRateLimit(`coupon-validate:${clientIp(req)}`, VALIDATE_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json();
  const code = String(body?.code ?? "").toUpperCase().trim();
  const subtotal = Math.max(0, Number(body?.subtotal ?? 0));
  if (!code) {
    return Response.json({ error: "Masukkan kode voucher dulu ya." }, { status: 400 });
  }

  const TIDAK_VALID = "Kode voucher tidak valid atau tidak berlaku.";
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
          : "Gagal memeriksa voucher.",
      },
      { status: 500 },
    );
  }
  if (!data) {
    return Response.json({ error: TIDAK_VALID }, { status: 400 });
  }

  const coupon = rowToCoupon(data);
  const res = couponDiscount(coupon, subtotal);
  if (!res.ok || res.discount == null) {
    return Response.json({ error: TIDAK_VALID }, { status: 400 });
  }
  return Response.json({
    coupon: { ...coupon, discount: res.discount } satisfies Coupon & {
      discount: number;
    },
  });
}
