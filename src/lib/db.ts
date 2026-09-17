import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Mode cloud aktif bila kredensial Supabase terisi di .env.
    Tanpa kredensial, seluruh situs memakai mode lokal (localStorage). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const isCloud =
  !!SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

/** Client sisi server dengan service key — JANGAN pernah diimpor ke
    komponen client; hanya untuk API routes. */
export function db(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } },
    );
  }
  return adminClient;
}

/** Daftar email admin yang diizinkan, dari env ADMIN_EMAIL (dipisah koma).
    Sengaja TIDAK pakai NEXT_PUBLIC_* supaya daftarnya tidak ikut ke browser. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** true bila ADMIN_EMAIL belum diisi — dipakai untuk pesan diagnostik,
    bukan untuk melonggarkan pengecekan. */
export function adminEmailsConfigured(): boolean {
  return adminEmails().length > 0;
}

/** Apakah email ini termasuk admin terdaftar? Perbandingan case-insensitive.
    Daftar kosong = false (fail closed, bukan "semua boleh"). */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Verifikasi token Supabase Auth dari header Authorization.
    Mengembalikan user bila token valid DAN emailnya admin terdaftar.

    PENTING: token Supabase yang valid saja tidak cukup. Supabase Auth
    mengizinkan pendaftaran akun sendiri (signup terbuka), jadi tanpa
    pengecekan email, siapa pun yang mendaftar otomatis jadi admin. */
export async function requireAdmin(
  req: Request,
): Promise<{ id: string; email?: string } | null> {
  if (!isCloud) return null;
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data } = await anon.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;
  if (!isAdminEmail(user.email)) {
    // jangan bocorkan email mana yang benar; cukup catat di log server
    console.warn(
      `[admin] ditolak: ${user.email ?? "(tanpa email)"} bukan admin terdaftar`,
    );
    return null;
  }
  return { id: user.id, email: user.email };
}

/** Respons seragam untuk endpoint yang butuh mode cloud */
export function cloudRequired() {
  return Response.json(
    { error: "Mode lokal aktif — endpoint ini hanya dipakai saat database cloud terhubung." },
    { status: 503 },
  );
}

export function unauthorized() {
  return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
}
