import { cache } from "react";
import { connection } from "next/server";
import { db, isCloud } from "./db";
import { parseCategories } from "./categories";
import type { Category } from "./types";

export async function readCategories(): Promise<Category[]> {
  const { data, error } = await db().from("categories")
    .select("slug,name,emoji,tint,sort")
    .order("sort").order("slug")
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error("Kategori belum dapat dimuat. Silakan coba lagi.");
  return parseCategories(data);
}

/** HTML pertama sudah memakai kategori tersimpan, bukan daftar contoh.
    Saat DB gagal, klien mencoba mirror/refresh tanpa menganggapnya kosong. */
export const getInitialCategories = cache(async (): Promise<Category[] | null> => {
  if (!isCloud) return null;
  await connection();
  try {
    return await readCategories();
  } catch {
    return null;
  }
});
