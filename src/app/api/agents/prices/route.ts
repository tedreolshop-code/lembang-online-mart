import { db, isCloud, cloudRequired, requireAdmin, unauthorized } from "@/lib/db";
import { normalizeAgentCode, rowToAgentPrice } from "@/lib/agent";

/** Harga khusus agen per produk (v9). Admin mengatur lewat tab Agen;
    pembeli yang datang dari tautan agen membacanya untuk ditampilkan
    (tagihan tetap dihitung ulang `create_order` di database). */

const MISSING_MSG =
  "Tabel agent_prices belum ada — jalankan sql/alter-v9.sql di Supabase SQL Editor.";
const isMissing = (msg: string) =>
  /agent_prices|relation|Could not find|does not exist/i.test(msg);

/** GET: ?agent=CODE → harga khusus agen itu.
    Tanpa parameter → seluruh tabel (admin butuh untuk preload).
    Membaca harga SATU agen tidak butuh sesi admin: pembeli dari tautan agen
    harus melihat angka yang sama dengan tagihan; data pribadi agen (WA,
    rekening) tidak tersimpan di tabel ini. Membaca seluruh tabel tetap
    khusus admin. */
export async function GET(req: Request) {
  if (!isCloud) return cloudRequired();

  const url = new URL(req.url);
  const agent = normalizeAgentCode(url.searchParams.get("agent") ?? "");
  if (!agent && !(await requireAdmin(req))) return unauthorized();

  let query = db().from("agent_prices").select("agent_code,product_id,price");
  if (agent) query = query.eq("agent_code", agent);
  query = query.order("agent_code", { ascending: true });

  const { data, error } = await query;
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? MISSING_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json((data ?? []).map(rowToAgentPrice));
}

/** POST: simpan / perbarui satu baris harga agen.
    Body: { agentCode, productId, price } */
export async function POST(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body kosong." }, { status: 400 });

  const agentCode = normalizeAgentCode(body.agentCode ?? "");
  const productId = String(body.productId ?? "").trim();
  const price = Math.round(Number(body.price ?? 0));

  if (!agentCode || !productId) {
    return Response.json(
      { error: "Kode agen & ID produk wajib diisi." },
      { status: 400 },
    );
  }
  if (price <= 0) {
    return Response.json(
      { error: "Harga harus lebih dari 0." },
      { status: 400 },
    );
  }

  const { error } = await db()
    .from("agent_prices")
    .upsert({
      agent_code: agentCode,
      product_id: productId,
      price,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? MISSING_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}

/** DELETE: ?agent=CODE&product=ID → hapus satu baris.
    ?agent=CODE (tanpa product) → hapus semua harga agen itu. */
export async function DELETE(req: Request) {
  if (!isCloud) return cloudRequired();
  if (!(await requireAdmin(req))) return unauthorized();

  const url = new URL(req.url);
  const agent = normalizeAgentCode(url.searchParams.get("agent") ?? "");
  const product = url.searchParams.get("product") ?? "";

  if (!agent) {
    return Response.json({ error: "Kode agen wajib diisi." }, { status: 400 });
  }

  let query = db().from("agent_prices").delete();
  query = query.eq("agent_code", agent);
  if (product) query = query.eq("product_id", product);

  const { error } = await query;
  if (error) {
    return Response.json(
      { error: isMissing(error.message) ? MISSING_MSG : error.message },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}
