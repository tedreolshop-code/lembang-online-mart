import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTiers } from "./pricing";
import type { PriceTier } from "./types";

/* Helper server-only untuk simpan tier grosir (v6) via Supabase.
   Terpisah dari lib/pricing.ts agar fungsi murni itu tetap aman
   diimpor komponen client. */

/** Pesan ramah saat tabel v6 belum dibuat (DB belum dimigrasi). */
export const TIERS_MIGRATION_MSG =
  "Tabel harga grosir belum ada — jalankan sql/alter-v6.sql di Supabase SQL Editor.";

const isMissingTable = (msg: string) =>
  /product_tiers|Could not find|does not exist/i.test(msg);

/** Ganti seluruh tier satu produk (replace-all) dengan hasil pembersihan
    normalizeTiers terhadap harga jual. Mengembalikan tier yang tersimpan.
    Daftar kosong + tabel belum ada = no-op (form produk selalu mengirim
    tiers, DB pra-v6 tidak boleh ikut menolak). Selain itu melempar Error
    dengan pesan migrasi bila tabel belum ada. */
export async function replaceProductTiers(
  client: SupabaseClient,
  productId: string,
  raw: unknown,
  basePrice: number,
): Promise<PriceTier[]> {
  const tiers = normalizeTiers(raw, basePrice);
  const { error: del } = await client
    .from("product_tiers")
    .delete()
    .eq("product_id", productId);
  if (del) {
    if (isMissingTable(del.message) && tiers.length === 0) return [];
    throw new Error(isMissingTable(del.message) ? TIERS_MIGRATION_MSG : del.message);
  }
  if (tiers.length > 0) {
    const rows = tiers.map((t) => ({
      product_id: productId,
      min_qty: t.minQty,
      price: t.price,
    }));
    const { error } = await client.from("product_tiers").insert(rows);
    if (error) {
      throw new Error(
        isMissingTable(error.message) ? TIERS_MIGRATION_MSG : error.message,
      );
    }
  }
  return tiers;
}

/** Ambil tier untuk sekumpulan id produk; peta kosong bila tabel belum ada
    (mode degradasi: toko tetap jalan tanpa harga grosir). */
export async function tiersForProducts(
  client: SupabaseClient,
  ids: string[],
): Promise<Map<string, PriceTier[]>> {
  const empty = new Map<string, PriceTier[]>();
  if (ids.length === 0) return empty;
  const { data, error } = await client
    .from("product_tiers")
    .select("product_id,min_qty,price")
    .in("product_id", ids);
  if (error || !data) return empty;
  const map = new Map<string, PriceTier[]>();
  for (const r of data as { product_id: string; min_qty: number; price: number }[]) {
    const list = map.get(r.product_id) ?? [];
    list.push({ minQty: Number(r.min_qty), price: Number(r.price) });
    map.set(r.product_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.minQty - b.minQty);
  return map;
}
