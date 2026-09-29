import { createClient } from "@supabase/supabase-js";
import { isCloud, cloudRequired, isAdminEmail, SUPABASE_URL } from "@/lib/db";
import {
  ADMIN_COOKIE,
  ADMIN_EMAIL_COOKIE,
  ADMIN_REFRESH_COOKIE,
  buildCookie,
  readCookie,
} from "@/lib/admin-cookie";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function clearCookies(): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildCookie(ADMIN_COOKIE, "", 0, true));
  headers.append("Set-Cookie", buildCookie(ADMIN_EMAIL_COOKIE, "", 0, false));
  headers.append("Set-Cookie", buildCookie(ADMIN_REFRESH_COOKIE, "", 0, true));
  return headers;
}

/** POST: perpanjang sesi admin memakai refresh token di cookie HttpOnly.
    Dipanggil berkala oleh dashboard supaya admin tidak perlu login ulang saat
    access token (~1 jam) kedaluwarsa. Bila gagal → cookie dibersihkan (401). */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const refresh = readCookie(req, ADMIN_REFRESH_COOKIE);
  if (!refresh) {
    return Response.json({ error: "Tidak ada sesi." }, { status: 401 });
  }

  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data, error } = await anon.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session || !isAdminEmail(data.user?.email)) {
    return new Response(JSON.stringify({ error: "Sesi berakhir." }), {
      status: 401,
      headers: clearCookies(),
    });
  }

  const maxAge = data.session.expires_in ?? 3600;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildCookie(ADMIN_COOKIE, data.session.access_token, maxAge, true));
  headers.append(
    "Set-Cookie",
    buildCookie(ADMIN_EMAIL_COOKIE, data.user?.email ?? "", maxAge, false),
  );
  headers.append(
    "Set-Cookie",
    buildCookie(ADMIN_REFRESH_COOKIE, data.session.refresh_token ?? refresh, REFRESH_MAX_AGE, true),
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
