"use client";


export function slugify(name: string): string {  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `produk-${Date.now()}`
  );
}

/* ── tab pengaturan ───────────────────────────────────────────── */

/* ── tab tampilan: warna tema, logo, banner promo ─────────────── */
