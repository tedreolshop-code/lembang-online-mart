import { NextResponse, type NextRequest } from "next/server";

/**
 * Link khusus login via subdomain (1 deployment, tanpa project terpisah):
 *   admin.<domain>  →  halaman login admin (/admin)
 *   agen.<domain>   →  login/dashboard agen (/agen/dashboard)
 *
 * Cara kerjanya REWRITE, bukan redirect: URL bar tetap admin.domain, jadi
 * admin bisa bookmark alamat pendek itu. Path lama (/admin, /agen/...)
 * tetap berfungsi di domain utama — subdomain hanya pintasan masuk.
 *
 * Domain aktif diset lewat env NEXT_PUBLIC_STORE_ORIGIN (mis.
 * https://lembangonlinemart.com) agar bisa diganti tanpa deploy ulang kode;
 * tanpa env, semua host kecuali localhost dianggap domain produksi.
 */

const SUBDOMAIN_TARGETS: Record<string, string> = {
  admin: "/admin",
  agen: "/agen/dashboard",
};

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const parts = host.split(".");

  // localhost:3000 → tidak ada subdomain bermakna
  if (parts.length >= 2) {
    const sub = parts[0];
    const target = SUBDOMAIN_TARGETS[sub];
    if (target && sub !== "www") {
      const url = req.nextUrl.clone();
      url.pathname = target;
      // bawa query (?ref=…) bila ada
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Halaman saja — API & aset statis tidak perlu direwrite.
  matcher: [
    // jalankan untuk semua request kecuali file internal Next & API
    "/((?!api/|_next/|favicon.ico|images/|products/).*)",
  ],
};
