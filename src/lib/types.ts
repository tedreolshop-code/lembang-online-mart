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
  /** harga beli / HPP per unit (v6) — dipakai hitung laba di Admin → Laporan; 0/kosong = belum diisi */
  costPrice?: number;
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
  /** harga grosir bertingkat (v6): berlaku bila jumlah beli >= minQty */
  tiers?: PriceTier[];
}

/** Satu tingkat harga grosir — dikelola pemilik dari Admin → Produk */
export interface PriceTier {
  /** jumlah minimum pembelian agar harga ini berlaku (harus > 1) */
  minQty: number;
  price: number;
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
  /** snapshot HPP per unit saat pesanan dibuat (0/kosong = HPP belum diisi saat itu) */
  costPrice?: number;
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
  /** kode agen yang tercatat pada pesanan ini (program agen v6) */
  agentCode?: string;
  /** nilai komisi tersimpan (snapshot saat pesanan dibuat) */
  agentCommission?: number;
}

/* ── program agen (v6) ──────────────────────────────────────────── */

/** Aturan komisi global yang diatur pemilik (Admin → Agen) */
export interface CommissionSettings {
  /** program aktif/nonaktif; nonaktif = tidak ada komisi baru */
  aktif: boolean;
  /** percent = % dari basis · fixed = nominal Rp tetap per pesanan */
  kind: "percent" | "fixed";
  /** persen (1–20) atau nominal Rp (untuk kind "fixed") */
  value: number;
  /** dasar perhitungan: subtotal sebelum atau sesudah potongan voucher */
  basis: "subtotal" | "after_discount";
  /** lantai komisi per pesanan (0 = tanpa) */
  minAmount: number;
  /** plafon komisi per pesanan (0 = tanpa) */
  maxAmount: number;
  /** minimum nilai pesanan agar komisi berlaku (0 = tanpa) */
  minOrderAmount: number;
  /** masa berlaku kode dari link referral (hari) */
  linkDays: number;
  /** masa tunggu sebelum komisi bisa dicairkan (hari) */
  holdDays: number;
}

/** Agen penjual — data pribadi (termasuk nomor rekening) tidak pernah publik */
export interface Agent {
  code: string;
  nama: string;
  wa: string;
  alamat: string;
  payMethod: "transfer" | "ewallet";
  /** nomor rekening / e-wallet tujuan pencairan */
  payTarget: string;
  /** komisi khusus agen ini; null = ikut aturan global */
  commissionPercent: number | null;
  status: "pending" | "aktif" | "nonaktif";
  totalKlik: number;
  createdAt?: string;
}

export type CommissionStatus = "pending" | "dibayar" | "batal";

/** Ledger komisi: angka hasil (snapshot), bukan hitungan ulang */
export interface AgentCommission {
  id?: number;
  orderId: string;
  agentCode: string;
  basisAmount: number;
  percentUsed: number;
  amount: number;
  /** koreksi manual oleh admin (bila ada, ini yang dipakai) */
  overrideAmount: number | null;
  status: CommissionStatus;
  /** diisi saat pesanan selesai: kapan komisi boleh dicairkan */
  readyAt: string | null;
  paidAt: string | null;
  note: string;
}
