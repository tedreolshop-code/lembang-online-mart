"use client";

import { useSettings } from "@/lib/store";

/** Logo LEMBANG ONLINE MART.
    - Logo (default): ikon tas belanja, untuk header/footer/admin.
    - LogoFull: tas + tulisan lengkap, untuk latar putih.
    Bila pemilik mengunggah logo kustom (Admin → Tampilan), keduanya
    otomatis memakai logo tersebut. */

export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  const { logoUrl } = useSettings();
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={logoUrl || "/logo-mark.png"}
      alt=""
      aria-hidden
      className={`${className} object-contain`}
    />
  );
}

export function LogoFull({
  className = "h-10 w-auto",
}: {
  className?: string;
}) {
  const { logoUrl } = useSettings();
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={logoUrl || "/logo.png"}
      alt="Lembang Online Mart"
      className={`${className} object-contain`}
    />
  );
}
