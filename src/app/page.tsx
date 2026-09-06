"use client";

import Link from "next/link";
import { useProducts } from "@/lib/store";
import { CATEGORIES } from "@/data/seed";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "@/components/BannerCarousel";
import SectionHeader from "@/components/SectionHeader";
import { ChevronRightIcon, TruckIcon } from "@/components/Icons";

export default function HomePage() {
  const products = useProducts();

  const promo = products.filter((p) => p.isPromo);
  const terlaris = products.filter((p) => p.isBestSeller);
  const rekomendasi = products.filter((p) => !p.isPromo && !p.isBestSeller);

  return (
    <div className="space-y-8">
      <BannerCarousel />

      {/* kategori */}
      <section>
        <SectionHeader title="Kategori Belanja" emoji="🛒" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/kategori/${c.slug}`}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white p-2.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-navy/30 hover:bg-navy hover:shadow-md"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-2xl sm:h-14 sm:w-14 sm:text-3xl"
                style={{ background: c.tint }}
              >
                {c.emoji}
              </span>
              <span className="text-[11px] font-semibold leading-tight text-slate-700 transition group-hover:text-white sm:text-xs">
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
          <SectionHeader
            title="Promo Spesial"
            emoji="🔥"
            href="/cari?filter=promo"
          />
          <ProductRow products={promo} />
        </section>
      )}

      {/* terlaris */}
      {terlaris.length > 0 && (
        <section>
          <SectionHeader title="Paling Sering Dibeli" emoji="⭐" href="/cari" />
          <ProductRow products={terlaris} />
        </section>
      )}

      {/* rekomendasi */}
      <section>
        <SectionHeader
          title="Rekomendasi Untukmu"
          emoji="🧺"
          href="/kategori"
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {rekomendasi.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
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
