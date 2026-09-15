import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { replaceProductTiers } from "@/lib/product-tiers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json();

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) row.name = body.name;
  if (body.category !== undefined) row.category_slug = body.category || null;
  if (body.price !== undefined) row.price = body.price;
  if (body.oldPrice !== undefined) row.old_price = body.oldPrice ?? null;
  if (body.unit !== undefined) row.unit = body.unit;
  if (body.emoji !== undefined) row.emoji = body.emoji;
  if (body.image !== undefined) row.image_url = body.image ?? null;
  if (body.description !== undefined) row.description = body.description ?? null;
  if (body.isPromo !== undefined) row.is_promo = !!body.isPromo;
  if (body.isBestSeller !== undefined) row.is_bestseller = !!body.isBestSeller;
  if (body.isNew !== undefined) row.is_new = !!body.isNew;

  // perubahan stok lewat PATCH produk dicatat sebagai movement "set"
  if (body.stock !== undefined) {
    const { data: cur } = await db()
      .from("products")
      .select("stock")
      .eq("id", id)
      .single();
    row.stock = Math.max(0, Number(body.stock) || 0);
    if (cur && cur.stock !== row.stock) {
      await db().from("stock_movements").insert({
        product_id: id,
        delta: (row.stock as number) - cur.stock,
        reason: "set",
      });
    }
  }

  const { data, error } = await db()
    .from("products")
    .update(row)
    .eq("id", id)
    .select();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return Response.json({ error: "Produk tidak ditemukan." }, { status: 404 });
  }

  // tier grosir (v6): field tiers hadir = ganti seluruh daftar.
  // Tier yang >= harga baru otomatis dibuang oleh normalizeTiers.
  if (body.tiers !== undefined) {
    try {
      await replaceProductTiers(db(), id, body.tiers, Number(data[0].price));
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Gagal menyimpan harga grosir." },
        { status: 500 },
      );
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await ctx.params;
  const { error } = await db().from("products").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
