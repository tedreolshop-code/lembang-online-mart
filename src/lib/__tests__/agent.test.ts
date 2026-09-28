import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commissionFor,
  commissionBasis,
  marginCommission,
  isSelfPurchase,
  normalizeAgentCode,
  DEFAULT_COMMISSION_SETTINGS as S,
} from "../agent";

test("commissionBasis: subtotal vs setelah diskon", () => {
  assert.equal(commissionBasis(100000, 20000, "subtotal"), 100000);
  assert.equal(commissionBasis(100000, 20000, "after_discount"), 80000);
  // tidak pernah negatif
  assert.equal(commissionBasis(10000, 20000, "after_discount"), 0);
});

test("commissionFor persen khusus agen menang & dibulatkan Rp100", () => {
  assert.deepEqual(commissionFor(100000, 10, S), { percent: 10, amount: 10000 });
});

test("commissionFor menghormati plafon (maxAmount)", () => {
  assert.equal(commissionFor(1000000, 10, { ...S, maxAmount: 20000 }).amount, 20000);
});

test("commissionFor nominal tetap & lantai (minAmount)", () => {
  assert.equal(
    commissionFor(50000, null, { ...S, kind: "fixed", value: 3000, minAmount: 4000 }).amount,
    4000,
  );
});

test("commissionFor 0 bila program nonaktif / di bawah minimum belanja", () => {
  assert.equal(commissionFor(100000, 10, { ...S, aktif: false }).amount, 0);
  assert.equal(commissionFor(1000, 10, { ...S, minOrderAmount: 5000 }).amount, 0);
});

test("marginCommission = max(0, subtotal − HPP)", () => {
  assert.equal(marginCommission(30000, 21000), 9000);
  assert.equal(marginCommission(10000, 12000), 0);
});

test("isSelfPurchase menyamakan format nomor WA", () => {
  assert.equal(isSelfPurchase("0812-3456-7890", "6281234567890"), true);
  assert.equal(isSelfPurchase("081200000000", "6281234567890"), false);
});

test("normalizeAgentCode: uppercase & buang non-alfanumerik", () => {
  assert.equal(normalizeAgentCode(" ag-x7k2m "), "AGX7K2M");
});
