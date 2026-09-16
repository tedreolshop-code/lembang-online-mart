"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { SearchIcon, UserIcon } from "./Icons";
import Logo from "./Logo";

/* Menu tengah hanya tampil di layar lebar (md:flex). "Keranjang" tetap di
   sini karena bar bawah layar — satu-satunya tempat tombol keranjang
   sekarang — tersembunyi mulai md. */
const MENU = [
  { href: "/", label: "Beranda" },
  { href: "/kategori", label: "Kategori" },
  { href: "/keranjang", label: "Keranjang" },
  { href: "/pesanan", label: "Pesanan" },
];

/** Header navy ala mockup: logo kiri, menu tengah (desktop: Beranda,
    Kategori, Keranjang, Pesanan), lalu cari + tombol **Akun** di kanan.
    Tombol keranjang yang dulu ada di kanan sudah diganti tombol Akun;
    keranjang kini dijangkau dari tab "Keranjang" di bar bawah layar
    (mobile) atau menu tengah (desktop). */
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
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
            {/* kelas (bukan inline style) → warna ikut CSS variables tema
                yang sudah benar sejak paint pertama, tidak berubah setelah fetch */}
            <span className="text-brand">Online Mart</span>
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>

          {/* tombol Akun — menggantikan tombol keranjang oranye yang dulu
              di posisi ini; jumlah item keranjang tampil di tab bar bawah */}
          <Link
            href="/akun"
            aria-label="Akun saya"
            aria-current={pathname.startsWith("/akun") ? "page" : undefined}
            className="flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-brand text-sm font-bold text-white shadow transition hover:brightness-110 sm:w-auto sm:px-4"
          >
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Akun</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
