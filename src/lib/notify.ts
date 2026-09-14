import type { Order } from "./types";
import type { StoreSettings } from "./config";
import { formatRupiah } from "./format";

/** Kirim notifikasi pesanan masuk ke pemilik warung.
    Provider: Fonnte (WhatsApp, fonnte.com) atau Telegram Bot.
    Best-effort: gagal kirim TIDAK menggagalkan pesanan. */
export async function sendOrderNotification(
  settings: StoreSettings,
  order: Order,
): Promise<{ sent: boolean; error?: string }> {
  return sendText(settings, buildMessage(settings, order));
}

/** Pesan tes dari tombol "Kirim Pesan Tes" di Pengaturan */
export async function sendTestNotification(
  settings: StoreSettings,
): Promise<{ sent: boolean; error?: string }> {
  return sendText(
    settings,
    "✅ Tes notifikasi berhasil terhubung. Pesanan baru dari website akan diberitahukan ke chat ini.",
  );
}

async function sendText(
  settings: StoreSettings,
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  if (settings.notifyProvider === "off") return { sent: false };
  if (!settings.notifyToken || !settings.notifyTarget) {
    return { sent: false, error: "Notifikasi belum dikonfigurasi lengkap." };
  }
  try {
    if (settings.notifyProvider === "fonnte") {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: settings.notifyToken },
        body: new URLSearchParams({
          target: settings.notifyTarget,
          message: text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { reason?: string };
        return { sent: false, error: body.reason ?? `Fonnte HTTP ${res.status}` };
      }
      return { sent: true };
    }

    // telegram
    const res = await fetch(
      `https://api.telegram.org/bot${settings.notifyToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.notifyTarget,
          text,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        description?: string;
      };
      return {
        sent: false,
        error: body.description ?? `Telegram HTTP ${res.status}`,
      };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "gagal kirim",
    };
  }
}

function buildMessage(s: StoreSettings, o: Order): string {
  const items = o.items
    .map((i) => `• ${i.name} x${i.qty}`)
    .join("\n");
  return [
    `🔔 *PESANAN BARU ${o.id}*`,
    `${s.name}`,
    "",
    `👤 ${o.customer.name} (${o.customer.phone})`,
    `📍 ${o.customer.address}`,
    `🚚 Antar: ${o.shipOption === "xpress" ? s.xpressLabel : "Reguler"}`,
    "",
    items,
    "",
    o.discount > 0
      ? `🎟 Voucher ${o.coupon ?? "-"}: -${formatRupiah(o.discount)}`
      : "",
    `Total: *${formatRupiah(o.total)}* (${o.payment})`,
    o.customer.note ? `📝 ${o.customer.note}` : "",
    "",
    "Buka halaman admin untuk memproses pesanan ini.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const TEST_MESSAGE =
  "✅ Tes notifikasi berhasil terhubung. Pesanan baru dari website akan diberitahukan ke chat ini.";
