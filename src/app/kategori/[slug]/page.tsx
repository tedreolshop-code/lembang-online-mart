"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useProducts } from "@/lib/store";
import { useCategoryCatalog } from "@/lib/category-store";
import CategoryStatus from "@/components/CategoryStatus";
import ProductCard from "@/components/ProductCard";

type SortKey = "populer" | "murah" | "mahal";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "populer", label: "Paling Populer" },
  { key: "murah", label: "Harga Terendah" },
  { key: "mahal", label: "Harga Tertinggi" },
];

export default function KategoriDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const products = useProducts();
  const { categories, ready, error, refresh } = useCategoryCatalog();
  const [sort, setSort] = useState<SortKey>("populer");

  const cat = categories.find((category) => category.slug === slug);

  const items = useMemo(() => {
    const filtered = products.filter((p) => p.category === slug);
    switch (sort) {
      case "murah":
        return [...filtered].sort((a, b) => a.price - b.price);
      case "mahal":
        return [...filtered].sort((a, b) => b.price - a.price);
      default:
        return [...filtered].sort(
          (a, b) =>
            Number(b.isBestSeller ?? false) - Number(a.isBestSeller ?? false),
        );
    }
  }, [products, slug, sort]);

  if (!ready) return <CategoryStatus />;
  if (!cat && error) return (
    <div role="status" className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
      Kategori belum dapat dimuat.
      <button type="button" onClick={() => void refresh()} className="ml-2 font-bold text-brand">Coba lagi</button>
    </div>
  );
  if (!cat) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl">🤔</p>
        <h1 className="mt-2 text-lg font-bold text-slate-700">
          Kategori tidak ditemukan
        </h1>
        <Link
          href="/kategori"
          className="mt-4 inline-block rounded-full bg-brand px-5 py-2 text-sm font-bold text-white"
        >
          Lihat Semua Kategori
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div
        className="mb-5 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: cat.tint }}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          {cat.emoji}
        </span>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 sm:text-xl">
            {cat.name}
          </h1>
          <p className="text-xs text-slate-500">{items.length} produk</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto text-xs sm:text-sm">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSort(o.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold transition ${
                sort === o.key
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand/40"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
          Belum ada produk di kategori ini.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
