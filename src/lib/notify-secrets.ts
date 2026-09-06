import { db } from "./db";
import type { StoreSettings } from "./config";

/** Kredensial notifikasi (Fonnte/Telegram) disimpan di tabel notify_secrets
    yang terkunci RLS (tanpa policy → hanya service key API yang bisa akses).
    Tabel settings terbaca publik sehingga TIDAK boleh menyimpan rahasia. */

export interface NotifySecrets {
  provider: StoreSettings["notifyProvider"];
  token: string;
  target: string;
}

export async function readSecrets(): Promise<NotifySecrets> {
  const { data } = await db()
    .from("notify_secrets")
    .select("notify_provider,notify_token,notify_target")
    .eq("id", 1)
    .single();
  return {
    provider:
      data?.notify_provider === "fonnte" || data?.notify_provider === "telegram"
        ? data.notify_provider
        : "off",
    token: data?.notify_token ?? "",
    target: data?.notify_target ?? "",
  };
}

/** Simpan kredensial. Token/target kosong berarti pertahankan nilai lama.
    Mengembalikan pesan peringatan bila tabel belum ada (migrasi belum jalan). */
export async function writeSecrets(
  provider: StoreSettings["notifyProvider"],
  token: string,
  target: string,
): Promise<{ warning?: string }> {
  const cur = await readSecrets();
  const { error } = await db().from("notify_secrets").upsert({
    id: 1,
    notify_provider: provider,
    notify_token: token || cur.token,
    notify_target: target || cur.target,
  });
  if (error) {
    return {
      warning:
        "Kredensial notifikasi belum tersimpan — jalankan ulang sql/alter-v3.sql di Supabase SQL Editor (ada tambahan tabel notify_secrets).",
    };
  }
  return {};
}

/** Gabungkan kredensial ke objek settings (untuk pengiriman notifikasi). */
export async function withSecrets(
  settings: StoreSettings,
): Promise<StoreSettings> {
  const sec = await readSecrets();
  return { ...settings, ...sec };
}
