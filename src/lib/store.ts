"use client";

import { useSyncExternalStore } from "react";
import { SEED_PRODUCTS } from "@/data/seed";
import { DEFAULT_SETTINGS, hitungOngkir } from "./config";
import type { StoreSettings } from "./config";
import { cloudMode, authHeaders } from "./auth";
import { newOrderId } from "./format";
import type { Order, Product } from "./types";

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
}

/** Buat pesanan. Cloud: harga & stok divalidasi server (transaksi DB).
    Lokal: dihitung dari data localStorage. Melempar Error bila gagal. */
export async function createOrder(draft: OrderDraft): Promise<Order> {
  if (cloudMode) {
    const order = await api<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(draft),
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
  const shipping = hitungOngkir(settings, subtotal);

  const order: Order = {
    id: newOrderId(),
    createdAt: Date.now(),
    channel: draft.channel,
    status: "menunggu",
    stockApplied: true,
    customer: draft.customer,
    payment: draft.payment,
    items: lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      price: l.product.price,
      qty: l.qty,
      unit: l.product.unit,
      emoji: l.product.emoji,
    })),
    subtotal,
    shipping,
    total: subtotal + shipping,
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

/* ── pengaturan toko ──────────────────────────────────────────── */

export function useSettings(): StoreSettings {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (cloudMode) {
        ensureCloudBoot();
        return cloudSettings;
      }
      return readJSON<StoreSettings>(KEYS.settings, DEFAULT_SETTINGS);
    },
    () => DEFAULT_SETTINGS,
  );
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  if (cloudMode) {
    await api("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
    await refreshSettings();
    return;
  }
  writeJSON(KEYS.settings, settings);
}

/** Admin: isi data awal ke database (hanya bila DB kosong) */
export async function seedDatabase(): Promise<void> {
  await api("/api/seed", { method: "POST" });
  await refreshProducts();
  await refreshSettings();
}
