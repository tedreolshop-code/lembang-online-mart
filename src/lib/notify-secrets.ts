import { db } from "./db";
import type { StoreSettings } from "./config";

/** Kredensial notifikasi (Fonnte/Telegram) disimpan di tabel notify_secrets
    yang terkunci RLS (tanpa policy → hanya service key API yang bisa akses).
    Tabel settings terbaca publik sehingga TIDAK boleh menyimpan rahasia. */

export interface NotifySecrets {
  provider: StoreSettings["notifyProvider"];
  token: string;
  target: string;
  discordWebhook: string;
}

export async function readSecrets(): Promise<NotifySecrets> {
  const { data } = await db()
    .from("notify_secrets")
    .select("notify_provider,notify_token,notify_target,discord_webhook")
    .eq("id", 1)
    .single();
  return {
    provider:
      data?.notify_provider === "fonnte" ||
      data?.notify_provider === "telegram" ||
      data?.notify_provider === "discord"
        ? data.notify_provider
        : "off",
    token: data?.notify_token ?? "",
    target: data?.notify_target ?? "",
    discordWebhook: data?.discord_webhook ?? "",
  };
}

/** Simpan kredensial. Token/target kosong berarti pertahankan nilai lama.
    Mengembalikan pesan peringatan bila tabel belum ada (migrasi belum jalan). */
export async function writeSecrets(
  provider: StoreSettings["notifyProvider"],
  token: string,
  target: string,
  discordWebhook?: string,
): Promise<{ warning?: string }> {
  const cur = await readSecrets();
  const { error } = await db().from("notify_secrets").upsert({
    id: 1,
    notify_provider: provider,
    notify_token: token || cur.token,
    notify_target: target || cur.target,
    discord_webhook: discordWebhook !== undefined ? discordWebhook : cur.discordWebhook,
  });
  if (error) {
    return {
      warning:
        "Kredensial notifikasi belum tersimpan — jalankan ulang sql/alter-v8.sql di Supabase SQL Editor.",
    };
  }
  return {};
}

/** Gabungkan kredensial ke objek settings (untuk pengiriman notifikasi). */
export async function withSecrets(
  settings: StoreSettings,
): Promise<StoreSettings> {
  const sec = await readSecrets();
  return {
    ...settings,
    notifyProvider: sec.provider,
    notifyToken: sec.token,
    notifyTarget: sec.target,
    discordWebhook: sec.discordWebhook,
  };
}

/** Kirim notifikasi ke semua provider aktif (Telegram + Discord sekaligus).
    Dipakai untuk pendaftaran agen baru — best-effort, tidak melempar error. */
export async function sendAdminAlert(
  text: string,
): Promise<void> {
  const sec = await readSecrets();
  const tasks: Promise<void>[] = [];

  if (sec.provider === "telegram" && sec.token && sec.target) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${sec.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: sec.target, text }),
        signal: AbortSignal.timeout(10000),
      }).then(() => undefined).catch(() => undefined),
    );
  }

  if (sec.discordWebhook) {
    tasks.push(
      fetch(sec.discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: AbortSignal.timeout(10000),
      }).then(() => undefined).catch(() => undefined),
    );
  }

  await Promise.allSettled(tasks);
}
