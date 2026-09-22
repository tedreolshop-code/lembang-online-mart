"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useFavorites, useProduct, useProducts, toggleFavorite } from "@/lib/store";
import { formatRupiah, discountPercent } from "@/lib/format";
import { unitPrice } from "@/lib/pricing";
import { useCategories } from "@/lib/category-store";
import { useSettings } from "@/lib/store";
import ProductCard from "@/components/ProductCard";
import ProductImage from "@/components/ProductImage";
import SectionHeader from "@/components/SectionHeader";
import QtySelector from "@/components/QtySelector";
import {
  CartIcon,
  CheckIcon,
  HeartIcon,
  TruckIcon,
} from "@/components/Icons";

export default function ProdukDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id);
  const products = useProducts();
  const categories = useCategories();
  const settings = useSettings();
  const { addItem } = useCart();
  const favorites = useFavorites();
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl">🤔</p>
        <h1 className="mt-2 text-lg font-bold text-slate-700">
          Produk tidak ditemukan
        </h1>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full bg-brand px-5 py-2 text-sm font-bold text-white"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const cat = categories.find((category) => category.slug === product.category);
  const diskon = discountPercent(product.price, product.oldPrice);
  const isFav = favorites.includes(product.id);
  const habis = product.stock <= 0;
  // harga grosir (v6): harga satuan efektif untuk jumlah terpilih + tier berikutnya
  const tiers = (product.tiers ?? []).filter((t) => t.price < product.price);
  const harga = unitPrice(product, qty);
  const lagi = tiers.find((t) => t.minQty > qty);
  const terkait = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const tambahKeKeranjang = () => addItem(product.id, qty);

  const beliSekarang = () => {
    addItem(product.id, qty);
    router.push("/keranjang");
  };

  return (
    <div className="space-y-8">
      <nav className="text-xs text-slate-500 sm:text-sm">
        <Link href="/" className="hover:text-brand">
          Beranda
        </Link>
        <span className="mx-1">›</span>
        <Link href={`/kategori/${product.category}`} className="hover:text-brand">
          {cat?.name ?? "Kategori"}
        </Link>
        <span className="mx-1">›</span>
        <span className="font-semibold text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-6 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        {/* gambar */}
        <ProductImage
          product={product}
          className="h-56 rounded-xl sm:h-72"
          emojiClassName="text-[110px] leading-none sm:text-[150px]"
        />

        {/* info */}
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-1.5">
            {diskon && (
              <span className="rounded bg-brand px-2 py-0.5 text-xs font-bold text-white">
                Diskon {diskon}%
              </span>
            )}
            {product.isBestSeller && (
              <span className="rounded bg-navy px-2 py-0.5 text-xs font-bold text-white">
                Terlaris
              </span>
            )}
            {product.isNew && (
              <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                Baru
              </span>
            )}
          </div>

          <h1 className="mt-2 text-xl font-extrabold text-slate-800 sm:text-2xl">
            {product.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{product.unit}</p>

          <div className="mt-3 flex items-end gap-2">
            <span
              className={`text-3xl font-extrabold ${
                habis ? "text-slate-400" : "text-brand"
              }`}
            >
              {formatRupiah(harga)}
            </span>
            {harga < product.price && (
              <span className="pb-1 text-sm font-semibold text-emerald-600">
                harga grosir
              </span>
            )}
            {product.oldPrice && (
              <span className="pb-1 text-sm text-slate-400 line-through">
                {formatRupiah(product.oldPrice)}
              </span>
            )}
          </div>

          {tiers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {tiers.map((t) => (
                <span
                  key={t.minQty}
                  className={`rounded-md px-1.5 py-0.5 font-semibold ${
                    t.minQty <= qty
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Beli {t.minQty}+ · {formatRupiah(t.price)}
                </span>
              ))}
              {lagi && !habis && (
                <span className="text-slate-400">
                  +{lagi.minQty - qty} lagi → {formatRupiah(lagi.price)}
                </span>
              )}
            </div>
          )}

          <p className="mt-1 text-xs font-semibold">
            {habis ? (
              <span className="text-slate-400">Stok habis</span>
            ) : (
              <span className="text-emerald-600">
                Stok tersedia ({product.stock})
              </span>
            )}
          </p>

          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {product.description}
            </p>
          )}

          {/* aksi */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QtySelector
              qty={qty}
              onChange={(q) => setQty(Math.max(1, q))}
              max={habis ? 0 : product.stock}
              size="lg"
            />
            <button
              type="button"
              disabled={habis}
              onClick={tambahKeKeranjang}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 py-2.5 text-sm font-bold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              <CartIcon className="h-4 w-4" />
              + Keranjang
            </button>
            <button
              type="button"
              disabled={habis}
              onClick={beliSekarang}
              className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Beli Sekarang
            </button>
            <button
              type="button"
              aria-label="Favorit"
              onClick={() => toggleFavorite(product.id)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                isFav
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-slate-200 text-slate-400 hover:text-brand"
              }`}
            >
              <HeartIcon className="h-5 w-5" filled={isFav} />
            </button>
          </div>

          {/* keunggulan */}
          <ul className="mt-5 grid gap-2 text-xs text-slate-600 sm:text-sm">
            <li className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-navy" />
              Gratis ongkir min. belanja{" "}
              {formatRupiah(settings.freeOngkirMin)} area Lembang
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-navy" />
              Bayar di tempat (COD) atau transfer bank
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-navy" />
              Barang segar langsung dari warung
            </li>
          </ul>
        </div>
      </div>

      {/* produk serupa */}
      {terkait.length > 0 && (
        <section>
          <SectionHeader
            title="Produk Serupa"
            emoji="🛍️"
            href={`/kategori/${product.category}`}
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
            {terkait.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
