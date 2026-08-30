"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import type { StoreSettings } from "@/lib/config";

const BANNERS = [
  {
    title: "PROMO GAJIAN 🎉",
    subtitle: () => "Minyak goreng & sembako diskon hingga 20%",
    cta: "Belanja Sekarang",
    href: "/kategori/sembako",
    className: "bg-gradient-to-r from-brand to-brand-dark",
  },
  {
    title: "GRATIS ONGKIR 🚚",
    subtitle: (s: StoreSettings) =>
      `Belanja min. ${formatRupiah(s.freeOngkirMin)}, diantar sampai rumah`,
    cta: "Mulai Belanja",
    href: "/kategori",
    className: "bg-gradient-to-r from-navy to-navy-dark",
  },
  {
    title: "FLASH SALE SABTU 🔥",
    subtitle: () => "Mie instan & snack harga spesial tiap akhir pekan",
    cta: "Lihat Mie Instan",
    href: "/kategori/mie-instan",
    className: "bg-gradient-to-r from-brand via-[#c2274f] to-navy",
  },
];

export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const settings = useSettings();

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % BANNERS.length),
      4500,
    );
    return () => clearInterval(t);
  }, []);

  const banner = BANNERS[index];

  return (
    <div>
      <div
        className={`flex flex-col items-start gap-1.5 rounded-2xl px-5 py-6 text-white shadow-lg shadow-slate-300/40 transition-colors duration-500 sm:px-8 sm:py-8 ${banner.className}`}
      >
        <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl">
          {banner.title}
        </h2>
        <p className="text-sm text-white/90 sm:text-base">{banner.subtitle(settings)}</p>
        <Link
          href={banner.href}
          className="mt-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-800 shadow transition hover:bg-white/90 sm:text-sm"
        >
          {banner.cta} →
        </Link>
      </div>

      {/* indikator slide */}
      <div className="mt-3 flex justify-center gap-1.5">
        {BANNERS.map((b, i) => (
          <button
            key={b.title}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-brand" : "w-1.5 bg-slate-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
