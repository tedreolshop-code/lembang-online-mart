"use client";

import { useConfigError } from "@/lib/store";

/** Banner merah bila server salah-konfigurasi (mode cloud setengah jalan).
    Tanpa ini, toko diam-diam menampilkan data seed / data basi tanpa
    penjelasan apa pun — persis jenis "silent bug" yang ingin dihindari. */
export default function ConfigErrorBanner() {
  const err = useConfigError();
  if (!err) return null;
  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800"
    >
      ⚠ Konfigurasi server belum lengkap — {err}
    </div>
  );
}
