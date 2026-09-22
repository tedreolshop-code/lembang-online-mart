"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useFavorites, toggleFavorite } from "@/lib/store";
import { formatRupiah, discountPercent } from "@/lib/format";
import { bestTier } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import ProductImage from "./ProductImage";
import { HeartIcon, PlusIcon } from "./Icons";

/** Kartu produk ala mockup: foto di atas, tombol + oranye di pojok kanan
    atas, nama & harga di tengah bawah. */
export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const favorites = useFavorites();
  const isFav = favorites.includes(product.id);
  const diskon = discountPercent(product.price, product.oldPrice);
  const habis = product.stock <= 0;
  const grosir = bestTier(product.tiers); // harga termurah utk badge "Grosir ≥n"

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200">
      {/* gambar */}
      <Link href={`/produk/${product.id}`} className="relative block h-32 sm:h-44">
        <ProductImage
          product={product}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          emojiClassName="text-5xl sm:text-6xl"
        />

        {/* badge diskon & label */}
        <div className="absolute bottom-2 left-2 flex gap-1">
          {diskon && (
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
              -{diskon}%
            </span>
          )}
          {product.isBestSeller && (
            <span className="rounded-md bg-navy px-1.5 py-0.5 text-[10px] font-bold text-white">
              TERLARIS
            </span>
          )}
          {product.isNew && (
            <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
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

      {/* favorit (kiri atas) */}
      <button
        type="button"
        aria-label={isFav ? "Hapus dari favorit" : "Tambah ke favorit"}
        onClick={() => toggleFavorite(product.id)}
        className={`absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition ${
          isFav
            ? "bg-brand-soft text-brand"
            : "bg-white/90 text-slate-400 hover:text-brand"
        }`}
      >
        <HeartIcon className="h-3.5 w-3.5" filled={isFav} />
      </button>

      {/* tombol + oranye (kanan atas, ala mockup) */}
      <button
        type="button"
        disabled={habis}
        aria-label={`Tambah ${product.name} ke keranjang`}
        onClick={() => addItem(product.id)}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-md transition hover:bg-brand-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-10 sm:w-10"
      >
        <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {/* info: nama, satuan, harga — di tengah ala mockup */}
      <div className="flex flex-1 flex-col items-center gap-0.5 p-2.5 text-center sm:p-3">
        <Link
          href={`/produk/${product.id}`}
          className="line-clamp-2 min-h-9 text-[13px] font-bold leading-snug text-navy hover:text-brand sm:min-h-10 sm:text-sm"
        >
          {product.name}
        </Link>
        <span className="text-[11px] text-slate-400">{product.unit}</span>

        <div className="mt-auto pt-1">
          {product.oldPrice && (
            <span className="mr-1.5 text-[11px] text-slate-400 line-through">
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
          {grosir && (
            <span className="mt-0.5 block text-[10px] font-bold text-emerald-600">
              Grosir ≥{grosir.minQty}: {formatRupiah(grosir.price)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
