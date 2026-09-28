"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrders, useProducts, useSettings, adjustStock, setStock, upsertProduct, deleteProduct, seedDatabase } from "@/lib/store";
import { cloudMode, adminLogin, adminLogout, hasAdminSession, localLogin, authHeaders, verifyAdminSession } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { formatRupiah } from "@/lib/format";
import { storeOrigin } from "@/lib/agent";
import { normalizeTiers } from "@/lib/pricing";
import { useCategoryCatalog, useCategories } from "@/lib/category-store";
import CategoriesTab from "@/components/admin/CategoriesTab";
import type { PriceTier, Product } from "@/lib/types";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import AgenTab from "@/components/admin/AgenTab";
import VoucherTab from "@/components/admin/VoucherTab";
import PesananTab from "@/components/admin/PesananTab";
import TampilanTab from "@/components/admin/TampilanTab";
import PengaturanTab from "@/components/admin/PengaturanTab";

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
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  const startAdd = () => {
    setEditing({ ...EMPTY_FORM, category: categories[0]?.slug ?? "" });
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    setShowForm(true);
  };

  const remove = async (p: Product) => {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    try {
      await deleteProduct(p.id);
      showToast(true, `✅ "${p.name}" berhasil dihapus.`);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : "Gagal menghapus produk.");
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

  /* eslint-disable react-hooks/purity -- cut-off laporan: waktu dibaca saat
     render (bukan state) dan tidak perlu memicu render ulang. */
  const since =
    period === "hari"
      ? new Date().setHours(0, 0, 0, 0)
      : period === "7hari"
        ? Date.now() - 7 * 86400000
        : period === "30hari"
          ? Date.now() - 30 * 86400000
          : 0;
  /* eslint-enable react-hooks/purity */

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



function slugify(name: string): string {  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `produk-${Date.now()}`
  );
}

/* ── tab pengaturan ───────────────────────────────────────────── */

/* ── tab tampilan: warna tema, logo, banner promo ─────────────── */


