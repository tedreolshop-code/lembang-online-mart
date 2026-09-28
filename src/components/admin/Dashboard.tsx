"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrders } from "@/lib/store";
import { adminLogout } from "@/lib/auth";
import { storeOrigin } from "@/lib/agent";
import CategoriesTab from "@/components/admin/CategoriesTab";
import { TabButton } from "@/components/admin/ui";
import AgenTab from "@/components/admin/AgenTab";
import VoucherTab from "@/components/admin/VoucherTab";
import PesananTab from "@/components/admin/PesananTab";
import TampilanTab from "@/components/admin/TampilanTab";
import PengaturanTab from "@/components/admin/PengaturanTab";
import SetupGuide from "@/components/admin/SetupGuide";
import ProdukTab from "@/components/admin/ProdukTab";
import StokTab from "@/components/admin/StokTab";
import LaporanTab from "@/components/admin/LaporanTab";

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<
    "produk" | "kategori" | "stok" | "pesanan" | "laporan" | "voucher" | "agen" | "pengaturan" | "tampilan"
  >("produk");
  const [showGuide, setShowGuide] = useState(false);
  const [productCategory, setProductCategory] = useState<string | undefined>();
  const orders = useOrders();
  const pending = orders.filter((o) => o.status === "menunggu").length;

  useEffect(() => {
    try {
      if (!localStorage.getItem("setupGuideDone")) {
        // panduan onboarding dibaca sekali dari localStorage (bukan render berantai)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowGuide(true);
      }
    } catch {
      // SSR or storage blocked — skip
    }
  }, []);

  const closeGuide = () => {
    try {
      localStorage.setItem("setupGuideDone", "1");
    } catch {
      // ignore
    }
    setShowGuide(false);
  };

  const goToTab = (t: typeof tab) => {
    setTab(t);
    closeGuide();
  };

  return (
    <div className="pb-24">
      {showGuide && <SetupGuide onClose={closeGuide} goToTab={goToTab} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
          Dashboard Admin 🧑‍💼
        </h1>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem("setupGuideDone");
            } catch {
              // ignore
            }
            setShowGuide(true);
          }}
          className="rounded-full border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/10"
        >
          ? Panduan Setup
        </button>
        <div className="flex items-center gap-2">
          {/* di subdomain admin.*, semua path diarahkan ke login — jadi tombol
              keluar ke toko memakai domain utama dari env bila diset */}
          {storeOrigin() ? (
            <a
              href={storeOrigin()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand/40"
            >
              Lihat Toko
            </a>
          ) : (
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand/40"
            >
              Lihat Toko</Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await adminLogout();
              onLogout();
            }}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
          >
            Keluar
          </button>
        </div>
      </div>

      {tab === "produk" ? (
        <ProdukTab initialCategory={productCategory} />
      ) : tab === "kategori" ? (
        <CategoriesTab onAddProduct={(slug) => { setProductCategory(slug); setTab("produk"); }} />
      ) : tab === "stok" ? (
        <StokTab />
      ) : tab === "pesanan" ? (
        <PesananTab />
      ) : tab === "laporan" ? (
        <LaporanTab />
      ) : tab === "voucher" ? (
        <VoucherTab />
      ) : tab === "agen" ? (
        <AgenTab />
      ) : tab === "tampilan" ? (
        <TampilanTab />
      ) : (
        <PengaturanTab />
      )}

      {/* menu tab di bawah layar (fixed) — mengikuti pola BottomNav toko;
          dapat digeser horizontal bila sempit, isi konten diberi pb agar
          tidak tertutup */}
      <nav
        aria-label="Menu admin"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur"
      >
        <div className="no-scrollbar mx-auto flex max-w-3xl gap-2 overflow-x-auto">
          <TabButton active={tab === "produk"} onClick={() => { setProductCategory(undefined); setTab("produk"); }}>
            🛒 Produk
          </TabButton>
          <TabButton active={tab === "kategori"} onClick={() => setTab("kategori")}>
            🗂️ Kategori
          </TabButton>
          <TabButton active={tab === "stok"} onClick={() => setTab("stok")}>
            📦 Stok
          </TabButton>
          <TabButton
            active={tab === "pesanan"}
            onClick={() => setTab("pesanan")}
          >
            🧾 Pesanan
            {pending > 0 && (
              <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                {pending}
              </span>
            )}
          </TabButton>
          <TabButton
            active={tab === "laporan"}
            onClick={() => setTab("laporan")}
          >
            📊 Laporan
          </TabButton>
          <TabButton
            active={tab === "voucher"}
            onClick={() => setTab("voucher")}
          >
            🎟️ Voucher
          </TabButton>
          <TabButton active={tab === "agen"} onClick={() => setTab("agen")}>
            🤝 Agen
          </TabButton>
          <TabButton
            active={tab === "tampilan"}
            onClick={() => setTab("tampilan")}
          >
            🎨 Tampilan
          </TabButton>
          <TabButton
            active={tab === "pengaturan"}
            onClick={() => setTab("pengaturan")}
          >
            ⚙️ Pengaturan
          </TabButton>
        </div>
      </nav>
    </div>
  );
}

/* ── panduan setup onboarding (muncul saat first login) ───────── */

export default Dashboard;
