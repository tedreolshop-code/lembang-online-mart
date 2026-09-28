import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tierFor,
  unitPrice,
  unitPriceWithAgent,
  normalizeTiers,
} from "../pricing";

test("tierFor memilih tier dengan minQty terbesar yang tercapai", () => {
  const tiers = [
    { minQty: 5, price: 900 },
    { minQty: 10, price: 800 },
  ];
  assert.equal(tierFor(tiers, 4), null);
  assert.equal(tierFor(tiers, 5)?.price, 900);
  assert.equal(tierFor(tiers, 12)?.price, 800);
});

test("unitPrice memakai harga grosir hanya bila lebih murah", () => {
  assert.equal(unitPrice({ price: 1000, tiers: [{ minQty: 5, price: 900 }] }, 1), 1000);
  assert.equal(unitPrice({ price: 1000, tiers: [{ minQty: 5, price: 900 }] }, 5), 900);
  // tier lebih mahal dari harga normal → diabaikan
  assert.equal(
    unitPrice({ price: 1000, tiers: [{ minQty: 5, price: 1200 }] }, 5),
    1000,
  );
});

test("unitPriceWithAgent: harga agen dipakai HANYA bila lebih murah", () => {
  const p = { id: "x", price: 10000, tiers: [] };
  assert.equal(unitPriceWithAgent(p, 1, [{ productId: "x", price: 8000 }]), 8000);
  assert.equal(unitPriceWithAgent(p, 1, [{ productId: "x", price: 12000 }]), 10000);
  assert.equal(unitPriceWithAgent(p, 1, []), 10000);
});

test("unitPriceWithAgent tetap menghormati harga grosir", () => {
  const p = { id: "x", price: 10000, tiers: [{ minQty: 5, price: 9000 }] };
  assert.equal(unitPriceWithAgent(p, 5, [{ productId: "x", price: 9500 }]), 9000);
});

test("normalizeTiers menyaring tier tidak valid & mengurutkan", () => {
  const out = normalizeTiers(
    [
      { minQty: 1, price: 900 }, // minQty harus > 1 → dibuang
      { minQty: 5, price: 900 },
      { minQty: 5, price: 800 }, // duplikat minQty → dibuang
      { minQty: 10, price: 1200 }, // >= harga normal → dibuang
      { minQty: 20, price: 700 },
    ],
    1000,
  );
  assert.deepEqual(out, [
    { minQty: 5, price: 900 },
    { minQty: 20, price: 700 },
  ]);
});
