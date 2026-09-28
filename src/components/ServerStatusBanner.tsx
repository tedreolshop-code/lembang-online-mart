"use client";

import { useConfigError, useSyncError } from "@/lib/store";

/** Banner peringatan status server — tampil bila (a) konfigurasi cloud
    setengah jalan, atau (b) sinkronisasi ke server gagal. Tanpa ini, toko
    diam-diam menyajikan data seed/basi tanpa penjelasan (silent bug). */
export default function ServerStatusBanner() {
  const configError = useConfigError();
  const syncError = useSyncError();
  const err = configError ?? syncError;
  if (!err) return null;
  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800"
    >
      ⚠ {configError ? "Konfigurasi server belum lengkap" : "Gagal sinkron dengan server"} — {err}
    </div>
  );
}
