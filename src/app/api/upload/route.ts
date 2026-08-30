import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";

/** POST: upload foto produk ke Supabase Storage (khusus admin).
    FormData: file (gambar) → { url } */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: "Maksimal 2MB." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db()
    .storage.from("product-images")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = db()
    .storage.from("product-images")
    .getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
