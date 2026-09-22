"use client";

import { useCategoryCatalog } from "@/lib/category-store";

/** Bedakan proses memuat, gangguan, dan daftar yang memang kosong. */
export default function CategoryStatus() {
  const { ready, error, categories, refresh } = useCategoryCatalog();
  if (ready && categories.length > 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500" role="status">
      {error ? (
        <>
          <p>Kategori belum dapat dimuat.</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 rounded-full px-4 py-2 font-bold text-brand hover:bg-brand-soft">
            Coba lagi
          </button>
        </>
      ) : ready ? "Belum ada kategori. Kategori baru akan tampil di sini." : "Memuat kategori…"}
    </div>
  );
}
