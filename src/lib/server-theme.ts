import { db, isCloud } from "./db";

/* Warna tema untuk paint pertama (SSR). Di mode cloud, ThemeStyle dulunya
   merender fallback default lalu berganti setelah /api/settings tiba di
   klien — itulah "kedip warna" saat refresh. Helper ini membacanya di
   server agar HTML pertama sudah memakai tema tersimpan pemilik toko. */

export interface ThemeColors {
  colorPrimary: string;
  colorDark: string;
}

let memo: { at: number; value: ThemeColors | null } = { at: 0, value: null };
const TTL_MS = 30_000;

/** Warna tersimpan dari DB (mode cloud), atau null (mode lokal / gagal /
    kolom belum ada — situs tetap memakai default globals.css). */
export async function getThemeColors(): Promise<ThemeColors | null> {
  if (!isCloud) return null;
  if (memo.value && Date.now() - memo.at < TTL_MS) return memo.value;
  try {
    const { data, error } = await db()
      .from("settings")
      .select("color_primary, color_dark")
      .eq("id", 1)
      .single();
    if (error || !data) return memo.value ?? null;
    const value: ThemeColors = {
      colorPrimary: String(data.color_primary ?? ""),
      colorDark: String(data.color_dark ?? ""),
    };
    memo = { at: Date.now(), value };
    return value;
  } catch {
    return memo.value ?? null;
  }
}
