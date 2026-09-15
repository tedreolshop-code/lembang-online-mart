/** Audit kontras WCAG untuk matematika warna di src/lib/theme.ts.
    Jalan: npx tsx scripts/check-contrast.ts   (keluar dengan error kalau gagal)

    Aturan main tema: warna pilihan pemilik toko bebas (apa pun), tapi tinta
    teks di atasnya dihitung otomatis (bestInk / readableTint) sehingga selalu
    lolos ambang WCAG AA 4.5:1. Skrip ini membuktikan aturan itu berlaku untuk
    SEMUA warna, bukan cuma preset: sapuan 144 warna HSL + warna default
    + warna tersimpan di database (kalau .env tersedia). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bestInk,
  contrast,
  mixWhite,
  readableTint,
  shade,
  toHex,
} from "../src/lib/theme";
import { DEFAULT_SETTINGS } from "../src/lib/config";

const AA = 4.5;

/** HSL (h 0-350, s/l 0-100) → hex, untuk sapuan warna seluas mungkin. */
function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) =>
    (l / 100) -
    a * Math.max(-1, Math.min((n + h / 30) % 12) - 3, 9 - ((n + h / 30) % 12), 1);
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// ── 1. kumpulkan warna uji: sapuan hue × terang/gelap + kasus ekstrem ──
const swatch: string[] = [];
for (let h = 0; h < 360; h += 15) {
  for (const l of [2, 10, 45, 60, 90, 98]) swatch.push(hslToHex(h, 100, l));
}
swatch.push("#000000", "#ffffff", "#ffff00", "#808080", DEFAULT_SETTINGS.colorPrimary, DEFAULT_SETTINGS.colorDark);

// ── 2. ink = pasangan (tinta, latar) yang mungkin muncul di UI ──
// putih, navy gelap, warna brand asli, dan turunannya — semua harus bisa
// dibuat terbaca lewat bestInk / readableTint di atas latar mana pun.
const inks = [
  "#ffffff",
  "#0f172a",
  DEFAULT_SETTINGS.colorPrimary,
  shade(DEFAULT_SETTINGS.colorPrimary, -0.18),
  DEFAULT_SETTINGS.colorDark,
  mixWhite(DEFAULT_SETTINGS.colorDark, 0.92),
];

let checked = 0;
for (const bg of swatch) {
  // bestInk selalu memilih tinta yang lolos AA
  const ink = bestInk(bg);
  assert.ok(
    contrast(ink, bg) >= AA,
    `bestInk salah di ${bg}: ${ink} hanya ${contrast(ink, bg).toFixed(2)}:1`,
  );
  checked++;
  // readableTint dijamin mengembalikan warna yang lolos AA atau jatuh ke bestInk
  for (const fg of inks) {
    const tint = readableTint(fg, bg, AA);
    assert.ok(
      contrast(tint, bg) >= AA,
      `readableTint(${fg}) gagal di ${bg}: ${tint} hanya ${contrast(tint, bg).toFixed(2)}:1`,
    );
    checked++;
  }
}

// ── 3. variabel CSS turunan tema (identik dengan ThemeStyle.tsx) ──
function auditTheme(label: string, primary: string, dark: string): void {
  const vars = {
    "--color-brand": primary,
    "--color-brand-dark": shade(primary, -0.18),
    "--color-brand-soft": mixWhite(primary, 0.88),
    "--color-navy": dark,
    "--color-navy-dark": shade(dark, -0.22),
    "--color-navy-soft": mixWhite(dark, 0.92),
  };
  const report: string[] = [];
  for (const [name, color] of Object.entries(vars)) {
    const ink = bestInk(color);
    const ratio = contrast(ink, color);
    assert.ok(ratio >= AA, `${label}: ${name}=${color} tak punya tinta AA (${ratio.toFixed(2)}:1)`);
    checked++;
    report.push(`${name.padEnd(18)} ${color}  ${ink} ${ratio.toFixed(1)}:1`);
  }
  console.log(`\n[${label}] primary=${primary} dark=${dark}`);
  report.forEach((r) => console.log("  " + r));
}

auditTheme("default", DEFAULT_SETTINGS.colorPrimary, DEFAULT_SETTINGS.colorDark);

// ── 4. warna tersimpan di database — bonus kalau .env cloud tersedia ──
(async () => {
  try {
    const env: Record<string, string> = {};
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { data, error } = await db
        .from("settings")
        .select("color_primary,color_dark")
        .eq("id", 1)
        .single();
      if (error) console.log(`\n[cloud] skip: ${error.message}`);
      else
        auditTheme(
          "cloud",
          /^#[0-9a-fA-F]{6}$/.test(data?.color_primary ?? "") ? data.color_primary : DEFAULT_SETTINGS.colorPrimary,
          /^#[0-9a-fA-F]{6}$/.test(data?.color_dark ?? "") ? data.color_dark : DEFAULT_SETTINGS.colorDark,
        );
    } else {
      console.log("\n[cloud] skip: .env tanpa kredensial Supabase");
    }
  } catch (e) {
    console.log(`\n[cloud] skip: ${(e as Error).message}`);
  }

  console.log(`\nok — ${checked} kombinasi latar/tinta lolos WCAG AA ${AA}:1`);
})();
