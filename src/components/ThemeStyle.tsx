"use client";

import { useSettings } from "@/lib/store";

/** Terapkan warna tema langsung ke <html> (pratinjau langsung di
    Admin → Tampilan sebelum disimpan). */
export function applyThemeVars(primary: string, dark: string): void {
  const p = safe(primary, "#f97316");
  const d = safe(dark, "#b91c1c");
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
    Tailwind bg-brand / text-brand / bg-navy / text-navy dst. */
export default function ThemeStyle() {
  const s = useSettings();
  const primary = safe(s.colorPrimary, "#f97316");
  const dark = safe(s.colorDark, "#b91c1c");

  // turunan warna agar gradasi/soft tetap terlihat harmonis
  const primaryDark = shade(primary, -0.18);
  const primarySoft = mixWhite(primary, 0.88);
  const darkSoft = mixWhite(dark, 0.92);

  return (
    <style
      // variabel warna global — nilai berasal dari pengaturan pemilik toko
      dangerouslySetInnerHTML={{
        __html: `:root{--color-brand:${primary};--color-brand-dark:${primaryDark};--color-brand-soft:${primarySoft};--color-navy:${dark};--color-navy-dark:${shade(
          dark,
          -0.22,
        )};--color-navy-soft:${darkSoft};}`,
      }}
    />
  );
}

/* ── util warna sederhana (tanpa dependensi) ──────────────────── */

function parse(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** factor < 0 → lebih gelap, > 0 → lebih terang */
function shade(hex: string, factor: number): string {
  const [r, g, b] = parse(hex);
  if (factor >= 0) {
    return toHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
  const k = 1 + factor;
  return toHex(r * k, g * k, b * k);
}

function mixWhite(hex: string, ratio: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r + (255 - r) * ratio, g + (255 - g) * ratio, b + (255 - b) * ratio);
}
