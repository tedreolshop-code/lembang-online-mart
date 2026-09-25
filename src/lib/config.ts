/** Provider notifikasi pesanan masuk ke pemilik warung. */
export type NotifyProvider = "off" | "fonnte" | "telegram" | "discord";

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
  /** biaya layanan antar cepat (Xpress/Instan) — tidak kena aturan gratis */
  xpressOngkir: number;
  /** label opsi Xpress yang tampil di checkout */
  xpressLabel: string;
  /** keterangan ongkir (kurir/area/estimasi) — tampil di keranjang & checkout */
  ongkirNote: string;
  /** password login halaman admin (mode lokal saja; cloud memakai Supabase Auth) */
  adminPassword: string;
  /** notifikasi pesanan masuk ke pemilik */
  notifyProvider: NotifyProvider;
  /** Fonnte: token device · Telegram: bot token dari @BotFather */
  notifyToken: string;
  /** Fonnte: nomor WA pemilik (62…) · Telegram: chat_id pemilik */
  notifyTarget: string;
  /** Discord: webhook URL (https://discord.com/api/webhooks/…) */
  discordWebhook: string;

  /* ── pembayaran (Admin → tab Pengaturan) ────────────────────── */
  /** metode COD (bayar di tempat) aktif & tampil di pemilihan pembayaran */
  codEnabled: boolean;
  /** daftar metode transfer/e-wallet (Bank, DANA, OVO, …) yang aktif */
  paymentMethods: PaymentMethodOption[];

  /* ── tampilan (Admin → tab Tampilan) ────────────────────────── */
  /** warna utama: tombol, harga, badge, aksen (default oranye) */
  colorPrimary: string;
  /** warna gelap: header, footer, banner (default navy) */
  colorDark: string;
  /** logo kustom (URL hasil upload); kosong = pakai logo bawaan */
  logoUrl: string;
  /** slide banner promo di beranda */
  banners: BannerSlide[];
}

/** Satu metode pembayaran non-COD (transfer bank / e-wallet) yang dipilih
    pembeli setelah pesanan dibuat. Dikelola pemilik dari Admin → Pengaturan. */
export interface PaymentMethodOption {
  /** id stabil untuk memetakan pilihan ke pesanan ("transfer", "dana", …) */
  id: string;
  /** nama yang tampil ke pembeli, mis. "Transfer Bank" / "DANA" */
  label: string;
  /** detail tujuan: nomor rekening/HP + nama pemilik, mis. "BCA 1234567890 a.n. Budi" */
  detail: string;
  /** instruksi singkat setelah memilih, mis. "Kirim bukti transfer ke WA" */
  note: string;
}

/** Satu slide banner promo di beranda */
export interface BannerSlide {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  /** "otomatis" memakai warna gelap toko; atau warna hex sendiri */
  color: string;
  /** URL foto sisi kanan hero (kosong = foto bawaan /hero-toko.jpg) */
  image: string;
}

/** Banners bawaan bila pemilik belum mengatur apa-apa */
export const DEFAULT_BANNERS: BannerSlide[] = [
  {
    title: "PROMO GAJIAN 🎉",
    subtitle: "Minyak goreng & sembako diskon hingga 20%",
    cta: "Belanja Sekarang",
    href: "/kategori/sembako",
    color: "otomatis",
    image: "",
  },
  {
    title: "GRATIS ONGKIR 🚚",
    subtitle: "Diantar sampai rumah untuk belanja min. Rp50.000",
    cta: "Mulai Belanja",
    href: "/kategori",
    color: "otomatis",
    image: "",
  },
  {
    title: "FLASH SALE SABTU 🔥",
    subtitle: "Mie instan & snack harga spesial tiap akhir pekan",
    cta: "Lihat Mie Instan",
    href: "/kategori/mie-instan",
    color: "otomatis",
    image: "",
  },
];

