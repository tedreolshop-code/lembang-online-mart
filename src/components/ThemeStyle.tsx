"use client";

import { useEffect, useLayoutEffect } from "react";
import { rememberThemeColors, useSettings, useSettingsReady } from "@/lib/store";
import { mixWhite, shade, themeVarsCss } from "@/lib/theme";

/** Warna hasil pembacaan SSR (mode cloud) — memastikan paint pertama
    memakai warna tersimpan, bukan default, sebelum fetch klien tiba. */
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
    sehingga tidak ada kedip warna sebelum hasil fetch klien tiba. Mode
    lokal tidak mengirim `initial`: tema paint pertama dipasang skrip
    prapaint di layout, dan komponen ini menahannya sampai store siap. */
export default function ThemeStyle({ initial }: { initial?: ThemeInitial }) {
  const s = useSettings();
  const ready = useSettingsReady();
  // Status pemuatan terpisah dari nilai: default juga merupakan pilihan
  // tema yang sah. Selama fetch belum berhasil, pertahankan SSR/jembatan.
  const view = ready ? s : initial;
  const css = view ? themeVarsCss(view.colorPrimary, view.colorDark) : "";

  // Jembatan prapaint dilepas hanya setelah React siap mengambil alih
  // (style dirender dengan nilai yang sama). Bila belum, jembatan
  // dipertahankan supaya warna paint pertama tetap menempel.
  useLayoutEffect(() => {
    if (!css) return;
    document.getElementById("los-theme-init-css")?.remove();
  }, [css]);

  // Simpan juga hasil SSR, walaupun fetch pengaturan klien sedang gagal.
  useEffect(() => {
    if (view) rememberThemeColors(view);
  }, [view]);

  return css ? (
    <style
      id="los-theme-vars"
      // variabel warna global — nilai berasal dari pengaturan pemilik toko
      dangerouslySetInnerHTML={{ __html: css }}
    />
  ) : null;
}

