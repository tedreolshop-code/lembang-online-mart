import { db, isCloud, cloudRequired } from "@/lib/db";
import { formatWaDigits } from "@/lib/config";
import { clientIp, hitRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { newAgentCode } from "@/lib/agent";
import { sendAgentRegisterNotification } from "@/lib/notify";

/** POST: agen mendaftar mandiri (publik — tidak butuh login admin).
    Status awal selalu "pending" → admin approve di tab Agen.
    Setelah daftar, notifikasi dikirim ke Telegram + Discord admin. */
/** Batas pendaftaran agen per IP — menahan pembuatan akun agen massal. */
const DAFTAR_AGEN_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();

  const tunggu = hitRateLimit(`agen-daftar:${clientIp(req)}`, DAFTAR_AGEN_LIMIT);
  if (tunggu !== null) return tooManyRequests(tunggu);

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const nama = String(body.nama ?? "").trim().slice(0, 80);
  const wa = formatWaDigits(String(body.wa ?? ""));
  const alamat = String(body.alamat ?? "").trim().slice(0, 200);
  const payMethod = body.payMethod === "transfer" ? "transfer" : "ewallet";
  const payTarget = String(body.payTarget ?? "").trim().slice(0, 80);
  const email = body.email ? String(body.email).trim().slice(0, 120) : null;

  if (!nama) {
    return Response.json({ error: "Nama wajib diisi." }, { status: 400 });
  }
  if (wa.length < 8) {
    return Response.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
  }
  if (payMethod === "transfer" && !payTarget) {
    return Response.json({ error: "Nomor rekening wajib diisi." }, { status: 400 });
  }
  if (payMethod === "ewallet" && !payTarget) {
    return Response.json({ error: "Nomor e-wallet wajib diisi." }, { status: 400 });
  }

  // cek duplikat: satu No. WA hanya boleh satu agen
  const { data: existing } = await db()
    .from("agents")
    .select("code,status")
    .eq("wa", wa)
    .maybeSingle();

  if (existing) {
    const statusLabel =
      existing.status === "aktif"
        ? "sudah aktif"
        : existing.status === "nonaktif"
          ? "sedang nonaktif"
          : "masih menunggu approval";
    return Response.json(
      { error: `Nomor WhatsApp ini sudah terdaftar sebagai agen (${statusLabel}).` },
      { status: 409 },
    );
  }

  const code = newAgentCode();
  const row = {
    code,
    nama,
    wa,
    alamat,
    pay_method: payMethod,
    pay_target: payTarget,
    status: "pending",
    email,
  };

  const { error } = await db().from("agents").insert(row);
  if (error) {
    const msg =
      /agents|relation|Could not find|does not exist/i.test(error.message)
        ? "Tabel agen belum ada — jalankan sql/alter-v6.sql di Supabase SQL Editor."
        : "Gagal menyimpan pendaftaran agen.";
    return Response.json({ error: msg }, { status: 500 });
  }

  // notifikasi ke admin (Telegram + Discord) — best-effort
  void sendAgentRegisterNotification(nama, wa, code).catch(() => {});

  return Response.json({
    ok: true,
    code,
    message:
      "Pendaftaran berhasil! Admin akan meninjau dan menyetujui pendaftaranmu. Kami akan memberi tahu via WhatsApp.",
  });
}
