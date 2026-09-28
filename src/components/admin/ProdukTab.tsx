"use client";

import { useState } from "react";
import { useProducts, upsertProduct, deleteProduct, seedDatabase } from "@/lib/store";
import { cloudMode, authHeaders } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { normalizeTiers } from "@/lib/pricing";
import { useCategoryCatalog, useCategories } from "@/lib/category-store";
import { slugify } from "@/lib/slug";
import { Tag, Check } from "@/components/admin/ui";
import type { PriceTier, Product } from "@/lib/types";
import { PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/Icons";

const EMPTY_FORM: Product = {
  id: "",
  name: "",
  category: "",
  price: 0,
  unit: "1 pcs",
  emoji: "🛒",
  stock: 0,
};

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

export default ProdukTab;
