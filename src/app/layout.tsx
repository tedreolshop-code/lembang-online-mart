import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import FloatingWa from "@/components/FloatingWa";
import ThemeStyle from "@/components/ThemeStyle";
import RefCapture from "@/components/RefCapture";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { getThemeColors } from "@/lib/server-theme";

/* Mode lokal: tema tersimpan ada di localStorage yang tidak bisa dibaca
   server. Skrip inline di awal <body> ini dieksekusi parser sebelum konten
   ter-paint dan menyuntik <style> "los-theme-init-css" agar paint pertama
   sudah memakai tema pemilik — bukan fallback lalu berubah.

   Skrip HANYA menyuntik style bila localStorage memang menyimpan tema
   kustom — di mode cloud localStorage kosong, dan tanpa syarat ini jembatan
   justru memasang warna default menimpa tema dari server (kedip baru).

   Pilih style sheet (bukan atribut style di <html>) supaya tidak bentrok
   dengan hidrasi React atas elemen <html>; selektor `:root:root` membuatnya
   menang atas aturan `:root` ThemeStyle, dan ThemeStyle menghapus elemen ini
   setelah mount (saat itu nilainya sudah membaca localStorage yang sama). */
const LOCAL_THEME_INIT = `(function(){try{
var s=JSON.parse(localStorage.getItem("los_settings_v1")||"null")||{};
var re=/^#[0-9a-fA-F]{6}$/;
var p=re.test(s.colorPrimary)?s.colorPrimary:"${DEFAULT_SETTINGS.colorPrimary}";
var d=re.test(s.colorDark)?s.colorDark:"${DEFAULT_SETTINGS.colorDark}";
function c(v){return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")}
function sh(h,f){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
if(f>=0)return"#"+c(r+(255-r)*f)+c(g+(255-g)*f)+c(b+(255-b)*f);
var k=1+f;return"#"+c(r*k)+c(g*k)+c(b*k)}
var css=":root:root{--color-brand:"+p+";--color-brand-dark:"+sh(p,-0.18)+
";--color-brand-soft:"+sh(p,0.88)+";--color-navy:"+d+
";--color-navy-dark:"+sh(d,-0.22)+";--color-navy-soft:"+sh(d,0.92)+";}";
// tanpa tema kustom di localStorage (mode cloud / belum pernah diatur):
// biarkan tema dari server (SSR) yang terpasang — jangan pasang default
if(!(re.test(s.colorPrimary)||re.test(s.colorDark)))return;
var el=document.createElement("style");
el.id="los-theme-init-css";
el.textContent=css;
(document.head||document.documentElement).appendChild(el);
}catch(e){}})();`;

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: {
    default: `${DEFAULT_SETTINGS.name} — ${DEFAULT_SETTINGS.tagline}`,
    template: `%s · ${DEFAULT_SETTINGS.name}`,
  },
  description:
    "Warung online warga Lembang: mie instan, minyak, sembako, popok, dan kebutuhan harian lainnya. Belanja hemat, diantar sampai rumah.",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeColors();
  const dark = theme?.colorDark ?? "";
  return {
    themeColor: /^#[0-9a-fA-F]{6}$/.test(dark) ? dark : DEFAULT_SETTINGS.colorDark,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mode cloud: warna tersimpan dibaca di server → ThemeStyle merender
  // CSS variables yang benar sejak HTML pertama (tanpa kedip tema).
  // Mode lokal: skrip prapaint di <body> membaca localStorage sebelum
  // paint pertama, jadi tema juga sudah benar sejak awal.
  const theme = await getThemeColors();
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 font-sans md:pb-0">
        {/* Elemen pertama body → dieksekusi parser sebelum konten apa pun
            ter-paint: tema tersimpan (mode lokal) dipasang ke <html> sebelum
            Style React di bawah siap, lalu dilepas ThemeStyle saat mount. */}
        <script
          id="los-theme-init"
          dangerouslySetInnerHTML={{ __html: LOCAL_THEME_INIT }}
        />
        <CartProvider>
          <ThemeStyle initial={theme ?? undefined} />
          <Suspense fallback={null}>
            <RefCapture />
          </Suspense>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-10 pt-4 sm:px-6">
            {children}
          </main>
          <BottomNav />
          <FloatingWa />
        </CartProvider>
      </body>
    </html>
  );
}
