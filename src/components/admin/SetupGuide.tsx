"use client";

import { useState } from "react";

const SETUP_STEPS: {
  icon: string;
  title: string;
  desc: string;
  action: { label: string; tab: "produk" | "stok" | "pengaturan" | "tampilan" | "agen" };
  checklist: string[];
}[] = [
  {
    icon: "⚙️",
    title: "1. Pengaturan Toko",
    desc: "Isi nama toko, nomor WhatsApp penerima pesanan, alamat, jam operasional, ongkir & gratis ongkir. Pastikan ADMIN_EMAIL di file .env sudah berisi email admin — kalau belum, tidak ada yang bisa masuk dashboard.",
    action: { label: "Buka Pengaturan", tab: "pengaturan" },
    checklist: [
      "Nama toko & slogan",
      "Nomor WhatsApp penerima pesanan",
      "Alamat & jam operasional",
      "Ongkir & batas gratis ongkir",
      "ADMIN_EMAIL di .env sudah diisi email admin",
    ],
  },
  {
    icon: "🔔",
    title: "2. Notifikasi Pesanan Masuk",
    desc: "Pilih metode notifikasi (Telegram / Discord / WhatsApp Fonnte) di tab Pengaturan → section Notifikasi. Klik 'Kirim Pesan Tes' untuk memastikan notifikasi sampai.",
    action: { label: "Buka Pengaturan", tab: "pengaturan" },
    checklist: [
      "Pilih metode notifikasi",
      "Isi token/chat_id atau webhook URL",
      "Klik 'Kirim Pesan Tes' — cek HP/discord",
    ],
  },
  {
    icon: "🎨",
    title: "3. Tampilan Toko",
    desc: "Pilih warna tema toko, upload logo, dan atur banner promo yang tampil di beranda.",
    action: { label: "Buka Tampilan", tab: "tampilan" },
    checklist: [
      "Pilih warna tema",
      "Upload logo toko",
      "Atur banner promo beranda",
    ],
  },
  {
    icon: "🛒",
    title: "4. Input Produk + HPP",
    desc: "Tambahkan produk beserta HARGA BELI (HPP). HPP wajib diisi agar laporan laba akurat. Tanpa HPP, laporan laba akan kelebihan karena modal tidak dihitung.",
    action: { label: "Buka Produk", tab: "produk" },
    checklist: [
      "Klik 'Muat Data Awal' jika database kosong",
      "Tambah produk: nama, kategori, harga jual",
      "Isi HPP (harga beli) — WAJIB",
      "Isi stok awal tiap produk",
    ],
  },
  {
    icon: "🤝",
    title: "5. Aturan Komisi Agen (Opsional)",
    desc: "Jika ada agen reseller, atur persentase komisi di tab Agen. Nantinya setiap pendaftaran agen baru akan muncul dengan status pending — approve untuk aktifkan. Untuk agen yang untungnya dari selisih harga, pilih mode 'Harga khusus agen' lalu isi harganya per produk.",
    action: { label: "Buka Agen", tab: "agen" },
    checklist: [
      "Set persentase komisi default",
      "Isi ketentuan komisi",
      "Approve agen yang mendaftar",
      "Isi 🏷️ Harga Khusus Agen bila pakai mode harga",
    ],
  },
];

function SetupGuide({
  onClose,
  goToTab,
}: {
  onClose: () => void;
  goToTab: (t: "produk" | "stok" | "pengaturan" | "tampilan" | "agen") => void;
}) {
  const [step, setStep] = useState(0);
  const current = SETUP_STEPS[step];
  const isLast = step === SETUP_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-extrabold">Panduan Setup Toko</h2>
            <p className="text-[11px] text-white/70">
              Langkah {step + 1} dari {SETUP_STEPS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            Lewati ✕
          </button>
        </div>

        {/* progress bar */}
        <div className="flex gap-1 bg-slate-100 px-5 py-2">
          {SETUP_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === step
                  ? "bg-brand"
                  : i < step
                    ? "bg-brand/40"
                    : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* content */}
        <div className="px-5 py-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-xl">
              {current.icon}
            </span>
            <h3 className="text-base font-extrabold text-slate-800">
              {current.title}
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            {current.desc}
          </p>

          <ul className="mb-5 space-y-2">
            {current.checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 text-[10px] text-slate-400">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                ← Sebelumnya
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {!isLast ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Lewati
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="rounded-lg bg-brand px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-dark"
                  >
                    Selanjutnya →
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Selesai nanti
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab(current.action.tab)}
                    className="rounded-lg bg-brand px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-dark"
                  >
                    {current.action.label}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupGuide;
