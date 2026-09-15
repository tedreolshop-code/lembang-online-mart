import { formatWaDigits } from "./config";
import type {
  Agent,
  AgentCommission,
  CommissionSettings,
  CommissionStatus,
} from "./types";

/** Logika program agen bersama (dipakai server & mode lokal).
    Perhitungan komisi HARUS sama dengan fungsi database `create_order`
    (sql/alter-v6.sql) — nilai yang tersimpan di database selalu otoritatif,
    fungsi di sini dipakai untuk pratinjau di UI dan mode lokal. */

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  aktif: true,
  kind: "percent",
  value: 5,
  basis: "after_discount",
  minAmount: 0,
  maxAmount: 20000,
  minOrderAmount: 0,
  linkDays: 30,
  holdDays: 7,
};

/** Alfabet kode agen: tanpa karakter mudah tertukar (I O 0 1). */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Kode agen otomatis: "AG" + 4 karakter acak kriptografis (permintaan klien:
    otomatis, tidak perlu dipikir pemilik; masih bisa diganti manual). */
export function newAgentCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let out = "";
  for (const b of bytes) out += CODE_CHARS[b % CODE_CHARS.length];
  return `AG${out}`;
}

/** Bersihkan kode agen dari input: huruf/angka saja, uppercase. */
export function normalizeAgentCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/** Nomor WA pelanggan/agen → hanya digit, "0…" jadi "62…" (untuk dibandingkan
    saat mendeteksi pembelian sendiri). */
export function normalizeWa(raw: unknown): string {
  return formatWaDigits(String(raw ?? ""));
}

/** Nilai dasar komisi sesuai aturan pemilik (subtotal atau setelah voucher). */
export function commissionBasis(
  subtotal: number,
  discount: number,
  basis: CommissionSettings["basis"],
): number {
  return basis === "subtotal"
    ? Math.max(0, subtotal)
    : Math.max(0, subtotal - discount);
}

/** Komisi dibulatkan ke Rp100 terdekat, seperti potongan voucher. */
export function roundTo100(n: number): number {
  return Math.round(n / 100) * 100;
}

/** Hitung komisi satu pesanan. `agentPercent` = override khusus agen
    (null = ikut aturan global). Mengembalikan persen yang dipakai + nilainya. */
export function commissionFor(
  basis: number,
  agentPercent: number | null,
  s: CommissionSettings,
): { percent: number; amount: number } {
  if (!s.aktif) return { percent: 0, amount: 0 };
  if (s.minOrderAmount > 0 && basis < s.minOrderAmount) {
    return { percent: 0, amount: 0 };
  }
  let percent = 0;
  let amount = 0;
  if (agentPercent != null) {
    percent = agentPercent;
    amount = roundTo100((basis * percent) / 100);
  } else if (s.kind === "percent") {
    percent = s.value;
    amount = roundTo100((basis * percent) / 100);
  } else {
    amount = s.value; // nominal tetap per pesanan
  }
  if (s.minAmount > 0) amount = Math.max(amount, s.minAmount);
  if (s.maxAmount > 0) amount = Math.min(amount, s.maxAmount);
  return { percent, amount };
}

/** Pembelian sendiri oleh agen → komisi 0 (pengaman utama anti-akal-akalan). */
export function isSelfPurchase(customerPhone: string, agentWa: string): boolean {
  const a = normalizeWa(customerPhone);
  const b = normalizeWa(agentWa);
  return a !== "" && a === b;
}

/** Link referral agen. `origin` opsional agar bisa dipakai di server. */
export function agentShareLink(code: string, origin = ""): string {
  return `${origin}/?ref=${normalizeAgentCode(code)}`;
}

/** Komisi dianggap siap dibayar bila pesanan sudah selesai (ready_at terisi)
    dan masa tunggu pemilik sudah lewat. Tidak perlu scheduler/cron. */
export function isCommissionReady(
  c: Pick<AgentCommission, "status" | "readyAt">,
  now = Date.now(),
): boolean {
  if (c.status !== "pending" || !c.readyAt) return false;
  return Date.parse(c.readyAt) <= now;
}

