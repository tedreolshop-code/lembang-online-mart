/* Isi database Supabase dengan kategori + produk seed + pengaturan awal.
   Setara tombol "Muat Data Awal ke Database" di admin — bisa dipakai
   dari terminal tanpa login. Aman dijalankan ulang (tidak menimpa yang
   sudah ada, bila dipanggil dengan --force akan menimpa produk seed).
   Jalankan: npx tsx scripts/seed-db.ts [--force] */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, SEED_PRODUCTS } from "../src/data/seed";
import { DEFAULT_SETTINGS } from "../src/lib/config";

// baca kredensial dari .env tanpa menampilkan isinya
const env: Record<string, string> = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("✗ SUPABASE_SERVICE_ROLE_KEY tidak ada di .env");
  process.exit(1);
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const force = process.argv.includes("--force");

async function main() {
  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true });
  const existing = count ?? 0;

  if (existing > 0 && !force) {
    console.log(
      `database sudah berisi ${existing} produk — lewati. (pakai --force untuk menimpa produk seed)`,
    );
    return;
  }

  const { error: e1 } = await db.from("categories").upsert(
    CATEGORIES.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      tint: c.tint,
      sort: i,
    })),
  );
  if (e1) throw new Error("kategori: " + e1.message);
  console.log("✓ kategori:", CATEGORIES.length);

  const rows = SEED_PRODUCTS.map((p, i) => ({
    id: p.id,
    name: p.name,
    category_slug: p.category,
    price: p.price,
    old_price: p.oldPrice ?? null,
    unit: p.unit,
    emoji: p.emoji,
    image_url: p.image ?? null,
    stock: p.stock,
    is_promo: !!p.isPromo,
    is_bestseller: !!p.isBestSeller,
    is_new: !!p.isNew,
    description: p.description ?? null,
    position: i,
  }));
  const { error: e2 } = await db.from("products").upsert(rows);
  if (e2) throw new Error("produk: " + e2.message);
  console.log("✓ produk:", rows.length);

  const { error: e3 } = await db.from("settings").upsert({
    id: 1,
    name: DEFAULT_SETTINGS.name,
    tagline: DEFAULT_SETTINGS.tagline,
    whatsapp: DEFAULT_SETTINGS.whatsapp,
    address: DEFAULT_SETTINGS.address,
    hours: DEFAULT_SETTINGS.hours,
    ongkir: DEFAULT_SETTINGS.ongkir,
    free_ongkir_min: DEFAULT_SETTINGS.freeOngkirMin,
    notify_provider: DEFAULT_SETTINGS.notifyProvider,
    notify_token: "",
    notify_target: "",
  });
  if (e3) throw new Error("pengaturan: " + e3.message);
  console.log("✓ pengaturan awal terisi");
}

main()
  .then(() => {
    console.log("SEED SELESAI — cek https://lembang-online-store.vercel.app");
  })
  .catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  });
