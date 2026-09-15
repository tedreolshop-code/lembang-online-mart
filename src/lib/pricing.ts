import type { PriceTier, Product } from "./types";

/** Logika harga bersama (mode lokal & server). HARUS sama dengan perhitungan
    di fungsi database `create_order` (sql/alter-v6.sql): harga yang dipakai
    adalah tier grosir dengan `minQty` terbesar yang masih <= jumlah dibeli. */

/** Tier yang berlaku untuk sejumlah qty; null bila tidak ada tier memenuhi. */
export function tierFor(
  tiers: PriceTier[] | undefined,
  qty: number,
): PriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  let best: PriceTier | null = null;
  for (const t of tiers) {
    if (t.minQty <= qty && (!best || t.minQty > best.minQty)) best = t;
  }
  return best;
}

/** Harga satuan efektif untuk qty tertentu (grosir bila ambang tercapai dan
    lebih murah dari harga normal — sama seperti aturan di create_order). */
export function unitPrice(
  product: Pick<Product, "price" | "tiers">,
  qty: number,
): number {
  const t = tierFor(product.tiers, qty);
  if (t && t.price > 0 && t.price < product.price) return t.price;
  return product.price;
}

/** Tier termurah untuk ditampilkan sebagai badge "Grosir ≥n: Rp…" */
export function bestTier(tiers: PriceTier[] | undefined): PriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers.reduce((a, b) => (b.price < a.price ? b : a));
}

/** Subtotal satu baris keranjang memakai harga efektif. */
export function lineSubtotal(
  product: Pick<Product, "price" | "tiers">,
  qty: number,
): number {
  return unitPrice(product, qty) * qty;
}

/** Bersihkan daftar tier dari input admin/DB: minQty > 1, unik, harga > 0
    dan lebih murah dari harga normal. Mengembalikan daftar terurut menaik. */
export function normalizeTiers(raw: unknown, basePrice: number): PriceTier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: PriceTier[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const minQty = Math.round(Number(o.minQty ?? o.min_qty ?? 0));
    const price = Math.round(Number(o.price ?? 0));
    if (!Number.isFinite(minQty) || minQty <= 1 || seen.has(minQty)) continue;
    if (!Number.isFinite(price) || price <= 0 || price >= basePrice) continue;
    seen.add(minQty);
    out.push({ minQty, price });
  }
  return out.sort((a, b) => a.minQty - b.minQty);
}

/** Baris DB (snake_case) → PriceTier */
export function rowToTier(r: {
  min_qty?: number | null;
  price?: number | null;
}): PriceTier {
  return { minQty: Number(r.min_qty ?? 0), price: Number(r.price ?? 0) };
}

/** Kelompokkan baris product_tiers per produk (dipakai /api/products). */
export function groupTiers(
  rows: { product_id: string; min_qty: number; price: number }[],
): Map<string, PriceTier[]> {
  const map = new Map<string, PriceTier[]>();
  for (const r of rows) {
    const list = map.get(r.product_id) ?? [];
    list.push(rowToTier(r));
    map.set(r.product_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.minQty - b.minQty);
  return map;
}