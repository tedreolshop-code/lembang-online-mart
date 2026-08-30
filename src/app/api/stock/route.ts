import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";

/** POST: atur stok produk — {productId, delta} untuk +/− atau
    {productId, stock} untuk set langsung. Mencatat stock_movements. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const body = await req.json();
  const productId = String(body?.productId ?? "");
  if (!productId) {
    return Response.json({ error: "productId wajib." }, { status: 400 });
  }

  const { data: cur, error: ferr } = await db()
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();
  if (ferr || !cur) {
    return Response.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

  let newStock: number;
  let reason: string;
  if (body.stock !== undefined) {
    newStock = Math.max(0, Number(body.stock) || 0);
    reason = "set";
  } else {
    newStock = Math.max(0, cur.stock - (Number(body.delta) || 0));
    reason = "adjust";
  }

  const { error } = await db()
    .from("products")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await db()
    .from("stock_movements")
    .insert({ product_id: productId, delta: newStock - cur.stock, reason });
  return Response.json({ ok: true, stock: newStock });
}
