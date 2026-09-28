"use client";

import { useState } from "react";
import { useOrders, useProducts } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import { TabButton, StatCard } from "@/components/admin/ui";

type Periode = "hari" | "7hari" | "30hari" | "semua";

const PERIODE_LABEL: Record<Periode, string> = {
  hari: "Hari Ini",
  "7hari": "7 Hari",
  "30hari": "30 Hari",
  semua: "Semua",
};

function LaporanTab() {
  const orders = useOrders();
  const products = useProducts();
  const [period, setPeriod] = useState<Periode>("hari");

  /* eslint-disable react-hooks/purity -- cut-off laporan: waktu dibaca saat
     render (bukan state) dan tidak perlu memicu render ulang. */
  const since =
    period === "hari"
      ? new Date().setHours(0, 0, 0, 0)
      : period === "7hari"
        ? Date.now() - 7 * 86400000
        : period === "30hari"
          ? Date.now() - 30 * 86400000
          : 0;
  /* eslint-enable react-hooks/purity */

  const valid = orders.filter(
    (o) => o.status !== "dibatalkan" && o.createdAt >= since,
  );
  const omzet = valid.reduce((a, o) => a + o.total, 0);
  const barang = valid.reduce(
    (a, o) => a + o.items.reduce((s, i) => s + i.qty, 0),
    0,
  );
  // laba kotor (v7): omzet − HPP snapshot per item. Item dengan HPP 0
  // (belum diisi) ikut omzet tapi tanpa modal, jadi laba tampak lebih besar.
  const hpp = valid.reduce(
    (a, o) => a + o.items.reduce((s, i) => s + i.qty * (i.costPrice ?? 0), 0),
    0,
  );
  const laba = omzet - hpp;
  const hppKurang = products.filter((x) => !x.costPrice).length;

  const top = new Map<
    string,
    { emoji: string; name: string; qty: number; omzet: number; hpp: number }
  >();
  for (const o of valid) {
    for (const i of o.items) {
      const cur = top.get(i.productId) ?? {
        emoji: i.emoji,
        name: i.name,
        qty: 0,
        omzet: 0,
        hpp: 0,
      };
      cur.qty += i.qty;
      cur.omzet += i.price * i.qty;
      cur.hpp += i.qty * (i.costPrice ?? 0);
      top.set(i.productId, cur);
    }
  }
  const topList = [...top.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const dibatalkan = orders.filter(
    (o) => o.status === "dibatalkan" && o.createdAt >= since,
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
          <TabButton key={p} active={period === p} onClick={() => setPeriod(p)}>
            {PERIODE_LABEL[p]}
          </TabButton>
        ))}
      </div>

      <div className="mb-2 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Omzet" value={omzet} tone="normal" isRupiah />
        <StatCard label="Laba Kotor" value={laba} tone="normal" isRupiah />
        <StatCard label="Modal (HPP)" value={hpp} tone="normal" isRupiah />
        <StatCard label="Transaksi" value={valid.length} tone="normal" />
        <StatCard label="Barang Terjual" value={barang} tone="normal" />
      </div>
      {hppKurang > 0 && (
        <p className="mb-4 text-xs text-slate-400">
          ⚠️ Harga Beli/HPP belum diisi untuk {hppKurang} produk — laba di atas
          kelebihan karena barang itu dihitung tanpa modal. Isi di Admin →
          Produk pada kolom Harga Beli / HPP.
        </p>
      )}

      {dibatalkan > 0 && (
        <p className="mb-4 text-xs text-slate-400">
          {dibatalkan} pesanan dibatalkan tidak ikut dihitung.
        </p>
      )}

      <h3 className="mb-2 font-extrabold text-slate-800">
        Produk Paling Laris {period === "semua" ? "" : `(${PERIODE_LABEL[period]})`}
      </h3>
      {topList.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Belum ada penjualan pada periode ini. 📈
        </div>
      ) : (
        <div className="max-w-xl overflow-x-auto overscroll-x-contain rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Produk</th>
                <th className="px-3 py-2.5">Terjual</th>
                <th className="px-3 py-2.5 text-right">Omzet (Laba)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topList.map((t, i) => (
                <tr key={t.id}>
                  <td className="px-3 py-2.5">
                    <span className="mr-1 text-slate-300">#{i + 1}</span>
                    {t.emoji} <b className="text-slate-700">{t.name}</b>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-700">
                    {t.qty}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-brand">
                    {formatRupiah(t.omzet)}
                    {t.hpp > 0 && (
                      <div className="text-[11px] font-semibold text-slate-400">
                        laba {formatRupiah(t.omzet - t.hpp)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── tab pesanan ──────────────────────────────────────────────── */

export default LaporanTab;
