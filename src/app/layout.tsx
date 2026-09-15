import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ThemeStyle from "@/components/ThemeStyle";
import RefCapture from "@/components/RefCapture";
import { DEFAULT_SETTINGS } from "@/lib/config";

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

export const viewport: Viewport = {
  themeColor: "#b91c1c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 font-sans md:pb-0">
        <CartProvider>
          <ThemeStyle />
          <Suspense fallback={null}>
            <RefCapture />
          </Suspense>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-10 pt-4 sm:px-6">
            {children}
          </main>
          <BottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
