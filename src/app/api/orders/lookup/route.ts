import { db, isCloud, cloudRequired } from "@/lib/db";
import { rowToOrder, orderWithoutCostPrice } from "@/lib/rows";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Kode pesanan acak (8 karakter dari 32 simbol) praktis tidak bisa ditebak,
    tapi tanpa batas laju endpoint ini tetap bisa digempur. Batasnya dilonggarkan
    karena satu kunjungan wajar bisa memuat beberapa kali (sinkron berkala). */
const LOOKUP_LIMIT = { max: 30, windowMs: 60 * 1000 };

/** POST: riwayat pesanan milik perangkat ini (publik, terbatas daftar id
    yang tersimpan di browser pelanggan — tanpa membuka data orang lain).
    Kode pesanan kini acak kriptografis (lihat newOrderId), jadi yang tahu
    kodenya = yang punya akses; bentuknya tetap divalidasi agar endpoint ini
    tidak dipakai menanyakan string sembarang ke database. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = hitRateLimit(`lookup:${clientIp(req)}`, LOOKUP_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json();
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids
        .map(String)
        .filter((id: string) => /^LMB-[A-Z0-9]{4,12}$/.test(id))
        .slice(0, 50)
    : [];
  if (ids.length === 0) return Response.json([]);

  const { data, error } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // publik: HPP per item tidak boleh ikut terkirim
  return Response.json(
    (data ?? []).map((r) => orderWithoutCostPrice(rowToOrder(r))),
  );
}
