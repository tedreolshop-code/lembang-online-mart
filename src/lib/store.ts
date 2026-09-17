"use client";

import { useSyncExternalStore } from "react";
import { SEED_PRODUCTS } from "@/data/seed";
import { DEFAULT_SETTINGS, formatWaDigits, hitungOngkir, normalizeSettings } from "./config";
import type { ShipOption, StoreSettings } from "./config";
import { cloudMode, authHeaders } from "./auth";
import { couponDiscount } from "./coupon";
import { newOrderId } from "./format";
import {
  cleanAgentPrices,
  lineSubtotalWithAgent,
  unitPriceWithAgent,
} from "./pricing";
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
  AgentPrice,
  AgentPriceLine,
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
  // harga khusus agen (v9)
  agentPrices: "los_agent_prices_v1",
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

/** Error API yang menyertakan kode status HTTP.

    Sebelumnya `api()` hanya melempar Error biasa, jadi pemanggil tidak bisa
    membedakan 409 "nomor sudah terdaftar" dari kegagalan server — padahal
    keduanya butuh penanganan yang sangat berbeda. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
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
    throw new ApiError(
      body.error || `Kesalahan server (${res.status})`,
      res.status,
    );
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

  // ── kode agen + harga khusus agen (v6/v9) ──────────────────────
  // cermin create_order: harga khusus agen dipakai HANYA bila agen aktif dan
  // bukan pembelian sendiri, dan ditetapkan SEBELUM ongkir, voucher, komisi
  const agentCode = normalizeAgentCode(draft.agentCode);
  const agent = agentCode
    ? readJSON<Agent[]>(KEYS.agents, EMPTY_AGENTS).find(
        (a) => a.code === agentCode,
      )
    : undefined;
  const agentPrices =
    agent &&
    agent.status === "aktif" &&
    !isSelfPurchase(draft.customer.phone, agent.wa)
      ? agentPriceLines(agentCode)
      : EMPTY_AGENT_PRICE_LINES;

  // harga grosir (v6) + harga khusus agen (v9): subtotal & item memakai
  // harga efektif per tier, ditimpa harga agen bila ada
  const subtotal = lines.reduce(
    (a, l) => a + lineSubtotalWithAgent(l.product, l.qty, agentPrices),
    0,
  );
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
  let agentCommission = 0;
  let commissionRow: AgentCommission | null = null;
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
      price: unitPriceWithAgent(l.product, l.qty, agentPrices),
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
    // atribusi hanya bila kode agen dikenal — sama dengan create_order
    agentCode: agent ? agentCode : undefined,
    agentCommission: agent ? agentCommission : undefined,
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

/** Hasil daftar/masuk pelanggan. */
export interface CustomerLoginResult {
  customer: Customer;
  isNew: boolean;
  /** Nomor sudah pernah dipakai: profil disimpan di perangkat ini saja,
      tidak ada baris baru di server. Bukan kegagalan. */
  localOnly?: boolean;
}

/** Daftar atau masuk sebagai pelanggan.
    Cloud: daftarkan nomor baru ke tabel customers.
    Lokal: simpan di localStorage.

    Nomor yang SUDAH terdaftar (409) sengaja tidak diperlakukan sebagai gagal.
    Tanpa OTP, tidak ada cara memastikan nomor itu benar milik pemanggil, jadi
    server menolak menimpa dan tidak mengirim data tersimpan. Karena profil
    pelanggan memang hanya berguna di perangkat ini (checkout terisi dari
    localStorage, riwayat pesanan pakai kode pesanan), permintaan diteruskan
    secara lokal supaya pelanggan lama tidak menemui jalan buntu. */
export async function customerLogin(
  phone: string,
  name: string,
  address: string,
): Promise<CustomerLoginResult> {
  // pakai normalisasi yang sama dengan server (0… → 62…), supaya nomor yang
  // tersimpan dari jalur mana pun seragam
  const cleanPhone = formatWaDigits(phone);
  if (cloudMode) {
    try {
      const res = await api<{
        ok: boolean;
        customer: Customer;
        isNew: boolean;
      }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ phone: cleanPhone, name, address }),
      });
      writeCustomerAuth(res.customer);
      // simpan juga ke data pengiriman agar checkout terisi otomatis
      saveCustomer({
        name: res.customer.name,
        phone: res.customer.phone,
        address: res.customer.address,
      });
      return { customer: res.customer, isNew: res.isNew };
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) throw err;
      const customer: Customer = {
        phone: cleanPhone,
        name: name.trim(),
        address: address.trim(),
      };
      writeCustomerAuth(customer);
      saveCustomer(customer);
      return { customer, isNew: false, localOnly: true };
    }
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

