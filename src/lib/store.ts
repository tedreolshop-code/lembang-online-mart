"use client";

import { useSyncExternalStore } from "react";
import { SEED_PRODUCTS } from "@/data/seed";
import { DEFAULT_SETTINGS, hitungOngkir, normalizeSettings } from "./config";
import type { ShipOption, StoreSettings } from "./config";
import { cloudMode, authHeaders } from "./auth";
import { couponDiscount } from "./coupon";
import { newOrderId } from "./format";
import { lineSubtotal, unitPrice } from "./pricing";
import {
  DEFAULT_COMMISSION_SETTINGS,
  commissionBasis,
  commissionFor,
  isSelfPurchase,
  newAgentCode,
  normalizeAgentCode,
  readyAtFrom,
} from "./agent";
import type {
  Agent,
  AgentCommission,
  CommissionSettings,
  Customer,
} from "./types";
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
  // program agen (v6) — mode lokal menyimpannya seperti voucher
  agents: "los_agents_v1",
  commissionSettings: "los_commission_v1",
  commissions: "los_commissions_v1",
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
  /** kode agen yang mengetik/terpasang dari link referral (v6) */
  agentCode?: string;
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
  // harga grosir (v6): subtotal & item memakai harga efektif per tier
  const subtotal = lines.reduce((a, l) => a + lineSubtotal(l.product, l.qty), 0);
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

  // ── komisi agen (v6) — cermin create_order di database ──────────
  const agentCode = normalizeAgentCode(draft.agentCode);
  let agentCommission = 0;
  let commissionRow: AgentCommission | null = null;
  if (agentCode) {
    const agent = readJSON<Agent[]>(KEYS.agents, []).find(
      (a) => a.code === agentCode,
    );
    if (agent) {
      const cs = readJSON<CommissionSettings>(
        KEYS.commissionSettings,
        DEFAULT_COMMISSION_SETTINGS,
      );
      const basis = commissionBasis(subtotal, discount, cs.basis);
      let percent = 0;
      let note = "";
      if (!cs.aktif) {
        note = "program komisi sedang tidak aktif";
      } else if (agent.status !== "aktif") {
        note = "agen belum aktif";
      } else if (isSelfPurchase(draft.customer.phone, agent.wa)) {
        note = "pembelian sendiri — komisi 0";
      } else if (basis < cs.minOrderAmount) {
        note = "di bawah minimum belanja untuk komisi";
      } else {
        const r = commissionFor(basis, agent.commissionPercent, cs);
        percent = r.percent;
        agentCommission = r.amount;
      }
      commissionRow = {
        id: Date.now(),
        orderId: "", // diisi setelah id pesanan dibuat (di bawah)
        agentCode,
        basisAmount: basis,
        percentUsed: percent,
        amount: agentCommission,
        overrideAmount: null,
        status: agentCommission > 0 ? "pending" : "batal",
        readyAt: null,
        paidAt: null,
        note,
      };
    }
  }

  const orderId = newOrderId();
  const order: Order = {
    id: orderId,
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
      price: unitPrice(l.product, l.qty),
      qty: l.qty,
      unit: l.product.unit,
      emoji: l.product.emoji,
      // snapshot HPP saat pesanan dibuat — dasar hitung laba di Laporan
      costPrice: l.product.costPrice ?? 0,
    })),
    subtotal,
    discount,
    coupon,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
    agentCode: agentCode || undefined,
    agentCommission: agentCode ? agentCommission : undefined,
  };
  if (commissionRow) {
    commissionRow.orderId = orderId;
    const ledger = readJSON<AgentCommission[]>(KEYS.commissions, []);
    writeJSON(KEYS.commissions, [commissionRow, ...ledger]);
  }
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
  syncLocalCommission(o.id, o.status, "dibatalkan");
  writeJSON(
    KEYS.products,
    readJSON<Product[]>(KEYS.products, SEED_PRODUCTS).map((p) => {
      const item = o.items.find((i) => i.productId === p.id);
      return item ? { ...p, stock: p.stock + item.qty } : p;
    }),
  );
}

/** Pilih metode pembayaran pesanan form (dipanggil pembeli di halaman
    sukses, setelah pesanan dibuat). Melempar Error bila gagal. */
