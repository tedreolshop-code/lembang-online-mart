"use client";

import { useEffect, useState } from "react";
import { categoryBySlug } from "@/data/seed";
import type { Product } from "@/lib/types";

/** src foto yang sudah terbukti gagal dimuat — biar tidak dicoba ulang */
const failedSrcs = new Set<string>();

/**
 * Tampilan gambar produk dengan fallback berlapis:
 * 1. URL foto di data produk (kolom "URL Foto" di admin, opsional)
 * 2. File di public/products/<id-produk>.jpg (tinggal taruh file, otomatis tampil)
 * 3. Emoji di atas warna kategori (bila foto belum ada / gagal dimuat)
 *
 * Emoji dirender lebih dulu (SSR) dan tetap jadi lapisan dasar di balik foto,
 * sehingga selama foto termuat tidak pernah muncul kotak kosong. Foto baru
 * dipasang setelah halaman hidup supaya error 404 yang terjadi sebelum
 * hydration tetap tertangkap fallback.
 */
export default function ProductImage({
  product,
  className = "",
  emojiClassName = "text-5xl",
}: {
  product: Product;
  className?: string;
  emojiClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  const cat = categoryBySlug(product.category);
  const src = product.image?.trim() || `/products/${product.id}.jpg`;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || failed || failedSrcs.has(src)) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: cat?.tint ?? "#f1f5f9" }}
      >
        <span className={emojiClassName}>{product.emoji}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: cat?.tint ?? "#f1f5f9" }}
    >
      <span className={emojiClassName}>{product.emoji}</span>
      <img
        src={src}
        alt={product.name}
        onError={() => {
          failedSrcs.add(src);
          setFailed(true);
        }}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
