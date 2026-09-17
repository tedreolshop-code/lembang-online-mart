import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToSettings } from "@/lib/rows";
import { DEFAULT_BANNERS, DEFAULT_SETTINGS, type BannerSlide, type StoreSettings } from "@/lib/config";
import { readSecrets, writeSecrets } from "@/lib/notify-secrets";

/** hex valid: #rgb atau #rrggbb → kembalikan null bila tidak valid */
function hexColor(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v.trim()) ? v.trim() : fallback;
}

/** bersihkan daftar banner dari input admin */
function bannerList(v: unknown, fallback: BannerSlide[]): BannerSlide[] {
  if (!Array.isArray(v)) return fallback;
  const out = v
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      if (!o.title) return null;
      return {
        title: String(o.title).slice(0, 80),
        subtitle: String(o.subtitle ?? "").slice(0, 160),
        cta: String(o.cta ?? "Lihat").slice(0, 40),
        href: String(o.href ?? "/kategori").slice(0, 200),
        color: String(o.color ?? "otomatis") === "otomatis"
          ? "otomatis"
          : hexColor(o.color, "otomatis"),
        image: String(o.image ?? "").slice(0, 500),
      };
    })
    .filter((b): b is BannerSlide => b !== null)
    .slice(0, 8);
  return out.length > 0 ? out : fallback;
}

export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  const { data } = await db().from("settings").select("*").eq("id", 1).single();
  const full = data ? rowToSettings(data) : DEFAULT_SETTINGS;

  // kredensial notifikasi hanya dikirim ke admin yang login
  if (await requireAdmin(req)) {
    const s = await readSecrets();
    return Response.json({
      ...full,
      notifyProvider: s.provider,
      notifyToken: s.token,
      notifyTarget: s.target,
      discordWebhook: s.discordWebhook,
    });
  }
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

  const row = {
    id: 1,
    name: String(body.name ?? DEFAULT_SETTINGS.name),
    tagline: String(body.tagline ?? DEFAULT_SETTINGS.tagline),
    whatsapp: String(body.whatsapp ?? DEFAULT_SETTINGS.whatsapp).replace(/[^0-9]/g, ""),
    address: String(body.address ?? DEFAULT_SETTINGS.address),
    hours: String(body.hours ?? DEFAULT_SETTINGS.hours),
    ongkir: Number(body.ongkir ?? DEFAULT_SETTINGS.ongkir) || 0,
    free_ongkir_min: Number(body.freeOngkirMin ?? DEFAULT_SETTINGS.freeOngkirMin) || 0,
    // v4: opsi layanan antar Xpress + keterangan ongkir
    xpress_ongkir: Number(body.xpressOngkir ?? DEFAULT_SETTINGS.xpressOngkir) || 0,
    xpress_label: String(body.xpressLabel ?? DEFAULT_SETTINGS.xpressLabel).slice(0, 80),
    ongkir_note: String(body.ongkirNote ?? "").slice(0, 600),
    // tampilan: warna tema, logo, banner promo
    color_primary: hexColor(body.colorPrimary, DEFAULT_SETTINGS.colorPrimary),
    color_dark: hexColor(body.colorDark, DEFAULT_SETTINGS.colorDark),
    logo_url: body.logoUrl ? String(body.logoUrl) : "",
    banners: bannerList(body.banners, DEFAULT_BANNERS),
  };

  // kolom v3/v4 mungkin belum ada bila SQL migrasi belum dijalankan —
  // coba versi lengkap, lalu kurangi bertahap agar pengaturan dasar tetap tersimpan
  const v4Keys = ["xpress_ongkir", "xpress_label", "ongkir_note"] as const;
  const v3Keys = ["color_primary", "color_dark", "logo_url", "banners"] as const;
  const drop = (obj: Record<string, unknown>, keys: readonly string[]) => {
    for (const k of keys) delete obj[k];
    return obj;
  };

  let error = (await db().from("settings").upsert(row)).error;
  let warning: string | undefined;
  if (error) {
    const partial = drop({ ...row }, v4Keys);
    error = (await db().from("settings").upsert(partial)).error;
    warning =
      "Pengaturan Xpress/keterangan ongkir belum tersimpan di database — jalankan sql/alter-v4.sql di Supabase SQL Editor.";
    if (error) {
      error = (await db().from("settings").upsert(drop(partial, v3Keys))).error;
      warning = error
        ? undefined
        : "Pengaturan tampilan & Xpress/ongkir belum tersimpan di database — jalankan sql/alter-v3.sql dan sql/alter-v4.sql di Supabase SQL Editor.";
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // kredensial notifikasi → tabel notify_secrets (token kosong = tidak diubah)
  if (
    body.notifyProvider !== undefined ||
    body.notifyToken !== undefined ||
    body.notifyTarget !== undefined
  ) {
    const sec = await writeSecrets(
      body.notifyProvider === "fonnte" ||
        body.notifyProvider === "telegram" ||
        body.notifyProvider === "discord"
        ? (body.notifyProvider as StoreSettings["notifyProvider"])
        : "off",
      body.notifyToken ? String(body.notifyToken) : "",
      body.notifyTarget ? String(body.notifyTarget) : "",
      body.discordWebhook !== undefined
        ? String(body.discordWebhook)
        : undefined,
    );
    warning = sec.warning;
  }

  return Response.json(warning ? { ok: true, warning } : { ok: true });
}
