export interface Category {
  slug: string;
  name: string;
  emoji: string;
  /** warna latar lembut untuk ikon kategori & thumbnail produk */
  tint: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  /** harga normal sebelum diskon, opsional */
  oldPrice?: number;
  /** kemasan, mis. "1 dus @ 40 pcs" */
  unit: string;
  emoji: string;
  /** URL atau path foto produk (opsional; tanpa ini dipakai emoji) */
  image?: string;
  stock: number;
  isPromo?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  description?: string;
}

export interface CartItem {
  productId: string;
  qty: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  emoji: string;
}

export type OrderStatus = "menunggu" | "diproses" | "selesai" | "dibatalkan";
export type PaymentMethod = "COD" | "Transfer Bank";
export type NotifyProvider = "off" | "fonnte" | "telegram";
export type ShipOption = "reguler" | "xpress";

/** Voucher potongan harga — dikelola pemilik dari Admin → Voucher */
export interface Coupon {
  /** kode yang diketik pembeli, selalu disimpan uppercase */
  code: string;
  label: string;
  /** percent = % dari subtotal · fixed = potongan Rp nominal */
  kind: "percent" | "fixed";
  value: number;
  /** subtotal minimum agar voucher berlaku */
  minSubtotal: number;
  /** null = tanpa batas pemakaian */
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  /** tanggal "YYYY-MM-DD"; null = tanpa kedaluwarsa */
  expiresAt: string | null;
}

export interface Order {
  id: string;
  createdAt: number;
  channel: "whatsapp" | "form";
  status: OrderStatus;
  /** true = stok produk sudah dikurangi untuk pesanan ini */
  stockApplied?: boolean;
  customer: {
    name: string;
    phone: string;
    address: string;
    note?: string;
  };
  payment: PaymentMethod;
  /** layanan antar pilihan pembeli (default reguler) */
  shipOption: ShipOption;
  items: OrderItem[];
  subtotal: number;
  /** potongan voucher (0 bila tidak pakai) */
  discount: number;
  /** kode voucher yang dipakai */
  coupon?: string;
  shipping: number;
  total: number;
}
