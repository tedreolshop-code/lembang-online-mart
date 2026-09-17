import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";

/** Tabel customers — No. WA sebagai identitas utama (bukan email).
    Tanpa OTP di fase awal: daftar/login cukup No. WA + nama.

  POST /api/customers  →  daftar atau login (upsert by phone)
  GET  /api/customers?phone=628xxx  →  ambil data pelanggan (untuk cek profil)
*/

function cleanPhone(raw: string): string | null {
  const digits = formatWaDigits(raw);
  return digits.length >= 8 ? digits : null;
}

/** POST: daftar pelanggan baru atau login (No. WA + nama).
    Bila No. WA sudah ada → perbarui nama/alamat, kembalikan data lama.
    Bila baru → buat baris baru. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
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

  const { error } = await db().from("customers").upsert(row);
  if (error) {
    return Response.json(
      { error: "Gagal menyimpan data pelanggan." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    customer: { phone, name, address },
    isNew: !existing,
  });
}

/** GET: ambil data pelanggan by phone (untuk cek profil / login). */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  const phone = cleanPhone(
    new URL(req.url).searchParams.get("phone") ?? "",
  );
  if (!phone) {
    return Response.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
  }

  const { data } = await db()
    .from("customers")
    .select("phone,name,address,created_at")
    .eq("phone", phone)
    .maybeSingle();

  if (!data) {
    return Response.json({ error: "Pelanggan belum terdaftar." }, { status: 404 });
  }

  return Response.json({
    customer: {
      phone: data.phone,
      name: data.name,
      address: data.address ?? "",
    },
  });
}
