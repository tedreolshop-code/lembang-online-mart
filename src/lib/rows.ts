import type { Order, OrderItem, Product } from "./types";
import type { BannerSlide, StoreSettings } from "./config";
import { DEFAULT_BANNERS } from "./config";

/** Mapper antara baris database (snake_case) dan tipe aplikasi (camelCase).
    Hanya dipakai di sisi server (API routes). */

export interface ProductRow {
  id: string;
  name: string;
  category_slug: string | null;
  price: number;
  old_price: number | null;
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

export function productToRow(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    category_slug: p.category || null,
    price: p.price,
    old_price: p.oldPrice ?? null,
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
  color_primary?: string | null;
  color_dark?: string | null;
  logo_url?: string | null;
  banners?: BannerSlide[] | null;
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

export function rowToSettings(r: SettingsRow): StoreSettings {
  const banners = Array.isArray(r.banners)
    ? r.banners.map(toBanner).filter((b): b is BannerSlide => b !== null)
    : [];
  return {
    name: r.name,
    tagline: r.tagline,
    whatsapp: r.whatsapp,
    address: r.address,
    hours: r.hours,
    ongkir: r.ongkir,
    freeOngkirMin: r.free_ongkir_min,
    adminPassword: "terkelola-di-supabase-auth",
    // kredensial notifikasi diisi terpisah dari tabel notify_secrets
    notifyProvider: "off",
    notifyToken: "",
    notifyTarget: "",
    colorPrimary: r.color_primary || "#f97316",
    colorDark: r.color_dark || "#b91c1c",
    logoUrl: r.logo_url ?? "",
    banners: banners.length > 0 ? banners : DEFAULT_BANNERS,
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
  subtotal: number;
  shipping: number;
  total: number;
  order_items?: ItemRow[] | null;
}

export interface ItemRow {
  product_id: string | null;
  name: string;
  price: number;
  qty: number;
  unit: string;
  emoji: string;
}

export function rowToOrder(r: OrderRow): Order {
  const items: OrderItem[] = (r.order_items ?? []).map((i) => ({
    productId: i.product_id ?? "",
    name: i.name,
    price: i.price,
    qty: i.qty,
    unit: i.unit,
    emoji: i.emoji,
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
    items,
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
  };
}
