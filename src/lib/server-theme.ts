import { db, isCloud } from "./db";

/* Warna tema untuk paint pertama (SSR). Di mode cloud, ThemeStyle dulunya
   merender fallback default lalu berganti setelah /api/settings tiba di
   klien — itulah "kedip warna" saat refresh. Helper ini membacanya di
   server agar HTML pertama sudah memakai tema tersimpan pemilik toko.

   Sumber kedip saat refresh & cara menutupnya:
   1. Query Supabase lambat/gagal sesaat (cold start bisa >5 detik):
      sebelumnya error hanya "lolos" selama 30 detik lalu hasilnya dibuang
      → paint balik ke merah default sampai fetch klien berhasil lagi.
      Ditutup: nilai terakhir yang pernah berhasil dipakai selamanya
      (hanya dua warna hex — aman di-cache lama).
   2. Render tidak boleh berdiam menunggu DB: batas tunggu 5 detik; di
      atas itu render jalan dengan cache/nilai terakhir. Browser menutup
      sisanya lewat mirror localStorage (lihat refreshSettings di store)
      sehingga paint pertama tetap warna yang benar.
   3. Row rusak/kosong tidak ikut di-cache sebagai nilai baik.

   `lastGood` disimpan juga di globalThis supaya hot-reload dev (modul
   dievaluasi ulang) tidak menghapus nilai terakhir. */

export interface ThemeColors {
  colorPrimary: string;
  colorDark: string;
}

type Memo =
  | { kind: "value"; at: number; value: ThemeColors }
  | { kind: "none"; at: number };

const TTL_MS = 30_000;
const NONE_TTL_MS = 10_000;
/** Batas tunggu fetch DB — di atas ini render jalan dengan cache/fallback
    agar halaman tidak berdiam menunggu DB saat cold start. */
const FETCH_TIMEOUT_MS = 5_000;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Nilai terakhir yang pernah berhasil dibaca dari DB — bertahan lintas
    TTL maupun hot-reload, dipakai saat fetch berikutnya gagal. */
let lastGood: ThemeColors | null = (globalThis as Record<string, unknown>)
  .__losThemeCache as ThemeColors | null ?? null;

let memo: Memo = { kind: "none", at: 0 };

/** Invaldasi memo (dipanggil admin setelah menyimpan tema). */
export function invalidateThemeCache(): void {
  memo = { kind: "none", at: 0 };
}

function validTheme(v: ThemeColors): boolean {
  return HEX.test(v.colorPrimary) || HEX.test(v.colorDark);
}

/** Warna tersimpan dari DB (mode cloud), atau null (mode lokal / gagal /
    kolom belum ada — situs tetap memakai default globals.css). */
export async function getThemeColors(): Promise<ThemeColors | null> {
  if (!isCloud) return null;

  const now = Date.now();
  if (memo.kind === "value" && now - memo.at < TTL_MS) return memo.value;
  if (memo.kind === "none" && now - memo.at < NONE_TTL_MS) return null;

  try {
    const result = (await Promise.race([
      db()
        .from("settings")
        .select("color_primary, color_dark")
        .eq("id", 1)
        .single(),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "timeout" } }),
          FETCH_TIMEOUT_MS,
        ),
      ),
    ])) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (result.error || !result.data) {
      // gagal sesaat (timeout/DB down) → pakai nilai terakhir yang pernah
      // berhasil, bukan null yang membuat paint balik ke warna default
      memo = { kind: "none", at: now };
      return lastGood;
    }

    const value: ThemeColors = {
      colorPrimary: String(result.data.color_primary ?? ""),
      colorDark: String(result.data.color_dark ?? ""),
    };
    if (!validTheme(value)) {
      // row kosong/rusak → jangan ijinkan menimpa nilai baik yang lama
      memo = { kind: "none", at: now };
      return lastGood;
    }

    lastGood = value;
    (globalThis as Record<string, unknown>).__losThemeCache = value;
    memo = { kind: "value", at: now, value };
    return value;
  } catch {
    memo = { kind: "none", at: now };
    return lastGood;
  }
}
