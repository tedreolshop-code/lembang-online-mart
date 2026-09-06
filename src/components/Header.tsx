"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { BagIcon, SearchIcon, CartIcon } from "./Icons";
import Logo from "./Logo";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const settings = useSettings();
  const [q, setQ] = useState("");

  if (pathname.startsWith("/admin")) return null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query) router.push(`/cari?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-40">
      {/* strip navy gelap info */}
      <div className="bg-navy-dark px-3 py-1.5 text-center text-[11px] font-medium text-white/90 sm:text-xs">
        🚚 Gratis ongkir min. belanja {formatRupiah(settings.freeOngkirMin)} ·
        Antar sampai rumah
      </div>

      {/* bar navy utama */}
      <div className="bg-navy shadow-md shadow-navy/30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="rounded-xl bg-white p-1.5 shadow-sm">
              <Logo className="h-7 w-7" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-base font-extrabold tracking-tight text-white">
                Lembang
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                Online Mart
              </span>
            </span>
          </Link>

          {/* pencarian */}
          <form onSubmit={submitSearch} className="flex-1">
            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2">
              <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari mie instan, minyak, popok…"
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                aria-label="Cari produk"
              />
            </div>
          </form>

          {/* keranjang */}
          <Link
            href="/keranjang"
            aria-label="Keranjang belanja"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark"
          >
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-navy">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </div>

        {/* nav desktop */}
        <nav className="mx-auto hidden max-w-6xl items-center gap-1 px-6 pb-2 text-sm font-medium text-white/90 sm:flex">
          <BagIcon className="mr-1 h-4 w-4" />
          <span className="mr-3 text-white">{settings.tagline}</span>
          <HeaderLink href="/kategori">Semua Kategori</HeaderLink>
          <HeaderLink href="/favorit">Favorit</HeaderLink>
          <HeaderLink href="/pesanan">Riwayat Pesanan</HeaderLink>
          <HeaderLink href="/cara-pesan">Cara Pesan</HeaderLink>
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1 transition hover:bg-white/15 hover:text-white"
    >
      {children}
    </Link>
  );
}
