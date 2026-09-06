"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOrders, useProducts, updateOrderStatus, useSettings, saveSettings, adjustStock, setStock, upsertProduct, deleteProduct, acceptOrder, cancelOrder, seedDatabase } from "@/lib/store";
import { cloudMode, adminLogin, adminLogout, hasAdminSession, localLogin, authHeaders } from "@/lib/auth";
import { DEFAULT_SETTINGS, formatWaDigits, type StoreSettings } from "@/lib/config";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { CATEGORIES } from "@/data/seed";
import type { Order, OrderStatus, Product } from "@/lib/types";
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
    "produk" | "stok" | "pesanan" | "laporan" | "pengaturan" | "tampilan"
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
    onSave(p);
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

function slugify(name: string): string {
  return (
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
            <span className="form-label">Warna Gelap (header, footer)</span>
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
