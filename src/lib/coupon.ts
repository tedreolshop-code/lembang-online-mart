import { formatRupiah } from "./format";
import type { Coupon } from "./types";

/** Logika voucher bersama: dipakai API server (otoritatif) maupun mode
    lokal demo. Persentase dibulatkan ke Rp100 terdekat, potongan tidak
    pernah membuat subtotal jadi negatif, dan ongkir tidak dipotong. */
export function couponDiscount(
  c: Coupon,
  subtotal: number,
): { ok: boolean; discount?: number; error?: string } {
  if (!c.active) return { ok: false, error: "Voucher sedang tidak aktif." };
  if (c.expiresAt && Date.parse(c.expiresAt + "T23:59:59") < Date.now()) {
    return { ok: false, error: "Voucher sudah kedaluwarsa." };
  }
  if (c.maxUses != null && c.usedCount >= c.maxUses) {
    return { ok: false, error: "Kuota voucher sudah habis." };
  }
  if (subtotal < c.minSubtotal) {
    return {
      ok: false,
      error: `Minimal belanja ${formatRupiah(c.minSubtotal)} untuk voucher ini.`,
    };
  }
  let d =
    c.kind === "percent"
      ? Math.round((subtotal * c.value) / 100 / 100) * 100
      : c.value;
  d = Math.min(Math.max(0, d), subtotal);
  return { ok: true, discount: d };
}

/** Baris DB (snake_case) → Coupon */
export function rowToCoupon(r: {
  code: string;
  label?: string | null;
  kind?: string | null;
  value?: number | null;
  min_subtotal?: number | null;
  max_uses?: number | null;
  used_count?: number | null;
  active?: boolean | null;
  expires_at?: string | null;
}): Coupon {
  return {
    code: String(r.code).toUpperCase(),
    label: r.label ?? "",
    kind: r.kind === "fixed" ? "fixed" : "percent",
    value: Number(r.value ?? 0),
    minSubtotal: Number(r.min_subtotal ?? 0),
    maxUses: r.max_uses == null ? null : Number(r.max_uses),
    usedCount: Number(r.used_count ?? 0),
    active: r.active !== false,
    expiresAt: r.expires_at ? String(r.expires_at).slice(0, 10) : null,
  };
}

/** Bersihkan input admin/API → bentuk Coupon siap simpan (uppercase,
    tanpa spasi). Melempar Error dengan pesan Indonesia bila tidak valid. */
export function normalizeCoupon(raw: unknown): Coupon {
  const o = (raw ?? {}) as Record<string, unknown>;
  const code = String(o.code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  if (!code) throw new Error("Kode voucher wajib diisi (huruf/angka).");
  const kind = o.kind === "fixed" ? "fixed" : "percent";
  const value = Math.round(Number(o.value ?? 0));
  if (kind === "percent") {
    if (value < 1 || value > 90)
      throw new Error("Diskon persen harus 1–90.");
  } else if (value < 500) {
    throw new Error("Potongan minimal Rp500.");
  }
  const expiresAt =
    typeof o.expiresAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.expiresAt)
      ? o.expiresAt
      : null;
  return {
    code,
    label: String(o.label ?? "").slice(0, 60),
    kind,
    value,
    minSubtotal: Math.max(0, Math.round(Number(o.minSubtotal ?? 0))),
    maxUses:
      o.maxUses == null || String(o.maxUses) === ""
        ? null
        : Math.max(1, Math.round(Number(o.maxUses))),
    usedCount: Math.max(0, Math.round(Number(o.usedCount ?? 0))),
    active: o.active !== false,
    expiresAt,
  };
}

export function couponToRow(c: Coupon) {
  return {
    code: c.code,
    label: c.label,
    kind: c.kind,
    value: c.value,
    min_subtotal: c.minSubtotal,
    max_uses: c.maxUses,
    used_count: c.usedCount,
    active: c.active,
    expires_at: c.expiresAt,
  };
}
