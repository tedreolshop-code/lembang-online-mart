import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { productToRow } from "@/lib/rows";
import { CATEGORIES, SEED_PRODUCTS } from "@/data/seed";
import { DEFAULT_SETTINGS } from "@/lib/config";

/** POST: isi data awal (kategori + produk seed + pengaturan) bila database
    masih kosong. Khusus admin — dipakai saat pertama kali pindah ke cloud. */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const { count } = await db()
    .from("products")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "Database sudah berisi produk — seed dilewati." },
      { status: 409 },
    );
  }

  await db().from("categories").upsert(
    CATEGORIES.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      tint: c.tint,
      sort: i,
    })),
  );

  await db().from("products").insert(
    SEED_PRODUCTS.map((p, i) => ({ ...productToRow(p), position: i })),
  );

  await db().from("settings").upsert({
    id: 1,
    name: DEFAULT_SETTINGS.name,
    tagline: DEFAULT_SETTINGS.tagline,
    whatsapp: DEFAULT_SETTINGS.whatsapp,
    address: DEFAULT_SETTINGS.address,
    hours: DEFAULT_SETTINGS.hours,
    ongkir: DEFAULT_SETTINGS.ongkir,
    free_ongkir_min: DEFAULT_SETTINGS.freeOngkirMin,
  });

  return Response.json({ ok: true, inserted: SEED_PRODUCTS.length });
}
