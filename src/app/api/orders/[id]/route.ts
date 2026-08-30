import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToOrder } from "@/lib/rows";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH: ubah status pesanan, atau "terima" pesanan WhatsApp
    (mengurangi stok di server + catat movement) */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json();

  const { data: order, error: oerr } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  if (oerr || !order) {
    return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const row: Record<string, unknown> = {};

  // batalkan pesanan → kembalikan stok + catat movement "cancel"
  if (body.cancel && order.status !== "dibatalkan") {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue;
      const { data: p } = await db()
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();
      const newStock = (p?.stock ?? 0) + item.qty;
      await db()
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);
      await db().from("stock_movements").insert({
        product_id: item.product_id,
        delta: item.qty,
        reason: "cancel",
        order_id: id,
      });
    }
    row.status = "dibatalkan";
    row.stock_applied = false;
  }

  if (body.accept && !order.stock_applied) {
    // kurangi stok per item + catat movement "receive"
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue;
      const { data: p } = await db()
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();
      const newStock = Math.max(0, (p?.stock ?? 0) - item.qty);
      await db()
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);
      await db().from("stock_movements").insert({
        product_id: item.product_id,
        delta: -item.qty,
        reason: "receive",
        order_id: id,
      });
    }
    row.stock_applied = true;
    row.status = body.status ?? "diproses";
  }

  if (body.status) row.status = body.status;

  if (Object.keys(row).length === 0) {
    return Response.json({ ok: true });
  }

  const { error } = await db().from("orders").update(row).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: fresh } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  return Response.json(rowToOrder(fresh!));
}
