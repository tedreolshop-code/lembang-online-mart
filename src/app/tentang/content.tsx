"use client";

import Link from "next/link";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import { ClockIcon, PhoneIcon, PinIcon } from "@/components/Icons";
import { LogoFull } from "@/components/Logo";

/** Halaman Tentang Kami — memuat identitas toko (logo + deskripsi),
    navigasi Jelajahi, dan kontak Hubungi Kami (dulu ada di footer). */
export default function TentangContent() {
  const s = useSettings();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <LogoFull className="h-12 w-auto" />
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
          Tentang Kami
        </h1>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
        {s.name} adalah warung kelontong online milik warga Lembang. Kami
        menjual kebutuhan harian — mie instan, minyak goreng, sembako, popok,
        kebutuhan bayi, perawatan, sampai kebutuhan dapur — dengan harga warung
        dan diantar langsung sampai rumah.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Website ini dibuat agar warga tidak perlu keluar rumah saat hujan,
        malam hari, atau sedang sibuk. Tinggal pilih barang, pesan, dan tunggu
        kurir warung datang.
      </p>
      <p className="mt-3 text-sm italic leading-relaxed text-slate-500">
        {s.tagline} — pesanan diantar langsung ke rumah Anda.
      </p>

      {/* Jelajahi — navigasi yang dulu ada di footer */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-800">
        Jelajahi
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { href: "/kategori", label: "Kategori" },
          { href: "/pesanan?tab=favorit", label: "Favorit" },
          { href: "/pesanan", label: "Riwayat Pesanan" },
          { href: "/cara-pesan", label: "Cara Pesan" },
          { href: "/privasi", label: "Privasi" },
        ].map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-brand/40 hover:text-brand-dark hover:shadow-sm"
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* Hubungi Kami */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-800">
        Hubungi Kami
      </h2>
      <div className="mt-3 space-y-3 rounded-xl bg-navy-soft p-4 text-sm text-navy">
        <p className="flex items-start gap-2">
          <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {s.address}
        </p>
        <p className="flex items-start gap-2">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {s.hours}
        </p>
        <p className="flex items-start gap-2">
          <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <a
            href={`https://wa.me/${s.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline-offset-2 hover:underline"
          >
            WhatsApp: +{s.whatsapp}
          </a>
        </p>
      </div>

      {/* Pesan lewat kanal lain */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-800">
        Pesan Lewat
      </h2>
      <div className="mt-3 flex gap-2.5">
        <a
          href={`https://wa.me/${s.whatsapp}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white transition hover:bg-brand"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.5-.3-2.9.8.8-2.8-.3-.5A8 8 0 0 1 12 4zm-3 3.8c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.2-.5-2.2-1.4-.8-.7-1.3-1.6-1.5-1.9-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.6z" />
          </svg>
        </a>
        <Link
          href="/cara-pesan"
          aria-label="Cara pesan"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white transition hover:bg-brand"
        >
          <PhoneIcon className="h-5 w-5" />
        </Link>
        <Link
          href="/pesanan"
          aria-label="Cek pesanan"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white transition hover:bg-brand"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </Link>
      </div>

      <div className="mt-4 rounded-xl bg-brand-soft p-4 text-sm text-brand-dark">
        🚚 Gratis ongkir untuk belanja di atas {formatRupiah(s.freeOngkirMin)}.
      </div>

      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
      >
        Mulai Belanja →
      </Link>

      <p className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
        © 2026 {s.name} · Dibuat dengan ❤️ untuk warga Lembang
      </p>
    </div>
  );
}
