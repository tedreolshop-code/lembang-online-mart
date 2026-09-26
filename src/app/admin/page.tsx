"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrders, useProducts, updateOrderStatus, useSettings, saveSettings, adjustStock, setStock, upsertProduct, deleteProduct, acceptOrder, cancelOrder, deleteOrder, seedDatabase, listCoupons, upsertCoupon, deleteCoupon, listAgents, upsertAgent, deleteAgent, getCommissionSettings, saveCommissionSettings, listCommissions, commissionAction, overrideCommission, listAgentPrices, upsertAgentPrice, deleteAgentPrice, uploadKtp, getKtpUrl, deleteKtp } from "@/lib/store";
import { printOrderStruk } from "@/lib/printStruk";
import { cloudMode, adminLogin, adminLogout, hasAdminSession, localLogin, authHeaders, verifyAdminSession } from "@/lib/auth";
import { DEFAULT_SETTINGS, formatWaDigits, type StoreSettings } from "@/lib/config";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { agentShareLink, storeOrigin, DEFAULT_COMMISSION_SETTINGS, effectiveCommission, isCommissionReady } from "@/lib/agent";
import { normalizeTiers } from "@/lib/pricing";
import { useCategoryCatalog, useCategories } from "@/lib/category-store";
import CategoriesTab from "@/components/admin/CategoriesTab";
import type { Agent, AgentCommission, AgentPrice, CommissionSettings, Coupon, Order, OrderStatus, PriceTier, Product } from "@/lib/types";
import { BagIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import { applyThemeVars, clearThemeVars } from "@/components/ThemeStyle";
import { DEFAULT_BANNERS, type BannerSlide } from "@/lib/config";


const EMPTY_FORM: Product = {
  id: "",
  name: "",
  category: "",
  price: 0,
  unit: "1 pcs",
  emoji: "🛒",
  stock: 0,
};

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    // Token tersimpan belum tentu milik admin: Supabase Auth terbuka untuk
    // pendaftaran, jadi verifikasi ke server sebelum menampilkan dashboard.
    void (async () => {
      const ok = hasAdminSession() && (await verifyAdminSession()).ok;
      if (!ok) await adminLogout();
      if (!alive) return;
      setLoggedIn(ok);
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!checked) return null;

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;

  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}

/* ── login ────────────────────────────────────────────────────── */

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const settings = useSettings();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (cloudMode) {
        // mode database: Supabase Auth email + password
        const res = await adminLogin(email.trim(), password);
        if (!res.ok) throw new Error(res.error ?? "Login gagal.");
        // Berhasil login Supabase ≠ admin: pendaftaran akun terbuka, jadi
        // emailnya wajib terdaftar di ADMIN_EMAIL sebelum masuk dashboard.
        const cek = await verifyAdminSession();
        if (!cek.ok) {
          await adminLogout();
          throw new Error(cek.error ?? "Akun ini bukan admin.");
        }
      } else {
        // mode lokal demo: password dari Pengaturan
        if (password !== settings.adminPassword) {
          throw new Error("Password salah, coba lagi.");
        }
        localLogin();
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-2xl bg-white p-6 shadow-md">
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-3 text-center text-lg font-extrabold tracking-tight text-slate-800">
          {settings.name}
        </h1>
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
          Admin
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {cloudMode && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email admin"
              className="input text-center"
              autoFocus
              required
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={cloudMode ? "Password" : "Password admin"}
            className="input text-center"
            autoFocus={!cloudMode}
            required
          />
          {error && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-center text-sm font-semibold text-brand">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:bg-slate-300"
          >
            {busy ? "Memproses…" : "Masuk"}
          </button>
        </form>
        {cloudMode ||
        settings.adminPassword === DEFAULT_SETTINGS.adminPassword ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
            {cloudMode ? (
              "Masuk dengan akun admin Supabase."
            ) : (
              <>
                Demo: password <b className="font-mono">admin123</b>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ── dashboard ────────────────────────────────────────────────── */

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<
    "produk" | "kategori" | "stok" | "pesanan" | "laporan" | "voucher" | "agen" | "pengaturan" | "tampilan"
  >("produk");
  const [showGuide, setShowGuide] = useState(false);
  const [productCategory, setProductCategory] = useState<string | undefined>();
  const orders = useOrders();
  const pending = orders.filter((o) => o.status === "menunggu").length;
  const needStock = orders.filter(
    (o) => o.channel === "whatsapp" && !o.stockApplied,
  ).length;

  useEffect(() => {
    try {
      if (!localStorage.getItem("setupGuideDone")) {
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

const SETUP_STEPS: {
  icon: string;
  title: string;
  desc: string;
  action: { label: string; tab: "produk" | "stok" | "pengaturan" | "tampilan" | "agen" };
  checklist: string[];
}[] = [
  {
    icon: "⚙️",
    title: "1. Pengaturan Toko",
    desc: "Isi nama toko, nomor WhatsApp penerima pesanan, alamat, jam operasional, ongkir & gratis ongkir. Pastikan ADMIN_EMAIL di file .env sudah berisi email admin — kalau belum, tidak ada yang bisa masuk dashboard.",
    action: { label: "Buka Pengaturan", tab: "pengaturan" },
    checklist: [
      "Nama toko & slogan",
      "Nomor WhatsApp penerima pesanan",
      "Alamat & jam operasional",
      "Ongkir & batas gratis ongkir",
      "ADMIN_EMAIL di .env sudah diisi email admin",
    ],
  },
  {
    icon: "🔔",
    title: "2. Notifikasi Pesanan Masuk",
    desc: "Pilih metode notifikasi (Telegram / Discord / WhatsApp Fonnte) di tab Pengaturan → section Notifikasi. Klik 'Kirim Pesan Tes' untuk memastikan notifikasi sampai.",
    action: { label: "Buka Pengaturan", tab: "pengaturan" },
    checklist: [
      "Pilih metode notifikasi",
      "Isi token/chat_id atau webhook URL",
      "Klik 'Kirim Pesan Tes' — cek HP/discord",
    ],
  },
  {
    icon: "🎨",
    title: "3. Tampilan Toko",
    desc: "Pilih warna tema toko, upload logo, dan atur banner promo yang tampil di beranda.",
    action: { label: "Buka Tampilan", tab: "tampilan" },
    checklist: [
      "Pilih warna tema",
      "Upload logo toko",
      "Atur banner promo beranda",
    ],
  },
  {
    icon: "🛒",
    title: "4. Input Produk + HPP",
    desc: "Tambahkan produk beserta HARGA BELI (HPP). HPP wajib diisi agar laporan laba akurat. Tanpa HPP, laporan laba akan kelebihan karena modal tidak dihitung.",
    action: { label: "Buka Produk", tab: "produk" },
    checklist: [
      "Klik 'Muat Data Awal' jika database kosong",
      "Tambah produk: nama, kategori, harga jual",
      "Isi HPP (harga beli) — WAJIB",
      "Isi stok awal tiap produk",
    ],
  },
  {
    icon: "🤝",
    title: "5. Aturan Komisi Agen (Opsional)",
    desc: "Jika ada agen reseller, atur persentase komisi di tab Agen. Nantinya setiap pendaftaran agen baru akan muncul dengan status pending — approve untuk aktifkan. Untuk agen yang untungnya dari selisih harga, pilih mode 'Harga khusus agen' lalu isi harganya per produk.",
    action: { label: "Buka Agen", tab: "agen" },
    checklist: [
      "Set persentase komisi default",
      "Isi ketentuan komisi",
      "Approve agen yang mendaftar",
      "Isi 🏷️ Harga Khusus Agen bila pakai mode harga",
    ],
  },
];

function SetupGuide({
  onClose,
  goToTab,
}: {
  onClose: () => void;
  goToTab: (t: "produk" | "stok" | "pengaturan" | "tampilan" | "agen") => void;
}) {
  const [step, setStep] = useState(0);
  const current = SETUP_STEPS[step];
  const isLast = step === SETUP_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between bg-navy px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-extrabold">Panduan Setup Toko</h2>
            <p className="text-[11px] text-white/70">
              Langkah {step + 1} dari {SETUP_STEPS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            Lewati ✕
          </button>
        </div>

        {/* progress bar */}
        <div className="flex gap-1 bg-slate-100 px-5 py-2">
          {SETUP_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === step
                  ? "bg-brand"
                  : i < step
                    ? "bg-brand/40"
                    : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* content */}
        <div className="px-5 py-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-xl">
              {current.icon}
            </span>
            <h3 className="text-base font-extrabold text-slate-800">
              {current.title}
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            {current.desc}
          </p>

          <ul className="mb-5 space-y-2">
            {current.checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 text-[10px] text-slate-400">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                ← Sebelumnya
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {!isLast ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Lewati
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="rounded-lg bg-brand px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-dark"
                  >
                    Selanjutnya →
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Selesai nanti
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab(current.action.tab)}
                    className="rounded-lg bg-brand px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-dark"
                  >
                    {current.action.label}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-brand text-white shadow"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ── tab produk (CRUD) ────────────────────────────────────────── */

function ProdukTab({ initialCategory }: { initialCategory?: string }) {
  const products = useProducts();
  const { categories, ready, refresh } = useCategoryCatalog();
  const [editing, setEditing] = useState<Product | null>(initialCategory ? { ...EMPTY_FORM, category: initialCategory } : null);
  const [showForm, setShowForm] = useState(!!initialCategory);

  const startAdd = () => {
    setEditing({ ...EMPTY_FORM, category: categories[0]?.slug ?? "" });
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    setShowForm(true);
  };

  const remove = async (p: Product) => {
    if (confirm(`Hapus produk "${p.name}"?`)) {
      await deleteProduct(p.id);
    }
  };

  const save = async (p: Product) => {
    await upsertProduct({ ...p, id: p.id || slugify(p.name) });
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      {cloudMode && products.length === 0 && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-navy/30 bg-navy-soft p-4 text-center">
          <p className="text-sm font-bold text-navy">
            Database masih kosong
          </p>
          <p className="mt-0.5 text-xs text-navy/80">
            Muat 7 kategori &amp; 41 produk contoh + pengaturan awal ke
            database.
          </p>
          <button
            type="button"
            onClick={() => void seedDatabase().then(() => refresh())}
            className="mt-2 rounded-full bg-navy px-5 py-2 text-xs font-bold text-white shadow hover:bg-navy-dark"
          >
            Muat Data Awal ke Database
          </button>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{products.length} produk</p>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            disabled={!ready || categories.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" /> Tambah Produk
          </button>
        )}
      </div>

      {ready && categories.length === 0 && (
        <p className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Tambahkan kategori melalui tab Kategori sebelum menambah produk.</p>
      )}

      {showForm && editing && (
        <ProductForm
          initial={editing}
          isNew={!products.some((x) => x.id === editing.id)}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}

      <div className="overflow-x-auto overscroll-x-contain rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Kategori</th>
              <th className="px-3 py-2.5">Harga</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">HPP</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">Stok</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">Label</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.emoji}</span>
                    <div>
                      <div className="font-bold text-slate-700">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.unit}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {categories.find((c) => c.slug === p.category)?.name ??
                    p.category}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-extrabold text-brand">
                    {formatRupiah(p.price)}
                  </div>
                  {p.oldPrice && (
                    <div className="text-[11px] text-slate-400 line-through">
                      {formatRupiah(p.oldPrice)}
                    </div>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 text-xs sm:table-cell">
                  {p.costPrice ? (
                    <span className="text-slate-500">
                      {formatRupiah(p.costPrice)}
                    </span>
                  ) : (
                    <span className="font-bold text-brand">⚠ belum diisi</span>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <span
                    className={
                      p.stock > 0 ? "text-slate-600" : "font-bold text-brand"
                    }
                  >
                    {p.stock}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {p.isPromo && <Tag label="Promo" />}
                    {p.isBestSeller && <Tag label="Terlaris" />}
                    {p.isNew && <Tag label="Baru" />}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => startEdit(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-navy-soft hover:text-navy"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus ${p.name}`}
                      onClick={() => remove(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-soft hover:text-brand"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
      {label}
    </span>
  );
}

function ProductForm({
  initial,
  isNew,
  onCancel,
  onSave,
}: {
  initial: Product;
  isNew: boolean;
  onCancel: () => void;
  onSave: (p: Product) => void;
}) {
  const categories = useCategories();
  const [p, setP] = useState<Product>(initial);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<Product>) => setP((prev) => ({ ...prev, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!p.name.trim() || p.price <= 0) return;
    if (!p.costPrice || p.costPrice <= 0) {
      alert("Harga Beli / HPP wajib diisi. Isi modal beli per unit — dipakai hitung laba di Laporan.");
      return;
    }
    // tier grosir dibersihkan terhadap harga final (minQty > 1, harga < normal)
    onSave({ ...p, tiers: normalizeTiers(p.tiers ?? [], p.price) });
  };

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-xl border-2 border-brand/20 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-extrabold text-slate-800">
          {isNew ? "➕ Tambah Produk Baru" : `✏️ Edit: ${initial.name}`}
        </h3>
        <button
          type="button"
          aria-label="Tutup form"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="form-label">Nama Produk *</span>
          <input
            value={p.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="cth: Indomie Mi Goreng"
            className="input"
            required
          />
        </label>

        <label className="block">
          <span className="form-label">Kategori *</span>
          <select
            value={p.category}
            onChange={(e) => set({ category: e.target.value })}
            className="input"
            required
          >
            {!categories.some((c) => c.slug === p.category) && <option value={p.category}>{p.category || "Pilih kategori"}</option>}
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="form-label">Satuan / Kemasan</span>
          <input
            value={p.unit}
            onChange={(e) => set({ unit: e.target.value })}
            placeholder="cth: 1 kg"
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Harga Jual (Rp) *</span>
          <input
            type="number"
            min={0}
            value={p.price || ""}
            onChange={(e) => set({ price: Number(e.target.value) })}
            className="input"
            required
          />
        </label>

        <label className="block">
          <span className="form-label">Harga Normal (biar ada diskon)</span>
          <input
            type="number"
            min={0}
            value={p.oldPrice ?? ""}
            onChange={(e) =>
              set({
                oldPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Harga Beli / HPP (Rp) *</span>
          <input
            type="number"
            min={0}
            value={p.costPrice ?? ""}
            onChange={(e) =>
              set({
                costPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="input"
            required
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            {p.costPrice && p.costPrice > 0
              ? `Laba per unit: ${formatRupiah(p.price - p.costPrice)}${
                  p.price > p.costPrice
                    ? ` (${Math.round(((p.price - p.costPrice) / p.price) * 100)}%)`
                    : " — ⚠️ jual di bawah modal"
                }`
              : "Modal per unit — dipakai hitung laba di Laporan"}
          </span>
        </label>

        <label className="block">
          <span className="form-label">Stok</span>
          <input
            type="number"
            min={0}
            value={p.stock}
            onChange={(e) => set({ stock: Number(e.target.value) })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Emoji / Ikon Produk</span>
          <input
            value={p.emoji}
            onChange={(e) => set({ emoji: e.target.value })}
            className="input"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="form-label">URL Foto (opsional)</span>
          <input
            value={p.image ?? ""}
            onChange={(e) => set({ image: e.target.value || undefined })}
            placeholder="https://…/indomie.jpg — kosongkan bila foto sudah ditaruh di public/products/"
            className="input"
          />
          {cloudMode && (
            <span className="mt-2 block">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/upload", {
                      method: "POST",
                      headers: authHeaders(),
                      body: fd,
                    });
                    const j = (await res.json()) as { url?: string; error?: string };
                    if (j.url) set({ image: j.url });
                    else alert(j.error ?? "Upload gagal.");
                  } finally {
                    setUploading(false);
                  }
                }}
                className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                {uploading
                  ? "Mengunggah ke Storage…"
                  : "atau pilih foto dari HP untuk diunggah ke Storage"}
              </span>
            </span>
          )}
          <span className="mt-1 block text-[11px] text-slate-400">
            Tanpa URL, website otomatis mencari foto di file{" "}
            <code className="rounded bg-slate-100 px-1">
              public/products/{p.id || "&lt;id-produk&gt;"}.jpg
            </code>
            ; kalau tidak ada, tampil emoji.
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="form-label">Deskripsi Singkat</span>
          <textarea
            value={p.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            className="input resize-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Check label="Promo 🔥" checked={!!p.isPromo} onChange={(v) => set({ isPromo: v })} />
          <Check label="Terlaris ⭐" checked={!!p.isBestSeller} onChange={(v) => set({ isBestSeller: v })} />
          <Check label="Baru 🆕" checked={!!p.isNew} onChange={(v) => set({ isNew: v })} />
        </div>

        {/* harga grosir (v6) */}
        <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">
              🏷️ Harga Grosir (opsional)
            </span>
            <button
              type="button"
              onClick={() =>
                set({
                  tiers: [
                    ...(p.tiers ?? []),
                    { minQty: ((p.tiers?.at(-1)?.minQty ?? 1) + 1), price: p.price },
                  ],
                })
              }
              className="rounded-lg border-2 border-brand/40 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-soft"
            >
              + Tambah tingkat
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Harga lebih murah saat pembeli mengambil sejumlah minimum. Kosong =
            hanya harga normal.
          </p>
          {(p.tiers ?? []).length === 0 ? (
            <p className="mt-2 text-xs italic text-slate-400">
              Belum ada tingkat grosir.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {(p.tiers ?? []).map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex flex-1 items-center gap-1 text-xs text-slate-500">
                    Beli ≥
                    <input
                      type="number"
                      min={2}
                      value={t.minQty}
                      onChange={(e) =>
                        set({
                          tiers: (p.tiers ?? []).map((x, j) =>
                            j === i ? { ...x, minQty: Number(e.target.value) } : x,
                          ) as PriceTier[],
                        })
                      }
                      className="input w-20"
                    />
                  </label>
                  <label className="flex flex-1 items-center gap-1 text-xs text-slate-500">
                    Harga Rp
                    <input
                      type="number"
                      min={0}
                      value={t.price}
                      onChange={(e) =>
                        set({
                          tiers: (p.tiers ?? []).map((x, j) =>
                            j === i ? { ...x, price: Number(e.target.value) } : x,
                          ) as PriceTier[],
                        })
                      }
                      className="input w-28"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label="Hapus tingkat grosir"
                    onClick={() =>
                      set({ tiers: (p.tiers ?? []).filter((_, j) => j !== i) as PriceTier[] })
                    }
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
        >
          Simpan Produk
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#f97316]"
      />
      {label}
    </label>
  );
}

/* ── tab stok ─────────────────────────────────────────────────── */

const STOK_MENIPIS = 5;

function StokTab() {
  const products = useProducts();
  const [q, setQ] = useState("");

  const list = products
    .filter(
      (p) =>
        !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()),
    )
    .sort((a, b) => a.stock - b.stock);
  const habis = products.filter((p) => p.stock <= 0).length;
  const menipis = products.filter(
    (p) => p.stock > 0 && p.stock <= STOK_MENIPIS,
  ).length;

  return (
    <div>
      <div className="mb-3 grid max-w-md grid-cols-3 gap-2">
        <StatCard label="Total Produk" value={products.length} tone="normal" />
        <StatCard label="Stok Menipis" value={menipis} tone="warn" />
        <StatCard label="Habis" value={habis} tone="danger" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari produk…"
          className="input max-w-xs"
        />
        <span className="text-xs text-slate-400">
          Stok paling sedikit tampil paling atas
        </span>
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Stok</th>
              <th className="px-3 py-2.5 text-right">Atur Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((p) => (
              <StokRow key={p.id} product={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  isRupiah,
}: {
  label: string;
  value: number;
  tone: "normal" | "warn" | "danger";
  isRupiah?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? value > 0
        ? "text-brand"
        : "text-slate-400"
      : tone === "warn"
        ? value > 0
          ? "text-amber-600"
          : "text-slate-400"
        : "text-slate-800";
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 text-center shadow-sm">
      <div className={`truncate text-xl font-extrabold ${toneClass}`}>
        {isRupiah ? formatRupiah(value) : value}
      </div>
      <div className="truncate text-[11px] font-semibold text-slate-400">
        {label}
      </div>
    </div>
  );
}

function StokRow({ product: p }: { product: Product }) {
  const [draft, setDraft] = useState<string | null>(null);
  const tampil = draft ?? String(p.stock);

  const badge =
    p.stock <= 0 ? (
      <span className="rounded bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
        HABIS
      </span>
    ) : p.stock <= STOK_MENIPIS ? (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
        MENIPIS
      </span>
    ) : (
      <span className="text-[11px] text-slate-400">aman</span>
    );

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">{p.emoji}</span>
          <div>
            <div className="font-bold text-slate-700">{p.name}</div>
            <div className="text-[11px] text-slate-400">{p.unit}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">{badge}</td>
      <td className="px-3 py-2.5">
        <span
          className={`font-extrabold ${
            p.stock <= 0 ? "text-brand" : "text-slate-800"
          }`}
        >
          {p.stock}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label={`Kurangi stok ${p.name}`}
            onClick={() => adjustStock(p.id, -1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Tambah stok ${p.name}`}
            onClick={() => adjustStock(p.id, 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            +
          </button>
          <input
            value={tampil}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm font-bold text-slate-700 outline-none focus:border-brand"
            aria-label={`Set stok ${p.name}`}
          />
          <button
            type="button"
            onClick={() => {
              setStock(p.id, Number(draft || 0));
              setDraft(null);
            }}
            disabled={draft === null}
            className="rounded-lg bg-navy px-2.5 py-1 text-xs font-bold text-white transition hover:bg-navy-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Set
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── tab laporan ──────────────────────────────────────────────── */

type Periode = "hari" | "7hari" | "30hari" | "semua";

const PERIODE_LABEL: Record<Periode, string> = {
  hari: "Hari Ini",
  "7hari": "7 Hari",
  "30hari": "30 Hari",
  semua: "Semua",
};

function LaporanTab() {
  const orders = useOrders();
  const products = useProducts();
  const [period, setPeriod] = useState<Periode>("hari");

  const since =
    period === "hari"
      ? new Date().setHours(0, 0, 0, 0)
      : period === "7hari"
        ? Date.now() - 7 * 86400000
        : period === "30hari"
          ? Date.now() - 30 * 86400000
          : 0;

  const valid = orders.filter(
    (o) => o.status !== "dibatalkan" && o.createdAt >= since,
  );
  const omzet = valid.reduce((a, o) => a + o.total, 0);
  const barang = valid.reduce(
    (a, o) => a + o.items.reduce((s, i) => s + i.qty, 0),
    0,
  );
  // laba kotor (v7): omzet − HPP snapshot per item. Item dengan HPP 0
  // (belum diisi) ikut omzet tapi tanpa modal, jadi laba tampak lebih besar.
  const hpp = valid.reduce(
    (a, o) => a + o.items.reduce((s, i) => s + i.qty * (i.costPrice ?? 0), 0),
    0,
  );
  const laba = omzet - hpp;
  const hppKurang = products.filter((x) => !x.costPrice).length;

  const top = new Map<
    string,
    { emoji: string; name: string; qty: number; omzet: number; hpp: number }
  >();
  for (const o of valid) {
    for (const i of o.items) {
      const cur = top.get(i.productId) ?? {
        emoji: i.emoji,
        name: i.name,
        qty: 0,
        omzet: 0,
        hpp: 0,
      };
      cur.qty += i.qty;
      cur.omzet += i.price * i.qty;
      cur.hpp += i.qty * (i.costPrice ?? 0);
      top.set(i.productId, cur);
    }
  }
  const topList = [...top.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const dibatalkan = orders.filter(
    (o) => o.status === "dibatalkan" && o.createdAt >= since,
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
          <TabButton key={p} active={period === p} onClick={() => setPeriod(p)}>
            {PERIODE_LABEL[p]}
          </TabButton>
        ))}
      </div>

      <div className="mb-2 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Omzet" value={omzet} tone="normal" isRupiah />
        <StatCard label="Laba Kotor" value={laba} tone="normal" isRupiah />
        <StatCard label="Modal (HPP)" value={hpp} tone="normal" isRupiah />
        <StatCard label="Transaksi" value={valid.length} tone="normal" />
        <StatCard label="Barang Terjual" value={barang} tone="normal" />
      </div>
      {hppKurang > 0 && (
        <p className="mb-4 text-xs text-slate-400">
          ⚠️ Harga Beli/HPP belum diisi untuk {hppKurang} produk — laba di atas
          kelebihan karena barang itu dihitung tanpa modal. Isi di Admin →
          Produk pada kolom Harga Beli / HPP.
        </p>
      )}

      {dibatalkan > 0 && (
        <p className="mb-4 text-xs text-slate-400">
          {dibatalkan} pesanan dibatalkan tidak ikut dihitung.
        </p>
      )}

      <h3 className="mb-2 font-extrabold text-slate-800">
        Produk Paling Laris {period === "semua" ? "" : `(${PERIODE_LABEL[period]})`}
      </h3>
      {topList.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Belum ada penjualan pada periode ini. 📈
        </div>
      ) : (
        <div className="max-w-xl overflow-x-auto overscroll-x-contain rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Produk</th>
                <th className="px-3 py-2.5">Terjual</th>
                <th className="px-3 py-2.5 text-right">Omzet (Laba)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topList.map((t, i) => (
                <tr key={t.id}>
                  <td className="px-3 py-2.5">
                    <span className="mr-1 text-slate-300">#{i + 1}</span>
                    {t.emoji} <b className="text-slate-700">{t.name}</b>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-700">
                    {t.qty}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-brand">
                    {formatRupiah(t.omzet)}
                    {t.hpp > 0 && (
                      <div className="text-[11px] font-semibold text-slate-400">
                        laba {formatRupiah(t.omzet - t.hpp)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── tab pesanan ──────────────────────────────────────────────── */

function PesananTab() {
  const orders = useOrders();
  const products = useProducts();
  const settings = useSettings();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  if (orders.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm">
        <BagIcon className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-2 font-bold text-slate-700">Belum ada pesanan masuk</p>
        <p className="mt-1 text-sm text-slate-500">
          Pesanan dari form checkout akan muncul di sini. Pesanan lewat WhatsApp
          masuk langsung ke chat WhatsApp warung.
        </p>
      </div>
    );
  }

  const terima = async (o: Order) => {
    await acceptOrder(o);
  };

  // tampilkan toast lalu hilangkan otomatis (pesanan dihapus / gagal)
  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  // hapus permanen: konfirmasi ketik id → baru dihapus + notifikasi hasil
  const hapus = async (o: Order) => {
    const jawab = prompt(
      `⚠️ Hapus permanen pesanan ${o.id}?\n\n` +
        `Tindakan ini TIDAK bisa dibatalkan: data pesanan hilang dari daftar ` +
        `dan laporan. Ketik HAPUS untuk melanjutkan.`,
    );
    if (jawab === null) return; // dibatalkan
    if (jawab.trim().toUpperCase() !== "HAPUS") {
      showToast(false, "❌ Penghapusan dibatalkan — ketikan tidak sesuai.");
      return;
    }
    try {
      await deleteOrder(o.id);
      showToast(true, `✅ Pesanan ${o.id} berhasil dihapus.`);
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Gagal menghapus pesanan.",
      );
    }
  };

  const stokCukup = (o: Order) =>
    o.items.every((i) => {
      const p = products.find((x) => x.id === i.productId);
      return !p || p.stock >= i.qty;
    });

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-navy-soft p-3 text-xs text-navy sm:text-sm">
        📦 Pesanan <b>form checkout</b> otomatis mengurangi stok. Pesanan{" "}
        <b>WhatsApp</b>: tekan "Terima" setelah pelanggan konfirmasi agar stok
        juga berkurang.
      </div>
      {orders.map((o: Order) => (
        <div key={o.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="break-all font-mono font-extrabold text-slate-800">
                {o.id}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                {formatDateTime(o.createdAt)}
              </span>
              {o.agentCode && (
                <span
                  className="ml-2 rounded bg-navy-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy"
                  title={
                    (o.agentCommission ?? 0) > 0
                      ? `Komisi agen ${formatRupiah(o.agentCommission ?? 0)}`
                      : "Agen tercatat tanpa komisi (lihat tab Agen)"
                  }
                >
                  🤝 {o.agentCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.status === "dibatalkan" && (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  dibatalkan
                </span>
              )}
              {o.channel === "whatsapp" && !o.stockApplied && o.status !== "dibatalkan" && (
                <button
                  type="button"
                  onClick={() => terima(o)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow transition hover:brightness-95 ${
                    stokCukup(o) ? "bg-brand" : "bg-slate-400"
                  }`}
                  title={
                    stokCukup(o)
                      ? "Kurangi stok & proses pesanan"
                      : "Stok tidak cukup — stok akan dikurangi sebisanya"
                  }
                >
                  Terima &amp; kurangi stok
                </button>
              )}
              {o.stockApplied && o.status !== "dibatalkan" && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ stok dikurangi
                </span>
              )}
              <select
                value={o.status}
                onChange={(e) =>
                  updateOrderStatus(o.id, e.target.value as OrderStatus)
                }
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold capitalize outline-none"
              >
                <option value="menunggu">menunggu</option>
                <option value="diproses">diproses</option>
                <option value="selesai">selesai</option>
                <option value="dibatalkan">dibatalkan</option>
              </select>
              {o.status !== "dibatalkan" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      confirm(
                        `Batalkan pesanan ${o.id}? Stok yang sudah dikurangi akan dikembalikan.`,
                      )
                    ) {
                      await cancelOrder(o);
                    }
                  }}
                  title="Batalkan pesanan & kembalikan stok"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                >
                  Batalkan
                </button>
              )}
              <button
                type="button"
                onClick={() => printOrderStruk(o, settings)}
                title="Cetak struk pesanan"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-brand/40 hover:text-brand"
              >
                🖨 Struk
              </button>
              <button
                type="button"
                onClick={() => void hapus(o)}
                title="Hapus permanen pesanan"
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Hapus
              </button>
            </div>
          </div>

          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div className="text-slate-600">
              <p className="font-bold text-slate-700">{o.customer.name}</p>
              <p>{o.customer.phone}</p>
              <p className="text-xs">{o.customer.address}</p>
              {o.customer.note && (
                <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  📝 {o.customer.note}
                </p>
              )}
            </div>
            <ul className="text-slate-600">
              {o.items.map((i) => {
                const p = products.find((x) => x.id === i.productId);
                return (
                  <li key={i.productId}>
                    {i.emoji} {i.name}{" "}
                    <span className="text-slate-400">×{i.qty}</span>
                    {o.stockApplied && p && (
                      <span className="text-[11px] text-slate-400">
                        {" "}
                        · sisa {p.stock}
                      </span>
                    )}
                  </li>
                );
              })}
              <li className="mt-1 border-t border-dashed border-slate-200 pt-1 font-bold text-slate-800">
                Total: {formatRupiah(o.total)}{" "}
                <span className="font-normal text-slate-400">
                  ({o.payment})
                </span>
              </li>
            </ul>
          </div>
        </div>
      ))}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition ${
            toast.ok ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/** Tab Voucher — pemilik membuat kode potongan harga. Pembeli mengetik
    kodenya di halaman checkout; validasi final tetap di server. */
function VoucherTab() {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [err, setErr] = useState("");
  // "sekarang" diambil saat memuat data — bukan saat render (render harus murni)
  const [now, setNow] = useState(0);
  const [form, setForm] = useState({
    code: "",
    label: "",
    kind: "percent" as "percent" | "fixed",
    value: "",
    minSubtotal: "",
    maxUses: "",
    expiresAt: "",
  });
  const [msg, setMsg] = useState("");

  const load = () =>
    listCoupons()
      .then((c) => {
        setNow(Date.now());
        setList(c);
        setErr("");
      })
      .catch((e: unknown) => {
        setList([]);
        setErr(e instanceof Error ? e.message : "Gagal memuat voucher.");
      });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertCoupon({
        code: form.code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        label: form.label.trim(),
        kind: form.kind,
        value: Math.round(Number(form.value)),
        minSubtotal: Math.round(Number(form.minSubtotal || 0)),
        maxUses: form.maxUses.trim() === "" ? null : Math.round(Number(form.maxUses)),
        usedCount: list?.find((x) => x.code === form.code.toUpperCase())?.usedCount ?? 0,
        active: true,
        expiresAt: form.expiresAt.trim() === "" ? null : form.expiresAt.trim(),
      });
      setMsg(`Voucher tersimpan. Pembeli tinggal mengetik kodenya di checkout.`);
      setForm({ code: "", label: "", kind: "percent", value: "", minSubtotal: "", maxUses: "", expiresAt: "" });
      load();
    } catch (e2) {
      setMsg(e2 instanceof Error ? `Gagal: ${e2.message}` : "Gagal menyimpan voucher.");
    }
    setTimeout(() => setMsg(""), 4000);
  };

  const toggle = async (c: Coupon) => {
    await upsertCoupon({ ...c, active: !c.active }).catch((e: unknown) =>
      setErr(e instanceof Error ? e.message : "Gagal"),
    );
    load();
  };

  const hapus = async (c: Coupon) => {
    if (!confirm(`Hapus voucher ${c.code}?`)) return;
    await deleteCoupon(c.code).catch((e: unknown) =>
      setErr(e instanceof Error ? e.message : "Gagal"),
    );
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-navy-soft p-4 text-sm text-navy">
        🎟️ Pembeli mengetik kode voucher di halaman <b>checkout</b>. Potongan
        dihitung ulang oleh server — kode palsu tidak akan mempan.
      </div>

      {err && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          ⚠️ {err}
        </div>
      )}

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <h3 className="font-extrabold text-slate-800 sm:col-span-2 lg:col-span-4">
          ➕ Buat Voucher Baru
        </h3>
        <label className="block">
          <span className="form-label">Kode *</span>
          <input
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
            placeholder="HEMAT10"
            required
            className="input font-mono uppercase"
            maxLength={20}
          />
        </label>
        <label className="block">
          <span className="form-label">Label (opsional)</span>
          <input
            value={form.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="Voucher warga Lembang"
            className="input"
            maxLength={60}
          />
        </label>
        <label className="block">
          <span className="form-label">Jenis</span>
          <select
            value={form.kind}
            onChange={(e) => set({ kind: e.target.value as "percent" | "fixed" })}
            className="input"
          >
            <option value="percent">Persen (%)</option>
            <option value="fixed">Nominal (Rp)</option>
          </select>
        </label>
        <label className="block">
          <span className="form-label">
            {form.kind === "percent" ? "Nilai % (1–90) *" : "Nilai Rp *"}
          </span>
          <input
            type="number"
            min={1}
            max={form.kind === "percent" ? 90 : undefined}
            required
            value={form.value}
            onChange={(e) => set({ value: e.target.value })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Min. Belanja (Rp)</span>
          <input
            type="number"
            min={0}
            value={form.minSubtotal}
            onChange={(e) => set({ minSubtotal: e.target.value })}
            placeholder="0"
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Kuota Pakai (kosong = tanpa batas)</span>
          <input
            type="number"
            min={1}
            value={form.maxUses}
            onChange={(e) => set({ maxUses: e.target.value })}
            placeholder="mis. 100"
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Berlaku Sampai (opsional)</span>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => set({ expiresAt: e.target.value })}
            className="input"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            Simpan Voucher
          </button>
        </div>
        {msg && (
          <p className="text-xs font-bold text-emerald-600 sm:col-span-2 lg:col-span-4">
            {msg}
          </p>
        )}
      </form>

      {!list ? (
        <p className="text-sm text-slate-400">Memuat voucher…</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-3xl">🎟️</p>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Belum ada voucher — buat di atas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const habis = c.maxUses != null && c.usedCount >= c.maxUses;
            const expired =
              now > 0 && !!c.expiresAt && Date.parse(c.expiresAt + "T23:59:59") < now;
            return (
              <div
                key={c.code}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="min-w-40 flex-1">
                  <span className="font-mono text-sm font-extrabold text-slate-800">
                    {c.code}
                  </span>
                  {c.label && (
                    <span className="ml-2 text-xs text-slate-400">{c.label}</span>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.kind === "percent" ? `Diskon ${c.value}%` : `Potongan ${formatRupiah(c.value)}`}
                    {c.minSubtotal > 0 && ` · min. ${formatRupiah(c.minSubtotal)}`}
                    {c.maxUses != null && ` · kuota ${c.usedCount}/${c.maxUses}`}
                    {c.expiresAt && ` · s/d ${c.expiresAt}`}
                  </p>
                </div>
                {(habis || expired) && (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {expired ? "kedaluwarsa" : "kuota habis"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    c.active
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                  }`}
                >
                  {c.active ? "aktif" : "nonaktif"}
                </button>
                <button
                  type="button"
                  onClick={() => hapus(c)}
                  aria-label={`Hapus voucher ${c.code}`}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── tab agen (v6): aturan komisi + daftar agen + ledger pencairan ── */

const AGENT_STATUS_LABEL: Record<Agent["status"], string> = {
  pending: "Menunggu persetujuan",
  aktif: "Aktif",
  nonaktif: "Nonaktif",
};

const EMPTY_AGENT_FORM = {
  code: "",
  nama: "",
  wa: "",
  alamat: "",
  payMethod: "ewallet" as Agent["payMethod"],
  payTarget: "",
  commissionMode: "percent" as NonNullable<Agent["commissionMode"]>,
  commissionPercent: "",
  status: "pending" as Agent["status"],
  ktpUrl: "" as string,
};

/* ── baris editor harga khusus agen per produk (v9) ──────────── */

function AgentPriceRow({
  product,
  currentPrice,
  onSave,
  onDelete,
}: {
  product: Product;
  currentPrice?: number;
  onSave: (price: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [val, setVal] = useState(
    currentPrice != null ? String(currentPrice) : "",
  );
  const [busy, setBusy] = useState(false);

  const num = Math.round(Number(val));
  const changed = num > 0 && num !== currentPrice;
  const belowCost =
    product.costPrice != null &&
    product.costPrice > 0 &&
    num > 0 &&
    num < product.costPrice;

  const save = async () => {
    if (!changed || busy) return;
    setBusy(true);
    try {
      await onSave(num);
      setVal(String(num));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan harga agen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
      setVal("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menghapus harga agen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td className="px-3 py-2">
        <span className="mr-1.5">{product.emoji}</span>
        <span className="font-semibold text-slate-700">{product.name}</span>
        <span className="ml-1.5 text-[11px] text-slate-400">{product.unit}</span>
      </td>
      <td className="hidden px-3 py-2 text-xs text-slate-500 sm:table-cell">
        {formatRupiah(product.price)}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="cth: 45000"
          className={`input max-w-36 py-1.5 text-sm ${
            belowCost ? "border-red-400" : ""
          }`}
          aria-label={`Harga agen untuk ${product.name}`}
        />
        {belowCost && product.costPrice != null && product.costPrice > 0 && (
          <span className="ml-1.5 text-[10px] font-bold text-red-500">
            ⚠ di bawah HPP {formatRupiah(product.costPrice)}
          </span>
        )}
        {currentPrice != null && num > 0 && num !== currentPrice && (
          <span className="ml-1.5 text-[10px] text-slate-400">
            ganti dari {formatRupiah(currentPrice)}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!changed || busy}
            className="rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            {busy ? "…" : "Simpan"}
          </button>
          {currentPrice != null && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-400 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
            >
              Hapus
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AgenTab() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [commissions, setCommissions] = useState<AgentCommission[] | null>(null);
  const [agentPrices, setAgentPrices] = useState<AgentPrice[] | null>(null);
  const [settings, setSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);
  const [err, setErr] = useState("");
  const [priceErr, setPriceErr] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(0);
  const [form, setForm] = useState(EMPTY_AGENT_FORM);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [priceAgent, setPriceAgent] = useState<string | null>(null);
  const [ktpPreview, setKtpPreview] = useState<string>("");
  const [ktpBusy, setKtpBusy] = useState(false);
  const [ktpError, setKtpError] = useState("");

  const products = useProducts();

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 4000);
  };

  const load = () =>
    Promise.all([listAgents(), listCommissions(), getCommissionSettings()])
      .then(([a, c, s]) => {
        setAgents(a);
        setCommissions(c);
        setSettings(s);
        setNow(Date.now());
        setErr("");
        // harga khusus agen (v9) dimuat terpisah: bila alter-v9.sql belum
        // dijalankan, tabelnya belum ada — kelola agen tetap harus jalan
        return listAgentPrices()
          .then((ap) => {
            setAgentPrices(ap);
            setPriceErr("");
          })
          .catch((e: unknown) => {
            setAgentPrices([]);
            setPriceErr(
              e instanceof Error
                ? e.message
                : "Harga khusus agen belum bisa dimuat.",
            );
          });
      })
      .catch((e: unknown) => {
        setAgents([]);
        setCommissions([]);
        setAgentPrices([]);
        setErr(e instanceof Error ? e.message : "Gagal memuat data agen.");
      });
  useEffect(() => {
    load();
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  /* ── upload KTP ────────────────────────────────────────────── */
  const handleKtpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Untuk agen baru (code belum ada), simpan ke sementara & upload setelah agen tersimpan
    if (!cloudMode) {
      setKtpError("Upload KTP hanya tersedia di mode cloud (database terhubung).");
      return;
    }
    setKtpBusy(true);
    setKtpError("");
    try {
      // Bila agen sudah ada (edit mode), upload langsung
      if (form.code) {
        const { ktpUrl, warning } = await uploadKtp(form.code, file);
        setKtpPreview(ktpUrl);
        set({ ktpUrl });
        flash(warning ?? "Foto KTP berhasil diunggah.");
      } else {
        // Untuk agen baru: upload sementara — simpan setelah agen tersimpan
        setKtpError("Simpan agen dulu, lalu unggah foto KTP.");
      }
    } catch (err) {
      setKtpError(err instanceof Error ? err.message : "Upload KTP gagal.");
    } finally {
      setKtpBusy(false);
    }
  };

  const handleKtpDelete = async () => {
    if (!form.code) return;
    if (!confirm("Hapus foto KTP agen ini?")) return;
    setKtpBusy(true);
    setKtpError("");
    try {
      await deleteKtp(form.code);
      setKtpPreview("");
      set({ ktpUrl: "" });
      flash("Foto KTP dihapus.");
    } catch (err) {
      setKtpError(err instanceof Error ? err.message : "Gagal menghapus KTP.");
    } finally {
      setKtpBusy(false);
    }
  };

  /* ── aturan komisi ──────────────────────────────────────────── */
  const setS = (patch: Partial<CommissionSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const saveAturan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCommissionSettings(settings);
      flash("Aturan komisi tersimpan — pesanan baru memakai aturan ini.");
    } catch (e2) {
      flash(e2 instanceof Error ? `Gagal: ${e2.message}` : "Gagal menyimpan aturan.");
    }
  };

  /* ── agen ───────────────────────────────────────────────────── */
  const submitAgen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { code, warning } = await upsertAgent({
        code: form.code,
        nama: form.nama.trim(),
        wa: formatWaDigits(form.wa),
        alamat: form.alamat.trim(),
        payMethod: form.payMethod,
        payTarget: form.payTarget.trim(),
        commissionMode: form.commissionMode,
        commissionPercent:
          form.commissionMode === "percent" &&
          form.commissionPercent.trim() !== ""
            ? Math.round(Number(form.commissionPercent))
            : null,
        status: form.status,
        totalKlik: agents?.find((a) => a.code === form.code)?.totalKlik ?? 0,
        ktpUrl: form.ktpUrl || undefined,
      });
      flash(
        warning ??
          (form.commissionMode === "price"
            ? `Agen tersimpan (${code}). Atur harga khususnya di bagian "Harga Khusus Agen" di bawah.`
            : `Agen tersimpan. Kode: ${code} — bagikan tautan referral-nya.`),
      );
      setForm(EMPTY_AGENT_FORM);
      setEditingCode(null);
      setKtpPreview("");
      load();
    } catch (e2) {
      flash(e2 instanceof Error ? `Gagal: ${e2.message}` : "Gagal menyimpan agen.");
    }
  };

  const editAgen = async (a: Agent) => {
    setForm({
      code: a.code,
      nama: a.nama,
      wa: a.wa,
      alamat: a.alamat,
      payMethod: a.payMethod,
      payTarget: a.payTarget,
      commissionMode: a.commissionMode ?? "percent",
      commissionPercent: a.commissionPercent == null ? "" : String(a.commissionPercent),
      status: a.status,
      ktpUrl: a.ktpUrl ?? "",
    });
    setEditingCode(a.code);
    setKtpError("");
    // Ambil signed URL KTP bila sudah ada
    setKtpPreview("");
    if (cloudMode && a.code) {
      const url = await getKtpUrl(a.code).catch(() => null);
      if (url) setKtpPreview(url);
    }
  };

  const setStatusAgen = async (a: Agent, status: Agent["status"]) => {
    await upsertAgent({ ...a, status }).catch((e: unknown) =>
      flash(e instanceof Error ? e.message : "Gagal mengubah status."),
    );
    load();
  };

  const hapusAgen = async (a: Agent) => {
    if (!confirm(`Hapus agen ${a.nama} (${a.code})?`)) return;
    await deleteAgent(a.code).catch((e: unknown) =>
      flash(e instanceof Error ? e.message : "Gagal menghapus."),
    );
    load();
  };

  const salinLink = async (a: Agent) => {
    // domain toko dari env bila diset — jangan pakai origin subdomain admin
    const link =
      typeof window === "undefined"
        ? a.code
        : agentShareLink(a.code, storeOrigin());
    try {
      await navigator.clipboard.writeText(link);
      flash(`Tautan referral ${a.code} disalin — tinggal dibagikan.`);
    } catch {
      flash(`Tautan: ${link}`);
    }
  };

  /* ── ledger komisi ──────────────────────────────────────────── */
  const aksi = async (
    c: AgentCommission,
    action: "bayar" | "batal" | "ulang",
  ) => {
    try {
      await commissionAction(c, action);
      load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Aksi gagal.");
    }
  };

  const koreksi = async (c: AgentCommission) => {
    const cur = effectiveCommission(c);
    const raw = prompt(
      `Koreksi manual nilai komisi pesanan ${c.orderId} (Rp).\nKosongkan untuk menghapus koreksi.`,
      String(cur),
    );
    if (raw === null) return;
    const v = raw.trim() === "" ? null : Math.max(0, Math.round(Number(raw)));
    try {
      await overrideCommission(c, v);
      load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Koreksi gagal.");
    }
  };

  const totals = (commissions ?? []).reduce(
    (acc, c) => {
      const n = effectiveCommission(c);
      if (c.status === "pending") {
        acc.pending += n;
        if (isCommissionReady(c, now)) acc.ready += n;
      } else if (c.status === "dibayar") acc.paid += n;
      return acc;
    },
    { pending: 0, ready: 0, paid: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-navy-soft p-4 text-sm text-navy">
        🤝 Pembeli yang datang dari <b>tautan referral agen</b> (atau mengetik
        kode agen di checkout) otomatis tercatat. Komisi dihitung saat pesanan
        dibuat, lalu bisa dicairkan setelah masa tunggu lewat{" "}
        <b>pesanan selesai</b>. Nilai komisi tersimpan sebagai snapshot —
        mengubah aturan tidak mengubah pesanan lama.
      </div>

      {err && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          ⚠️ {err}
        </div>
      )}
      {msg && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {msg}
        </div>
      )}

      {/* ── aturan komisi ── */}
      <form
        onSubmit={saveAturan}
        className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <h3 className="font-extrabold text-slate-800 sm:col-span-2 lg:col-span-4">
          ⚙️ Aturan Komisi
        </h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={settings.aktif}
            onChange={(e) => setS({ aktif: e.target.checked })}
            className="h-4 w-4 accent-[#f97316]"
          />
          Program aktif
        </label>
        <label className="block">
          <span className="form-label">Jenis</span>
          <select
            value={settings.kind}
            onChange={(e) =>
              setS({ kind: e.target.value as CommissionSettings["kind"] })
            }
            className="input"
          >
            <option value="percent">Persen (%)</option>
            <option value="fixed">Nominal Rp tetap / pesanan</option>
          </select>
        </label>
        <label className="block">
          <span className="form-label">
            {settings.kind === "percent" ? "Nilai % (1–20) *" : "Nilai Rp *"}
          </span>
          <input
            type="number"
            min={settings.kind === "percent" ? 1 : 0}
            max={settings.kind === "percent" ? 20 : undefined}
            required
            value={settings.value}
            onChange={(e) => setS({ value: Math.round(Number(e.target.value)) })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Dasar perhitungan</span>
          <select
            value={settings.basis}
            onChange={(e) =>
              setS({ basis: e.target.value as CommissionSettings["basis"] })
            }
            className="input"
          >
            <option value="after_discount">Setelah potongan voucher</option>
            <option value="subtotal">Subtotal penuh</option>
          </select>
        </label>
        <label className="block">
          <span className="form-label">Min. belanja (Rp, 0 = tanpa)</span>
          <input
            type="number"
            min={0}
            value={settings.minOrderAmount}
            onChange={(e) => setS({ minOrderAmount: Math.round(Number(e.target.value)) })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Lantai komisi (Rp, 0 = tanpa)</span>
          <input
            type="number"
            min={0}
            value={settings.minAmount}
            onChange={(e) => setS({ minAmount: Math.round(Number(e.target.value)) })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Plafon komisi (Rp, 0 = tanpa)</span>
          <input
            type="number"
            min={0}
            value={settings.maxAmount}
            onChange={(e) => setS({ maxAmount: Math.round(Number(e.target.value)) })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Masa berlaku tautan (hari)</span>
          <input
            type="number"
            min={1}
            value={settings.linkDays}
            onChange={(e) => setS({ linkDays: Math.max(1, Math.round(Number(e.target.value))) })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="form-label">Masa tunggu cair (hari)</span>
          <input
            type="number"
            min={0}
            value={settings.holdDays}
            onChange={(e) => setS({ holdDays: Math.max(0, Math.round(Number(e.target.value))) })}
            className="input"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            Simpan Aturan
          </button>
        </div>
      </form>

      {/* ── daftar agen ── */}
      <form
        onSubmit={submitAgen}
        className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <h3 className="font-extrabold text-slate-800 sm:col-span-2 lg:col-span-4">
          {editingCode ? `✏️ Edit Agen: ${form.nama} (${form.code})` : "➕ Daftarkan Agen Baru"}
        </h3>
        <label className="block">
          <span className="form-label">Nama *</span>
          <input
            value={form.nama}
            onChange={(e) => set({ nama: e.target.value })}
            placeholder="cth: Bu Iis"
            required
            className="input"
            maxLength={80}
          />
        </label>
        <label className="block">
          <span className="form-label">No. WhatsApp *</span>
          <input
            value={form.wa}
            onChange={(e) => set({ wa: e.target.value })}
            placeholder="0812xxxxxxx"
            required
            inputMode="tel"
            className="input"
            maxLength={20}
          />
        </label>
        <label className="block">
          <span className="form-label">Alamat (opsional)</span>
          <input
            value={form.alamat}
            onChange={(e) => set({ alamat: e.target.value })}
            className="input"
            maxLength={200}
          />
        </label>
        <label className="block">
          <span className="form-label">Status</span>
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value as Agent["status"] })}
            className="input"
          >
            <option value="pending">Pending</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </label>
        <label className="block">
          <span className="form-label">Bayar via</span>
          <select
            value={form.payMethod}
            onChange={(e) =>
              set({ payMethod: e.target.value as Agent["payMethod"] })
            }
            className="input"
          >
            <option value="ewallet">E-wallet</option>
            <option value="transfer">Transfer bank</option>
          </select>
        </label>
        <label className="block">
          <span className="form-label">No. rekening / e-wallet</span>
          <input
            value={form.payTarget}
            onChange={(e) => set({ payTarget: e.target.value })}
            placeholder="data pribadi — tidak pernah tampil ke pembeli"
            className="input"
            maxLength={80}
          />
        </label>
        {/* Upload KTP agen (v10) */}
        <div className="block sm:col-span-2 lg:col-span-4">
          <span className="form-label">Foto KTP Agen</span>
          <div className="mt-1 flex flex-wrap items-start gap-4">
            {ktpPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ktpPreview}
                  alt={`KTP ${form.nama || "agen"}`}
                  className="h-40 w-64 rounded-xl border border-slate-200 object-cover shadow-sm"
                />
                <button
                  type="button"
                  disabled={ktpBusy}
                  onClick={handleKtpDelete}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600 disabled:opacity-40"
                  aria-label="Hapus foto KTP"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className={`flex h-40 w-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand/40 hover:text-brand ${ktpBusy ? "pointer-events-none opacity-60" : ""}`}>
                <span className="text-3xl">📷</span>
                <span className="text-xs font-semibold">
                  {ktpBusy ? "Mengunggah…" : form.code ? "Klik untuk upload KTP" : "Simpan agen dulu, lalu upload KTP"}
                </span>
                <span className="text-[10px] text-slate-400">JPG/PNG/WebP, maks. 4 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleKtpUpload}
                  disabled={ktpBusy || !form.code}
                  className="hidden"
                />
              </label>
            )}
            <div className="flex-1">
              {ktpError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  {ktpError}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500">
                Foto KTP wajib diunggah untuk verifikasi identitas agen.
                Hanya bisa dilihat oleh admin. Disimpan di Supabase Storage
                bucket <code className="text-slate-600">agent-ktp</code>.
              </p>
              {!form.code && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
                  ⚠ Simpan agen terlebih dahulu, lalu edit untuk upload KTP.
                </p>
              )}
            </div>
          </div>
        </div>
        <label className="block">
          <span className="form-label">Mode Komisi</span>
          <select
            value={form.commissionMode}
            onChange={(e) =>
              set({
                commissionMode: e.target.value as NonNullable<
                  Agent["commissionMode"]
                >,
              })
            }
            className="input"
          >
            <option value="percent">Komisi persen (%)</option>
            <option value="price">Harga khusus agen</option>
          </select>
        </label>
        {form.commissionMode === "price" ? (
          <p className="self-end rounded-lg bg-brand-soft px-3 py-2 text-xs leading-relaxed text-slate-600">
            Keuntungan agen dari <b>selisih harga khusus</b> — tidak pakai
            komisi persen. Harga wajib diisi per produk di bagian{" "}
            <b>🏷️ Harga Khusus Agen</b> setelah agen tersimpan.
          </p>
        ) : (
          <label className="block">
            <span className="form-label">
              Komisi khusus % (kosong = ikut aturan)
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={form.commissionPercent}
              onChange={(e) => set({ commissionPercent: e.target.value })}
              placeholder="mis. 10"
              className="input"
            />
          </label>
        )}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            {editingCode ? "Simpan Perubahan" : "Daftarkan Agen"}
          </button>
          {editingCode && (
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_AGENT_FORM);
                setEditingCode(null);
                setKtpPreview("");
                setKtpError("");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {!agents ? (
        <p className="text-sm text-slate-400">Memuat data agen…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-3xl">🤝</p>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Belum ada agen — daftarkan di atas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((a) => (
            <div
              key={a.code}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="min-w-44 flex-1">
                <span className="text-sm font-bold text-slate-800">{a.nama}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-600">
                  {a.code}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  {a.wa}
                  {a.commissionMode === "price"
                    ? ` · harga khusus (${(agentPrices ?? []).filter((x) => x.agentCode === a.code).length} produk)`
                    : a.commissionPercent != null &&
                      ` · komisi khusus ${a.commissionPercent}%`}
                  {a.payTarget && ` · ${a.payMethod}: ${a.payTarget}`}
                  {` · ${a.totalKlik} klik`}
                  {a.ktpUrl ? " · KTP ✓" : " · KTP belum diunggah"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  a.status === "aktif"
                    ? "bg-emerald-100 text-emerald-700"
                    : a.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {AGENT_STATUS_LABEL[a.status]}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => salinLink(a)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-brand/40 hover:text-brand"
                >
                  🔗 Tautan
                </button>
                {a.ktpUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      const url = await getKtpUrl(a.code).catch(() => null);
                      if (url) window.open(url, "_blank");
                      else flash("Gagal memuat foto KTP.");
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-brand/40 hover:text-brand"
                  >
                    🪪 KTP
                  </button>
                )}
                {a.status === "aktif" && (
                  <button
                    type="button"
                    onClick={() => setPriceAgent(a.code)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-brand/40 hover:text-brand"
                  >
                    🏷️ Harga
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => editAgen(a)}
                  aria-label={`Edit agen ${a.nama}`}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-brand/40 hover:text-brand"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                {a.status !== "aktif" ? (
                  <button
                    type="button"
                    onClick={() => setStatusAgen(a, "aktif")}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    Aktifkan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatusAgen(a, "nonaktif")}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-200"
                  >
                    Nonaktifkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => hapusAgen(a)}
                  aria-label={`Hapus agen ${a.nama}`}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── harga khusus agen (v9) ── */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-slate-800">🏷️ Harga Khusus Agen</h3>
          <select
            value={priceAgent ?? ""}
            onChange={(e) => setPriceAgent(e.target.value || null)}
            className="input max-w-60"
          >
            <option value="">— Pilih agen —</option>
            {(agents ?? []).filter((a) => a.status === "aktif").map((a) => (
              <option key={a.code} value={a.code}>
                {a.nama} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Atur harga jual khusus per produk untuk agen terpilih. Pembeli yang
          datang dari referral agen akan dapat harga ini (menimpa harga normal
          &amp; grosir). Kosongkan = ikut harga normal.
        </p>
        {priceErr && (
          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            ⚠️ {priceErr}
          </div>
        )}
        {priceAgent &&
          (agents ?? []).find((a) => a.code === priceAgent)
            ?.commissionMode === "price" &&
          (agentPrices ?? []).filter((x) => x.agentCode === priceAgent)
            .length === 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700">
              ⚠️ Agen ini memakai mode <b>Harga Khusus</b> tapi belum ada satu
              pun harga yang diisi. Isi harga di bawah — tanpa harga, pembeli
              referral tetap bayar harga normal dan agen tidak dapat keuntungan.
            </div>
          )}

        {priceAgent && (
          <div className="mt-3 overflow-x-auto overscroll-x-contain rounded-lg border border-slate-100">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Harga Normal</th>
                  <th className="px-3 py-2">Harga Agen</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs italic text-slate-400">
                      Belum ada produk — tambahkan produk dulu di tab Produk.
                    </td>
                  </tr>
                )}
                {products.map((p) => {
                  const ap = (agentPrices ?? []).find(
                    (x) => x.agentCode === priceAgent && x.productId === p.id,
                  );
                  return (
                    <AgentPriceRow
                      key={p.id}
                      product={p}
                      currentPrice={ap?.price}
                      onSave={async (price) => {
                        await upsertAgentPrice({
                          agentCode: priceAgent,
                          productId: p.id,
                          price,
                        });
                        flash(`Harga agen untuk ${p.name} disimpan.`);
                        load();
                      }}
                      onDelete={async () => {
                        await deleteAgentPrice(priceAgent, p.id);
                        flash(`Harga khusus ${p.name} dihapus — kembali ke harga normal.`);
                        load();
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ledger komisi ── */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-slate-800">📒 Komisi Terjadi</h3>
          <div className="flex gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
              menunggu {formatRupiah(totals.pending)}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              siap cair {formatRupiah(totals.ready)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              dibayar {formatRupiah(totals.paid)}
            </span>
          </div>
        </div>
        {!commissions ? (
          <p className="mt-3 text-sm text-slate-400">Memuat ledger…</p>
        ) : commissions.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-400">
            Belum ada komisi tercatat — pesanan dengan kode agen akan muncul di sini.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {commissions.map((c) => {
              const n = effectiveCommission(c);
              const ready = isCommissionReady(c, now);
              return (
                <div
                  key={c.id ?? c.orderId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3"
                >
                  <div className="min-w-44 flex-1">
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {c.orderId}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-slate-400">
                      {c.agentCode}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {n > 0
                        ? `${c.percentUsed > 0 ? `${c.percentUsed}% · ` : ""}basis ${formatRupiah(c.basisAmount)}`
                        : c.note || "tanpa catatan"}
                      {c.overrideAmount != null && " · dikoreksi admin"}
                      {c.readyAt &&
                        (ready
                          ? " · siap cair"
                          : ` · cair ${formatDateTime(Date.parse(c.readyAt))}`)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      c.status === "dibayar"
                        ? "bg-slate-100 text-slate-600"
                        : c.status === "pending"
                          ? ready
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                          : "bg-red-50 text-red-600"
                    }`}
                  >
                    {c.status === "pending"
                      ? ready
                        ? "siap dicairkan"
                        : "menunggu"
                      : c.status}
                  </span>
                  <span className="w-24 text-right text-sm font-extrabold text-slate-800">
                    {formatRupiah(n)}
                  </span>
                  <div className="flex gap-1.5">
                    {c.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => aksi(c, "bayar")}
                        disabled={!ready && n > 0}
                        title={ready ? "Tandai sudah dibayar" : "Belum lewat masa tunggu"}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Bayar
                      </button>
                    )}
                    {c.status !== "batal" && (
                      <button
                        type="button"
                        onClick={() => aksi(c, "batal")}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500 hover:border-red-300 hover:text-red-500"
                      >
                        Batal
                      </button>
                    )}
                    {c.status === "batal" && n > 0 && (
                      <button
                        type="button"
                        onClick={() => aksi(c, "ulang")}
                        className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                      >
                        Aktifkan lagi
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => koreksi(c)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500 hover:border-brand/40 hover:text-brand"
                    >
                      Koreksi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function slugify(name: string): string {  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `produk-${Date.now()}`
  );
}

/* ── tab pengaturan ───────────────────────────────────────────── */

/* ── tab tampilan: warna tema, logo, banner promo ─────────────── */

const PRESET_TEMA: { nama: string; primary: string; dark: string }[] = [
  { nama: "Merah & Oranye", primary: "#f97316", dark: "#b91c1c" },
  { nama: "Navy & Oranye", primary: "#f97316", dark: "#0a3472" },
  { nama: "Merah Putih", primary: "#d81e2e", dark: "#1a3c8b" },
  { nama: "Hijau Segar", primary: "#16a34a", dark: "#14532d" },
  { nama: "Ungu Modern", primary: "#8b5cf6", dark: "#3b0764" },
  { nama: "Merah Maroon", primary: "#e11d48", dark: "#4c0519" },
  { nama: "Teal Toska", primary: "#0d9488", dark: "#134e4a" },
];

function TampilanTab() {
  const settings = useSettings();
  const [primary, setPrimary] = useState(settings.colorPrimary);
  const [dark, setDark] = useState(settings.colorDark);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [banners, setBanners] = useState<BannerSlide[]>(settings.banners);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");

  // pratinjau langsung saat warna diubah (belum tersimpan)
  useEffect(() => {
    applyThemeVars(primary, dark);
    return () => clearThemeVars();
  }, [primary, dark]);

  const setBanner = (i: number, patch: Partial<BannerSlide>) =>
    setBanners((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveSettings({
      ...settings,
      colorPrimary: primary,
      colorDark: dark,
      logoUrl,
      banners,
    });
    if (res.warning) {
      setNote(res.warning);
      setSaved(false);
    } else {
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  /** Unggah gambar (logo / foto banner) langsung dari perangkat.
      Cloud → Supabase Storage lewat /api/upload; lokal → data URL
      (tersimpan di localStorage settings). `pasang` menerima URL hasil. */
  const uploadGambar = async (
    file: File,
    pasang: (url: string) => void,
  ): Promise<void> => {
    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 2MB.");
      return;
    }
    if (!/^image\//.test(file.type)) {
      alert("File harus berupa gambar (PNG/JPG/WebP).");
      return;
    }
    if (!cloudMode) {
      const url = await new Promise<string>((ok, no) => {
        const reader = new FileReader();
        reader.onload = () => ok(String(reader.result));
        reader.onerror = () => no(new Error("baca gagal"));
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (url) pasang(url);
      else alert("Gagal membaca file.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (j.url) pasang(j.url);
      else alert(j.error ?? "Upload gagal.");
    } catch {
      alert("Upload gagal — periksa koneksi lalu coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <div className="rounded-xl bg-navy-soft p-4 text-sm text-navy">
        🎨 Ganti <b>warna toko</b>, <b>logo</b>, dan <b>banner promo</b> di
        sini — perubahan warna langsung terlihat, klik{" "}
        <b>Simpan Tampilan</b> agar permanen.
      </div>

      {/* ── warna tema ── */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-extrabold text-slate-800">
          🌈 Warna Toko
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMA.map((t) => (
            <button
              key={t.nama}
              type="button"
              onClick={() => {
                setPrimary(t.primary);
                setDark(t.dark);
              }}
              className={`flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-xs font-bold transition ${
                primary === t.primary && dark === t.dark
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full border border-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${t.primary} 50%, ${t.dark} 50%)` }}
              />
              {t.nama}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label">Warna Utama (tombol, harga)</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
              <input
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                placeholder="#dc2626"
                className="input font-mono text-xs"
              />
            </span>
          </label>
          <label className="block">
            <span className="form-label">Warna Gelap (banner &amp; tombol)</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
              />
              <input
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                placeholder="#991b1b"
                className="input font-mono text-xs"
              />
            </span>
          </label>
        </div>
        {/* pratinjau kecil */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: dark }}
          >
            <span className="text-sm font-extrabold">{settings.name}</span>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ backgroundColor: primary }}
            >
              Belanja
            </span>
          </div>
          <div className="bg-slate-50 px-4 py-2 text-xs font-bold" style={{ color: primary }}>
            Rp15.000
          </div>
        </div>
      </div>

      {/* ── logo ── */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-extrabold text-slate-800">🖼️ Logo Toko</h3>
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl || "/logo-mark.png"}
              alt="Logo saat ini"
              className="max-h-full max-w-full object-contain"
            />
          </span>
          <div className="flex-1 space-y-2">
            {/* upload langsung dari perangkat di semua mode
                (cloud → Storage, lokal → tersimpan di browser) */}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // izinkan memilih file yang sama lagi
                if (file) void uploadGambar(file, setLogoUrl);
              }}
              className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white disabled:opacity-50"
            />
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="text-xs font-bold text-brand hover:underline"
              >
                Kembalikan ke logo bawaan
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          {uploading
            ? "Mengunggah…"
            : cloudMode
              ? "Pilih file PNG/JPG dari perangkat (maks 2MB) — langsung terunggah ke Storage."
              : "Mode lokal: gambar tersimpan di browser ini."}
        </p>
      </div>

      {/* ── banner promo ── */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800">
            🪧 Banner Promo (beranda)
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setBanners((prev) => [
                  ...prev,
                  {
                    title: "PROMO BARU ✨",
                    subtitle: "Tulis keterangan promo di sini",
                    cta: "Lihat",
                    href: "/kategori",
                    color: "otomatis",
                    image: "",
                  },
                ])
              }
              disabled={banners.length >= 8}
              className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-navy-dark disabled:bg-slate-300"
            >
              + Tambah Slide
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {banners.map((b, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">
                  Slide {i + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Hapus slide ${i + 1}`}
                  onClick={() => setBanners((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg bg-brand-soft p-1 text-brand hover:bg-brand hover:text-white"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="form-label">Judul</span>
                  <input
                    value={b.title}
                    onChange={(e) => setBanner(i, { title: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="form-label">Keterangan</span>
                  <input
                    value={b.subtitle}
                    onChange={(e) => setBanner(i, { subtitle: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="form-label">Teks Tombol</span>
                  <input
                    value={b.cta}
                    onChange={(e) => setBanner(i, { cta: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="form-label">Tautan</span>
                  <input
                    value={b.href}
                    onChange={(e) => setBanner(i, { href: e.target.value })}
                    placeholder="/kategori/sembako"
                    className="input"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="form-label">Warna Banner</span>
                  <span className="flex items-center gap-2">
                    <select
                      value={b.color === "otomatis" ? "otomatis" : "kustom"}
                      onChange={(e) =>
                        setBanner(i, {
                          color:
                            e.target.value === "otomatis"
                              ? "otomatis"
                              : dark,
                        })
                      }
                      className="input w-40"
                    >
                      <option value="otomatis">Warna gelap toko</option>
                      <option value="kustom">Pilih sendiri…</option>
                    </select>
                    {b.color !== "otomatis" && (
                      <input
                        type="color"
                        value={b.color}
                        onChange={(e) => setBanner(i, { color: e.target.value })}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                      />
                    )}
                  </span>
                </label>
                <div className="sm:col-span-2">
                  <span className="form-label">Foto Hero (sisi kanan)</span>
                  <div className="flex items-center gap-3">
                    {/* pratinjau kecil — kosong = foto bawaan toko */}
                    <span className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.image.trim() || "/hero-toko.jpg"}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file)
                          void uploadGambar(file, (url) =>
                            setBanner(i, { image: url }),
                          );
                      }}
                      className="block min-w-0 flex-1 text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white disabled:opacity-50"
                    />
                    {b.image && (
                      <button
                        type="button"
                        onClick={() => setBanner(i, { image: "" })}
                        className="shrink-0 text-xs font-bold text-brand hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Unggah langsung dari perangkat (PNG/JPG maks 2MB) — kosong =
                    foto bawaan.
                  </p>
                </div>
              </div>
              {/* pratinjau banner */}
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-white"
                style={{
                  backgroundColor:
                    b.color === "otomatis" ? dark : b.color,
                }}
              >
                <span className="text-xs font-extrabold">{b.title || "…"}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: primary }}
                >
                  {b.cta || "Lihat"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setBanners(DEFAULT_BANNERS)}
          className="text-xs font-bold text-slate-400 hover:text-brand hover:underline"
        >
          Kembalikan ke banner bawaan
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
        >
          Simpan Tampilan
        </button>
        {saved && (
          <span className="text-sm font-bold text-emerald-600">
            ✓ Tersimpan &amp; langsung berlaku
          </span>
        )}
        {note && (
          <span className="text-xs font-semibold text-amber-600">⚠️ {note}</span>
        )}
      </div>
    </form>
  );
}

/* ── tab pengaturan umum ──────────────────────────────────────── */

function PengaturanTab() {
  const settings = useSettings();
  const [form, setForm] = useState<StoreSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [tes, setTes] = useState("");

  const set = (patch: Partial<StoreSettings>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ ...form, whatsapp: formatWaDigits(form.whatsapp) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <div className="rounded-xl bg-navy-soft p-4 text-sm text-navy">
        ✏️ Semua perubahan di sini <b>langsung berlaku</b> di seluruh halaman
        website — tanpa perlu ngoding. Data tersimpan di browser ini.
      </div>

      <div className="grid gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="block sm:col-span-2">
          <span className="form-label">Nama Toko</span>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className="input"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="form-label">Slogan / Tagline</span>
          <input
            value={form.tagline}
            onChange={(e) => set({ tagline: e.target.value })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Nomor WhatsApp Pesanan *</span>
          <input
            value={form.whatsapp}
            onChange={(e) => set({ whatsapp: e.target.value })}
            placeholder="08xxxxxxxxxx"
            className="input"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Ketik 08… nanti otomatis dirapikan jadi 62…
          </span>
        </label>

        <label className="block">
          <span className="form-label">Jam Operasional</span>
          <input
            value={form.hours}
            onChange={(e) => set({ hours: e.target.value })}
            className="input"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="form-label">Alamat Toko</span>
          <input
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Ongkir (Rp)</span>
          <input
            type="number"
            min={0}
            value={form.ongkir}
            onChange={(e) => set({ ongkir: Number(e.target.value) })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Gratis Ongkir Mulai (Rp)</span>
          <input
            type="number"
            min={0}
            value={form.freeOngkirMin}
            onChange={(e) => set({ freeOngkirMin: Number(e.target.value) })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Ongkir Xpress / Instan (Rp)</span>
          <input
            type="number"
            min={0}
            value={form.xpressOngkir}
            onChange={(e) => set({ xpressOngkir: Number(e.target.value) })}
            className="input"
          />
        </label>

        <label className="block">
          <span className="form-label">Label Opsi Xpress</span>
          <input
            value={form.xpressLabel}
            onChange={(e) => set({ xpressLabel: e.target.value })}
            placeholder="Xpress / Instan (hari yang sama)"
            className="input"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="form-label">Keterangan Ongkir</span>
          <textarea
            value={form.ongkirNote}
            onChange={(e) => set({ ongkirNote: e.target.value })}
            rows={3}
            placeholder="Kurir apa, area mana saja, estimasi tiba berapa lama…"
            className="input resize-none text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Ditampilkan di keranjang &amp; checkout, plus tercetak di struk
            bila relevan.
          </span>
        </label>

        {/* ── metode pembayaran ── */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              💳 Metode Pembayaran
            </h3>
            <p className="text-xs text-slate-400">
              Atur pilihan yang muncul saat pembeli memilih pembayaran. COD
              bisa dimatikan, dan metode transfer/e-wallet bisa ditambah,
              diedit, atau dihapus.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <span>
              <span className="block text-sm font-bold text-slate-800">
                COD (Bayar di Tempat)
              </span>
              <span className="text-xs text-slate-500">
                Pembeli bayar tunai saat barang tiba
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.codEnabled}
              onChange={(e) => set({ codEnabled: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-brand"
            />
          </label>

          <div className="space-y-2">
            {form.paymentMethods.map((m, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={m.label}
                    onChange={(e) =>
                      set({
                        paymentMethods: form.paymentMethods.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Nama metode, mis. DANA"
                    className="input flex-1 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        paymentMethods: form.paymentMethods.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  value={m.detail}
                  onChange={(e) =>
                    set({
                      paymentMethods: form.paymentMethods.map((x, j) =>
                        j === i ? { ...x, detail: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Tujuan, mis. DANA 0812-3456-7890 a.n. Budi"
                  className="input text-sm"
                />
                <input
                  value={m.note}
                  onChange={(e) =>
                    set({
                      paymentMethods: form.paymentMethods.map((x, j) =>
                        j === i ? { ...x, note: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Instruksi singkat, mis. Kirim bukti transfer ke WhatsApp"
                  className="input text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const presets = [
                  { id: "dana", label: "DANA", detail: "", note: "" },
                  { id: "ovo", label: "OVO", detail: "", note: "" },
                  { id: "gopay", label: "GoPay", detail: "", note: "" },
                  { id: "shopeepay", label: "ShopeePay", detail: "", note: "" },
                  { id: "bank", label: "Transfer Bank", detail: "", note: "" },
                ];
                const dipakai = new Set(
                  form.paymentMethods.map((m) => m.id.toLowerCase()),
                );
                const preset =
                  presets.find((p) => !dipakai.has(p.id)) ??
                  presets.find((p) => !dipakai.has(p.id + "-2")) ?? {
                    id: `metode-${Date.now()}`,
                    label: "Metode Baru",
                    detail: "",
                    note: "",
                  };
                set({
                  paymentMethods: [
                    ...form.paymentMethods,
                    {
                      ...preset,
                      id: dipakai.has(preset.id) ? `${preset.id}-2` : preset.id,
                    },
                  ],
                });
              }}
              className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-500 transition hover:border-brand/50 hover:text-brand"
            >
              + Tambah Metode (Bank, DANA, OVO, GoPay, …)
            </button>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Kosongkan daftar ini (hapus semua) bila hanya ingin menawarkan
              COD. Id metode dipakai untuk mencatat pilihan pembeli di
              pesanan — jangan diubah-ubah setelah dipakai.
            </p>
          </div>
        </div>

        {/* ── notifikasi pesanan masuk ── */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              🔔 Notifikasi Pesanan Masuk
            </h3>
            <p className="text-xs text-slate-400">
              Pemilik langsung diberi tahu di WhatsApp/Telegram/Discord setiap
              ada pesanan baru dari website. Discord webhook juga menerima
              notifikasi pendaftaran agen baru.
            </p>
          </div>

          <label className="block">
            <span className="form-label">Metode Notifikasi</span>
            <select
              value={form.notifyProvider}
              onChange={(e) =>
                set({ notifyProvider: e.target.value as StoreSettings["notifyProvider"] })
              }
              className="input"
            >
              <option value="off">Matikan</option>
              <option value="fonnte">WhatsApp via Fonnte (fonnte.com)</option>
              <option value="telegram">Telegram Bot</option>
              <option value="discord">Discord Webhook</option>
            </select>
          </label>

          {form.notifyProvider !== "off" && (
            <>
              {form.notifyProvider === "discord" ? (
                <label className="block">
                  <span className="form-label">Discord Webhook URL</span>
                  <input
                    value={form.discordWebhook}
                    onChange={(e) =>
                      set({ discordWebhook: e.target.value })
                    }
                    placeholder="https://discord.com/api/webhooks/…"
                    className="input"
                  />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="form-label">
                      {form.notifyProvider === "fonnte"
                        ? "Nomor WA Penerima (62…)"
                        : "Chat ID Telegram"}
                    </span>
                    <input
                      value={form.notifyTarget}
                      onChange={(e) =>
                        set({ notifyTarget: e.target.value })
                      }
                      placeholder={
                        form.notifyProvider === "fonnte"
                          ? "6281234567890"
                          : "cth: 123456789 (dari @userinfobot)"
                      }
                      className="input"
                    />
                  </label>
                  <label className="block">
                    <span className="form-label">
                      {form.notifyProvider === "fonnte"
                        ? "Token Fonnte (dari dashboard fonnte.com)"
                        : "Token Bot (dari @BotFather)"}
                    </span>
                    <input
                      type="password"
                      value={form.notifyToken}
                      onChange={(e) =>
                        set({ notifyToken: e.target.value })
                      }
                      placeholder={
                        form.notifyToken
                          ? "tersimpan — kosongkan bila tidak diubah"
                          : "tempel token di sini"
                      }
                      className="input"
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (cloudMode) {
                      setTes("Mengirim…");
                      try {
                        const res = await fetch("/api/notify/test", {
                          method: "POST",
                          headers: authHeaders(),
                        });
                        const j = (await res.json()) as { error?: string };
                        setTes(
                          res.ok
                            ? "✅ Terkirim! Cek chat penerima."
                            : `❌ ${j.error ?? "gagal"}`,
                        );
                      } catch {
                        setTes("❌ Gagal terhubung ke server.");
                      }
                    } else {
                      setTes(
                        "ℹ️ Notifikasi otomatis aktif saat mode database (Supabase) terhubung.",
                      );
                    }
                  }}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white shadow hover:bg-navy-dark"
                >
                  Kirim Pesan Tes
                </button>
                {tes && <span className="text-xs font-semibold text-slate-600">{tes}</span>}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {form.notifyProvider === "fonnte"
                  ? "Fonnte punya paket gratis: daftar di fonnte.com → hubungkan device WhatsApp → salin token."
                  : form.notifyProvider === "telegram"
                    ? "Buat bot lewat @BotFather → salin token → kirim pesan ke bot sekali → ambil chat_id lewat @userinfobot."
                    : "Discord: Server Settings → Integrations → Webhooks → New Webhook → salin URL. Webhook ini juga menerima notifikasi pendaftaran agen baru."}
              </p>
            </>
          )}
        </div>

        {cloudMode ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400 sm:col-span-2">
            Password admin dikelola lewat Supabase Auth (Dashboard →
            Authentication → Users).
          </p>
        ) : (
          <label className="block sm:col-span-2">
            <span className="form-label">Password Admin</span>
            <input
              value={form.adminPassword}
              onChange={(e) => set({ adminPassword: e.target.value })}
              className="input"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Berlaku untuk login berikutnya — jangan sampai lupa!
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
        >
          Simpan Pengaturan
        </button>
        {saved && (
          <span className="text-sm font-bold text-emerald-600">
            ✓ Tersimpan &amp; langsung berlaku
          </span>
        )}
      </div>
    </form>
  );
}
