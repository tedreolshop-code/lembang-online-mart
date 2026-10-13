import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Next 16 mengunci `.next/dev/lock` sehingga hanya satu server dev per
     folder. Mengarahkan distDir lewat NEXT_DIST_DIR memungkinkan server dev
     kedua jalan di port lain tanpa mengganggu yang sudah hidup:
       NEXT_DIST_DIR=.next/dev-3010 npx next dev -p 3010
     Tanpa env ini nilainya tetap ".next" (perilaku tidak berubah). */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
