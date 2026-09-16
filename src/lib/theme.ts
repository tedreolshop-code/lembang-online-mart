/** Matematika warna murni (tanpa dependensi) — dipakai ThemeStyle untuk
    menghasilkan CSS variables, dan scripts/check-contrast.ts untuk mengaudit
    kontras setiap preset tema. Aturan mainnya: warna pilihan pemilik toko
    bebas, tapi tinta teks di atasnya dihitung otomatis supaya selalu terbaca. */

export function parseHex(hex: string): [number, number, number] {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000";
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** factor < 0 → lebih gelap, > 0 → lebih terang (menuju putih) */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  if (factor >= 0) {
    return toHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }
  const k = 1 + factor;
  return toHex(r * k, g * k, b * k);
}

export function mixWhite(hex: string, ratio: number): string {
  return shade(hex, ratio);
}

/** campuran menuju warna target apa pun (dipakai untuk tinta gelap) */
export function mix(hex: string, target: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(target);
  return toHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  );
}

/** luminansi relatif WCAG 2.x */
export function luminance(hex: string): number {
  const ch = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** komposit warna foreground berjaga alpha di atas background solid */
export function overAlpha(fg: [number, number, number], alpha: number, bg: string): string {
  const [r, g, b] = parseHex(bg);
  return toHex(
    fg[0] * alpha + r * (1 - alpha),
    fg[1] * alpha + g * (1 - alpha),
    fg[2] * alpha + b * (1 - alpha),
  );
}

/** hex #rrggbb valid, selain itu pakai fallback */
export function safeHex(hex: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

/** CSS variables tema penuh — satu sumber kebenaran untuk ThemeStyle
    (SSR & klien) dan skrip prapaint mode lokal di layout. Fallback disamakan
    dengan DEFAULT_SETTINGS di lib/config.ts. */
export function themeVarsCss(colorPrimary: string, colorDark: string): string {
  const p = safeHex(colorPrimary, "#dc2626");
  const d = safeHex(colorDark, "#991b1b");
  return (
    `:root{--color-brand:${p};--color-brand-dark:${shade(p, -0.18)};` +
    `--color-brand-soft:${mixWhite(p, 0.88)};--color-navy:${d};` +
    `--color-navy-dark:${shade(d, -0.22)};--color-navy-soft:${mixWhite(d, 0.92)};}`
  );
}

/** tinta gelap navy — dipakai bila latar terang supaya tetap warna, bukan abu */
export const INK_DARK = "#0f172a";

/** Tinta teks paling terbaca di atas `bg`: putih atau navy gelap — dipilih
    yang kontrasnya lebih tinggi. Pada latar medium (luminansi ~0.18–0.23)
    keduanya gagal AA 4.5:1, jadi fallback mengencangkan navy ke hitam. */
export function bestInk(bg: string): string {
  const cw = contrast("#ffffff", bg);
  const cd = contrast(INK_DARK, bg);
  if (Math.max(cw, cd) >= 4.5) return cw >= cd ? "#ffffff" : INK_DARK;
  let ink = INK_DARK;
  for (let i = 0; i < 20 && contrast(ink, bg) < 4.5; i++) {
    ink = mix(ink, "#000000", 0.08);
  }
  return ink;
}

/** Versi `color` yang lolos `min` terhadap `bg`, diarahkan ke putih agar rona
    aslinya tetap terasa. Dipakai untuk teks brand di atas latar menu (logo
    "Online Mart") yang kalau dibiarkan menyatu dengan warna menu. */
export function readableTint(color: string, bg: string, min = 4.5): string {
  let out = color;
  for (let i = 0; i <= 20 && contrast(out, bg) < min; i++) {
    out = mixWhite(out, 0.06);
  }
  // latar bg gelap-terang ekstrem: kalau arah ke putih tidak menolong,
  // pakai tinta terbaik bg tersebut
  return contrast(out, bg) < min ? bestInk(bg) : out;
}