export async function setOrderPayment(
  id: string,
  payment: "COD" | "Transfer Bank",
): Promise<void> {
  if (cloudMode) {
    // endpoint publik khusus (bukan PATCH admin): yang memilih pembeli
    const updated = await api<Order>(`/api/orders/${id}/payment`, {
      method: "PATCH",
      body: JSON.stringify({ payment }),
    });
    cloudOrders = cloudOrders.map((x) => (x.id === id ? updated : x));
    emit();
    return;
  }
  writeJSON(
    KEYS.orders,
    readJSON<Order[]>(KEYS.orders, EMPTY_ORDERS).map((o) =>
      o.id === id ? { ...o, payment } : o,
    ),
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
  const before = orders.find((o) => o.id === id)?.status;
  writeJSON(
    KEYS.orders,
    orders.map((o) => (o.id === id ? { ...o, status } : o)),
  );
  // ledger komisi mengikuti status (mode lokal) — sama seperti API v6
  if (status !== before) syncLocalCommission(id, before, status);
}

/** Selaraskan baris ledger komisi lokal dengan status pesanan (v6). */
function syncLocalCommission(
  orderId: string,
  from: string | undefined,
  to: Order["status"],
): void {
  const ledger = readJSON<AgentCommission[]>(KEYS.commissions, []);
  if (!ledger.some((c) => c.orderId === orderId)) return;
  const cs = readJSON<CommissionSettings>(
    KEYS.commissionSettings,
    DEFAULT_COMMISSION_SETTINGS,
  );
  writeJSON(
    KEYS.commissions,
    ledger.map((c) => {
      if (c.orderId !== orderId) return c;
      if (to === "selesai" && c.status === "pending" && !c.readyAt) {
        return { ...c, readyAt: readyAtFrom(Date.now(), cs.holdDays) };
      }
      if (to === "dibatalkan" && (c.status === "pending" || c.status === "dibayar")) {
        return { ...c, status: "batal", note: "pesanan dibatalkan" };
      }
      if (from === "dibatalkan" && to !== "dibatalkan" && c.status === "batal" &&
          c.note === "pesanan dibatalkan" && c.amount > 0) {
        return { ...c, status: "pending" };
      }
      return c;
    }),
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

/* ── identitas pembeli (selalu lokal — biar tidak usah ketik ulang) ──

   Nama, No. HP, dan alamat disimpan di perangkat pembeli saja, bukan di
   database: checkout berikutnya terisi otomatis dan pembeli bisa melihat,
   mengubah, atau menghapusnya dari halaman Akun. */

const CUSTOMER_KEY = "los_customer_v1";

export interface CustomerProfile {
  name: string;
  phone: string;
  address: string;
  /** waktu terakhir diubah (ms) */
  at: number;
}

/** Data pengiriman terakhir di perangkat ini (null bila belum pernah diisi). */
export function useSavedCustomer(): CustomerProfile | null {
  return useSyncExternalStore(
    subscribe,
    () => readJSON<CustomerProfile | null>(CUSTOMER_KEY, null),
    () => null,
  );
}

/** Ingat data pengiriman pembeli — dipanggil checkout setelah pesanan
    berhasil dibuat, dan dari halaman Akun. */
export function saveCustomer(data: {
  name: string;
  phone: string;
  address: string;
}): void {
  writeJSON<CustomerProfile>(CUSTOMER_KEY, {
    name: data.name.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    at: Date.now(),
  });
}

/** Hapus data tersimpan (tombol "Hapus data" di halaman Akun). */
export function forgetCustomer(): void {
  window.localStorage.removeItem(CUSTOMER_KEY);
  emit();
}

/* ── akun pelanggan (v8) — login/daftar No. WA + nama ────────────
   Mode cloud: data tersimpan di tabel customers (lintas perangkat).
   Mode lokal: fallback ke localStorage (sama seperti data pengiriman). */

const CUSTOMER_AUTH_KEY = "los_customer_auth_v1";

function readCustomerAuth(): Customer | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_AUTH_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

function writeCustomerAuth(c: Customer): void {
  localStorage.setItem(CUSTOMER_AUTH_KEY, JSON.stringify(c));
  emit();
}

function clearCustomerAuth(): void {
  localStorage.removeItem(CUSTOMER_AUTH_KEY);
  emit();
}

/** Pelanggan yang sedang login (null bila belum login). Reaktif. */
export function useCustomerAuth(): Customer | null {
  return useSyncExternalStore(
    subscribe,
    readCustomerAuth,
    () => null,
  );
}

/** Daftar atau login pelanggan.
    Cloud: upsert ke tabel customers → data tersinkron lintas perangkat.
    Lokal: simpan di localStorage. */
export async function customerLogin(
  phone: string,
  name: string,
  address: string,
): Promise<{ customer: Customer; isNew: boolean }> {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cloudMode) {
    const res = await api<{ ok: boolean; customer: Customer; isNew: boolean }>(
      "/api/customers",
      {
        method: "POST",
        body: JSON.stringify({ phone: cleanPhone, name, address }),
      },
    );
    writeCustomerAuth(res.customer);
    // simpan juga ke data pengiriman agar checkout terisi otomatis
    saveCustomer({
      name: res.customer.name,
      phone: res.customer.phone,
      address: res.customer.address,
    });
    return { customer: res.customer, isNew: res.isNew };
  }
  const customer: Customer = {
    phone: cleanPhone,
    name: name.trim(),
    address: address.trim(),
  };
  writeCustomerAuth(customer);
  saveCustomer(customer);
  return { customer, isNew: false };
}

/** Logout pelanggan (hapus sesi di perangkat ini, data tetap di server). */
export function customerLogout(): void {
  clearCustomerAuth();
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

/* ── program agen (v6; mode ganda seperti voucher) ────────────── */

const EMPTY_AGENTS: Agent[] = [];
const EMPTY_COMMISSIONS: AgentCommission[] = [];

/** Daftar agen untuk halaman admin (butuh login di mode cloud). */
export async function listAgents(): Promise<Agent[]> {
  if (cloudMode) return api<Agent[]>("/api/agents");
  return readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS);
}

/** Tambah/perbarui agen. Code kosong → kode otomatis. */
export async function upsertAgent(a: Agent): Promise<string> {
  if (cloudMode) {
    const res = await api<{ ok: boolean; code: string }>("/api/agents", {
      method: "POST",
      body: JSON.stringify(a),
    });
    return res.code;
  }
  const code = normalizeAgentCode(a.code) || newAgentCode();
  const clean: Agent = {
    ...a,
    code,
    wa: a.wa.replace(/[^0-9]/g, ""),
    commissionPercent:
      a.commissionPercent == null
        ? null
        : Math.min(20, Math.max(1, Math.round(a.commissionPercent))),
  };
  const arr = readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS);
  const exists = arr.some((x) => x.code === code);
  writeJSON(
    KEYS.agents,
    exists ? arr.map((x) => (x.code === code ? clean : x)) : [clean, ...arr],
  );
  return code;
}

export async function deleteAgent(code: string): Promise<void> {
  if (cloudMode) {
    await api(`/api/agents?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    return;
  }
  const used = readJSON<AgentCommission[]>(KEYS.commissions, []).some(
    (c) => c.agentCode === code,
  );
  if (used) throw new Error("Agen punya riwayat komisi — nonaktifkan saja.");
  writeJSON(
    KEYS.agents,
    readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS).filter((x) => x.code !== code),
  );
}

/** Aturan komisi global (Admin → Agen). */
export async function getCommissionSettings(): Promise<CommissionSettings> {
  if (cloudMode) {
    const res = await api<{ settings: CommissionSettings }>("/api/commission");
    return res.settings;
  }
  return {
    ...DEFAULT_COMMISSION_SETTINGS,
    ...readJSON<Partial<CommissionSettings>>(KEYS.commissionSettings, {}),
  };
}

export async function saveCommissionSettings(
  s: CommissionSettings,
): Promise<void> {
  if (cloudMode) {
    await api("/api/commission", { method: "PUT", body: JSON.stringify(s) });
    return;
  }
  writeJSON(KEYS.commissionSettings, s);
}

/** Ledger komisi terbaru (maks. 200 baris — sama seperti API). */
export async function listCommissions(): Promise<AgentCommission[]> {
  if (cloudMode) {
    const res = await api<{ commissions: AgentCommission[] }>(
      "/api/commission",
    );
    return res.commissions;
  }
  return readJSON<AgentCommission[]>(KEYS.commissions, EMPTY_COMMISSIONS);
}

/** Aksi admin pada satu baris komisi: bayar / batal / ulang. */
export async function commissionAction(
  c: AgentCommission,
  action: "bayar" | "batal" | "ulang",
): Promise<void> {
  if (cloudMode) {
    await api("/api/commission", {
      method: "PATCH",
      body: JSON.stringify({ id: c.id, action }),
    });
    return;
  }
  const now = new Date().toISOString();
  writeJSON(
    KEYS.commissions,
    readJSON<AgentCommission[]>(KEYS.commissions, []).map((x) =>
      x.id === c.id
        ? {
            ...x,
            status:
              action === "bayar" ? "dibayar" : action === "batal" ? "batal" : "pending",
            paidAt: action === "bayar" ? now : x.paidAt,
            note: action === "batal" ? "dibatalkan admin" : x.note,
          }
        : x,
    ),
  );
}

/** Koreksi manual nilai komisi (null = hapus koreksi). */
export async function overrideCommission(
  c: AgentCommission,
  amount: number | null,
): Promise<void> {
  if (cloudMode) {
    await api("/api/commission", {
      method: "PATCH",
      body: JSON.stringify({ id: c.id, override: amount }),
    });
    return;
  }
  writeJSON(
    KEYS.commissions,
    readJSON<AgentCommission[]>(KEYS.commissions, []).map((x) =>
      x.id === c.id ? { ...x, overrideAmount: amount } : x,
    ),
  );
}

/** Catat klik link referral + info agen untuk banner checkout.
    Mode lokal membaca daftar localStorage; mode cloud lewat API. */
export async function trackAgentRef(
  code: string,
): Promise<{ ok: boolean; nama?: string; linkDays?: number }> {
  const c = normalizeAgentCode(code);
  if (!c) return { ok: false };
  if (cloudMode) {
    try {
      return await api<{ ok: boolean; nama?: string; linkDays?: number }>(
        "/api/agents/click",
        { method: "POST", body: JSON.stringify({ code: c }) },
      );
    } catch {
      return { ok: false };
    }
  }
  const agent = readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS).find(
    (a) => a.code === c,
  );
  if (!agent || agent.status !== "aktif") return { ok: false };
  const arr = readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS).map((a) =>
    a.code === c ? { ...a, totalKlik: a.totalKlik + 1 } : a,
  );
  writeJSON(KEYS.agents, arr);
  const cs = readJSON<CommissionSettings>(
    KEYS.commissionSettings,
    DEFAULT_COMMISSION_SETTINGS,
  );
  return { ok: true, nama: agent.nama, linkDays: cs.linkDays };
}

/* ── kode referral dari link ?ref=KODE (v6) ─────────────────── */
/* Ditulis RefCapture (layout) saat pengujung datang dari tautan agen,
   dibaca reaktif oleh checkout & keranjang. lewat pub-sub store —
   tanpa efek setState di halaman. */

const REF_KEY = "los_agent_ref_v1";

/** Simpan kode referral + masa berlaku (link_days). days <= 1 → tanpa batas. */
export function storeAgentRef(code: string, days: number): void {
  if (typeof window === "undefined") return;
  const c = normalizeAgentCode(code);
  if (!c) return;
  const until = days > 1 ? Date.now() + days * 86400000 : 0; // 0 = tak kedaluwarsa
  localStorage.setItem(REF_KEY, JSON.stringify({ code: c, until }));
  emit();
}

function readAgentRefNow(): string | null {
  try {
    const raw = window.localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { code?: string; until?: number };
    const c = normalizeAgentCode(o.code ?? "");
    if (!c) return null;
    if (o.until && Date.now() > o.until) {
      window.localStorage.removeItem(REF_KEY);
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

/** Kode agen tersimpan dari link referral (null di SSR / kosong / kedaluwarsa). */
export function useAgentRef(): string | null {
  return useSyncExternalStore(subscribe, readAgentRefNow, () => null);
}
