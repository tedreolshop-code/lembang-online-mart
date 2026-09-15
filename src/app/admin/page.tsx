"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrders, useProducts, updateOrderStatus, useSettings, saveSettings, adjustStock, setStock, upsertProduct, deleteProduct, acceptOrder, cancelOrder, seedDatabase, listCoupons, upsertCoupon, deleteCoupon, listAgents, upsertAgent, deleteAgent, getCommissionSettings, saveCommissionSettings, listCommissions, commissionAction, overrideCommission } from "@/lib/store";
import { printOrderStruk } from "@/lib/printStruk";
import { cloudMode, adminLogin, adminLogout, hasAdminSession, localLogin, authHeaders } from "@/lib/auth";
import { DEFAULT_SETTINGS, formatWaDigits, type StoreSettings } from "@/lib/config";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { agentShareLink, DEFAULT_COMMISSION_SETTINGS, effectiveCommission, isCommissionReady } from "@/lib/agent";
import { normalizeTiers } from "@/lib/pricing";
import { CATEGORIES } from "@/data/seed";
import type { Agent, AgentCommission, CommissionSettings, Coupon, Order, OrderStatus, PriceTier, Product } from "@/lib/types";
import { BagIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import { applyThemeVars, clearThemeVars } from "@/components/ThemeStyle";
import { DEFAULT_BANNERS, type BannerSlide } from "@/lib/config";


const EMPTY_FORM: Product = {
  id: "",
  name: "",
  category: "mie-instan",
  price: 0,
  unit: "1 pcs",
  emoji: "🛒",
  stock: 0,
};

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setLoggedIn(hasAdminSession());
    setChecked(true);
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
        <h1 className="mt-3 text-center text-lg font-extrabold text-slate-800">
          Admin {settings.name}
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          Masuk untuk mengelola produk, pesanan &amp; pengaturan warung
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
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
          {cloudMode ? (
            <>
              Mode database aktif — login memakai akun admin Supabase
              (dibuat di Dashboard → Authentication).
            </>
          ) : settings.adminPassword === DEFAULT_SETTINGS.adminPassword ? (
            <>
              Demo: password <b className="font-mono">admin123</b> (bisa diganti
              di menu Pengaturan)
            </>
          ) : (
            "Password sudah diganti pemilik toko."
          )}
        </p>
      </div>
    </div>
  );
}

