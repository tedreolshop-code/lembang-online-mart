"use client";

import Link from "next/link";

/** Halaman pendaftaran agen ditutup untuk publik (v10).
    Pendaftaran agen sekarang hanya melalui admin: Admin → Agen → Daftarkan Agen Baru.
    Admin mengisi data agen termasuk upload foto KTP. */
export default function AgenDaftarPage() {
  return (
    <div className="mx-auto max-w-lg">
      <section className="rounded-2xl bg-navy p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤝</span>
          <div>
            <h1 className="text-lg font-extrabold">Pendaftaran Agen</h1>
            <p className="mt-0.5 text-xs text-white/80">
              Pendaftaran agen saat ini ditutup untuk umum
            </p>
          </div>
        </div>
      </section>
      <section className="mt-5 rounded-2xl bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
          <span className="text-3xl">📋</span>
        </div>
        <h2 className="mt-4 text-base font-extrabold text-slate-800">
          Hubungi Admin untuk Mendaftar
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Untuk menjadi agen, silakan hubungi admin toko langsung.
          Admin akan mendaftarkan data Anda termasuk verifikasi KTP.
          Setelah disetujui, Anda akan menerima kode agen dan dapat
          mengakses dashboard agen.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/akun"
            className="block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300"
          >
            Kembali ke Akun
          </Link>
          <Link
            href="/agen/dashboard"
            className="block w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            Dashboard Agen
          </Link>
        </div>
      </section>
    </div>
  );
}
