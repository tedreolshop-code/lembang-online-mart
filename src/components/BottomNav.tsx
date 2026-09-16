"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import {
  CartIcon,
  HomeIcon,
  ReceiptIcon,
  SearchIcon,
  UserIcon,
} from "./Icons";

const ITEMS = [
  { href: "/", label: "Beranda", icon: HomeIcon },
  { href: "/cari", label: "Cari", icon: SearchIcon },
  /* dulu "Tentang Kami" — tempatnya dipakai menu Akun pelanggan;
     halaman info (Tentang Kami/Cara Pesan/Privasi) ditautkan dari /akun */
  { href: "/akun", label: "Akun", icon: UserIcon },
  { href: "/keranjang", label: "Keranjang", icon: CartIcon },
  { href: "/pesanan", label: "Pesanan", icon: ReceiptIcon },
];

/** Menu bawah khusus mobile (header menu tampil mulai md): tetap terlihat
    saat scroll, ikon + label, badge jumlah item di Keranjang. Kategori
    dicapai dari seksi kategori di Beranda (kartu/chip + tombol Lihat
    Semua Produk) dan halaman Tentang Kami lewat tab Akun. */
export default function BottomNav() {
  const pathname = usePathname();
  const { count, ready } = useCart();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden"
    >
      <div className="mx-auto flex max-w-md">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 whitespace-nowrap py-2 text-[10px] font-semibold transition ${
                active ? "text-brand" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {active && (
                <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" />
              )}
              {label === "Keranjang" && ready && count > 0 && (
                <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
