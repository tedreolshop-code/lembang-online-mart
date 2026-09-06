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
    // tampilan: warna tema, logo, banner promo
    color_primary: hexColor(body.colorPrimary, DEFAULT_SETTINGS.colorPrimary),
    color_dark: hexColor(body.colorDark, DEFAULT_SETTINGS.colorDark),
    logo_url: body.logoUrl ? String(body.logoUrl) : "",
    banners: bannerList(body.banners, DEFAULT_BANNERS),
  };

  const { error } = await db().from("settings").upsert(row);
  if (error) {
    // kolom tampilan belum ada (migrasi sql/alter-v3.sql belum dijalankan)?
    // simpan dulu data dasar agar pengaturan lain tetap berfungsi.
    const base: Record<string, unknown> = { ...row };
    delete base.color_primary;
    delete base.color_dark;
    delete base.logo_url;
    delete base.banners;
    const retry = await db().from("settings").upsert(base);
    if (retry.error) {
      return Response.json({ error: retry.error.message }, { status: 500 });
    }
    return Response.json({
      ok: true,
      warning:
        "Pengaturan tampilan (warna/logo/banner) belum tersimpan di database — jalankan sql/alter-v3.sql di Supabase SQL Editor.",
    });
  }

  let warning: string | undefined;

  // kredensial notifikasi → tabel notify_secrets (token kosong = tidak diubah)
  if (
    body.notifyProvider !== undefined ||
    body.notifyToken !== undefined ||
    body.notifyTarget !== undefined
  ) {
    const sec = await writeSecrets(
      body.notifyProvider === "fonnte" || body.notifyProvider === "telegram"
        ? (body.notifyProvider as StoreSettings["notifyProvider"])
        : "off",
      body.notifyToken ? String(body.notifyToken) : "",
      body.notifyTarget ? String(body.notifyTarget) : "",
    );
    warning = sec.warning;
  }

  return Response.json(warning ? { ok: true, warning } : { ok: true });
}
