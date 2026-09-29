/** Cookie sesi admin.
    `los_admin` (HttpOnly) menyimpan access token Supabase — tidak bisa dibaca
    JavaScript sehingga aman dari pencurian via XSS. `los_admin_email`
    (non-HttpOnly) hanya penanda tampilan, bukan rahasia. */

export const ADMIN_COOKIE = "los_admin";
export const ADMIN_EMAIL_COOKIE = "los_admin_email";
/** Refresh token Supabase — dipakai /api/admin/refresh memperpanjang sesi. */
export const ADMIN_REFRESH_COOKIE = "los_admin_rt";

/** Bangun string Set-Cookie. `Secure` hanya di produksi agar dev via http jalan. */
export function buildCookie(
  name: string,
  value: string,
  maxAge: number,
  httpOnly: boolean,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    "SameSite=Lax",
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Baca satu nilai cookie dari header Cookie (tanpa dependensi). */
export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
