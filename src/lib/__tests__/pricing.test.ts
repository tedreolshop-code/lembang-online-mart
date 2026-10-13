import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanPackSize,
  lineSubtotal,
  normalizeTiers,
  packOptions,
  tierFor,
  unitPrice,
  unitPriceWithAgent,
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

test("cleanPackSize hanya menerima isi kemasan bulat > 1", () => {
  assert.equal(cleanPackSize(10), 10);
  assert.equal(cleanPackSize("40"), 40);
  // 1 pcs = satuan (sudah harga jual), bukan kemasan
  assert.equal(cleanPackSize(1), undefined);
  assert.equal(cleanPackSize(0), undefined);
  assert.equal(cleanPackSize(-5), undefined);
  assert.equal(cleanPackSize("abc"), undefined);
  assert.equal(cleanPackSize(undefined), undefined);
});

test("packOptions: satuan selalu ada, pack/dus ikut isi kemasan", () => {
  const p = {
    price: 3500,
    tiers: [
      { minQty: 10, price: 3400 },
      { minQty: 40, price: 3300 },
    ],
    packSize: 10,
    dusSize: 40,
  };
  assert.deepEqual(packOptions(p), [
    { kind: "satuan", size: 1, price: 3500, total: 3500 },
    { kind: "pack", size: 10, price: 3400, total: 34000 },
    { kind: "dus", size: 40, price: 3300, total: 132000 },
  ]);
  // tanpa isi kemasan → hanya satuan
  assert.deepEqual(packOptions({ price: 3500, tiers: [] }), [
    { kind: "satuan", size: 1, price: 3500, total: 3500 },
  ]);
});

test("packOptions: harga kemasan = harga yang ditagih keranjang", () => {
  // tanpa tingkat grosir, kemasan tetap tampil dengan harga satuan
  const polos = { price: 1000, tiers: [], packSize: 5, dusSize: 20 };
  // isi kemasan yang lebih besar mencakup tingkat grosir di bawahnya
  const bertingkat = {
    price: 1000,
    tiers: [{ minQty: 10, price: 900 }],
    packSize: 10,
    dusSize: 40,
  };
  for (const p of [polos, bertingkat]) {
    for (const o of packOptions(p)) {
      // satu-satunya kebenaran: total = lineSubtotal pada jumlah itu
      assert.equal(o.total, lineSubtotal(p, o.size));
    }
  }
  assert.deepEqual(packOptions(bertingkat), [
    { kind: "satuan", size: 1, price: 1000, total: 1000 },
    { kind: "pack", size: 10, price: 900, total: 9000 },
    // 40 pcs tanpa tingkat 40 → memakai tingkat ≥10
    { kind: "dus", size: 40, price: 900, total: 36000 },
  ]);
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
