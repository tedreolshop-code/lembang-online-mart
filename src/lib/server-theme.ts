import { cache } from "react";
import { connection } from "next/server";
import { DEFAULT_SETTINGS } from "./config";
import { db, isCloud } from "./db";

export interface ThemeColors {
  colorPrimary: string;
  colorDark: string;
}

const FETCH_TIMEOUT_MS = 5_000;
const RETRY_MS = 10_000;
const HEX = /^#[0-9a-fA-F]{6}$/;

interface ThemeCache {
  lastGood: ThemeColors | null;
  retryAt: number;
  version: number;
  pending: Promise<ThemeColors | null> | null;
}

// Satu cache fallback, juga saat modul dimuat ulang oleh dev server.
const globalTheme = globalThis as typeof globalThis & {
  __losServerTheme?: ThemeCache;
};
const themeCache = (globalTheme.__losServerTheme ??= {
  lastGood: null,
  retryAt: 0,
  version: 0,
  pending: null,
});

function validTheme(value: ThemeColors): boolean {
  return HEX.test(value.colorPrimary) && HEX.test(value.colorDark);
}

/** Setelah simpan, fallback langsung memakai tema baru. Query lama yang
    masih berjalan tidak boleh menimpa hasil penyimpanan ini. */
export function invalidateThemeCache(saved?: ThemeColors): void {
  themeCache.version += 1;
  themeCache.retryAt = 0;
  themeCache.pending = null;
  if (saved && validTheme(saved)) themeCache.lastGood = saved;
}

async function readTheme(): Promise<ThemeColors | null> {
  if (Date.now() < themeCache.retryAt) return themeCache.lastGood;
  if (themeCache.pending) return themeCache.pending;

  const version = themeCache.version;
  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { data, error } = await db()
        .from("settings")
        .select("color_primary, color_dark")
        .eq("id", 1)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (error) throw error;

      const value: ThemeColors = {
        colorPrimary: data?.color_primary || DEFAULT_SETTINGS.colorPrimary,
        colorDark: data?.color_dark || DEFAULT_SETTINGS.colorDark,
      };
      if (!validTheme(value)) throw new Error("Warna tema tidak valid");
      if (version === themeCache.version) {
        themeCache.lastGood = value;
        themeCache.retryAt = 0;
      }
    } catch {
      // Seluruh request selama gangguan tetap mendapat warna terakhir,
      // termasuk request kedua dan seterusnya selama jeda retry.
      if (version === themeCache.version) {
        themeCache.retryAt = Date.now() + RETRY_MS;
      }
    } finally {
      clearTimeout(timeout);
    }
    return themeCache.lastGood;
  })();

  themeCache.pending = pending;
  try {
    return await pending;
  } finally {
    if (themeCache.pending === pending) themeCache.pending = null;
  }
}

/** Baca tema terbaru sebelum HTML tampil. Memo React hanya berlaku dalam
    satu render (layout + viewport), bukan TTL warna lama lintas refresh.
    connection() mencegah warna saat build membeku di HTML statis. */
export const getThemeColors = cache(async (): Promise<ThemeColors | null> => {
  if (!isCloud) return null;
  await connection();
  return readTheme();
});
