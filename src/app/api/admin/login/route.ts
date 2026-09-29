import { createClient } from "@supabase/supabase-js";
import { isCloud, cloudRequired, isAdminEmail, SUPABASE_URL } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_EMAIL_COOKIE, buildCookie } from "@/lib/admin-cookie";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Batas percobaan login admin per IP — menahan brute-force kredensial. */
const ADMIN_LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

/** POST: login admin. Verifikasi email+password lewat Supabase Auth di SERVER,
    lalu simpan access token di cookie HttpOnly (bukan sessionStorage) supaya
    tidak bisa dicuri lewat XSS. API route lain membaca cookie ini. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = await hitRateLimit(`admin-login:${clientIp(req)}`, ADMIN_LOGIN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return Response.json(
      { error: "Email dan password wajib diisi." },
      { status: 400 },
    );
  }

  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return Response.json({ error: "Email atau password salah." }, { status: 401 });
  }
  // token valid saja tidak cukup — Supabase Auth mengizinkan pendaftaran akun
  // sendiri, jadi wajib ada di daftar ADMIN_EMAIL.
  if (!isAdminEmail(data.user?.email)) {
    return Response.json(
      { error: "Akun ini bukan admin terdaftar." },
      { status: 403 },
    );
  }

  const maxAge = data.session.expires_in ?? 3600;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    buildCookie(ADMIN_COOKIE, data.session.access_token, maxAge, true),
  );
  headers.append(
    "Set-Cookie",
    buildCookie(ADMIN_EMAIL_COOKIE, data.user?.email ?? email, maxAge, false),
  );
  return new Response(
    JSON.stringify({ ok: true, email: data.user?.email ?? email }),
    { status: 200, headers },
  );
}
