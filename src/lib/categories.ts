import type { Category } from "./types";

export const CATEGORY_STORAGE_KEY = "los_categories_v1";
export const CATEGORY_NAME_MAX = 50;
export const CATEGORY_EMOJIS = ["🛒", "🍜", "🌾", "🛢️", "🥤", "🍪", "🧷", "🧼", "🍳", "🥬", "🍎", "🥚", "🥛", "🍞", "🧊", "🐟", "🍗", "🧂", "☕", "🍬", "🧴", "🧹", "💊", "🐾"];
export const CATEGORY_TINTS = ["#fff1e6", "#fff8e1", "#e8f3fd", "#fdf0f3", "#eef7ee", "#edf6fa", "#f6f0fa", "#f1f5f9"];

export type CategoryInput = Pick<Category, "name" | "emoji" | "tint" | "sort">;

export function categorySlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function parseCategoryInput(body: unknown): CategoryInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Isi nama, ikon, dan warna kategori terlebih dahulu.");
  }
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > CATEGORY_NAME_MAX || !categorySlug(name)) {
    throw new Error(`Nama kategori wajib diisi, maksimal ${CATEGORY_NAME_MAX} karakter dan mengandung huruf atau angka.`);
  }
  const emoji = typeof value.emoji === "string" ? value.emoji.trim() : "";
  if (!emoji || [...emoji].length > 16) throw new Error("Pilih ikon atau isi satu emoji kategori.");
  if (typeof value.tint !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.tint)) {
    throw new Error("Pilih warna latar kategori yang valid.");
  }
  if (typeof value.sort !== "number" || !Number.isInteger(value.sort) || value.sort < 0 || value.sort > 9998) {
    throw new Error("Urutan tampil harus antara 1 dan 9999.");
  }
  return { name, emoji, tint: value.tint.toLowerCase(), sort: value.sort };
}

export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug));
}

/** Dipakai juga untuk memeriksa mirror browser sebelum ditampilkan. */
export function parseCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) throw new Error("Daftar kategori tidak valid.");
  const slugs = new Set<string>();
  return sortCategories(value.map((row) => {
    if (!row || typeof row.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || slugs.has(row.slug)) {
      throw new Error("Kode kategori tidak valid atau duplikat.");
    }
    slugs.add(row.slug);
    return { slug: row.slug, ...parseCategoryInput(row) };
  }));
}
