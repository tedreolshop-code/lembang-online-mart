"use client";

import { useSyncExternalStore } from "react";
import { SEED_PRODUCTS } from "@/data/seed";
import { DEFAULT_SETTINGS, hitungOngkir, normalizeSettings } from "./config";
import type { ShipOption, StoreSettings } from "./config";
import { cloudMode, authHeaders } from "./auth";
import { couponDiscount } from "./coupon";
import { newOrderId } from "./format";
import type { Coupon, Order, Product } from "./types";

/* ================================================================
   DATA LAYER MODE GANDA
   - Mode cloud  : kredensial Supabase terisi di .env → semua data
                   lewat API Next.js (database terpusat, multi-perangkat).
   - Mode lokal  : tanpa kredensial → localStorage per-browser (demo).
   API hook & fungsi di file ini SAMA untuk kedua mode, sehingga
   halaman tidak tahu bedanya.
   ================================================================ */

const KEYS = {
  products: "los_products_v2",
  orders: "los_orders_v2",
  favorites: "los_favorites_v2",
  settings: "los_settings_v1",
  coupons: "los_coupons_v1",
};
const MY_ORDERS_KEY = "los_my_orders_v1";

/* ── pub-sub ──────────────────────────────────────────────────── */

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn();
}

/* ── mode lokal: penyimpanan localStorage + cache referensi ───── */

function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(KEYS.products)) {
    localStorage.setItem(KEYS.products, JSON.stringify(SEED_PRODUCTS));
  }
}

const cache = new Map<string, { raw: string; value: unknown }>();

function readJSON<T>(key: string, fallback: T): T {
  ensureSeeded();
  const raw = window.localStorage.getItem(key) ?? JSON.stringify(fallback);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  const value = JSON.parse(raw) as T;
  cache.set(key, { raw, value });
  return value;
}

function writeJSON<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  emit();
}

const EMPTY_ORDERS: Order[] = [];
const EMPTY_FAVS: string[] = [];

/* ── mode cloud: cache memori + sinkron API ───────────────────── */

let booted = false;
let cloudProducts: Product[] = SEED_PRODUCTS;
let cloudOrders: Order[] = [];
let cloudSettings: StoreSettings = DEFAULT_SETTINGS;

function myOrderIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function rememberMyOrder(id: string) {
  const ids = [id, ...myOrderIds()].slice(0, 50);
  localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(ids));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Kesalahan server (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const refreshProducts = async () => {
  cloudProducts = await api<Product[]>("/api/products");
  emit();
};
const refreshSettings = async () => {
  cloudSettings = await api<StoreSettings>("/api/settings");
  emit();
};
const refreshOrders = async () => {
  cloudOrders = authHeaders().Authorization
    ? await api<Order[]>("/api/orders")
    : await api<Order[]>("/api/orders/lookup", {
        method: "POST",
        body: JSON.stringify({ ids: myOrderIds() }),
      });
  emit();
};

function ensureCloudBoot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  void refreshProducts().catch(() => {});
  void refreshSettings().catch(() => {});
  void refreshOrders().catch(() => {});
  // sinkron berkala + saat tab kembali aktif
  setInterval(() => {
    void refreshProducts().catch(() => {});
    void refreshSettings().catch(() => {});
    void refreshOrders().catch(() => {});
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshProducts().catch(() => {});
      void refreshOrders().catch(() => {});
    }
  });
}

/* ── produk ───────────────────────────────────────────────────── */

export function useProducts(): Product[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (cloudMode) {
        ensureCloudBoot();
        return cloudProducts;
      }
      return readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
    },
    () => SEED_PRODUCTS,
  );
}

export function useProduct(id: string): Product | undefined {
  const products = useProducts();
  return products.find((p) => p.id === id);
}

