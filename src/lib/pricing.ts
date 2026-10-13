import type { AgentPriceLine, PriceTier, Product } from "./types";

/** Logika harga bersama (mode lokal & server). HARUS sama dengan perhitungan
    di fungsi database `create_order` (sql/alter-v9.sql): harga yang dipakai
    adalah tier grosir dengan `minQty` terbesar yang masih <= jumlah dibeli,
    dan untuk pembeli dari tautan agen harga khusus agen menimpanya. */

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

/* ── label kemasan (v19) ────────────────────────────────────────── */
/* Produk boleh menyimpan isi 1 pack / 1 dus (pcs). Angka itu HANYA label dan
   bantuan jumlah belanja: harga tetap per pcs seperti di atas, sama dengan
   create_order di database — jadi tidak ada harga kedua yang bisa meleset
   dari tagihan. */

/** Isi kemasan dari input admin/DB: bulat > 1; selain itu undefined. */
export function cleanPackSize(raw: unknown): number | undefined {
  const n = Math.round(Number(raw ?? 0));
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

/** Satu baris pilihan kemasan di halaman produk. */
export interface PackOption {
  kind: "satuan" | "pack" | "dus";
  /** jumlah pcs yang dibeli bila pembeli memilih kemasan ini */
  size: number;
  /** harga per pcs pada jumlah itu (grosir bila ambangnya tercapai) */
  price: number;
  /** yang ditagih = price × size */
  total: number;
}

/** Pilihan kemasan yang bisa dibeli: Satuan selalu ada, Pack & Dus menyusul
    bila isinya diisi admin. Total memakai aturan harga yang sama dengan
    keranjang & create_order, jadi angka di layar = angka di struk. */
export function packOptions(
  product: Pick<Product, "price" | "tiers" | "packSize" | "dusSize">,
): PackOption[] {
  const out: PackOption[] = [
    { kind: "satuan", size: 1, price: product.price, total: product.price },
  ];
  const add = (kind: "pack" | "dus", raw: unknown) => {
    const size = cleanPackSize(raw);
    if (!size) return;
    const price = unitPrice(product, size);
    out.push({ kind, size, price, total: price * size });
  };
  add("pack", product.packSize);
  add("dus", product.dusSize);
  return out;
}

/* ── harga khusus agen (v9) ─────────────────────────────────────── */
/* Pembeli yang datang dari tautan referral agen membayar harga khusus
   agen bila ada barisnya; kalau tidak ada → harga normal/grosir.
   Aturan ini HARUS sama dengan create_order versi v9 di database. */

/** Harga khusus untuk satu produk; undefined = tidak ada (pakai normal). */
export function agentPriceFor(
  prices: AgentPriceLine[] | null | undefined,
  productId: string,
): number | undefined {
  if (!prices || prices.length === 0) return undefined;
  const row = prices.find((p) => p.productId === productId);
  return row && row.price > 0 ? row.price : undefined;
}

/** Harga satuan untuk pembeli dari tautan agen: harga khusus agen menimpa
    harga normal & grosir HANYA bila lebih murah — sama seperti aturan di
    `create_order`. Ini mencegah pembeli ditagih lebih mahal dari harga toko
    gara-gara harga agen yang salah set. */
export function unitPriceWithAgent(
  product: Pick<Product, "id" | "price" | "tiers">,
  qty: number,
  agentPrices?: AgentPriceLine[] | null,
): number {
  const base = unitPrice(product, qty);
  const ap = agentPriceFor(agentPrices, product.id);
  return ap !== undefined && ap < base ? ap : base;
}

/** Subtotal satu baris keranjang untuk pembeli dari tautan agen (v9). */
export function lineSubtotalWithAgent(
  product: Pick<Product, "id" | "price" | "tiers">,
  qty: number,
  agentPrices?: AgentPriceLine[] | null,
): number {
  return unitPriceWithAgent(product, qty, agentPrices) * qty;
}

/** Bersihkan daftar harga agen dari API/localStorage: id produk wajib,
    harga bulat > 0, satu baris per produk (baris pertama menang). */
export function cleanAgentPrices(raw: unknown): AgentPriceLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AgentPriceLine[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const productId = String(o.productId ?? o.product_id ?? "").trim();
    const price = Math.round(Number(o.price ?? 0));
    if (!productId || !Number.isFinite(price) || price <= 0) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    out.push({ productId, price });
  }
  return out;
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