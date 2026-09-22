import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { categorySlug, parseCategoryInput } from "@/lib/categories";
import { readCategories } from "@/lib/server-categories";

export async function GET() {
  if (!isCloud) return cloudRequired();
  try {
    return Response.json(await readCategories(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Kategori belum dapat dimuat. Silakan coba lagi." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  let input;
  try {
    input = parseCategoryInput(await req.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Data kategori tidak valid." }, { status: 400 });
  }
  const slug = categorySlug(input.name);
  const { data, error } = await db().from("categories").insert({ slug, ...input }).select("slug,name,emoji,tint,sort").single();
  if (error) {
    return Response.json({ error: error.code === "23505"
      ? "Kategori dengan nama tersebut sudah ada. Gunakan nama lain."
      : "Kategori gagal disimpan. Silakan coba lagi." }, { status: error.code === "23505" ? 409 : 500 });
  }
  return Response.json(data, { status: 201 });
}
