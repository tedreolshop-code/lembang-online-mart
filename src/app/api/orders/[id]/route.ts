import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToOrder } from "@/lib/rows";
import { readyAtFrom, rowToCommissionSettings } from "@/lib/agent";

type Ctx = { params: Promise<{ id: string }> };

/** Masa tunggu pencairan (hold_days) dari pengaturan komisi; bawaan aman
    bila baris belum ada. */
async function holdDays(): Promise<number> {
  const { data } = await db()
    .from("commission_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return rowToCommissionSettings(data ?? null).holdDays;
}

/** Perubahan status pesanan ikut mengurus ledger komisi agen (v6):
    - selesai   → isi ready_at = sekarang + hold_days (komisi jadi "siap cair")
    - dibatalkan → baris komisi pending jadi batal (alasan terekam)
    Hanya best-effort: kegagalan di sini tidak membatalkan perubahan status. */
async function syncCommission(
  orderId: string,
  from: string,
  to: string,
): Promise<void> {
  if (to === from) return;
  if (to === "selesai") {
    const ready = readyAtFrom(Date.now(), await holdDays());
    await db()
      .from("agent_commissions")
      .update({ ready_at: ready })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .is("ready_at", null);
  } else if (to === "dibatalkan") {
    await db()
      .from("agent_commissions")
      .update({ status: "batal", note: "pesanan dibatalkan" })
      .eq("order_id", orderId)
      .in("status", ["pending", "dibayar"]);
  } else if (from === "dibatalkan" && to !== "dibatalkan") {
    // pesanan diaktifkan lagi dari batal — kembalikan baris yang kita batal-
    // kan karena pembatalan (amount > 0) ke pending
    await db()
      .from("agent_commissions")
      .update({ status: "pending" })
      .eq("order_id", orderId)
      .eq("status", "batal")
      .eq("note", "pesanan dibatalkan")
      .gt("amount", 0);
  }
}

/** PATCH: ubah status pesanan, atau "terima" pesanan WhatsApp
    (mengurangi stok di server + catat movement) */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json();

  const { data: order, error: oerr } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  if (oerr || !order) {
    return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const row: Record<string, unknown> = {};

  // batalkan pesanan → kembalikan stok + catat movement "cancel"
  if (body.cancel && order.status !== "dibatalkan") {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue;
      const { data: p } = await db()
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();
      const newStock = (p?.stock ?? 0) + item.qty;
      await db()
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);
      await db().from("stock_movements").insert({
        product_id: item.product_id,
        delta: item.qty,
        reason: "cancel",
        order_id: id,
      });
    }
    row.status = "dibatalkan";
    row.stock_applied = false;
  }

  if (body.accept && !order.stock_applied) {
    // kurangi stok per item + catat movement "receive"
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue;
      const { data: p } = await db()
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .single();
      const newStock = Math.max(0, (p?.stock ?? 0) - item.qty);
      await db()
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);
      await db().from("stock_movements").insert({
        product_id: item.product_id,
        delta: -item.qty,
        reason: "receive",
        order_id: id,
      });
    }
    row.stock_applied = true;
    row.status = body.status ?? "diproses";
  }

  if (body.status) row.status = body.status;

  if (Object.keys(row).length === 0) {
    return Response.json({ ok: true });
  }

  const { error } = await db().from("orders").update(row).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // ledger komisi mengikuti status pesanan (v6)
  await syncCommission(id, order.status, (row.status as string) ?? order.status);

  const { data: fresh } = await db()
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  return Response.json(rowToOrder(fresh!));
}
