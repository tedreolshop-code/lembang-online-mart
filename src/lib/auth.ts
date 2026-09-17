"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Mode cloud untuk sisi browser — env NEXT_PUBLIC_* di-inline saat build,
    jadi berganti mode perlu `npm run build` ulang. */
export const cloudMode = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const AUTH_KEY = "los_admin_auth_v1";
const LOCAL_SESSION_KEY = "los_admin_session";
let browserClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
  }
  return browserClient;
}

interface AdminSession {
  access_token: string;
  email?: string;
}

function readSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

/** Header auth untuk memanggil API (mode cloud) */
export function authHeaders(): Record<string, string> {
  const session = readSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

export function adminEmail(): string | undefined {
  return readSession()?.email;
}

export function hasAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  if (cloudMode) return !!readSession()?.access_token;
  return sessionStorage.getItem(LOCAL_SESSION_KEY) === "1";
}

/** Mode lokal: tandai sesi admin (password sudah divalidasi pemanggil) */
export function localLogin(): void {
  sessionStorage.setItem(LOCAL_SESSION_KEY, "1");
}

/** Login admin. Mode cloud: Supabase Auth (email+password).
    Mode lokal: password sederhana dari pengaturan — divalidasi pemanggil. */
export async function adminLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    return { ok: false, error: error?.message ?? "Login gagal." };
  }
  sessionStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      access_token: data.session.access_token,
      email: data.user.email ?? email,
    }),
  );
  return { ok: true };
}

/** Pastikan sesi tersimpan benar-benar milik admin terdaftar (mode cloud).
    Return error berisi pesan siap tampil bila bukan. */
export async function verifyAdminSession(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!cloudMode) return { ok: true };
  if (!hasAdminSession()) return { ok: false, error: "Sesi tidak ditemukan." };
  try {
    const res = await fetch("/api/admin/whoami", { headers: authHeaders() });
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

export async function adminLogout(): Promise<void> {
  if (cloudMode && readSession()) {
    try {
      await getClient().auth.signOut();
    } catch {
      /* abaikan */
    }
  }
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(LOCAL_SESSION_KEY);
}
