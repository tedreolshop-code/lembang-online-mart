/** Pemeriksaan mandiri newOrderId + aturan filter /api/orders/lookup.
    Jalan: npx tsx scripts/check-order-code.ts   (keluar dengan error kalau gagal) */
import assert from "node:assert/strict";
import { newOrderId } from "../src/lib/format";

/** Cermin regex di src/app/api/orders/lookup/route.ts — 4 digit lama masih
    diterima supaya pesanan warisan tidak hilang dari halaman /pesanan. */
const LOOKUP_OK = /^LMB-[A-Z0-9]{4,12}$/;

// 1. format + alfabet tanpa I O 0 1
for (let i = 0; i < 500; i++) {
  const id = newOrderId();
  assert.match(id, /^LMB-[A-Z0-9]{8}$/, `format salah: ${id}`);
  assert.doesNotMatch(id, /[IO01]/, `kode bias: ${id}`);
  assert.ok(LOOKUP_OK.test(id), `ditolak endpoint lookup: ${id}`);
}

// 2. tidak ada tabrakan dari 5.000 kode (ruang kunci 32^8 ≈ 1,1 triliun)
const seen = new Set(Array.from({ length: 5000 }, () => newOrderId()));
assert.equal(seen.size, 5000, "ada tabrakan kode pesanan");

// 3. kompatibel baca: kode 4 digit warisan masih lolos, sampah tidak
assert.ok(LOOKUP_OK.test("LMB-8403"));
for (const bad of ["", "LMB-", "LMB-1", "LMB-abc-", "orders", "LMB-" + "A".repeat(13)]) {
  assert.ok(!LOOKUP_OK.test(bad), `lolos filter: ${bad}`);
}

console.log("ok — 5.500 kode pesanan valid, unik, dan lolos filter lookup");
