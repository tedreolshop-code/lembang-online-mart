import { db, isCloud, cloudRequired } from "@/lib/db";
import { rowToOrder } from "@/lib/rows";

/** POST: riwayat pesanan milik perangkat ini (publik, terbatas daftar id
    yang tersimpan di browser pelanggan — tanpa membuka data orang lain) */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  const body = await req.json();
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.slice(0, 50).map(String)
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
