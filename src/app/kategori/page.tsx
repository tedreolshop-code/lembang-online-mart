"use client";

import Link from "next/link";
import { useProducts } from "@/lib/store";
import { useCategories } from "@/lib/category-store";
import CategoryStatus from "@/components/CategoryStatus";
import { ChevronRightIcon } from "@/components/Icons";

export default function KategoriPage() {
  const products = useProducts();
  const categories = useCategories();

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Semua Kategori 🛒
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Pilih kategori untuk melihat barang di warung kami
      </p>

      <CategoryStatus />
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((c) => {
          const items = products.filter((p) => p.category === c.slug);
          return (
            <Link
              key={c.slug}
              href={`/kategori/${c.slug}`}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand/40 hover:shadow-md"
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl"
                style={{ background: c.tint }}
              >
                {c.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-bold text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-500">
                  {items.length} produk tersedia
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 text-slate-300" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
