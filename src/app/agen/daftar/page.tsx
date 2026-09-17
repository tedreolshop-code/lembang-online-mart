"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChatIcon,
  ChevronRightIcon,
  PinIcon,
  UserIcon,
} from "@/components/Icons";

/** Halaman pendaftaran agen mandiri.
    Status awal = pending → admin approve di tab Agen.
    Setelah daftar, notifikasi terkirim ke Telegram + Discord admin. */
export default function AgenDaftarPage() {
  const [form, setForm] = useState({
    nama: "",
    wa: "",
    alamat: "",
    payMethod: "ewallet" as "transfer" | "ewallet",
    payTarget: "",
    email: "",
  });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (!form.nama.trim()) {
      setErr("Nama wajib diisi.");
      return;
    }
    if (form.wa.replace(/[^0-9]/g, "").length < 8) {
      setErr("Nomor WhatsApp tidak valid.");
      return;
    }
    if (!form.payTarget.trim()) {
      setErr(
        form.payMethod === "transfer"
          ? "Nomor rekening wajib diisi."
          : "Nomor e-wallet wajib diisi.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? "Gagal mendaftar. Coba lagi.");
      } else {
        setOk({ code: body.code, message: body.message });
      }
    } catch {
      setErr("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (ok) {
    return (
      <div className="mx-auto max-w-lg">
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="mt-4 text-lg font-extrabold text-slate-800">
            Pendaftaran Berhasil!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {ok.message}
          </p>
          <div className="mt-4 rounded-xl bg-brand-soft px-4 py-3">
            <p className="text-xs text-brand-dark">Kode Agen Kamu</p>
            <p className="font-mono text-xl font-bold text-brand">{ok.code}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/"
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
            >
              Kembali ke Beranda
            </Link>
            <Link
              href="/akun"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300"
            >
              Lihat Akun Saya
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* header */}
      <section className="rounded-2xl bg-navy p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤝</span>
          <div>
            <h1 className="text-lg font-extrabold">Daftar Jadi Agen</h1>
            <p className="mt-0.5 text-xs text-white/80">
              Dapat komisi dari setiap pesanan lewat link referral-mu
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs leading-relaxed text-white/85">
          <p>1. Daftar dengan data diri & nomor pembayaran</p>
          <p>2. Admin meninjau dan menyetujui pendaftaranmu</p>
          <p>3. Dapat link referral — sebarkan ke pembeli</p>
          <p>4. Setiap pesanan dari link-mu menghasilkan komisi otomatis</p>
        </div>
      </section>

      {/* form */}
      <section className="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-xs font-bold text-slate-600">
          Nama Lengkap *
          <input
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="cth: Budi Santoso"
            className="input mt-1"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600">
          Nomor WhatsApp *
          <input
            value={form.wa}
            onChange={(e) => setForm({ ...form, wa: e.target.value })}
            placeholder="cth: 0812xxxxxxx"
            inputMode="tel"
            className="input mt-1"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Nomor ini dipakai untuk verifikasi & notifikasi komisi
          </span>
        </label>

        <label className="block text-xs font-bold text-slate-600">
          Alamat Lengkap
          <textarea
            value={form.alamat}
            onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            placeholder="Nama jalan, RT/RW, desa/dusun, patokan…"
            rows={2}
            className="input mt-1 resize-none"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600">
          Email (opsional)
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="cth: budi@email.com"
            inputMode="email"
            className="input mt-1"
          />
        </label>

        {/* metode pembayaran komisi */}
        <div>
          <span className="block text-xs font-bold text-slate-600">
            Metode Pencairan Komisi *
          </span>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, payMethod: "ewallet" })}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                form.payMethod === "ewallet"
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              E-Wallet
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, payMethod: "transfer" })}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                form.payMethod === "transfer"
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              Transfer Bank
            </button>
          </div>
        </div>

        <label className="block text-xs font-bold text-slate-600">
          {form.payMethod === "transfer" ? "Nomor Rekening *" : "Nomor E-Wallet *"}
          <input
            value={form.payTarget}
            onChange={(e) => setForm({ ...form, payTarget: e.target.value })}
            placeholder={
              form.payMethod === "transfer"
                ? "cth: 1234567890 (BCA a.n. Budi)"
                : "cth: 0812xxxxxxx (DANA a.n. Budi)"
            }
            className="input mt-1"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Tujuan pencairan komisi — data ini rahasia & hanya dilihat admin
          </span>
        </label>

        {err && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            {err}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Mendaftarkan…" : "Daftar Sekarang"}
          </button>
          <Link
            href="/akun"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300"
          >
            Batal
          </Link>
        </div>
      </section>

      {/* info komisi */}
      <section className="mt-4 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
        <p className="font-bold">Bagaimana komisi dihitung?</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-dark/80">
          Komisi dihitung otomatis saat pesanan dibuat lewat link referral-mu.
          Nilai & persentase diatur oleh admin. Komisi baru bisa dicairkan
          setelah pesanan selesai dan masa tunggu berlalu.
        </p>
      </section>
    </div>
  );
}
