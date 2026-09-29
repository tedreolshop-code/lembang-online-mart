"use client";

/** Mode cloud untuk sisi browser — env NEXT_PUBLIC_* di-inline saat build,
    jadi berganti mode perlu `npm run build` ulang.
    Butuh URL DAN anon key agar tidak menganggap cloud saat env setengah jalan;
    sisa ketidakcocokan (kunci server) dideteksi lewat /api/health. */
export const cloudMode =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Penanda NON-RAHASIA bahwa admin sudah login (untuk gating UI). Kebenaran
    sesungguhnya ada di cookie HttpOnly `los_admin` yang dibaca server — token
    tidak pernah disimpan di JavaScript/sessionStorage (aman dari XSS). */
const ADMIN_EMAIL_KEY = "los_admin_email";
const LOCAL_SESSION_KEY = "los_admin_session";

/** Header auth untuk memanggil API. Sesi admin kini berupa cookie HttpOnly
    yang dikirim browser otomatis untuk permintaan same-origin, jadi tidak ada
    header yang perlu diset. Dibiarkan ada agar pemanggil lama tetap jalan. */
export function authHeaders(): Record<string, string> {
  return {};
}

export function adminEmail(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(ADMIN_EMAIL_KEY) ?? undefined;
}

export function hasAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  if (cloudMode) return !!sessionStorage.getItem(ADMIN_EMAIL_KEY);
  return sessionStorage.getItem(LOCAL_SESSION_KEY) === "1";
}

/** Mode lokal: tandai sesi admin (password sudah divalidasi pemanggil) */
export function localLogin(): void {
  sessionStorage.setItem(LOCAL_SESSION_KEY, "1");
}

/** Login admin mode cloud: verifikasi di SERVER lalu simpan token di cookie
    HttpOnly. Mode lokal memakai localLogin(). */
export async function adminLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => null)) as
      | { error?: string; email?: string }
      | null;
    if (!res.ok) return { ok: false, error: body?.error ?? "Login gagal." };
    sessionStorage.setItem(ADMIN_EMAIL_KEY, body?.email ?? email);
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghubungi server." };
  }
}

/** Pastikan sesi benar-benar milik admin terdaftar (mode cloud). */
export async function verifyAdminSession(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!cloudMode) return { ok: true };
  if (!hasAdminSession()) return { ok: false, error: "Sesi tidak ditemukan." };
  try {
    const res = await fetch("/api/admin/whoami", { cache: "no-store" });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      error:
        body?.error ??
        "Akun ini bukan admin. Daftar akun di halaman ini tidak membuka akses dashboard.",
    };
  } catch {
    return { ok: false, error: "Gagal memverifikasi sesi, coba lagi." };
  }
}

/** Perpanjang sesi admin memakai refresh cookie (dipanggil berkala oleh
    dashboard). false = sesi benar-benar berakhir. */
export async function adminRefresh(): Promise<boolean> {
  if (!cloudMode) return true;
  try {
    const res = await fetch("/api/admin/refresh", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<void> {
  try {
    sessionStorage.removeItem(ADMIN_EMAIL_KEY);
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    /* storage bisa diblokir */
  }
  if (!cloudMode) return;
  try {
    await fetch("/api/admin/logout", { method: "POST" });
  } catch {
    /* abaikan */
  }
}
