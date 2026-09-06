"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/store";
import { ClockIcon, PhoneIcon, PinIcon } from "./Icons";
import Logo from "./Logo";

/** Footer navy ala mockup: info kontak di kiri, kanal pesanan/sosial di
    kanan, copyright di bawah. */
export default function Footer() {
  const pathname = usePathname();
  const settings = useSettings();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="mt-10 bg-navy text-white/85">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6">
        {/* kontak */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Hubungi Kami
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              {settings.address}
            </li>
            <li className="flex items-start gap-2">
              <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              {settings.hours}
            </li>
            <li className="flex items-start gap-2">
              <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
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
          <p className="mt-4 text-xs leading-relaxed text-white/60">
            {settings.tagline} — pesanan diantar langsung ke rumah Anda.
          </p>
        </div>

        {/* navigasi + kanal */}
        <div className="sm:justify-self-end">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Jelajahi
          </h3>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <Link className="hover:text-white" href="/kategori">
                Kategori
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/favorit">
                Favorit
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
                Privasi
              </Link>
            </li>
          </ul>

          {/* tombol kanal pesanan */}
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-white">
            Pesan Lewat
          </h3>
          <div className="mt-3 flex gap-2.5">
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.5-.3-2.9.8.8-2.8-.3-.5A8 8 0 0 1 12 4zm-3 3.8c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.2-.5-2.2-1.4-.8-.7-1.3-1.6-1.5-1.9-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.6z" />
              </svg>
            </a>
            <Link
              href="/cara-pesan"
              aria-label="Cara pesan"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand"
            >
              <PhoneIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/pesanan"
              aria-label="Cek pesanan"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </Link>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span className="rounded-lg bg-white p-1">
              <Logo className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold text-white/70">
              {settings.name}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15 py-4 text-center text-xs text-white/60">
        © 2026 {settings.name} · Dibuat dengan ❤️ untuk warga Lembang
      </div>
    </footer>
  );
}
