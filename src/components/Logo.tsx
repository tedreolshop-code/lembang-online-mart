/** Logo sementara LEMBANG ONLINE STORE — tas belanja merah-putih-biru.
    Ganti di sini (dan di src/app/icon.svg) saat logo final sudah ada. */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <rect width="48" height="48" rx="11" fill="#D81E2E" />
      {/* pegangan tas (biru) */}
      <path
        d="M17.5 18.5v-3a6.5 6.5 0 0 1 13 0v3"
        fill="none"
        stroke="#1A3C8B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* badan tas (putih) */}
      <rect x="13" y="18.5" width="22" height="17" rx="4" fill="#FFFFFF" />
      {/* huruf L (digambar sebagai path agar terbaca di ukuran kecil) */}
      <path d="M20 22.5H23.4V29.3H28V32.5H20Z" fill="#1A3C8B" />
    </svg>
  );
}
