import { db, isCloud, cloudRequired } from "@/lib/db";
import { rowToOrder } from "@/lib/rows";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH publik: pembeli memilih metode pembayaran pesanan form SETELAH
    pesanan dibuat (kartu pemilih di banner sukses halaman /pesanan).

    Sengaja dibatasi ketat karena tanpa login:
    - hanya kolom `payment` yang bisa diubah;
    - hanya pesanan channel "form" (pesanan WhatsApp tidak lewat sini);
    - hanya sekali: bila sudah bukan nilai awal "COD", ditolak (409);
    - hanya nilai "COD" | "Transfer Bank" yang diterima. */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { payment?: unknown };

  if (body.payment !== "COD" && body.payment !== "Transfer Bank") {
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
    .update({ payment: body.payment })
    .eq("id", id);
  if (uerr) return Response.json({ error: uerr.message }, { status: 500 });

  const { data: fresh } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  return Response.json(rowToOrder(fresh!));
}
