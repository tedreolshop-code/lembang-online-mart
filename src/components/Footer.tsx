"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/store";
import { ClockIcon, PhoneIcon, PinIcon } from "./Icons";
import Logo from "./Logo";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  const settings = useSettings();

  return (
    <footer className="mt-10 bg-navy text-white/85">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-white p-1">
              <Logo className="h-7 w-7" />
            </span>
            <span className="leading-tight text-white">
              <span className="block text-sm font-extrabold tracking-wide">
                LEMBANG
              </span>
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-white/75">
                ONLINE STORE
              </span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            {settings.tagline}. Warung kelontong online warga Lembang —
            kebutuhan harian diantar sampai rumah.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Jelajahi
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="hover:text-white" href="/kategori">
                Semua Kategori
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/favorit">
                Produk Favorit
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/pesanan">
                Riwayat Pesanan
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/cara-pesan">
                Cara Pesan
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/tentang">
                Tentang Kami
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/privasi">
                Kebijakan Privasi
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Hubungi Kami
          </h3>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {settings.address}
            </li>
            <li className="flex items-start gap-2">
              <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {settings.hours}
            </li>
            <li className="flex items-start gap-2">
              <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                WhatsApp: +{settings.whatsapp}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15 py-4 text-center text-xs text-white/60">
        © 2026 {settings.name} · Dibuat dengan ❤️ untuk warga Lembang
      </div>
    </footer>
  );
}