export const DEFAULT_SETTINGS: StoreSettings = {
  name: "LEMBANG ONLINE MART",
  tagline: "Belanja Hemat, Antar Sampai Rumah",
  whatsapp: "6281234567890",
  address: "Jl. Raya Lembang No. 123, Lembang, Bandung Barat",
  hours: "Setiap hari · 07.00 – 21.00 WIB",
  ongkir: 5000,
  freeOngkirMin: 50000,
  xpressOngkir: 15000,
  xpressLabel: "Xpress / Instan (hari yang sama)",
  ongkirNote:
    "Area Lembang & sekitarnya. Reguler: diantar kurir warung maksimal 1×24 jam (gratis untuk belanja di atas batas). Xpress: tiba hari ini juga, biaya tambahan.",
  adminPassword: "admin123",
  notifyProvider: "off",
  notifyToken: "",
  notifyTarget: "",
  discordWebhook: "",
  codEnabled: true,
  paymentMethods: [
    {
      id: "transfer",
      label: "Transfer Bank",
      detail: "BCA 1234567890 a.n. Lembang Store",
      note: "Kirim bukti transfer ke WhatsApp warung",
    },
  ],
  colorPrimary: "#dc2626",
  colorDark: "#991b1b",
  logoUrl: "",
  banners: DEFAULT_BANNERS,
};

export type ShipOption = "reguler" | "xpress";

/** Ongkir untuk satu layanan antar. Reguler mengikuti aturan ambang
    gratis; Xpress selalu berbayar (tidak kena aturan gratis). */
export function hitungOngkir(
  settings: StoreSettings,
  subtotal: number,
  option: ShipOption = "reguler",
): number {
  if (subtotal <= 0) return 0;
  if (option === "xpress") return Math.max(0, settings.xpressOngkir);
  return subtotal >= settings.freeOngkirMin ? 0 : settings.ongkir;
}

/** Rapikan input nomor dari pemilik: "0812-3456-7890" → "6281234567890" */
export function formatWaDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

/** Gabungkan data pengaturan tersimpan (localStorage lama bisa kehilangan
    field baru seperti warna/logo/banner) dengan nilai bawaan. */
export function normalizeSettings(raw: Partial<StoreSettings>): StoreSettings {
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  return {
    ...merged,
    colorPrimary: /^#[0-9a-fA-F]{6}$/.test(merged.colorPrimary)
      ? merged.colorPrimary
      : DEFAULT_SETTINGS.colorPrimary,
    colorDark: /^#[0-9a-fA-F]{6}$/.test(merged.colorDark)
      ? merged.colorDark
      : DEFAULT_SETTINGS.colorDark,
    logoUrl: typeof merged.logoUrl === "string" ? merged.logoUrl : "",
    xpressOngkir:
      Number.isFinite(merged.xpressOngkir) && merged.xpressOngkir >= 0
        ? Math.round(merged.xpressOngkir)
        : DEFAULT_SETTINGS.xpressOngkir,
    xpressLabel:
      typeof merged.xpressLabel === "string" && merged.xpressLabel.trim()
        ? merged.xpressLabel
        : DEFAULT_SETTINGS.xpressLabel,
    ongkirNote:
      typeof merged.ongkirNote === "string" ? merged.ongkirNote : "",
    codEnabled:
      typeof merged.codEnabled === "boolean"
        ? merged.codEnabled
        : DEFAULT_SETTINGS.codEnabled,
    paymentMethods: (Array.isArray(merged.paymentMethods)
      ? merged.paymentMethods
      : DEFAULT_SETTINGS.paymentMethods
    )
      .map((m) => ({
        id: typeof m?.id === "string" && m.id.trim() ? m.id.trim().slice(0, 40) : "",
        label: typeof m?.label === "string" ? m.label.trim().slice(0, 60) : "",
        detail: typeof m?.detail === "string" ? m.detail.trim().slice(0, 200) : "",
        note: typeof m?.note === "string" ? m.note.trim().slice(0, 200) : "",
      }))
      .filter((m) => m.id && m.label)
      .slice(0, 8),
    banners:
      (Array.isArray(merged.banners) && merged.banners.length > 0
        ? merged.banners
        : DEFAULT_BANNERS
      ).map((b) => ({
        ...b,
        image: typeof b.image === "string" ? b.image : "",
      })),
  };
}
