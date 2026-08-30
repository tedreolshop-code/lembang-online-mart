"use client";

import Link from "next/link";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";

const STEPS = [
  {
    emoji: "🛒",
    title: "1. Pilih Barang",
    desc: "Jelajahi kategori atau pakai kolom pencarian. Tekan tombol + untuk memasukkan barang ke keranjang.",
  },
  {
    emoji: "📝",
    title: "2. Buka Keranjang",
    desc: "Cek lagi pesananmu, atur jumlah barang, dan lihat total belanja. Belanja di atas batas gratis ongkir, diantar tanpa biaya!",
  },
  {
    emoji: "💬",
    title: "3. Pesan via WhatsApp atau Form",
    desc: "Tekan 'Pesan via WhatsApp' agar rincian pesanan terkirim otomatis ke warung, atau isi form checkout dengan alamatmu.",
  },
  {
    emoji: "🛵",
    title: "4. Konfirmasi & Diantar",
    desc: "Petugas warung mengonfirmasi pesanan dan stok, lalu barang langsung diantar ke rumahmu. Bisa bayar di tempat (COD) atau transfer.",
  },
];

export default function CaraPesanContent() {
  const s = useSettings();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
        Cara Pesan di {s.name} 🛵
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Cuma 4 langkah, belanja sampai rumah!
      </p>

      <ol className="mt-5 space-y-3">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
          >
            <span className="text-3xl">{step.emoji}</span>
            <div>
              <h2 className="font-bold text-slate-800">{step.title}</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                {step.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-2 rounded-xl bg-navy-soft p-4 text-sm text-navy">
        <p>
          🚚 Gratis ongkir untuk belanja di atas{" "}
          {formatRupiah(s.freeOngkirMin)} (di bawah itu ongkir{" "}
          {formatRupiah(s.ongkir)}).
        </p>
        <p>
          💡 <b>Tips:</b> pesan sebelum jam 19.00 agar barang diantar di hari
          yang sama. Di luar jam operasional ({s.hours}), pesanan diproses
          keesokan harinya.
        </p>
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
