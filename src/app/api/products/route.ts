import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { rowToProduct, productToRow, withoutCostPrice } from "@/lib/rows";
import { replaceProductTiers, tiersForProducts } from "@/lib/product-tiers";

/** GET: katalog produk.
    HPP (costPrice) HANYA dikirim bila pemanggilnya admin terdaftar — halaman
    publik memakai endpoint yang sama, jadi tanpa pembedaan ini modal usaha
    ikut terkirim ke setiap pengunjung. */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();
  const isAdmin = !!(await requireAdmin(req));

  const { data, error } = await db()
    .from("products")
    .select("*")
    .order("position", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // harga grosir (v6). Bila migrasi belum dijalankan, katalog tetap dikirim
  // tanpa tier supaya toko tidak ikut mati.
  const byProduct = await tiersForProducts(
    db(),
    (data ?? []).map((r) => r.id as string),
  );

  return Response.json(
    (data ?? []).map((r) => {
      const p = rowToProduct(r);
      const tiers = byProduct.get(p.id);
      const withTiers =
        tiers && tiers.length > 0 ? { ...p, tiers } : p;
      return isAdmin ? withTiers : withoutCostPrice(withTiers);
    }),
    // URL yang sama kini berisi berbeda tergantung token: pastikan tidak ada
    // cache bersama yang menyimpan respons admin lalu menyajikannya ke publik.
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json();
  if (!body?.name || !(body.price > 0)) {
    return Response.json({ error: "Nama & harga wajib diisi." }, { status: 400 });
  }

  // id = slug nama; beri sufiks bila sudah dipakai
  let id = String(body.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `produk-${Date.now()}`;
  const { data: existing } = await db()
    .from("products")
    .select("id")
    .eq("id", id);
  if (existing && existing.length > 0) id = `${id}-${Date.now() % 100000}`;

  const { data: maxRow } = await db()
    .from("products")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const row = {
    ...productToRow({ ...body, id }),
    position: (maxRow?.[0]?.position ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("products").insert(row).select();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const created = rowToProduct(data![0]);

  // tier grosir (v6) ikut tersimpan bila form mengirim daftar tier
  if (Array.isArray(body.tiers) && body.tiers.length > 0) {
    try {
      const saved = await replaceProductTiers(db(), id, body.tiers, created.price);
      if (saved.length > 0) created.tiers = saved;
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Gagal menyimpan harga grosir." },
        { status: 500 },
      );
    }
  }
  return Response.json(created);
}
