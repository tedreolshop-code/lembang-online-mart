import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifySecret } from "@/lib/password";

/** POST /api/customers/login — masuk dengan No. WA + password.

    Keamanan penting: pesan error SELALU sama ("Nomor WhatsApp atau password
    salah") baik nomor tidak terdaftar, belum punya password, maupun password
    salah — supaya endpoint ini tidak bisa dipakai memetakan pelanggan.
    Rate limit per IP menahan tebak password beruntun. */
const LOGIN_LIMIT = { max: 8, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = hitRateLimit(`cust-login:${clientIp(req)}`, LOGIN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const phone = formatWaDigits(String(body.phone ?? ""));
  const password = String(body.password ?? "");
  if (phone.length < 8 || !password) {
    return Response.json(
      { error: "Nomor WhatsApp atau password salah." },
      { status: 401 },
    );
  }

  const { data: row } = await db()
    .from("customers")
    .select("phone,name,address,password_hash")
    .eq("phone", phone)
    .maybeSingle();

  if (!row || !verifySecret(password, row.password_hash ?? "")) {
    return Response.json(
      { error: "Nomor WhatsApp atau password salah." },
      { status: 401 },
    );
  }

  return Response.json({
    ok: true,
    customer: { phone: row.phone, name: row.name, address: row.address ?? "" },
  });
}
