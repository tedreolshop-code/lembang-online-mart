import { hitungOngkir } from "./config";
import type { StoreSettings } from "./config";
import { formatRupiah } from "./format";
import type { Order, PaymentMethod, Product } from "./types";

export interface WaDraft {
  lines: { product: Product; qty: number }[];
  settings: StoreSettings;
  customer?: { name: string; phone: string; address: string; note?: string };
  payment?: PaymentMethod;
}

/** Susun teks pesanan siap kirim ke WhatsApp warung */
export function buildOrderMessage(draft: WaDraft): string {
  const subtotal = draft.lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const shipping = hitungOngkir(draft.settings, subtotal);
  const total = subtotal + shipping;

  const lines: string[] = [
    `*Halo ${draft.settings.name}!* 👋`,
    "Saya mau pesan:",
    "",
  ];
  draft.lines.forEach((l, i) => {
    lines.push(
      `${i + 1}. ${l.product.name} (${l.product.unit}) x${l.qty} — ${formatRupiah(
        l.product.price * l.qty,
      )}`,
    );
  });
  lines.push("", `Subtotal: ${formatRupiah(subtotal)}`);
  lines.push(
    shipping === 0
      ? "Ongkir: GRATIS 🎉"
      : `Ongkir: ${formatRupiah(shipping)}`,
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
  lines.push("", "Mohon dikonfirmasi ya, terima kasih 🙏");
  return lines.join("\n");
}

export function waLink(message: string, whatsapp: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

/** tombol "kirim ulang" dari halaman riwayat pesanan */
export function buildOrderRepeatMessage(
  order: Order,
  settings: StoreSettings,
): string {
  return buildOrderMessage({
    settings,
    lines: order.items.map((i) => ({
      product: {
        id: i.productId,
        name: i.name,
        price: i.price,
        unit: i.unit,
        emoji: i.emoji,
        category: "",
        stock: 0,
      },
      qty: i.qty,
    })),
    customer: order.customer,
    payment: order.payment,
  });
}
