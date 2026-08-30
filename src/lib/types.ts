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
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
}
