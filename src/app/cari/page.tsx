"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts } from "@/lib/store";
import { CATEGORIES } from "@/data/seed";
import ProductCard from "@/components/ProductCard";
import { SearchIcon } from "@/components/Icons";

function CariContent() {
  const params = useSearchParams();
  const products = useProducts();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState<string>("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const promoOnly = params.get("filter") === "promo";
    return products.filter((p) => {
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.unit.toLowerCase().includes(query);
      const matchCat = !cat || p.category === cat;
      const matchPromo = !promoOnly || p.isPromo === true;
      return matchQuery && matchCat && matchPromo;
    });
  }, [products, q, cat, params]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <SearchIcon className="h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari barang di warung…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          aria-label="Cari produk"
        />
      </div>

      {/* filter kategori */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          active={cat === ""}
          onClick={() => setCat("")}
          label="Semua"
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.slug}
            active={cat === c.slug}
            onClick={() => setCat(cat === c.slug ? "" : c.slug)}
            label={`${c.emoji} ${c.name}`}
          />
        ))}
      </div>

      <p className="mb-3 mt-4 text-sm text-slate-500">
        {q.trim() || cat ? (
          <>
            Ditemukan <b className="text-slate-700">{results.length}</b> produk
          </>
        ) : (
          "Menampilkan semua produk"
        )}
      </p>

      {results.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-bold text-slate-700">
            Barang tidak ditemukan
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Coba kata kunci lain, atau tanyakan lewat WhatsApp kami.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
        active
          ? "border-navy bg-navy text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-navy/40"
      }`}
    >
      {label}
    </button>
  );
}

export default function CariPage() {
  return (
    <Suspense>
      <CariContent />
    </Suspense>
  );
}