/* ── akun agen (v8) — login dashboard dengan No. WA + kode ──────
   Agen memasukkan No. WA + kode unik (diberikan saat daftar disetujui)
   untuk melihat ringkasan komisi, riwayat pesanan, dan link referral.
   Data sesi disimpan di localStorage per perangkat. */

const AGEN_AUTH_KEY = "los_agen_auth_v1";

export interface AgenAuth {
  code: string;
  wa: string;
  nama: string;
}

function readAgenAuth(): AgenAuth | null {
  try {
    const raw = localStorage.getItem(AGEN_AUTH_KEY);
    return raw ? (JSON.parse(raw) as AgenAuth) : null;
  } catch {
    return null;
  }
}

function writeAgenAuth(a: AgenAuth): void {
  localStorage.setItem(AGEN_AUTH_KEY, JSON.stringify(a));
  emit();
}

function clearAgenAuth(): void {
  localStorage.removeItem(AGEN_AUTH_KEY);
  emit();
}

/** Agen yang sedang login (null bila belum). Reaktif. */
export function useAgenAuth(): AgenAuth | null {
  return useSyncExternalStore(subscribe, readAgenAuth, () => null);
}

/** Login agen — simpan sesi di perangkat. */
export function agenLogin(code: string, wa: string, nama: string): void {
  writeAgenAuth({ code, wa, nama });
}

