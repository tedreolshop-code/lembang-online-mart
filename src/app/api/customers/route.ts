import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Batas pendaftaran per IP: nomor HP Indonesia bisa ditebak berurutan, jadi
    tanpa batas ini seseorang bisa memetakan pelanggan lewat percobaan massal. */
const DAFTAR_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/** Tabel customers — No. WA sebagai identitas utama (bukan email).

  POST /api/customers  →  daftar pelanggan baru

  CATATAN KEAMANAN
  Sempat ada `GET /api/customers?phone=628xxx` yang mengembalikan nama +
  alamat hanya bermodal nomor HP. Nomor HP bukan rahasia dan bisa
  dienumerasi berurutan, jadi endpoint itu setara membuka seluruh isi tabel
  pelanggan satu per satu — apalagi pesan 404-nya membedakan nomor terdaftar
  dari yang tidak, sehingga daftar pelanggan toko bisa dipetakan. Endpoint
  itu tidak pernah dipakai kode mana pun dan kini dihapus.
*/

function cleanPhone(raw: string): string | null {
  const digits = formatWaDigits(raw);
  return digits.length >= 8 ? digits : null;
}

/** POST: daftar pelanggan baru (No. WA + nama + alamat).

    SENGAJA TIDAK menimpa pelanggan yang sudah terdaftar. Dulu operasinya
    `upsert` tanpa verifikasi apa pun, sehingga siapa pun bisa mengisi nomor
    HP orang lain, "mendaftar", lalu alamat korban tertimpa alamat penyerang —
    pesanan korban berikutnya bisa dikirim ke alamat penyerang. Untuk nomor
    yang sudah terdaftar sekarang dikembalikan 409 dengan pesan netral, tanpa
    membocorkan nama/alamat yang tersimpan. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const ip = clientIp(req);
  const tunggu = hitRateLimit(`customers:${ip}`, DAFTAR_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const phone = cleanPhone(String(body.phone ?? ""));
  const name = String(body.name ?? "").trim().slice(0, 80);
  const address = String(body.address ?? "").trim().slice(0, 300);

  if (!phone) {
    return Response.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "Nama wajib diisi." }, { status: 400 });
  }

  const row = {
    phone,
    name,
    address,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db()
    .from("customers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    // Tanpa OTP, "nomor sudah terdaftar" tidak bisa dibedakan dari "nomor ini
    // milik orang lain yang sedang ditebak". Karena itu permintaan ditolak —
    // bukan ditimpa, dan bukan pula dibalas dengan data tersimpan.
    return Response.json(
      {
        error:
          "Nomor ini sudah pernah dipakai. Lanjutkan checkout seperti biasa, data pengiriman bisa diisi langsung di halaman checkout.",
      },
      { status: 409 },
    );
  }

  const { error } = await db().from("customers").insert(row);
  if (error) {
    return Response.json(
      { error: "Gagal menyimpan data pelanggan." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    customer: { phone, name, address },
    isNew: true,
  });
}
