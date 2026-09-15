import { db, isCloud, cloudRequired } from "@/lib/db";
import { rowToOrder } from "@/lib/rows";

/** POST: riwayat pesanan milik perangkat ini (publik, terbatas daftar id
    yang tersimpan di browser pelanggan — tanpa membuka data orang lain).
    Kode pesanan kini acak kriptografis (lihat newOrderId), jadi yang tahu
    kodenya = yang punya akses; bentuknya tetap divalidasi agar endpoint ini
    tidak dipakai menanyakan string sembarang ke database. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
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
  return Response.json((data ?? []).map(rowToOrder));
}
