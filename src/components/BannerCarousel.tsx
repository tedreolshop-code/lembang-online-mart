"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import type { BannerSlide } from "@/lib/config";

export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const settings = useSettings();
  const banners = settings.banners;

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % banners.length),
      4500,
    );
    return () => clearInterval(t);
  }, [banners.length]);

  // pengaturan dimuat async → jaga indeks tetap valid
  const i = Math.min(index, Math.max(0, banners.length - 1));
  const banner = banners[i] ?? {
    title: "",
    subtitle: "",
    cta: "",
    href: "/kategori",
    color: "otomatis",
  };
  const bg = banner.color === "otomatis" ? settings.colorDark : banner.color;

  return (
    <div>
      <div
        className="flex flex-col items-start gap-1.5 rounded-2xl px-5 py-6 text-white shadow-lg shadow-slate-300/40 transition-colors duration-500 sm:px-8 sm:py-8"
        style={{ backgroundColor: bg }}
      >
        <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl">
          {banner.title}
        </h2>
        {banner.subtitle && (
          <p className="text-sm text-white/90 sm:text-base">{banner.subtitle}</p>
        )}
        <Link
          href={banner.href || "/kategori"}
          className="mt-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow transition hover:brightness-110 sm:text-sm"
          style={{ backgroundColor: settings.colorPrimary }}
        >
          {banner.cta} →
        </Link>
      </div>

      {/* indikator slide */}
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, j) => (
            <button
              key={j}
              type="button"
              aria-label={`Slide ${j + 1}`}
              onClick={() => setIndex(j)}
              className={`h-1.5 rounded-full transition-all ${
                j === i ? "w-6 bg-brand" : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { BannerSlide };
