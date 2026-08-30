/** Pengaturan toko. Nilai default di bawah, tapi PEMILIK WARUNG bisa
    mengubah semuanya dari halaman Admin → tab "Pengaturan" (tersimpan di
    browser/localStorage, atau di database saat mode cloud aktif). */
export interface StoreSettings {
  name: string;
  tagline: string;
  /** nomor WhatsApp penerima pesanan (format internasional tanpa +) */
  whatsapp: string;
  address: string;
  hours: string;
  /** biaya antar flat, gratis jika subtotal mencapai freeOngkirMin */
  ongkir: number;
  freeOngkirMin: number;
  /** password login halaman admin (mode lokal saja; cloud memakai Supabase Auth) */
  adminPassword: string;
  /** notifikasi pesanan masuk ke pemilik */
  notifyProvider: "off" | "fonnte" | "telegram";
  /** Fonnte: token device · Telegram: bot token dari @BotFather */
  notifyToken: string;
  /** Fonnte: nomor WA pemilik (62…) · Telegram: chat_id pemilik */
  notifyTarget: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  name: "LEMBANG ONLINE STORE",
  tagline: "Belanja Hemat, Antar Sampai Rumah",
  whatsapp: "6281234567890",
  address: "Jl. Raya Lembang No. 123, Lembang, Bandung Barat",
  hours: "Setiap hari · 07.00 – 21.00 WIB",
  ongkir: 5000,
  freeOngkirMin: 50000,
  adminPassword: "admin123",
  notifyProvider: "off",
  notifyToken: "",
  notifyTarget: "",
};

export function hitungOngkir(settings: StoreSettings, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= settings.freeOngkirMin ? 0 : settings.ongkir;
}

/** Rapikan input nomor dari pemilik: "0812-3456-7890" → "6281234567890" */
export function formatWaDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}
