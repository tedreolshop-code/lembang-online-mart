"use client";

import Link from "next/link";
import { useFavorites, useProducts } from "@/lib/store";
import ProductCard from "@/components/ProductCard";

export default function FavoritPage() {
  const favorites = useFavorites();
  const products = useProducts();
  const items = products.filter((p) => favorites.includes(p.id));

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Produk Favorit ❤️
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Barang yang kamu tandai dengan hati, biar gampang dicari lagi
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-5xl">🤍</p>
          <p className="mt-3 font-bold text-slate-700">
            Belum ada produk favorit
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Tekan ikon hati di kartu produk untuk menyimpannya di sini.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow"
          >
            Cari Barang
          </Link>
        </div>
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
