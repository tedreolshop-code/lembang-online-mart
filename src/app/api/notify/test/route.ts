import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToSettings } from "@/lib/rows";
import { sendTestNotification } from "@/lib/notify";

/** POST: kirim pesan tes notifikasi ke pemilik (khusus admin) */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const { data: row } = await db().from("settings").select("*").eq("id", 1).single();
  const settings = row ? rowToSettings(row) : null;
  if (!settings) {
    return Response.json(
      { error: "Pengaturan belum tersimpan — simpan dulu di tab Pengaturan." },
      { status: 400 },
    );
  }
  const result = await sendTestNotification(settings);
  if (!result.sent) {
    return Response.json(
      { error: result.error ?? "Gagal mengirim tes." },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
