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

export function newOrderId(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `LMB-${n}`;
}
