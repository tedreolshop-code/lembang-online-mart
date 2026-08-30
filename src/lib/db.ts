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

/** Verifikasi token Supabase Auth dari header Authorization.
    Mengembalikan user bila valid, null bila tidak. */
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
  return data?.user ? { id: data.user.id, email: data.user.email } : null;
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
