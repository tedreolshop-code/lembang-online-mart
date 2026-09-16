"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import type { BannerSlide } from "@/lib/config";

/** Hero beranda ala mockup: panel teks warna gelap di kiri (judul besar,
    subjudul, tombol CTA oranye) + foto toko/gudang memenuhi setengah kanan.
    Slide promo dari Admin → Tampilan mengganti teks & foto. */
export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const settings = useSettings();
  const banners = settings.banners;

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % banners.length),
      5000,
    );
    return () => clearInterval(t);
  }, [banners.length]);

  // pengaturan dimuat async → jaga indeks tetap valid
  const i = Math.min(index, Math.max(0, banners.length - 1));
  const banner: BannerSlide = banners[i] ?? {
    title: settings.tagline,
    subtitle: settings.name,
    cta: "Mulai Belanja",
    href: "/kategori",
    color: "otomatis",
    image: "",
  };
  // "otomatis" → kelas bg-navy (mengikuti CSS variables tema yang sudah
  // benar sejak paint pertama); warna khusus per-banner tetap inline
  const customBg = banner.color === "otomatis" ? undefined : banner.color;

  return (
    <div className="full-bleed relative -mt-4 shadow-lg shadow-slate-300/40">
      <div
        className={`grid md:grid-cols-2 ${customBg ? "" : "bg-navy"}`}
        style={customBg ? { backgroundColor: customBg } : undefined}
      >
        {/* panel teks */}
        <div className="order-2 flex flex-col justify-center px-5 py-8 sm:px-10 md:order-1 lg:px-16">
          <div key={i} className="animate-hero-fade max-w-xl">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              {banner.title}
            </h1>
            {banner.subtitle && (
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 sm:text-lg">
                {banner.subtitle}
              </p>
            )}
            <Link
              href={banner.href || "/kategori"}
              className="mt-6 inline-block rounded-full bg-brand px-7 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110 sm:text-base"
            >
              {banner.cta}
            </Link>
          </div>
        </div>

        {/* foto */}
        <div className="relative order-1 h-52 min-h-0 sm:h-72 md:order-2 md:h-auto md:min-h-105">
          {banners.map((b, j) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={j}
              src={b.image.trim() || "/hero-toko.jpg"}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                j === i ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      </div>

      {/* indikator slide */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, j) => (
            <button
              key={j}
              type="button"
              aria-label={`Slide ${j + 1}`}
              onClick={() => setIndex(j)}
              className={`h-1.5 rounded-full transition-all ${
                j === i
                  ? "w-8 bg-brand"
                  : "w-4 bg-white/80 hover:bg-white"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { BannerSlide };
