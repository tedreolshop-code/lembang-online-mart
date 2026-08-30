"use client";

import Link from "next/link";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import { ClockIcon, PhoneIcon, PinIcon } from "@/components/Icons";
import Logo from "@/components/Logo";

export default function TentangContent() {
  const s = useSettings();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <Logo className="h-12 w-12" />
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
          Tentang {s.name}
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

      <div className="mt-6 space-y-3 rounded-xl bg-navy-soft p-4 text-sm text-navy">
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
          WhatsApp: +{s.whatsapp}
        </p>
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
    </div>
  );
}
