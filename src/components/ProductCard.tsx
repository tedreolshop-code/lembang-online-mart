"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useFavorites, toggleFavorite } from "@/lib/store";
import { formatRupiah, discountPercent } from "@/lib/format";
import type { Product } from "@/lib/types";
import ProductImage from "./ProductImage";
import { HeartIcon, PlusIcon } from "./Icons";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const favorites = useFavorites();
  const isFav = favorites.includes(product.id);
  const diskon = discountPercent(product.price, product.oldPrice);
  const habis = product.stock <= 0;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200">
      {/* gambar */}
      <Link
        href={`/produk/${product.id}`}
        className="relative block h-28 sm:h-36"
      >
        <ProductImage
          product={product}
          className="h-full w-full transition-transform duration-200 group-hover:scale-110"
          emojiClassName="text-5xl sm:text-6xl"
        />

        {/* badge diskon */}
        {diskon && (
          <span className="absolute left-2 top-2 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{diskon}%
          </span>
        )}

        {/* badge label */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {product.isBestSeller && (
            <span className="rounded bg-navy px-1.5 py-0.5 text-[10px] font-bold text-white">
              TERLARIS
            </span>
          )}
          {product.isNew && (
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              BARU
            </span>
          )}
        </div>

        {habis && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-bold text-slate-600">
            STOK HABIS
          </span>
        )}
      </Link>

      {/* favorit */}
      <button
        type="button"
        aria-label={isFav ? "Hapus dari favorit" : "Tambah ke favorit"}
        onClick={() => toggleFavorite(product.id)}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition ${
          isFav
            ? "bg-brand-soft text-brand"
            : "bg-white/90 text-slate-400 hover:text-brand"
        }`}
      >
        <HeartIcon className="h-4 w-4" filled={isFav} />
      </button>

      {/* info */}
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        <Link
          href={`/produk/${product.id}`}
          className="line-clamp-2 min-h-9 text-[13px] font-semibold leading-snug text-slate-800 hover:text-brand sm:min-h-10 sm:text-sm"
        >
          {product.name}
        </Link>
        <span className="text-[11px] text-slate-400">{product.unit}</span>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {product.oldPrice && (
              <span className="block text-[11px] text-slate-400 line-through">
                {formatRupiah(product.oldPrice)}
              </span>
            )}
            <span
              className={`text-sm font-extrabold sm:text-base ${
                habis ? "text-slate-400" : "text-brand"
              }`}
            >
              {formatRupiah(product.price)}
            </span>
          </div>

          <button
            type="button"
            disabled={habis}
            aria-label={`Tambah ${product.name} ke keranjang`}
            onClick={() => addItem(product.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