/** Waktu siap cair dihitung dari kapan pesanan selesai + hold_days. */
export function readyAtFrom(selesaiPada: number, holdDays: number): string {
  return new Date(selesaiPada + Math.max(0, holdDays) * 86400000).toISOString();
}

/** Nilai komisi yang dipakai: koreksi manual admin menang atas snapshot. */
export function effectiveCommission(
  c: Pick<AgentCommission, "amount" | "overrideAmount">,
): number {
  return c.overrideAmount != null ? c.overrideAmount : c.amount;
}

export const COMMISSION_STATUS_LABEL: Record<CommissionStatus, string> = {
  pending: "Menunggu",
  dibayar: "Sudah dibayar",
  batal: "Batal / komisi 0",
};

/* ── mapper baris DB (snake_case) ─────────────────────────────────── */

export function rowToAgent(r: {
  code: string;
  nama?: string | null;
  wa?: string | null;
  alamat?: string | null;
  pay_method?: string | null;
  pay_target?: string | null;
  commission_percent?: number | null;
  status?: string | null;
  total_klik?: number | null;
  created_at?: string | null;
}): Agent {
  return {
    code: normalizeAgentCode(r.code),
    nama: r.nama ?? "",
    wa: r.wa ?? "",
    alamat: r.alamat ?? "",
    payMethod: r.pay_method === "transfer" ? "transfer" : "ewallet",
    payTarget: r.pay_target ?? "",
    commissionPercent:
      r.commission_percent == null ? null : Number(r.commission_percent),
    status:
      r.status === "aktif" || r.status === "nonaktif" ? r.status : "pending",
    totalKlik: Number(r.total_klik ?? 0),
    createdAt: r.created_at ?? undefined,
  };
}

export function rowToCommission(r: {
  id?: number | string;
  order_id: string;
  agent_code: string;
  basis_amount?: number | null;
  percent_used?: number | null;
  amount?: number | null;
  override_amount?: number | null;
  status?: string | null;
  ready_at?: string | null;
  paid_at?: string | null;
  note?: string | null;
}): AgentCommission {
  return {
    id: r.id == null ? undefined : Number(r.id),
    orderId: r.order_id,
    agentCode: normalizeAgentCode(r.agent_code),
    basisAmount: Number(r.basis_amount ?? 0),
    percentUsed: Number(r.percent_used ?? 0),
    amount: Number(r.amount ?? 0),
    overrideAmount: r.override_amount == null ? null : Number(r.override_amount),
    status:
      r.status === "dibayar" || r.status === "batal"
        ? (r.status as CommissionStatus)
        : "pending",
    readyAt: r.ready_at ?? null,
    paidAt: r.paid_at ?? null,
    note: r.note ?? "",
  };
}

/** Aturan komisi dari DB; field kosong diisi nilai bawaan (aman). */
export function rowToCommissionSettings(
  r: {
    aktif?: boolean | null;
    kind?: string | null;
    value?: number | null;
    basis?: string | null;
    min_amount?: number | null;
    max_amount?: number | null;
    min_order_amount?: number | null;
    link_days?: number | null;
    hold_days?: number | null;
  } | null,
): CommissionSettings {
  const d = DEFAULT_COMMISSION_SETTINGS;
  if (!r) return d;
  return {
    aktif: r.aktif !== false,
    kind: r.kind === "fixed" ? "fixed" : "percent",
    value: Math.max(0, Math.round(Number(r.value ?? d.value))),
    basis: r.basis === "subtotal" ? "subtotal" : "after_discount",
    minAmount: Math.max(0, Math.round(Number(r.min_amount ?? 0))),
    maxAmount: Math.max(0, Math.round(Number(r.max_amount ?? d.maxAmount))),
    minOrderAmount: Math.max(0, Math.round(Number(r.min_order_amount ?? 0))),
    linkDays: Math.max(0, Math.round(Number(r.link_days ?? d.linkDays))),
    holdDays: Math.max(0, Math.round(Number(r.hold_days ?? d.holdDays))),
  };
}