/** Logout agen. */
export function agenLogout(): void {
  clearAgenAuth();
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

/** Tambah/perbarui agen. Code kosong → kode otomatis.
    `warning` diisi bila sebagian data (mis. mode komisi v9) belum bisa
    tersimpan karena migrasi SQL belum dijalankan. */
export async function upsertAgent(
  a: Agent,
): Promise<{ code: string; warning?: string }> {
  if (cloudMode) {
    const res = await api<{ ok: boolean; code: string; warning?: string }>(
      "/api/agents",
      {
        method: "POST",
        body: JSON.stringify(a),
      },
    );
    return { code: res.code, warning: res.warning };
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
  return { code };
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

/* ── harga khusus agen per produk (v9; mode ganda) ────────────── */

const EMPTY_AGENT_PRICES: AgentPrice[] = [];
const EMPTY_AGENT_PRICE_LINES: AgentPriceLine[] = [];

/** Semua baris harga agen (admin butuh untuk preload). */
export async function listAgentPrices(): Promise<AgentPrice[]> {
  if (cloudMode) return api<AgentPrice[]>("/api/agents/prices");
  return readJSON<AgentPrice[]>(KEYS.agentPrices, EMPTY_AGENT_PRICES);
}

/** Harga khusus satu agen untuk ditampilkan ke pembeli (publik).
    Dipakai keranjang/checkout & tombol "cek kode" agar angka yang dilihat
    pembeli sama dengan tagihan `create_order`; server tetap otoritatif. */
export async function fetchAgentPrices(
  agentCode: string,
): Promise<AgentPriceLine[]> {
  const code = normalizeAgentCode(agentCode);
  if (!code) return EMPTY_AGENT_PRICE_LINES;
  if (cloudMode) {
    try {
      const rows = await api<AgentPriceLine[]>(
        `/api/agents/prices?agent=${encodeURIComponent(code)}`,
      );
      return cleanAgentPrices(rows);
    } catch {
      return EMPTY_AGENT_PRICE_LINES;
    }
  }
  return agentPriceLines(code);
}

/** Baris harga lokal satu agen (mode lokal) dalam bentuk ramping. */
function agentPriceLines(agentCode: string): AgentPriceLine[] {
  return readJSON<AgentPrice[]>(KEYS.agentPrices, EMPTY_AGENT_PRICES)
    .filter((p) => p.agentCode === agentCode)
    .map((p) => ({ productId: p.productId, price: p.price }));
}

/** Simpan / perbarui satu baris harga agen. */
export async function upsertAgentPrice(p: AgentPrice): Promise<void> {
  if (cloudMode) {
    await api("/api/agents/prices", {
      method: "POST",
      body: JSON.stringify(p),
    });
    return;
  }
  const arr = readJSON<AgentPrice[]>(KEYS.agentPrices, EMPTY_AGENT_PRICES);
  const idx = arr.findIndex(
    (x) => x.agentCode === p.agentCode && x.productId === p.productId,
  );
  writeJSON(
    KEYS.agentPrices,
    idx >= 0
      ? arr.map((x, i) => (i === idx ? p : x))
      : [...arr, p],
  );
}

/** Hapus satu baris harga agen (bila product kosong, hapus semua agen itu). */
export async function deleteAgentPrice(
  agentCode: string,
  productId?: string,
): Promise<void> {
  if (cloudMode) {
    const q = `?agent=${encodeURIComponent(agentCode)}` +
      (productId ? `&product=${encodeURIComponent(productId)}` : "");
    await api(`/api/agents/prices${q}`, { method: "DELETE" });
    return;
  }
  const arr = readJSON<AgentPrice[]>(KEYS.agentPrices, EMPTY_AGENT_PRICES);
  writeJSON(
    KEYS.agentPrices,
    productId
      ? arr.filter(
          (x) => !(x.agentCode === agentCode && x.productId === productId),
        )
      : arr.filter((x) => x.agentCode !== agentCode),
  );
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
    Mode lokal membaca daftar localStorage; mode cloud lewat API.
    `prices` = harga khusus agen (v9) supaya pembeli melihat angka yang sama
    dengan tagihan `create_order`. */
export async function trackAgentRef(code: string): Promise<{
  ok: boolean;
  nama?: string;
  linkDays?: number;
  prices?: AgentPriceLine[];
}> {
  const c = normalizeAgentCode(code);
  if (!c) return { ok: false };
  if (cloudMode) {
    try {
      const res = await api<{
        ok: boolean;
        nama?: string;
        linkDays?: number;
        prices?: AgentPriceLine[];
      }>("/api/agents/click", { method: "POST", body: JSON.stringify({ code: c }) });
      return { ...res, prices: cleanAgentPrices(res.prices) };
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
  return {
    ok: true,
    nama: agent.nama,
    linkDays: cs.linkDays,
    prices: agentPriceLines(c),
  };
}

/* ── kode referral dari link ?ref=KODE (v6) ─────────────────── */
/* Ditulis RefCapture (layout) saat pengujung datang dari tautan agen,
   dibaca reaktif oleh checkout & keranjang. lewat pub-sub store —
   tanpa efek setState di halaman. */

const REF_KEY = "los_agent_ref_v1";
/* harga khusus agen (v9) milik kode referral yang tersimpan — dipisah agar
   pembeli bisa menghitung harga tanpa memanggil API berkali-kali. */
const REF_PRICES_KEY = "los_agent_ref_prices_v1";

/** cache harga referral — useSyncExternalStore membandingkan referensi
    snapshot, jadi daftar hasil parse tidak boleh dibuat ulang tiap panggilan. */
let refPricesCache: { key: string; list: AgentPriceLine[] } | null = null;

/** Simpan kode referral + masa berlaku (link_days). days <= 1 → tanpa batas.
    `prices` (v9) = harga khusus agen; `[]` berarti agen tidak punya harga
    khusus, `undefined` = jangan ubah data harga yang sudah tersimpan. */
export function storeAgentRef(
  code: string,
  days: number,
  prices?: AgentPriceLine[],
): void {
  if (typeof window === "undefined") return;
  const c = normalizeAgentCode(code);
  if (!c) return;
  const until = days > 1 ? Date.now() + days * 86400000 : 0; // 0 = tak kedaluwarsa
  localStorage.setItem(REF_KEY, JSON.stringify({ code: c, until }));
  if (prices !== undefined) {
    localStorage.setItem(
      REF_PRICES_KEY,
      JSON.stringify({ code: c, prices: cleanAgentPrices(prices) }),
    );
  }
  emit();
}

/** Harga khusus milik kode referral aktif; [] bila tidak ada / kode berbeda. */
function readAgentRefPricesNow(): AgentPriceLine[] {
  if (typeof window === "undefined") return EMPTY_AGENT_PRICE_LINES;
  const ref = readAgentRefNow();
  if (!ref) return EMPTY_AGENT_PRICE_LINES;
  const raw = window.localStorage.getItem(REF_PRICES_KEY) ?? "";
  // cache wajib: useSyncExternalStore membandingkan referensi snapshot
  const cacheKey = `${ref}|${raw}`;
  if (refPricesCache?.key === cacheKey) return refPricesCache.list;
  let list: AgentPriceLine[] = EMPTY_AGENT_PRICE_LINES;
  try {
    const o = JSON.parse(raw) as { code?: string; prices?: unknown };
    if (normalizeAgentCode(o.code ?? "") === ref) {
      list = cleanAgentPrices(o.prices);
    }
  } catch {
    list = EMPTY_AGENT_PRICE_LINES;
  }
  refPricesCache = { key: cacheKey, list };
  return list;
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

/** Harga khusus agen (v9) milik kode referral aktif — [] bila tidak ada.
    Dipakai keranjang & checkout agar harga yang tampil sama dengan tagihan. */
export function useAgentPrices(): AgentPriceLine[] {
  return useSyncExternalStore(
    subscribe,
    readAgentRefPricesNow,
    () => EMPTY_AGENT_PRICE_LINES,
  );
}
