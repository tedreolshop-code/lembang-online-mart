import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToSettings } from "@/lib/rows";
import { DEFAULT_SETTINGS } from "@/lib/config";

export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  const { data } = await db().from("settings").select("*").eq("id", 1).single();
  const full = data ? rowToSettings(data) : DEFAULT_SETTINGS;

  // kredensial notifikasi hanya dikirim ke admin yang login
  if (await requireAdmin(req)) return Response.json(full);
  return Response.json({
    ...full,
    notifyProvider: "off",
    notifyToken: "",
    notifyTarget: "",
  });
}

export async function PUT(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();
  const body = await req.json();

  const { data: cur } = await db().from("settings").select("*").eq("id", 1).single();
  const curSettings = cur ? rowToSettings(cur) : DEFAULT_SETTINGS;

  const row = {
    id: 1,
    name: String(body.name ?? DEFAULT_SETTINGS.name),
    tagline: String(body.tagline ?? DEFAULT_SETTINGS.tagline),
    whatsapp: String(body.whatsapp ?? DEFAULT_SETTINGS.whatsapp).replace(/[^0-9]/g, ""),
    address: String(body.address ?? DEFAULT_SETTINGS.address),
    hours: String(body.hours ?? DEFAULT_SETTINGS.hours),
    ongkir: Number(body.ongkir ?? DEFAULT_SETTINGS.ongkir) || 0,
    free_ongkir_min: Number(body.freeOngkirMin ?? DEFAULT_SETTINGS.freeOngkirMin) || 0,
    notify_provider:
      body.notifyProvider === "fonnte" || body.notifyProvider === "telegram"
        ? body.notifyProvider
        : "off",
    // token/target kosong berarti pertahankan nilai lama (tidak bocor ke client)
    notify_token: body.notifyToken
      ? String(body.notifyToken)
      : curSettings.notifyToken,
    notify_target: body.notifyTarget
      ? String(body.notifyTarget)
      : curSettings.notifyTarget,
  };

  const { error } = await db().from("settings").upsert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
