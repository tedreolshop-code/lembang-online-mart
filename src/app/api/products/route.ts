import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToProduct, productToRow } from "@/lib/rows";

export async function GET() {
  if (!isCloud) return cloudRequired();
  const { data, error } = await db()
    .from("products")
    .select("*")
    .order("position", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(rowToProduct));
}

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json();
  if (!body?.name || !(body.price > 0)) {
    return Response.json({ error: "Nama & harga wajib diisi." }, { status: 400 });
  }

  // id = slug nama; beri sufiks bila sudah dipakai
  let id = String(body.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `produk-${Date.now()}`;
  const { data: existing } = await db()
    .from("products")
    .select("id")
    .eq("id", id);
  if (existing && existing.length > 0) id = `${id}-${Date.now() % 100000}`;

  const { data: maxRow } = await db()
    .from("products")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const row = {
    ...productToRow({ ...body, id }),
    position: (maxRow?.[0]?.position ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("products").insert(row).select();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(rowToProduct(data![0]));
}
