"use client";

import Link from "next/link";
import { useProducts } from "@/lib/store";
import { useCategories } from "@/lib/category-store";
import CategoryStatus from "@/components/CategoryStatus";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "@/components/BannerCarousel";
import { TruckIcon } from "@/components/Icons";

/** Beranda warung: promo, rak kategori yang dikelola admin, lalu produk. */
export default function HomePage() {
  const products = useProducts();
  const categories = useCategories();

  const promo = products.filter((p) => p.isPromo);
  const terlaris = products.filter((p) => p.isBestSeller);
  const rekomendasi = products.filter((p) => !p.isPromo && !p.isBestSeller);

  return (
    <div className="space-y-10 sm:space-y-12">
      <BannerCarousel />

      {/* kategori: semua kategori tampil sebagai kartu dengan ukuran sama
          (grid 4 kolom; min-h seragam + isi di tengah agar nama 1–2 baris
          tidak mengubah tinggi kartu) */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-800">Belanja per Kategori</h2>
          <Link href="/kategori" className="shrink-0 text-xs font-bold text-brand">Lihat semua →</Link>
        </div>
        <CategoryStatus />
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/kategori/${c.slug}`}
              className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-1 py-3 text-center text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md sm:min-h-36 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-5"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl sm:h-14 sm:w-14 sm:text-3xl"
                style={{ backgroundColor: c.tint }}
              >
                {c.emoji}
              </span>
              <span className="w-full break-words text-[11px] font-bold leading-tight sm:text-sm">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* info ongkir */}
      <div className="flex items-center gap-3 rounded-xl border border-navy/15 bg-navy-soft px-4 py-3 text-sm text-navy">
        <TruckIcon className="h-6 w-6 shrink-0" />
        <p>
          <b>Gratis ongkir</b> untuk belanja di atas Rp50.000 — pesanan diantar
          langsung ke rumah Anda.
        </p>
      </div>

      {/* promo spesial */}
      {promo.length > 0 && (
        <section>
          <ProductSectionTitle
            title="Promo Spesial"
            href="/cari?filter=promo"
          />
          <ProductRow products={promo} />
        </section>
      )}

      {/* terlaris */}
      {terlaris.length > 0 && (
        <section>
          <ProductSectionTitle title="Paling Sering Dibeli" href="/cari" />
          <ProductRow products={terlaris} />
        </section>
      )}

      {/* rekomendasi / semua produk */}
      <section>
        <ProductSectionTitle title="Product" href="/kategori" center />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {rekomendasi.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/kategori"
            className="inline-block rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-navy-dark"
          >
            Lihat Semua Produk
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Judul seksi besar di tengah ala mockup ("Product") */
function ProductSectionTitle({
  title,
  href,
  center = false,
}: {
  title: string;
  href?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`mb-4 flex items-center gap-3 sm:mb-5 ${
        center ? "justify-center" : "justify-between"
      }`}
    >
      <h2 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl">
        {title}
      </h2>
      {href && !center && (
        <Link
          href={href}
          className="text-xs font-semibold text-navy/70 hover:text-brand sm:text-sm"
        >
          Lihat Semua →
        </Link>
      )}
    </div>
  );
}

/** baris produk geser-samping ala aplikasi */
function ProductRow({
  products,
}: {
  products: ReturnType<typeof useProducts>;
}) {
  return (
    <div className="no-scrollbar -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      {products.map((p) => (
        <div key={p.id} className="w-36 shrink-0 snap-start sm:w-44">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
