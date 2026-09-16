"use client";

import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/store";
import { WhatsAppIcon } from "./Icons";

const GREETING = "Halo CS Lembang Online Mart 👋 saya mau tanya-tanya dulu.";

/** Tombol kontak CS WhatsApp melayang di kanan-bawah layar — terlihat di
    semua halaman kecuali /admin. Posisi di atas bar menu bawah pada layar
    HP (nav bar tinggi ~57px) dan mepet sudut pada layar lebar. */
export default function FloatingWa() {
  const pathname = usePathname();
  const settings = useSettings();

  if (pathname.startsWith("/admin") || !settings.whatsapp) return null;

  return (
    <a
      href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(GREETING)}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat Customer Service via WhatsApp"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-slate-900/25 transition hover:brightness-95 active:scale-95 md:bottom-6 md:right-6"
    >
      <WhatsAppIcon className="h-6 w-6" />
      <span
        aria-hidden
        className="absolute -right-0.5 -top-0.5 flex h-5 items-center rounded-full bg-navy px-1.5 text-[9px] font-bold uppercase tracking-wide"
      >
        CS
      </span>
    </a>
  );
}
