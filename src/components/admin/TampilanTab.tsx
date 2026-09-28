"use client";

import { useEffect, useState } from "react";
import { useSettings, saveSettings } from "@/lib/store";
import { cloudMode, authHeaders } from "@/lib/auth";
import { DEFAULT_BANNERS } from "@/lib/config";
import type { BannerSlide } from "@/lib/config";
import { TrashIcon } from "@/components/Icons";
import { applyThemeVars, clearThemeVars } from "@/components/ThemeStyle";

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

export default TampilanTab;
