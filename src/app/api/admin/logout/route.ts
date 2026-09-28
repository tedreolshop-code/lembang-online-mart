import { isCloud, cloudRequired } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_EMAIL_COOKIE, buildCookie } from "@/lib/admin-cookie";

/** POST: hapus cookie sesi admin (kedaluwarsa seketika). */
export async function POST() {
  if (!isCloud) return cloudRequired();
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", buildCookie(ADMIN_COOKIE, "", 0, true));
  headers.append("Set-Cookie", buildCookie(ADMIN_EMAIL_COOKIE, "", 0, false));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
