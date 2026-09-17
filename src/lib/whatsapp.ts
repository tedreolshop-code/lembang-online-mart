import { hitungOngkir } from "./config";
import type { StoreSettings } from "./config";
import { formatRupiah } from "./format";
import { lineSubtotalWithAgent, unitPriceWithAgent } from "./pricing";
import type { AgentPriceLine, Order, PaymentMethod, Product } from "./types";

export interface WaDraft {
  lines: { product: Product; qty: number }[];
  settings: StoreSettings;
  customer?: { name: string; phone: string; address: string; note?: string };
  payment?: PaymentMethod;
  /** default reguler — opsi Xpress hanya bisa dipilih lewat form checkout */
  shipOption?: "reguler" | "xpress";
  /** kode agen yang tercatat dari link referral (v6) */
  agentCode?: string;
  /** harga khusus agen (v9) agar teks WA sama dengan tagihan `create_order` */
  agentPrices?: AgentPriceLine[];
}

/** Susun teks pesanan siap kirim ke WhatsApp warung */
export function buildOrderMessage(draft: WaDraft): string {
  // harga grosir (v6) + harga khusus agen (v9): subtotal mengikuti harga efektif
  const subtotal = draft.lines.reduce(
    (a, l) => a + lineSubtotalWithAgent(l.product, l.qty, draft.agentPrices),
    0,
  );
  const shipping = hitungOngkir(
    draft.settings,
    subtotal,
    draft.shipOption ?? "reguler",
  );
  const total = subtotal + shipping;

  const lines: string[] = [
    `*Halo ${draft.settings.name}!* 👋`,
    "Saya mau pesan:",
    "",
  ];
  draft.lines.forEach((l, i) => {
    lines.push(
      `${i + 1}. ${l.product.name} (${l.product.unit}) x${l.qty} — ${formatRupiah(
        unitPriceWithAgent(l.product, l.qty, draft.agentPrices) * l.qty,
      )}`,
    );
  });
  lines.push("", `Subtotal: ${formatRupiah(subtotal)}`);
  const label =
    draft.shipOption === "xpress" ? draft.settings.xpressLabel : "Reguler";
  lines.push(
    shipping === 0
      ? `Ongkir (${label}): GRATIS 🎉`
      : `Ongkir (${label}): ${formatRupiah(shipping)}`,
  );
  lines.push(`*Total: ${formatRupiah(total)}*`);

  if (draft.customer) {
    lines.push(
      "",
      `Nama: ${draft.customer.name}`,
      `No. HP: ${draft.customer.phone}`,
      `Alamat: ${draft.customer.address}`,
    );
    if (draft.customer.note) lines.push(`Catatan: ${draft.customer.note}`);
    if (draft.payment) lines.push(`Pembayaran: ${draft.payment}`);
  }
  if (draft.agentCode) lines.push("", `Kode agen: ${draft.agentCode}`);
  lines.push("", "Mohon dikonfirmasi ya, terima kasih 🙏");
  return lines.join("\n");
}

export function waLink(message: string, whatsapp: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

/** tombol "kirim ulang" dari halaman riwayat pesanan — memakai angka
    tersimpan di pesanan (termasuk diskon voucher & opsi antar), bukan
    dihitung ulang, agar teks WA sama persis dengan pesanan. */
export function buildOrderRepeatMessage(
  order: Order,
  settings: StoreSettings,
): string {
  const lines: string[] = [
    `*Halo ${settings.name}!* 👋`,
    "Saya mau mengulang pesanan di bawah:",
    "",
    `Kode pesanan: ${order.id}`,
    "",
  ];
  order.items.forEach((i, n) => {
    lines.push(
      `${n + 1}. ${i.name} (${i.unit}) x${i.qty} — ${formatRupiah(
        i.price * i.qty,
      )}`,
    );
  });
  lines.push("", `Subtotal: ${formatRupiah(order.subtotal)}`);
  if (order.discount > 0) {
    lines.push(
      `Voucher ${order.coupon ?? "-"}: -${formatRupiah(order.discount)}`,
    );
  }
  const label = order.shipOption === "xpress" ? settings.xpressLabel : "Reguler";
  lines.push(
    order.shipping === 0
      ? `Ongkir (${label}): GRATIS 🎉`
      : `Ongkir (${label}): ${formatRupiah(order.shipping)}`,
  );
  lines.push(`*Total: ${formatRupiah(order.total)}*`);
  lines.push("", `Pembayaran: ${order.payment}`);
  if (order.customer.note) lines.push(`Catatan: ${order.customer.note}`);
  lines.push("", "Mohon dikonfirmasi ya, terima kasih 🙏");
  return lines.join("\n");
}
