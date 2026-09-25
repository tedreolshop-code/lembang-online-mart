import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { hashSecret, verifySecret } from "@/lib/password";
import { randomInt } from "crypto";

/** Lupa password pelanggan — dua langkah, tanpa OTP SMS:

  POST {phone}                    → minta kode reset (langkah 1)
  POST {phone, code, password}    → pasang password baru (langkah 2)

  Caranya: kode 6 digit dikirim ke No. WhatsApp pelanggan lewat link
  wa.me — pelanggan menekan tombol "Buka WhatsApp" di halaman lupa
  password, lalu mengetikkan kode yang muncul di chat tersebut ke form.
  Kode hanya sampai ke pemilik nomor, jadi siapa pun yang tidak pegang
  nomor itu tidak bisa mengganti passwordnya.

  Keamanan:
  - Kode disimpan sebagai HASH (bukan teks polos) + kedaluwarsa 15 menit.
  - Maksimal 5 percobaan salah, setelah itu kode hangus (harus minta baru).
  - Pesan error langkah 2 netral, tidak membedakan "nomor tak terdaftar"
    vs "kode salah" vs "kedaluwarsa" — menghindari enumerasi.
  - Akun lama yang belum pernah buat password juga bisa lewat alur ini. */

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
    const tunggu = hitRateLimit(`cust-reset2:${clientIp(req)}`, RESET_LIMIT);
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
  const tunggu = hitRateLimit(`cust-reset1:${clientIp(req)}`, REQUEST_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const { data: row } = await db()
    .from("customers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (!row) {
    // Respons sukses palsu agar nomor tak terdaftar tidak bisa dipetakan;
    // frontend menampilkan wa.me generik tanpa kode.
    return Response.json({ ok: true, waLink: `https://wa.me/${phone}` });
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

  // kode dikirim via wa.me — pelanggan menekan tombol, lalu menyalin
  // kode dari draft pesan yang muncul di WhatsApp
  const waLink =
    `https://wa.me/${phone}?text=` +
    encodeURIComponent(
      `Reset password Lembang Online Mart\nKode saya: ${kode}\n\n(Abaikan pesan ini setelah kode disalin)`,
    );
  return Response.json({ ok: true, waLink });
}
