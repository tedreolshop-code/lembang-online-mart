import { test } from "node:test";
import assert from "node:assert/strict";
import { couponDiscount, normalizeCoupon } from "../coupon";
import type { Coupon } from "../types";

const base: Coupon = {
  code: "HEMAT10",
  label: "",
  kind: "percent",
  value: 10,
  minSubtotal: 0,
  maxUses: null,
  usedCount: 0,
  active: true,
  expiresAt: null,
};

test("voucher persen dibulatkan ke Rp100 terdekat", () => {
  assert.equal(couponDiscount(base, 30000).discount, 3000);
  // 10% dari 15.490 = 1.549 → 1.500
  assert.equal(couponDiscount(base, 15490).discount, 1500);
});

test("voucher nominal tidak melebihi subtotal", () => {
  assert.equal(
    couponDiscount({ ...base, kind: "fixed", value: 5000 }, 3000).discount,
    3000,
  );
});

test("voucher nonaktif / kedaluwarsa / kuota habis / min belanja ditolak", () => {
  assert.equal(couponDiscount({ ...base, active: false }, 50000).ok, false);
  assert.equal(couponDiscount({ ...base, expiresAt: "2000-01-01" }, 50000).ok, false);
  assert.equal(couponDiscount({ ...base, maxUses: 1, usedCount: 1 }, 50000).ok, false);
  assert.equal(couponDiscount({ ...base, minSubtotal: 50000 }, 10000).ok, false);
});

test("normalizeCoupon memvalidasi persen 1–90 & nominal minimal Rp500", () => {
  assert.throws(() => normalizeCoupon({ code: "X", kind: "percent", value: 0 }));
  assert.throws(() => normalizeCoupon({ code: "X", kind: "percent", value: 95 }));
  assert.throws(() => normalizeCoupon({ code: "X", kind: "fixed", value: 100 }));
  assert.throws(() => normalizeCoupon({ code: "!!!", kind: "percent", value: 10 }));
  assert.equal(normalizeCoupon({ code: "hemat10", kind: "percent", value: 10 }).code, "HEMAT10");
});
