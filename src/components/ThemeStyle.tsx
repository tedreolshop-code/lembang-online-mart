"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/store";
import { mixWhite, shade, themeVarsCss } from "@/lib/theme";
import { DEFAULT_SETTINGS } from "@/lib/config";

/** Pratinjau warna dari server (mode cloud) — mencegah kedip tema saat
    paint pertama sebelum /api/settings tiba di klien. */
export interface ThemeInitial {
  colorPrimary: string;
  colorDark: string;
}

/** Terapkan warna tema langsung ke <html> (pratinjau langsung di
    Admin → Tampilan sebelum disimpan). */
export function applyThemeVars(primary: string, dark: string): void {
  const p = safe(primary, "#dc2626");
  const d = safe(dark, "#991b1b");
  const r = document.documentElement.style;
  r.setProperty("--color-brand", p);
  r.setProperty("--color-brand-dark", shade(p, -0.18));
  r.setProperty("--color-brand-soft", mixWhite(p, 0.88));
  r.setProperty("--color-navy", d);
  r.setProperty("--color-navy-dark", shade(d, -0.22));
  r.setProperty("--color-navy-soft", mixWhite(d, 0.92));
}

/** Hapus override pratinjau → kembali ke tema tersimpan. */
export function clearThemeVars(): void {
  const r = document.documentElement.style;
  [
    "--color-brand",
    "--color-brand-dark",
    "--color-brand-soft",
    "--color-navy",
    "--color-navy-dark",
    "--color-navy-soft",
  ].forEach((k) => r.removeProperty(k));
}

function safe(hex: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

/** Terpasang sekali di layout: menerjemahkan warna tema pilihan pemilik
    (Admin → Tampilan) ke CSS variables yang dipakai seluruh utilitas
    Tailwind bg-brand / text-brand / bg-navy / text-navy dst.

    `initial` dari root layout (mode cloud) memastikan render server — dan
    paint pertama browser — sudah memakai warna tersimpan, bukan fallback,
    sehingga tidak ada kedip warna sebelum hasil fetch klien tiba. */
export default function ThemeStyle({ initial }: { initial?: ThemeInitial }) {
  const s = useSettings();
  // selama store belum menelan hasil fetch (objek masih DEFAULT_SETTINGS),
  // pakai nilai dari server; setelahnya nilai store yang menang (selalu
  // paling baru — admin mungkin menyimpan tema berbeda saat halaman terbuka)
  const view = initial && s === DEFAULT_SETTINGS ? initial : s;

  // mode lokal: skrip prapaint di layout menyuntik <style id="los-theme-init-css">
  // sebagai "jembatan" agar paint pertama sudah memakai tema localStorage.
  // Setelah React merender style di atas (nilai sama — sama-sama dibaca dari
  // localStorage), jembatan dilepas supaya perubahan tema selanjutnya
  // (mis. sinkron antar-tab) tetap bisa mengupdate variabel.
  useEffect(() => {
    document.getElementById("los-theme-init-css")?.remove();
  }, []);

  return (
    <style
      // variabel warna global — nilai berasal dari pengaturan pemilik toko
      dangerouslySetInnerHTML={{
        __html: themeVarsCss(view.colorPrimary, view.colorDark),
      }}
    />
  );
}

