import { db, isCloud, cloudRequired } from "@/lib/db";
import { rowToOrder, rowToSettings, orderWithoutCostPrice } from "@/lib/rows";
import { DEFAULT_SETTINGS } from "@/lib/config";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH publik: pembeli memilih metode pembayaran pesanan form SETELAH
    pesanan dibuat (kartu pemilih di banner sukses halaman /pesanan).

    Sengaja dibatasi ketat karena tanpa login:
    - hanya kolom `payment` yang bisa diubah;
    - hanya pesanan channel "form" (pesanan WhatsApp tidak lewat sini);
    - hanya sekali: bila sudah bukan nilai awal "COD", ditolak (409);
    - hanya label metode yang terdaftar aktif di settings (COD atau salah
      satu metode transfer/e-wallet dari Admin → Pengaturan). */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { payment?: unknown };

  const payment =
    typeof body.payment === "string" ? body.payment.trim().slice(0, 60) : "";
  if (!payment) {
    return Response.json(
      { error: "Metode pembayaran tidak dikenal." },
      { status: 400 },
    );
  }

  // validasi terhadap daftar metode aktif di settings
  const { data: sRow } = await db()
    .from("settings")
    .select("cod_enabled, payment_methods")
    .eq("id", 1)
    .maybeSingle();
  const s = sRow ? rowToSettings(sRow as never) : DEFAULT_SETTINGS;
  const labelAktif = [
    ...(s.codEnabled !== false ? ["COD"] : []),
    ...s.paymentMethods.map((m) => m.label),
  ];
  if (!labelAktif.includes(payment)) {
    return Response.json(
      { error: "Metode pembayaran tidak dikenal." },
      { status: 400 },
    );
  }

  const { data: order, error } = await db()
    .from("orders")
    .select("id, channel, payment")
    .eq("id", id)
    .single();
  if (error || !order) {
    return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }
  if (order.channel !== "form") {
    return Response.json(
      { error: "Pesanan ini tidak memakai form checkout." },
      { status: 409 },
    );
  }
  // "COD" = nilai awal sejak pesanan dibuat; selain itu berarti sudah dipilih
  if (order.payment !== "COD") {
    return Response.json(
      { error: "Metode pembayaran sudah dipilih sebelumnya." },
      { status: 409 },
    );
  }

  const { error: uerr } = await db()
    .from("orders")
    .update({ payment })
    .eq("id", id);
  if (uerr) return Response.json({ error: uerr.message }, { status: 500 });

  const { data: fresh } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  // publik: HPP per item tidak boleh ikut terkirim
  return Response.json(orderWithoutCostPrice(rowToOrder(fresh!)));
}
