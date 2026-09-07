"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useSettings } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { SearchIcon, CartIcon } from "./Icons";
import Logo from "./Logo";

const MENU = [
  { href: "/", label: "Beranda" },
  { href: "/kategori", label: "Kategori" },
  { href: "/keranjang", label: "Keranjang" },
  { href: "/pesanan", label: "Pesanan" },
];

/** Header navy ala mockup: logo kiri, menu tengah (desktop),
    tombol cari + keranjang oranye kanan. */
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, ready } = useCart();
  const settings = useSettings();
  const [q, setQ] = useState("");

  if (pathname.startsWith("/admin")) return null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query) router.push(`/cari?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-navy shadow-md shadow-navy/30">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
        {/* logo + nama toko */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
            Lembang{" "}
            <span style={{ color: settings.colorPrimary }}>Online Mart</span>
          </span>
        </Link>

        {/* menu tengah (desktop) */}
        <nav className="mx-auto hidden items-center gap-1 text-sm font-semibold text-white/85 md:flex">
          {MENU.map((m) => {
            const active =
              m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white ${
                  active ? "bg-white/10 text-white" : ""
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* cari + keranjang */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <form
            onSubmit={submitSearch}
            className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-2 lg:flex"
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kebutuhanmu…"
              className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 xl:w-52"
              aria-label="Cari produk"
            />
          </form>
          <Link
            href="/cari"
            aria-label="Cari produk"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>

          <Link
            href="/keranjang"
            aria-label="Keranjang belanja"
            className="relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow transition hover:brightness-110"
            style={{ backgroundColor: settings.colorPrimary }}
          >
            <CartIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Keranjang</span>
            {ready && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-navy">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
