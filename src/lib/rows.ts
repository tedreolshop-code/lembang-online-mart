import type { Order, OrderItem, Product, ShipOption } from "./types";
import type { BannerSlide, PaymentMethodOption, StoreSettings } from "./config";
import { DEFAULT_BANNERS, DEFAULT_SETTINGS } from "./config";

/** Mapper antara baris database (snake_case) dan tipe aplikasi (camelCase).
    Hanya dipakai di sisi server (API routes). */

export interface ProductRow {
  id: string;
  name: string;
  category_slug: string | null;
  price: number;
  old_price: number | null;
  cost_price: number | null;
  unit: string;
  emoji: string;
  image_url: string | null;
  stock: number;
  is_promo: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  description: string | null;
  position: number;
}

export function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category_slug ?? "",
    price: r.price,
    oldPrice: r.old_price ?? undefined,
    costPrice: r.cost_price ?? undefined,
    unit: r.unit,
    emoji: r.emoji,
    image: r.image_url ?? undefined,
    stock: r.stock,
    isPromo: r.is_promo || undefined,
    isBestSeller: r.is_bestseller || undefined,
    isNew: r.is_new || undefined,
    description: r.description ?? undefined,
  };
}

/** Produk tanpa HPP — untuk respons yang bisa dibaca publik.
    Field-nya dihapus, bukan di-set undefined, supaya `costPrice` benar-benar
    tidak muncul di JSON (kalau hanya undefined, sebagian serializer tetap
    menuliskannya sebagai `null`). */
export function withoutCostPrice(p: Product): Product {
  const out: Product = { ...p };
  delete out.costPrice;
  return out;
}

/** Pesanan dengan snapshot HPP tiap item dibuang.

    Dipakai respons PUBLIK (buat pesanan, lookup riwayat, pilih pembayaran):
    menyertakan HPP sama saja membocorkan modal per produk ke pembeli.
    Sengaja TIDAK dipakai di `GET /api/orders` yang khusus admin, karena di
    situ HPP memang dibutuhkan untuk laporan laba. */
export function orderWithoutCostPrice(o: Order): Order {
  return {
    ...o,
    items: o.items.map((i) => {
      const item: OrderItem = { ...i };
      delete item.costPrice;
      return item;
    }),
  };
}

export function productToRow(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    category_slug: p.category || null,
    price: p.price,
    old_price: p.oldPrice ?? null,
    cost_price: p.costPrice ?? null,
    unit: p.unit,
    emoji: p.emoji,
    image_url: p.image ?? null,
    stock: p.stock,
    is_promo: !!p.isPromo,
    is_bestseller: !!p.isBestSeller,
    is_new: !!p.isNew,
    description: p.description ?? null,
  };
}

export interface SettingsRow {
  name: string;
  tagline: string;
  whatsapp: string;
  address: string;
  hours: string;
  ongkir: number;
  free_ongkir_min: number;
  xpress_ongkir?: number | null;
  xpress_label?: string | null;
  ongkir_note?: string | null;
  color_primary?: string | null;
  color_dark?: string | null;
  logo_url?: string | null;
  banners?: BannerSlide[] | null;
  // metode pembayaran (v11) — bisa null bila migrasi belum dijalankan
  cod_enabled?: boolean | null;
  payment_methods?: unknown | null;
}

/** Normalisasi satu banner dari DB (bisa jsonb bentuk apa pun) */
function toBanner(b: unknown): BannerSlide | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (!o.title) return null;
  return {
    title: String(o.title),
    subtitle: String(o.subtitle ?? ""),
    cta: String(o.cta ?? "Lihat"),
    href: String(o.href ?? "/kategori"),
    color: String(o.color ?? "otomatis"),
    image: String(o.image ?? ""),
  };
}