/** Tambah (id kosong) atau perbarui satu produk */
export async function upsertProduct(p: Product): Promise<void> {
  if (cloudMode) {
    const exists = cloudProducts.some((x) => x.id === p.id);
    if (exists) {
      await api(`/api/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify(p),
      });
      await refreshProducts();
    } else {
      const created = await api<Product>("/api/products", {
        method: "POST",
        body: JSON.stringify(p),
      });
      cloudProducts = [created, ...cloudProducts];
      emit();
    }
    return;
  }
  const arr = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  const exists = arr.some((x) => x.id === p.id);
  writeJSON(
    KEYS.products,
    exists ? arr.map((x) => (x.id === p.id ? p : x)) : [p, ...arr],
  );
}

export async function deleteProduct(id: string): Promise<void> {
  if (cloudMode) {
    await api(`/api/products/${id}`, { method: "DELETE" });
    cloudProducts = cloudProducts.filter((x) => x.id !== id);
    emit();
    return;
  }
  const arr = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  writeJSON(KEYS.products, arr.filter((x) => x.id !== id));
}

/* ── stok cepat (tab Stok) ────────────────────────────────────── */

export async function adjustStock(productId: string, delta: number): Promise<void> {
  if (cloudMode) {
    await api("/api/stock", {
      method: "POST",
      body: JSON.stringify({ productId, delta }),
    });
    await refreshProducts();
    return;
  }
  const products = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  writeJSON(
    KEYS.products,
    products.map((p) =>
      p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p,
    ),
  );
}

export async function setStock(productId: string, stock: number): Promise<void> {
  if (cloudMode) {
    await api("/api/stock", {
      method: "POST",
      body: JSON.stringify({ productId, stock }),
    });
    await refreshProducts();
    return;
  }
  const products = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  writeJSON(
    KEYS.products,
    products.map((p) => (p.id === productId ? { ...p, stock } : p)),
  );
}

/* ── pesanan ──────────────────────────────────────────────────── */

export function useOrders(): Order[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (cloudMode) {
        ensureCloudBoot();
        return cloudOrders;
      }
      return readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS);
    },
    () => EMPTY_ORDERS,
  );
}

export interface OrderDraft {
  channel: "whatsapp" | "form";
  customer: { name: string; phone: string; address: string; note?: string };
  payment: "COD" | "Transfer Bank";
  items: { productId: string; qty: number }[];
  /** layanan antar — default reguler */
  shipOption?: ShipOption;
  /** kode voucher yang sudah divalidasi di server */
  couponCode?: string;
}

/** Buat pesanan. Cloud: harga, stok, ongkir, dan voucher divalidasi
    server (transaksi DB). Lokal: dihitung dari data localStorage.
    Melempar Error bila gagal. */
export async function createOrder(draft: OrderDraft): Promise<Order> {
  if (cloudMode) {
    const { order } = await api<{ order: Order }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        ...draft,
        shipOption: draft.shipOption ?? "reguler",
        couponCode: draft.couponCode ?? undefined,
      }),
    });
    rememberMyOrder(order.id);
    cloudOrders = [order, ...cloudOrders];
    emit();
    return order;
  }

  const products = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  const lines = draft.items.map((i) => {
    const product = products.find((p) => p.id === i.productId);
    if (!product) throw new Error("Produk tidak ditemukan.");
    if (product.stock < i.qty) {
      throw new Error(`Stok tidak cukup untuk ${product.name}.`);
    }
    return { product, qty: i.qty };
  });
  const settings = readJSON<StoreSettings>(KEYS.settings, DEFAULT_SETTINGS);
  const subtotal = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const shipOption: ShipOption = draft.shipOption ?? "reguler";
  const shipping = hitungOngkir(settings, subtotal, shipOption);

  // voucher mode lokal: dicocokkan dengan daftar localStorage
  let discount = 0;
  let coupon: string | undefined;
  if (draft.couponCode) {
    const c = readJSON<Coupon[]>(KEYS.coupons, []).find(
      (x) => x.code === draft.couponCode!.toUpperCase(),
    );
    if (!c) throw new Error("Voucher tidak ditemukan.");
    const res = couponDiscount(c, subtotal);
    if (!res.ok) throw new Error(res.error ?? "Voucher tidak berlaku.");
    discount = res.discount ?? 0;
    coupon = c.code;
  }

  const order: Order = {
    id: newOrderId(),
    createdAt: Date.now(),
    channel: draft.channel,
    status: "menunggu",
    stockApplied: true,
    customer: draft.customer,
    payment: draft.payment,
    shipOption,
    items: lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      price: l.product.price,
      qty: l.qty,
      unit: l.product.unit,
      emoji: l.product.emoji,
    })),
    subtotal,
    discount,
    coupon,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
  };
  writeJSON(KEYS.orders, [order, ...readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS)]);
  // kurangi stok (logika deductOrderStock versi lokal)
  writeJSON(
    KEYS.products,
    products.map((p) => {
      const item = order.items.find((i) => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    }),
  );
  if (coupon) {
    writeJSON(
      KEYS.coupons,
      readJSON<Coupon[]>(KEYS.coupons, []).map((c) =>
        c.code === coupon ? { ...c, usedCount: c.usedCount + 1 } : c,
      ),
    );
  }
  rememberMyOrder(order.id);
  emit();
  return order;
}

/** Admin menerima pesanan WhatsApp → kurangi stok + proses */
export async function acceptOrder(o: Order): Promise<void> {
  if (cloudMode) {
    const updated = await api<Order>(`/api/orders/${o.id}`, {
      method: "PATCH",
      body: JSON.stringify({ accept: true }),
    });
    cloudOrders = cloudOrders.map((x) => (x.id === o.id ? updated : x));
    emit();
    return;
  }
  const orders = readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS);
  writeJSON(
    KEYS.orders,
    orders.map((x) => (x.id === o.id ? { ...x, stockApplied: true } : x)),
  );
  const products = readJSON<Product[]>(KEYS.products, SEED_PRODUCTS);
  writeJSON(
    KEYS.products,
    products.map((p) => {
      const item = o.items.find((i) => i.productId === p.id);
      return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
    }),
  );
  updateOrderStatus(o.id, "diproses");
}

/** Batalkan pesanan → kembalikan stok yang sudah dikurangi */
export async function cancelOrder(o: Order): Promise<void> {
  if (cloudMode) {
    const updated = await api<Order>(`/api/orders/${o.id}`, {
      method: "PATCH",
      body: JSON.stringify({ cancel: true }),
    });
    cloudOrders = cloudOrders.map((x) => (x.id === o.id ? updated : x));
    emit();
    return;
  }
  writeJSON(
    KEYS.orders,
    readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS).map((x) =>
      x.id === o.id ? { ...x, status: "dibatalkan", stockApplied: false } : x,
    ),
  );
  writeJSON(
    KEYS.products,
    readJSON<Product[]>(KEYS.products, SEED_PRODUCTS).map((p) => {
      const item = o.items.find((i) => i.productId === p.id);
      return item ? { ...p, stock: p.stock + item.qty } : p;
    }),
  );
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"],
): Promise<void> {
  if (cloudMode) {
    const updated = await api<Order>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    cloudOrders = cloudOrders.map((x) => (x.id === id ? updated : x));
    emit();
    return;
  }
  const orders = readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS);
  writeJSON(
    KEYS.orders,
    orders.map((o) => (o.id === id ? { ...o, status } : o)),
  );
}

/* ── favorit (selalu lokal — state UI per-pengunjung) ─────────── */

export function useFavorites(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => readJSON<string[]>(KEYS.favorites, EMPTY_FAVS),
    () => EMPTY_FAVS,
  );
}

export function toggleFavorite(id: string) {
  const favs = readJSON<string[]>(KEYS.favorites, EMPTY_FAVS);
  writeJSON(
    KEYS.favorites,
    favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id],
  );
}

/* ── voucher (mode ganda; kelola dari Admin → Voucher) ────────── */

const EMPTY_COUPONS: Coupon[] = [];

/** Daftar voucher untuk halaman admin (butuh login di mode cloud). */
export async function listCoupons(): Promise<Coupon[]> {
  if (cloudMode) return api<Coupon[]>("/api/coupons");
  return readJSON<Coupon[]>(KEYS.coupons, EMPTY_COUPONS);
}

/** Tambah/perbarui voucher. */
export async function upsertCoupon(c: Coupon): Promise<void> {
  if (cloudMode) {
    await api("/api/coupons", {
      method: "POST",
      body: JSON.stringify(c),
    });
    return;
  }
  const arr = readJSON<Coupon[]>(KEYS.coupons, EMPTY_COUPONS);
  const exists = arr.some((x) => x.code === c.code);
  writeJSON(
    KEYS.coupons,
    exists ? arr.map((x) => (x.code === c.code ? c : x)) : [c, ...arr],
  );
}

export async function deleteCoupon(code: string): Promise<void> {
  if (cloudMode) {
    await api(`/api/coupons?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    return;
  }
  writeJSON(
    KEYS.coupons,
    readJSON<Coupon[]>(KEYS.coupons, EMPTY_COUPONS).filter(
      (x) => x.code !== code,
    ),
  );
}

/** Cek kode voucher saat checkout — melempar Error dengan pesan ramah.
    Server tetap memvalidasi ulang saat pesanan dibuat (anti-ubah client). */
export async function checkCoupon(
  code: string,
  subtotal: number,
): Promise<Coupon> {
  const c = code.toUpperCase().trim();
  if (!c) throw new Error("Masukkan kode voucher dulu ya.");
  if (cloudMode) {
    const { coupon } = await api<{ coupon: Coupon }>("/api/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code: c, subtotal }),
    });
    return coupon;
  }
  const found = readJSON<Coupon[]>(KEYS.coupons, EMPTY_COUPONS).find(
    (x) => x.code === c,
  );
  if (!found) throw new Error("Voucher tidak ditemukan.");
  const res = couponDiscount(found, subtotal);
  if (!res.ok) throw new Error(res.error ?? "Voucher tidak berlaku.");
  return found;
}

/* ── pengaturan toko ──────────────────────────────────────────── */

export function useSettings(): StoreSettings {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (cloudMode) {
        ensureCloudBoot();
        return cloudSettings;
      }
      return normalized(readJSON<StoreSettings>(KEYS.settings, DEFAULT_SETTINGS));
    },
    () => DEFAULT_SETTINGS,
  );
}

/* normalizeSettings menghasilkan objek baru — harus dimemo agar
   useSyncExternalStore tidak berputar tanpa hingga (React #185). */
let settingsMemo: { src: StoreSettings; out: StoreSettings } | null = null;
function normalized(src: StoreSettings): StoreSettings {
  if (settingsMemo && settingsMemo.src === src) return settingsMemo.out;
  const out = normalizeSettings(src);
  settingsMemo = { src, out };
  return out;
}

export async function saveSettings(
  settings: StoreSettings,
): Promise<{ warning?: string }> {
  if (cloudMode) {
    const res = await api<{ ok: boolean; warning?: string }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    await refreshSettings();
    return { warning: res.warning };
  }
  writeJSON(KEYS.settings, settings);
  return {};
}

/** Admin: isi data awal ke database (hanya bila DB kosong) */
export async function seedDatabase(): Promise<void> {
  await api("/api/seed", { method: "POST" });
  await refreshProducts();
  await refreshSettings();
}
