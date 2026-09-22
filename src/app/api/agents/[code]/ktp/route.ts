import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { normalizeAgentCode } from "@/lib/agent";

/** Batas ukuran & format upload KTP agen (v10). */
const MAX_KTP_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const BUCKET = "agent-ktp";

/** POST: upload foto KTP agen (admin only).
    File disimpan di Supabase Storage bucket "agent-ktp".
    Path: {code}.jpg — satu KTP per agen, timpa bila upload ulang. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const { code: rawCode } = await ctx.params;
  const code = normalizeAgentCode(rawCode);
  if (!code) {
    return Response.json({ error: "Kode agen tidak valid." }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
  }
  if (file.size > MAX_KTP_SIZE) {
    return Response.json(
      { error: "Ukuran foto melebihi 4 MB." },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json(
      { error: "Format harus JPG, PNG, atau WebP." },
      { status: 415 },
    );
  }

  // Pastikan agen ada
  const { data: agent } = await db()
    .from("agents")
    .select("code")
    .eq("code", code)
    .maybeSingle();
  if (!agent) {
    return Response.json({ error: "Agen tidak ditemukan." }, { status: 404 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${code}.${ext}`;
  const storage = db().storage.from(BUCKET);

  // Hapus file lama (bila ada, berbagai ekstensi) — best effort
  for (const oldExt of ["jpg", "jpeg", "png", "webp"]) {
    if (oldExt !== ext) {
      await storage.remove([`${code}.${oldExt}`]).catch(() => {});
    }
  }

  const { error: uploadError } = await storage.upload(
    path,
    new Uint8Array(await file.arrayBuffer()),
    { contentType: file.type, upsert: true },
  );
  if (uploadError) {
    return Response.json(
      {
        error: /Bucket not found|not exist/i.test(uploadError.message)
          ? "Bucket storage belum dibuat — jalankan sql/alter-v10.sql di Supabase SQL Editor."
          : "Upload KTP gagal. Silakan coba lagi.",
      },
      { status: 500 },
    );
  }

  // Buat signed URL (berlaku 1 jam) untuk admin melihat KTP
  const { data: urlData, error: urlError } = await storage
    .createSignedUrl(path, 3600);
  if (urlError || !urlData?.signedUrl) {
    return Response.json(
      { error: "KTP terunggah tapi URL gagal dibuat." },
      { status: 500 },
    );
  }

  // Simpan path KTP ke kolom agents.ktp_url
  const { error: dbError } = await db()
    .from("agents")
    .update({ ktp_url: path, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (dbError && !/ktp_url/i.test(dbError.message)) {
    return Response.json(
      { error: isMissingTable(dbError.message) ? "Tabel agen belum ada — jalankan sql/alter-v6.sql." : "KTP terunggah tapi gagal menyimpan referensi." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    ktpUrl: urlData.signedUrl,
    warning: /ktp_url/i.test(dbError?.message ?? "")
      ? "Foto KTP tersimpan di storage, tapi kolom ktp_url belum ada — jalankan sql/alter-v10.sql."
      : undefined,
  });
}

/** GET: ambil signed URL foto KTP agen (admin only). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const { code: rawCode } = await ctx.params;
  const code = normalizeAgentCode(rawCode);
  if (!code) {
    return Response.json({ error: "Kode agen tidak valid." }, { status: 400 });
  }

  const { data: agent } = await db()
    .from("agents")
    .select("ktp_url")
    .eq("code", code)
    .maybeSingle();
  if (!agent) {
    return Response.json({ error: "Agen tidak ditemukan." }, { status: 404 });
  }

  const path = agent.ktp_url as string | null;
  if (!path) {
    return Response.json({ error: "KTP belum diunggah." }, { status: 404 });
  }

  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    return Response.json(
      { error: "Gagal membuat URL KTP. Coba upload ulang." },
      { status: 500 },
    );
  }

  return Response.json({ ktpUrl: data.signedUrl });
}

/** DELETE: hapus foto KTP agen (admin only). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const { code: rawCode } = await ctx.params;
  const code = normalizeAgentCode(rawCode);
  if (!code) {
    return Response.json({ error: "Kode agen tidak valid." }, { status: 400 });
  }

  // Ambil path KTP dari DB
  const { data: agent } = await db()
    .from("agents")
    .select("ktp_url")
    .eq("code", code)
    .maybeSingle();
  if (!agent) {
    return Response.json({ error: "Agen tidak ditemukan." }, { status: 404 });
  }

  const path = agent.ktp_url as string | null;
  if (path) {
    await db().storage.from(BUCKET).remove([path]).catch(() => {});
  }

  // Hapus referensi di DB (best-effort bila kolom belum ada)
  try {
    await db()
      .from("agents")
      .update({ ktp_url: null, updated_at: new Date().toISOString() })
      .eq("code", code);
  } catch { /* best-effort */ }

  return Response.json({ ok: true });
}

function isMissingTable(msg: string): boolean {
  return /agents|relation|Could not find|does not exist/i.test(msg);
}
