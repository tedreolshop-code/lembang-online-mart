"use client";

import { useState } from "react";
import { useProducts, adjustStock, setStock } from "@/lib/store";
import { StatCard } from "@/components/admin/ui";
import type { Product } from "@/lib/types";

const STOK_MENIPIS = 5;

function StokTab() {
  const products = useProducts();
  const [q, setQ] = useState("");

  const list = products
    .filter(
      (p) =>
        !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()),
    )
    .sort((a, b) => a.stock - b.stock);
  const habis = products.filter((p) => p.stock <= 0).length;
  const menipis = products.filter(
    (p) => p.stock > 0 && p.stock <= STOK_MENIPIS,
  ).length;

  return (
    <div>
      <div className="mb-3 grid max-w-md grid-cols-3 gap-2">
        <StatCard label="Total Produk" value={products.length} tone="normal" />
        <StatCard label="Stok Menipis" value={menipis} tone="warn" />
        <StatCard label="Habis" value={habis} tone="danger" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari produk…"
          className="input max-w-xs"
        />
        <span className="text-xs text-slate-400">
          Stok paling sedikit tampil paling atas
        </span>
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Stok</th>
              <th className="px-3 py-2.5 text-right">Atur Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((p) => (
              <StokRow key={p.id} product={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StokRow({ product: p }: { product: Product }) {
  const [draft, setDraft] = useState<string | null>(null);
  const tampil = draft ?? String(p.stock);

  const badge =
    p.stock <= 0 ? (
      <span className="rounded bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
        HABIS
      </span>
    ) : p.stock <= STOK_MENIPIS ? (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
        MENIPIS
      </span>
    ) : (
      <span className="text-[11px] text-slate-400">aman</span>
    );

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">{p.emoji}</span>
          <div>
            <div className="font-bold text-slate-700">{p.name}</div>
            <div className="text-[11px] text-slate-400">{p.unit}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">{badge}</td>
      <td className="px-3 py-2.5">
        <span
          className={`font-extrabold ${
            p.stock <= 0 ? "text-brand" : "text-slate-800"
          }`}
        >
          {p.stock}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label={`Kurangi stok ${p.name}`}
            onClick={() => adjustStock(p.id, -1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Tambah stok ${p.name}`}
            onClick={() => adjustStock(p.id, 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            +
          </button>
          <input
            value={tampil}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand"
            aria-label={`Set stok ${p.name}`}
          />
          <button
            type="button"
            onClick={() => {
              setStock(p.id, Number(draft || 0));
              setDraft(null);
            }}
            disabled={draft === null}
            className="rounded-lg bg-navy px-2.5 py-1 text-xs font-bold text-white transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Set
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── tab laporan ──────────────────────────────────────────────── */

export default StokTab;
