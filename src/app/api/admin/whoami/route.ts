import { isCloud, cloudRequired, requireAdmin, adminEmailsConfigured, unauthorized } from "@/lib/db";

/** GET: pastikan token yang dipakai benar-benar milik admin terdaftar.

    Dipakai halaman /admin sesudah login Supabase: di Supabase Auth siapa pun
    bisa mendaftar akun sendiri, jadi "berhasil login" bukan berarti admin.
    Tanpa pemeriksaan ini, akun biasa akan masuk ke dashboard lalu semua
    request-nya gagal 401 satu per satu. */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();

  const admin = await requireAdmin(req);
  if (!admin) {
    // bedakan salah konfigurasi server dari akun yang memang bukan admin
    if (!adminEmailsConfigured()) {
      return Response.json(
        {
          error:
            "ADMIN_EMAIL belum diatur di file .env — isi dengan email admin, lalu jalankan npm run build ulang.",
        },
        { status: 401 },
      );
    }
    return unauthorized();
  }

  return Response.json({ ok: true, email: admin.email });
}
