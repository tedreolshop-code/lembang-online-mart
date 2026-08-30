"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { CartIcon, GridIcon, HeartIcon, HomeIcon, ReceiptIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Beranda", icon: HomeIcon },
  { href: "/kategori", label: "Kategori", icon: GridIcon },
  { href: "/favorit", label: "Favorit", icon: HeartIcon },
  { href: "/keranjang", label: "Keranjang", icon: CartIcon },
  { href: "/pesanan", label: "Pesanan", icon: ReceiptIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] sm:hidden">
      <div className="mx-auto flex max-w-md">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                active ? "text-brand" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {label === "Keranjang" && count > 0 && (
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