/** Normalisasi satu metode pembayaran dari DB (jsonb bentuk apa pun) */
function toPaymentMethod(m: unknown): PaymentMethodOption | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const label = String(o.label ?? "").trim();
  if (!id || !label) return null;
  return {
    id,
    label,
    detail: String(o.detail ?? ""),
    note: String(o.note ?? ""),
  };
}

export function rowToSettings(r: SettingsRow): StoreSettings {
  const banners = Array.isArray(r.banners)
    ? r.banners.map(toBanner).filter((b): b is BannerSlide => b !== null)
    : [];
  // kolom v11 mungkin belum ada bila sql/alter-v11.sql belum dijalankan
  const paymentMethods = Array.isArray(r.payment_methods)
    ? r.payment_methods
        .map(toPaymentMethod)
        .filter((m): m is PaymentMethodOption => m !== null)
    : [];
  return {
    name: r.name,
    tagline: r.tagline,
    whatsapp: r.whatsapp,
    address: r.address,
    hours: r.hours,
    ongkir: r.ongkir,
    freeOngkirMin: r.free_ongkir_min,
    // kolom v4 mungkin belum ada bila sql/alter-v4.sql belum dijalankan
    xpressOngkir:
      typeof r.xpress_ongkir === "number" && Number.isFinite(r.xpress_ongkir)
        ? r.xpress_ongkir
        : DEFAULT_SETTINGS.xpressOngkir,
    xpressLabel: r.xpress_label || DEFAULT_SETTINGS.xpressLabel,
    ongkirNote: r.ongkir_note ?? "",
    adminPassword: "terkelola-di-supabase-auth",
    // kredensial notifikasi diisi terpisah dari tabel notify_secrets
    notifyProvider: "off",
    notifyToken: "",
    notifyTarget: "",
    discordWebhook: "",
    colorPrimary: r.color_primary || DEFAULT_SETTINGS.colorPrimary,
    colorDark: r.color_dark || DEFAULT_SETTINGS.colorDark,
    logoUrl: r.logo_url ?? "",
    banners: banners.length > 0 ? banners : DEFAULT_BANNERS,
    codEnabled:
      typeof r.cod_enabled === "boolean"
        ? r.cod_enabled
        : DEFAULT_SETTINGS.codEnabled,
    paymentMethods:
      paymentMethods.length > 0
        ? paymentMethods
        : DEFAULT_SETTINGS.paymentMethods,
  };
}

export interface OrderRow {
  id: string;
  created_at: string;
  channel: "whatsapp" | "form";
  status: "menunggu" | "diproses" | "selesai";
  stock_applied: boolean;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note: string | null;
  payment: "COD" | "Transfer Bank";
  ship_option?: string | null;
  subtotal: number;
  discount?: number | null;
  coupon_code?: string | null;
  shipping: number;
  total: number;
  agent_code?: string | null;
  agent_commission?: number | null;
  order_items?: ItemRow[] | null;
}

export interface ItemRow {
  product_id: string | null;
  name: string;
  price: number;
  qty: number;
  unit: string;
  emoji: string;
  cost_price?: number | null;
}

export function rowToOrder(r: OrderRow): Order {
  const items: OrderItem[] = (r.order_items ?? []).map((i) => ({
    productId: i.product_id ?? "",
    name: i.name,
    price: i.price,
    qty: i.qty,
    unit: i.unit,
    emoji: i.emoji,
    costPrice: i.cost_price ?? undefined,
  }));
  return {
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    channel: r.channel,
    status: r.status,
    stockApplied: r.stock_applied,
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      address: r.customer_address,
      note: r.note ?? undefined,
    },
    payment: r.payment,
    shipOption: (r.ship_option === "xpress" ? "xpress" : "reguler") as ShipOption,
    items,
    subtotal: r.subtotal,
    discount: Number(r.discount ?? 0),
    coupon: r.coupon_code ?? undefined,
    shipping: r.shipping,
    total: r.total,
    agentCode: r.agent_code ?? undefined,
    agentCommission:
      r.agent_commission == null ? undefined : Number(r.agent_commission),
  };
}
