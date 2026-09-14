import type { StoreSettings } from "./config";
import { formatDateTime, formatRupiah } from "./format";
import type { Order } from "./types";

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cetak struk pesanan (kertas 80mm) lewat iframe tersembunyi —
    tanpa popup, jalan di Chrome/Edge/Firefox baik di HP maupun laptop. */
export function printOrderStruk(order: Order, s: StoreSettings): void {
  const items = order.items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}<br><span class=m>×${i.qty} · ${esc(i.unit)}</span></td><td class="r">${formatRupiah(i.price * i.qty)}</td></tr>`,
    )
    .join("");

  const rows = [
    ["Subtotal", formatRupiah(order.subtotal)],
    ...(order.discount > 0
      ? [[`Diskon ${esc(order.coupon ?? "voucher")}`, `−${formatRupiah(order.discount)}`]]
      : []),
    [
      `Ongkir (${order.shipOption === "xpress" ? "Xpress" : "Reguler"})`,
      order.shipping === 0 ? "GRATIS" : formatRupiah(order.shipping),
    ],
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td class=r>${v}</td></tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${esc(order.id)}</title>
<style>
  @page { margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 12px; color:#000; width: 72mm; margin: 0 auto; }
  h1 { font-size: 15px; text-align: center; margin: 0; }
  .c { text-align: center; }
  .m { color:#333; font-size: 10px; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .tot td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 4px; }
</style></head><body>
  <h1>${esc(s.name)}</h1>
  <p class="c m">${esc(s.tagline)}<br>${esc(s.address)}<br>WA: +${esc(s.whatsapp)}</p>
  <hr>
  <table>
    <tr><td>No</td><td class=r><b>${esc(order.id)}</b></td></tr>
    <tr><td>Tanggal</td><td class=r>${formatDateTime(order.createdAt)}</td></tr>
    <tr><td>Pelanggan</td><td class=r>${esc(order.customer.name)}</td></tr>
    <tr><td></td><td class=r>${esc(order.customer.phone)}</td></tr>
    <tr><td>Alamat</td><td class=r>${esc(order.customer.address)}</td></tr>
    ${order.customer.note ? `<tr><td>Catatan</td><td class=r>${esc(order.customer.note)}</td></tr>` : ""}
    <tr><td>Antar</td><td class=r>${order.shipOption === "xpress" ? esc(s.xpressLabel) : "Reguler"}</td></tr>
    <tr><td>Bayar</td><td class=r>${esc(order.payment)}</td></tr>
  </table>
  <hr>
  <table>${items}</table>
  <hr>
  <table>
    ${rows}
    <tr class="tot"><td>TOTAL</td><td class=r>${formatRupiah(order.total)}</td></tr>
  </table>
  <hr>
  <p class="c m">Terima kasih atas pesanan Anda 🙏<br>Simpan struk ini sebagai bukti transaksi.</p>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    alert("Maaf, struk gagal disiapkan. Coba lagi ya.");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
}
