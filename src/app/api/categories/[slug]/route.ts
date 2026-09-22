import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { parseCategoryInput } from "@/lib/categories";

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { slug } = await ctx.params;
  let input;
  try {
    input = parseCategoryInput(await req.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Data kategori tidak valid." }, { status: 400 });
  }
  // Slug tetap: nama baru tidak memutus relasi produk maupun tautan lama.
  const { data, error } = await db().from("categories").update(input)
    .eq("slug", slug).select("slug,name,emoji,tint,sort").maybeSingle();
  if (error) return Response.json({ error: "Perubahan gagal disimpan. Silakan coba lagi." }, { status: 500 });
  if (!data) return Response.json({ error: "Kategori tidak ditemukan. Muat ulang daftar kategori." }, { status: 404 });
  return Response.json(data);
}
