import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { hashSecret, verifySecret } from "@/lib/password";
import { randomInt } from "crypto";

/** Lupa password pelanggan — dua langkah, tanpa OTP SMS:

  POST {phone}                    → minta kode reset (langkah 1)
  POST {phone, code, password}    → pasang password baru (langkah 2)

  Caranya: kode 6 digit dikirim SERVER-SIDE oleh server toko ke No. WhatsApp
  pelanggan lewat Fonnte (kredensial di tabel notify_secrets). Kode TIDAK
  pernah ikut di respons API — bila dikembalikan ke pemanggil, siapa pun yang
  mengetahui nomor korban bisa membaca kodenya lalu mengganti password
  (account takeover).

  Keamanan:
  - Kode disimpan sebagai HASH (bukan teks polos) + kedaluwarsa 15 menit.
  - Maksimal 5 percobaan salah, setelah itu kode hangus (harus minta baru).
  - Pesan error langkah 2 netral, tidak membedakan "nomor tak terdaftar"
    vs "kode salah" vs "kedaluwarsa" — menghindari enumerasi.
  - Cek konfigurasi pengiriman dilakukan SEBELUM lookup nomor, dan nomor tak
    terdaftar selalu dibalas sukses palsu — agar bukan alat enumerasi.
  - Akun lama yang belum pernah buat password juga bisa lewat alur ini. */

import { readSecrets } from "@/lib/notify-secrets";

const REQUEST_LIMIT = { max: 3, windowMs: 15 * 60 * 1000 };
const RESET_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const KODE_MENIT = 15;
const MAKS_PERCOBAAN = 5;

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const phone = formatWaDigits(String(body.phone ?? ""));
  if (phone.length < 8) {
    return Response.json(
      { error: "Masukkan nomor WhatsApp yang valid." },
      { status: 400 },
    );
  }

  // ── langkah 2: pasang password baru ─────────────────────────────
  if (body.code !== undefined || body.password !== undefined) {
    const tunggu = await hitRateLimit(`cust-reset2:${clientIp(req)}`, RESET_LIMIT);
    if (tunggu !== null) return tooManyRequests(tunggu);

    const code = String(body.code ?? "").replace(/\D/g, "");
    const password = String(body.password ?? "");
    if (code.length !== 6) {
      return Response.json(
        { error: "Kode reset harus 6 digit." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return Response.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 },
      );
    }

    const { data: row } = await db()
      .from("customers")
      .select("reset_hash,reset_expires,reset_attempts")
      .eq("phone", phone)
      .maybeSingle();

    const kedaluwarsa = row?.reset_expires
      ? new Date(row.reset_expires).getTime()
      : 0;
    if (
      !row ||
      !row.reset_hash ||
      kedaluwarsa < Date.now() ||
      (row.reset_attempts ?? 0) >= MAKS_PERCOBAAN ||
      !verifySecret(code, row.reset_hash)
    ) {
      // pesan netral: tidak membocorkan nomor terdaftar / status kode
      return Response.json(
        { error: "Kode salah atau sudah kedaluwarsa. Minta kode baru." },
        { status: 400 },
      );
    }

    const { error } = await db()
      .from("customers")
      .update({
        password_hash: hashSecret(password),
        reset_hash: "",
        reset_expires: null,
        reset_attempts: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("phone", phone);
    if (error) {
      return Response.json(
        { error: "Gagal menyimpan password baru." },
        { status: 500 },
      );
    }
    return Response.json({ ok: true });
  }

  // ── langkah 1: minta kode reset ─────────────────────────────────
  const tunggu = await hitRateLimit(`cust-reset1:${clientIp(req)}`, REQUEST_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  // Pengiriman kode HARUS lewat server (Fonnte), bukan wa.me yang dibuka di
  // perangkat pemanggil — wa.me membocorkan kode ke siapa pun yang menebak
  // nomor. Cek konfigurasi SEBELUM lookup nomor supaya responsnya seragam
  // (bukan alat enumerasi nomor terdaftar).
  const sec = await readSecrets();
  const fonnteToken = sec.provider === "fonnte" ? sec.token : "";
  if (!fonnteToken) {
    return Response.json(
      {
        error:
          "Reset password via WhatsApp belum diaktifkan. Hubungi warung untuk bantuan.",
      },
      { status: 503 },
    );
  }

  const { data: row } = await db()
    .from("customers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (!row) {
    // Respons sukses palsu agar nomor tak terdaftar tidak bisa dipetakan.
    return Response.json({ ok: true });
  }

  const kode = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await db()
    .from("customers")
    .update({
      reset_hash: hashSecret(kode),
      reset_expires: new Date(Date.now() + KODE_MENIT * 60 * 1000).toISOString(),
      reset_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("phone", phone);
  if (error) {
    return Response.json(
      { error: "Gagal membuat kode reset. Coba lagi." },
      { status: 500 },
    );
  }

  // Kirim kode ke WhatsApp pemilik nomor — server-side, kode tidak pernah
  // dikembalikan ke pemanggil API.
  let terkirim = false;
  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: fonnteToken },
      body: new URLSearchParams({
        target: phone,
        message:
          `Kode reset password Lembang Online Mart: ${kode}\n\n` +
          `Berlaku ${KODE_MENIT} menit. Abaikan pesan ini bila kamu tidak meminta reset.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    terkirim = res.ok;
  } catch {
    terkirim = false;
  }
  if (!terkirim) {
    return Response.json(
      { error: "Gagal mengirim kode ke WhatsApp. Coba lagi sebentar lagi." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