/* ── dashboard ────────────────────────────────────────────────── */

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<
    "produk" | "stok" | "pesanan" | "laporan" | "voucher" | "agen" | "pengaturan" | "tampilan"
  >("produk");
  const orders = useOrders();
  const pending = orders.filter((o) => o.status === "menunggu").length;
  const needStock = orders.filter(
    (o) => o.channel === "whatsapp" && !o.stockApplied,
  ).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
          Dashboard Admin 🧑‍💼
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand/40"
          >
            Lihat Toko
          </Link>
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

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton active={tab === "produk"} onClick={() => setTab("produk")}>
          🛒 Produk
        </TabButton>
        <TabButton active={tab === "stok"} onClick={() => setTab("stok")}>
          📦 Stok
        </TabButton>
        <TabButton active={tab === "pesanan"} onClick={() => setTab("pesanan")}>
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
        <TabButton active={tab === "voucher"} onClick={() => setTab("voucher")}>
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

      {tab === "produk" ? (
        <ProdukTab />
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
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-brand text-white shadow"
          : "bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ── tab produk (CRUD) ────────────────────────────────────────── */

function ProdukTab() {
  const products = useProducts();
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startAdd = () => {
    setEditing({ ...EMPTY_FORM });
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
            onClick={() => void seedDatabase()}
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
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" /> Tambah Produk
          </button>
        )}
      </div>

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

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Kategori</th>
              <th className="px-3 py-2.5">Harga</th>
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
                  {CATEGORIES.find((c) => c.slug === p.category)?.name ??
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
  const [p, setP] = useState<Product>(initial);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<Product>) => setP((prev) => ({ ...prev, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!p.name.trim() || p.price <= 0) return;
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
          >
            {CATEGORIES.map((c) => (
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

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
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
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <div className={`text-xl font-extrabold ${toneClass}`}>
        {isRupiah ? formatRupiah(value) : value}
      </div>
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
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

  const top = new Map<string, { emoji: string; name: string; qty: number; omzet: number }>();
  for (const o of valid) {
    for (const i of o.items) {
      const cur = top.get(i.productId) ?? {
        emoji: i.emoji,
        name: i.name,
        qty: 0,
        omzet: 0,
      };
      cur.qty += i.qty;
      cur.omzet += i.price * i.qty;
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

      <div className="mb-4 grid max-w-xl grid-cols-3 gap-2">
        <StatCard label="Omzet" value={omzet} tone="normal" isRupiah />
        <StatCard label="Transaksi" value={valid.length} tone="normal" />
        <StatCard label="Barang Terjual" value={barang} tone="normal" />
      </div>

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
        <div className="max-w-xl overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Produk</th>
                <th className="px-3 py-2.5">Terjual</th>
                <th className="px-3 py-2.5 text-right">Omzet</th>
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
              <span className="font-mono font-extrabold text-slate-800">
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
  commissionPercent: "",
  status: "pending" as Agent["status"],
};

function AgenTab() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [commissions, setCommissions] = useState<AgentCommission[] | null>(null);
  const [settings, setSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(0);
  const [form, setForm] = useState(EMPTY_AGENT_FORM);
  const [editingCode, setEditingCode] = useState<string | null>(null);

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
      })
      .catch((e: unknown) => {
        setAgents([]);
        setCommissions([]);
        setErr(e instanceof Error ? e.message : "Gagal memuat data agen.");
      });
  useEffect(() => {
    load();
  }, []);

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

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
      const code = await upsertAgent({
        code: form.code,
        nama: form.nama.trim(),
        wa: formatWaDigits(form.wa),
        alamat: form.alamat.trim(),
        payMethod: form.payMethod,
        payTarget: form.payTarget.trim(),
        commissionPercent:
          form.commissionPercent.trim() === ""
            ? null
            : Math.round(Number(form.commissionPercent)),
        status: form.status,
        totalKlik: agents?.find((a) => a.code === form.code)?.totalKlik ?? 0,
      });
      flash(`Agen tersimpan. Kode: ${code} — bagikan tautan referral-nya.`);
      setForm(EMPTY_AGENT_FORM);
      setEditingCode(null);
      load();
    } catch (e2) {
      flash(e2 instanceof Error ? `Gagal: ${e2.message}` : "Gagal menyimpan agen.");
    }
  };

  const editAgen = (a: Agent) => {
    setForm({
      code: a.code,
      nama: a.nama,
      wa: a.wa,
      alamat: a.alamat,
      payMethod: a.payMethod,
      payTarget: a.payTarget,
      commissionPercent: a.commissionPercent == null ? "" : String(a.commissionPercent),
      status: a.status,
    });
    setEditingCode(a.code);
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
    const link =
      typeof window === "undefined"
        ? a.code
        : agentShareLink(a.code, window.location.origin);
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
        <label className="block">
          <span className="form-label">Komisi khusus % (kosong = ikut aturan)</span>
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
                  {a.commissionPercent != null && ` · komisi khusus ${a.commissionPercent}%`}
                  {a.payTarget && ` · ${a.payMethod}: ${a.payTarget}`}
                  {` · ${a.totalKlik} klik`}
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

  const uploadLogo = async (file: File) => {
    if (!cloudMode) {
      // mode lokal: pakai data URL (tersimpan di localStorage)
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(String(reader.result));
      reader.readAsDataURL(file);
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
      if (j.url) setLogoUrl(j.url);
      else alert(j.error ?? "Upload gagal.");
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
                placeholder="#f97316"
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
                placeholder="#b91c1c"
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
            {cloudMode && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
                className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
            )}
            <label className="block">
              <span className="form-label">atau tempel URL logo</span>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png (kosongkan = logo bawaan)"
                className="input text-xs"
              />
            </label>
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
            ? "Mengunggah ke Storage…"
            : cloudMode
              ? "Pilih file PNG/JPG dari perangkat, atau tempel URL gambar."
              : "Mode lokal: logo tersimpan di browser ini (data URL)."}
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
                <label className="block sm:col-span-2">
                  <span className="form-label">Foto Hero (sisi kanan)</span>
                  <input
                    value={b.image}
                    onChange={(e) => setBanner(i, { image: e.target.value })}
                    placeholder="https://…/gudang.jpg (kosongkan = foto bawaan)"
                    className="input text-xs"
                  />
                </label>
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

        {/* ── notifikasi pesanan masuk ── */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              🔔 Notifikasi Pesanan Masuk
            </h3>
            <p className="text-xs text-slate-400">
              Pemilik langsung diberi tahu di WhatsApp/Telegram setiap ada
              pesanan baru dari website.
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
            </select>
          </label>

          {form.notifyProvider !== "off" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="form-label">
                    {form.notifyProvider === "fonnte"
                      ? "Nomor WA Penerima (62…)"
                      : "Chat ID Telegram"}
                  </span>
                  <input
                    value={form.notifyTarget}
                    onChange={(e) => set({ notifyTarget: e.target.value })}
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
                    onChange={(e) => set({ notifyToken: e.target.value })}
                    placeholder={
                      form.notifyToken
                        ? "tersimpan — kosongkan bila tidak diubah"
                        : "tempel token di sini"
                    }
                    className="input"
                  />
                </label>
              </div>
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
                  : "Buat bot lewat @BotFather → salin token → kirim pesan ke bot sekali → ambil chat_id lewat @userinfobot."}
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
