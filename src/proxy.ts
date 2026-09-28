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
 *
 * Catatan Next 16: berkas ini dulu bernama `middleware.ts` — sekarang
 * `proxy.ts` (fungsi `proxy`) dengan perilaku yang sama.
 */

const SUBDOMAIN_TARGETS: Record<string, string> = {
  admin: "/admin",
  agen: "/agen/dashboard",
};

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const parts = host.split(".");

  // localhost:3000 → tidak ada subdomain bermakna
  if (parts.length >= 2) {
    const sub = parts[0];
    const target = SUBDOMAIN_TARGETS[sub];
    if (target && sub !== "www") {
      const url = req.nextUrl.clone();
      // JANGAN rewrite file statis (logo, foto produk, dsb.) — request file
      // berakhiran ekstensi akan menerima HTML halaman dan gambarnya rusak.
      const last = url.pathname.split("/").pop() ?? "";
      if (/\.[a-z0-9]+$/i.test(last)) return NextResponse.next();
      url.pathname = target;
      // bawa query (?ref=…) bila ada
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Halaman saja — API, aset Next, dan SEMUA file ber-ekstensi (logo,
  // foto, ikon) tidak perlu direwrite; memaksa file lewat rewrite membuat
  // browser menerima HTML alih-alih gambarnya.
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
