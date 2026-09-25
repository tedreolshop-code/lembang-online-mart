import type { Metadata } from "next";

// halaman admin tidak boleh terindeks mesin pencari
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // overflow-x-auto: konten admin yang lebih lebar dari layar (tabel,
  // baris detail) tetap bisa digeser di HP — body memakai overflow-x: clip
  // untuk hero toko, jadi tanpa wrapper ini konten lebar terpotong percuma.
  return (
    <div className="w-full overflow-x-auto overscroll-x-contain">{children}</div>
  );
}
