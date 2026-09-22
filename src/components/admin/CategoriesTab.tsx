"use client";

import Link from "next/link";
import { useState } from "react";
import { useCategoryCatalog } from "@/lib/category-store";
import { CATEGORY_EMOJIS, CATEGORY_NAME_MAX, CATEGORY_TINTS, type CategoryInput } from "@/lib/categories";
import { useProducts } from "@/lib/store";
import type { Category } from "@/lib/types";
import { PencilIcon, PlusIcon, XIcon } from "@/components/Icons";
import CategoryStatus from "@/components/CategoryStatus";

export default function CategoriesTab({ onAddProduct }: { onAddProduct: (slug: string) => void }) {
  const { categories, ready, error, refresh, saveCategory } = useCategoryCatalog();
  const products = useProducts();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [saved, setSaved] = useState<Category | null>(null);
  const counts = new Map<string, number>();
  for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);

  return (
    <section aria-labelledby="categories-title" className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="categories-title" className="text-xl font-extrabold text-slate-800">Kategori Produk</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">Rapikan rak warungmu supaya pelanggan mudah menemukan barang.</p>
        </div>
        {!editing && (
          <button type="button" disabled={!ready} onClick={() => { setEditing("new"); setSaved(null); }}
            className="flex min-h-11 items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50">
            <PlusIcon className="h-4 w-4" /> Tambah Kategori
          </button>
        )}
      </div>

      {saved && !editing && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p><b>{saved.name}</b> berhasil disimpan. Sudah tersedia di menu toko.</p>
          <button type="button" onClick={() => onAddProduct(saved.slug)} className="min-h-10 rounded-full border border-emerald-300 bg-white px-4 py-2 font-bold hover:bg-emerald-100">
            Tambah produk di sini →
          </button>
        </div>
      )}

      {error && ready && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>Menampilkan daftar terakhir. Sinkronisasi belum berhasil.</p>
          <button type="button" onClick={() => void refresh()} className="min-h-10 px-2 font-bold underline">Coba lagi</button>
        </div>
      )}

      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.slug}
          initial={editing === "new" ? null : editing}
          nextSort={Math.min(9998, Math.max(-1, ...categories.map((category) => category.sort)) + 1)}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            const category = await saveCategory(input, editing === "new" ? undefined : editing.slug);
            setSaved(category);
            setEditing(null);
          }}
        />
      )}

      <CategoryStatus />
      {ready && categories.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>{categories.length} kategori</span><span>Urutan menu toko</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {categories.map((category) => (
              <li key={category.slug} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <span className="w-7 shrink-0 text-center text-xs font-semibold text-slate-400">{category.sort + 1}</span>
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: category.tint }}>{category.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold text-slate-800 sm:text-base">{category.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{counts.get(category.slug) ?? 0} produk</p>
                </div>
                <button type="button" disabled={editing !== null} aria-label={`Edit kategori ${category.name}`}
                  onClick={() => { setEditing(category); setSaved(null); }}
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-brand/30 hover:bg-brand-soft hover:text-brand disabled:opacity-40 sm:px-4 sm:text-sm">
                  <PencilIcon className="h-4 w-4" /> Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Kategori tampil di beranda, pencarian, dan pilihan kategori saat menambah produk. <Link href="/kategori" className="font-bold text-brand hover:underline">Lihat di toko →</Link>
      </p>
    </section>
  );
}

function CategoryForm({ initial, nextSort, onCancel, onSave }: {
  initial: Category | null;
  nextSort: number;
  onCancel: () => void;
  onSave: (input: CategoryInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🛒");
  const [tint, setTint] = useState(initial?.tint ?? CATEGORY_TINTS[0]);
  const [position, setPosition] = useState(String((initial?.sort ?? nextSort) + 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ name, emoji, tint, sort: Number(position) - 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategori belum tersimpan. Silakan coba lagi.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-label={initial ? "Edit kategori" : "Tambah kategori"} className="rounded-2xl border-2 border-brand/20 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-lg font-extrabold text-slate-800">{initial ? "Edit Kategori" : "Kategori Baru"}</h3>
        <button type="button" disabled={busy} onClick={onCancel} aria-label="Tutup form kategori" className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><XIcon className="h-5 w-5" /></button>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-5 disabled:opacity-60">
        <label className="block">
          <span className="form-label">Nama kategori</span>
          <input autoFocus required maxLength={CATEGORY_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Sayur & Buah" className="input" />
        </label>
        <fieldset>
          <legend className="form-label">Ikon kategori</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_EMOJIS.map((icon) => (
              <button key={icon} type="button" aria-label={`Pilih ikon ${icon}`} aria-pressed={emoji === icon} onClick={() => setEmoji(icon)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border text-2xl transition ${emoji === icon ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-slate-200 hover:bg-slate-50"}`}>{icon}</button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            Atau emoji pilihanmu
            <input aria-label="Emoji pilihanmu" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={24} required className="input w-20 text-center text-xl" />
          </label>
        </fieldset>
        <fieldset>
          <legend className="form-label">Warna latar</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TINTS.map((color, index) => (
              <button key={color} type="button" aria-label={`Pilih warna ${index + 1}`} aria-pressed={tint === color} onClick={() => setTint(color)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-slate-700 ${tint === color ? "border-brand ring-2 ring-brand/30" : "border-slate-200"}`} style={{ backgroundColor: color }}>{tint === color ? "✓" : ""}</button>
            ))}
            <label className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-500">
              Lainnya <input type="color" aria-label="Warna latar pilihanmu" value={tint} onChange={(e) => setTint(e.target.value)} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0" />
            </label>
          </div>
        </fieldset>
        <label className="block">
          <span className="form-label">Urutan tampil</span>
          <input type="number" aria-label="Urutan tampil" aria-describedby="category-position-help" required min={1} max={9999} step={1} value={position} onChange={(e) => setPosition(e.target.value)} className="input max-w-28" />
          <span id="category-position-help" className="mt-1.5 block text-xs text-slate-500">Angka kecil tampil lebih dulu. Gunakan nomor berbeda agar urutannya jelas.</span>
        </label>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Pratinjau kategori</p>
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: tint }}>{emoji || "🛒"}</span>
            <span className="min-w-0 break-words text-sm font-bold text-slate-800">{name.trim() || "Nama kategori"}</span>
          </div>
        </div>
        {initial && <p className="text-xs text-slate-500">Nama baru langsung tampil di toko. Produk dan tautan kategori tetap terhubung.</p>}
      </fieldset>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Batal</button>
        <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-brand px-5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "Menyimpan…" : initial ? "Simpan Perubahan" : "Simpan Kategori"}</button>
      </div>
    </form>
  );
}
