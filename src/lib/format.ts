export function formatRupiah(n: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function discountPercent(price: number, oldPrice?: number): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts));
}

/** Huruf/angka tanpa yang mudah tertukar (I O 0 1) → 32 simbol, dan
    256 ÷ 32 = 8 pas sehingga modulo di bawah tidak bias. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Kode pesanan: `LMB-` + 8 karakter acak kriptografis (~1,1 triliun
    kombinasi). Harus tidak bisa ditebak: halaman /pesanan membaca data
    pelanggan lewat kode ini tanpa login, jadi kode = kuncinya. */
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += CODE_CHARS[b % CODE_CHARS.length];
  return `LMB-${out}`;
}
