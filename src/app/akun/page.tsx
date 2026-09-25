"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import {
  customerLogin,
  customerLogout,
  customerRegister,
  customerRequestReset,
  customerResetPassword,
  forgetCustomer,
  saveCustomer,
  useAgentRef,
  useAgenAuth,
  useCustomerAuth,
  useFavorites,
  useOrders,
  useSavedCustomer,
  useSettings,
} from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import {
  CartIcon,
  ChatIcon,
  ChevronRightIcon,
  ClockIcon,
  GridIcon,
  HeartIcon,
  InfoIcon,
  PhoneIcon,
  PinIcon,
  ReceiptIcon,
  UserIcon,
} from "@/components/Icons";

/** Halaman Akun: pusat menu pelanggan.
    Daftar: No. WA + nama + password (tersimpan di database mode cloud).
    Masuk: No. WA + password. Lupa password: kode reset dikirim ke
    WhatsApp pelanggan sendiri lewat wa.me. */
export default function AkunPage() {
  const settings = useSettings();
  const orders = useOrders();
  const favorites = useFavorites();
  const { count, ready } = useCart();
  const agentRef = useAgentRef();
  const agenAuth = useAgenAuth();
  const saved = useSavedCustomer();
  const customer = useCustomerAuth();

  // "masuk" = login dengan password; "daftar" = buat akun baru;
  // "lupa1" = minta kode; "lupa2" = pasang password baru dengan kode
  const [mode, setMode] = useState<"masuk" | "daftar" | "lupa1" | "lupa2">(
    "masuk",
  );
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({
    name: "",
    phone: "",
    address: "",
    password: "",
    password2: "",
    code: "",
  });
  const [resetWaLink, setResetWaLink] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loading, setLoading] = useState(false);

  // form data pengiriman
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    address: string;
  } | null>(null);
  const [msg, setMsg] = useState("");

  const diproses = orders.filter(
    (o) => o.status === "menunggu" || o.status === "diproses",
  ).length;
  const namaDepan = (customer?.name ?? saved?.name ?? "").trim().split(/\s+/)[0];

  const bukaLogin = () => {
    setLoginForm({
      name: saved?.name ?? "",
      phone: saved?.phone ?? "",
      address: "",
      password: "",
      password2: "",
      code: "",
    });
    setMode("masuk");
    setResetWaLink("");
    setLoginMsg("");
    setLoginErr("");
    setLoginOpen(true);
  };

  const submitMasuk = async () => {
    if (!loginForm.phone.trim() || !loginForm.password) {
      setLoginErr("Nomor WhatsApp dan password wajib diisi.");
      return;
    }
    setLoading(true);
    setLoginErr("");
    try {
      await customerLogin(loginForm.phone, loginForm.password);
      setLoginMsg("Login berhasil!");
      setLoginOpen(false);
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const submitDaftar = async () => {
    if (!loginForm.name.trim() || !loginForm.phone.trim()) {
      setLoginErr("Nama dan No. WhatsApp wajib diisi.");
      return;
    }
    if (loginForm.password.length < 6) {
      setLoginErr("Password minimal 6 karakter.");
      return;
    }
    if (loginForm.password !== loginForm.password2) {
      setLoginErr("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    setLoginErr("");
    try {
      await customerRegister(
        loginForm.phone,
        loginForm.name,
        loginForm.address,
        loginForm.password,
      );
      setLoginMsg("Pendaftaran berhasil! Akunmu siap.");
      setLoginOpen(false);
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const submitMintaKode = async () => {
    if (!loginForm.phone.trim()) {
      setLoginErr("Masukkan nomor WhatsApp kamu dulu.");
      return;
    }
    setLoading(true);
    setLoginErr("");
    try {
      const waLink = await customerRequestReset(loginForm.phone);
      setResetWaLink(waLink);
      setMode("lupa2");
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordBaru = async () => {
    if (loginForm.code.replace(/\D/g, "").length !== 6) {
      setLoginErr("Kode reset harus 6 digit.");
      return;
    }
    if (loginForm.password.length < 6) {
      setLoginErr("Password minimal 6 karakter.");
      return;
    }
    if (loginForm.password !== loginForm.password2) {
      setLoginErr("Konfirmasi password tidak sama.");
      return;
    }
    setLoading(true);
    setLoginErr("");
    try {
      await customerResetPassword(
        loginForm.phone,
        loginForm.code,
        loginForm.password,
      );
      setMode("masuk");
      setLoginForm({ ...loginForm, code: "", password: "", password2: "" });
      setLoginMsg("Password baru tersimpan! Silakan masuk.");
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    customerLogout();
    setLoginMsg("Berhasil keluar.");
  };

  const bukaForm = () => {
    setForm({
      name: saved?.name ?? customer?.name ?? "",
      phone: saved?.phone ?? customer?.phone ?? "",
      address: saved?.address ?? customer?.address ?? "",
    });
    setMsg("");
  };

  const simpanData = () => {
    if (!form) return;
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setMsg("Nama, No. HP, dan alamat wajib diisi.");
      return;
    }
    saveCustomer(form);
    setForm(null);
    setMsg("Data pengiriman tersimpan di perangkat ini.");
  };

  const hapusData = () => {
    forgetCustomer();
    setForm(null);
    setMsg("Data tersimpan sudah dihapus.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* kartu profil */}
      <section className="rounded-2xl bg-navy p-5 text-white shadow-sm sm:p-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <UserIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold sm:text-xl">
              {namaDepan ? `Halo, ${namaDepan}!` : "Akun Saya"}
            </h1>
            <p className="mt-0.5 text-xs text-white/80 sm:text-sm">
              {customer
                ? "Akun aktif — riwayat & data ikut di mana pun kamu masuk."
                : saved
                  ? "Data pengirimanmu siap — checkout terisi otomatis."
                  : "Masuk dengan No. WA untuk akses riwayat lintas perangkat."}
            </p>
          </div>
          {customer && (
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
            >
              Keluar
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Pesanan" value={ready ? orders.length : 0} />
          <Stat label="Diproses" value={diproses} />
          <Stat label="Favorit" value={ready ? favorites.length : 0} />
        </div>

        {!customer && !loginOpen && (
          <button
            type="button"
            onClick={bukaLogin}
            className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
          >
            Masuk / Daftar dengan No. WhatsApp
          </button>
        )}

        {loginOpen && (
          <div className="mt-3 space-y-3 rounded-xl bg-white/10 p-4">
            {mode === "masuk" && (
              <>
                <h3 className="text-sm font-bold text-white">Masuk</h3>
                <p className="text-[11px] leading-relaxed text-white/70">
                  Masukkan No. WhatsApp dan password akunmu. Data pesananmu
                  ikut di mana pun kamu masuk.
                </p>
                <label className="block text-xs font-bold text-white/90">
                  Nomor WhatsApp *
                  <input
                    value={loginForm.phone}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, phone: e.target.value })
                    }
                    placeholder="cth: 0812xxxxxxx"
                    inputMode="tel"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Password *
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    placeholder="Password akunmu"
                    className="input mt-1"
                  />
                </label>
                {loginErr && (
                  <p className="text-xs font-semibold text-red-300">
                    {loginErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitMasuk}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {loading ? "Memproses…" : "Masuk"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginOpen(false)}
                    className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                  >
                    Batal
                  </button>
                </div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("lupa1");
                      setLoginErr("");
                    }}
                    className="text-white/80 underline hover:text-white"
                  >
                    Lupa password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("daftar");
                      setLoginErr("");
                    }}
                    className="text-white/80 underline hover:text-white"
                  >
                    Belum punya akun? Daftar
                  </button>
                </div>
              </>
            )}

            {mode === "daftar" && (
              <>
                <h3 className="text-sm font-bold text-white">Daftar Akun</h3>
                <p className="text-[11px] leading-relaxed text-white/70">
                  Buat akun dengan No. WhatsApp + password. Data pesananmu
                  aman dan bisa diakses dari perangkat mana pun.
                </p>
                <label className="block text-xs font-bold text-white/90">
                  Nama Lengkap *
                  <input
                    value={loginForm.name}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, name: e.target.value })
                    }
                    placeholder="cth: Budi Santoso"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Nomor WhatsApp *
                  <input
                    value={loginForm.phone}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, phone: e.target.value })
                    }
                    placeholder="cth: 0812xxxxxxx"
                    inputMode="tel"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Password * (min. 6 karakter)
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    placeholder="Buat password"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Ulangi Password *
                  <input
                    type="password"
                    value={loginForm.password2}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password2: e.target.value })
                    }
                    placeholder="Ulangi password"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Alamat (opsional)
                  <textarea
                    value={loginForm.address}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, address: e.target.value })
                    }
                    placeholder="Nama jalan, RT/RW, desa/dusun, patokan…"
                    rows={2}
                    className="input mt-1 resize-none"
                  />
                </label>
                {loginErr && (
                  <p className="text-xs font-semibold text-red-300">
                    {loginErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitDaftar}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {loading ? "Memproses…" : "Daftar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginOpen(false)}
                    className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                  >
                    Batal
                  </button>
                </div>
                <div className="text-right text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("masuk");
                      setLoginErr("");
                    }}
                    className="text-white/80 underline hover:text-white"
                  >
                    Sudah punya akun? Masuk
                  </button>
                </div>
              </>
            )}

            {mode === "lupa1" && (
              <>
                <h3 className="text-sm font-bold text-white">Lupa Password</h3>
                <p className="text-[11px] leading-relaxed text-white/70">
                  Masukkan nomor WhatsApp kamu. Kami buatkan kode reset yang
                  dikirim lewat WhatsApp ke nomormu sendiri.
                </p>
                <label className="block text-xs font-bold text-white/90">
                  Nomor WhatsApp *
                  <input
                    value={loginForm.phone}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, phone: e.target.value })
                    }
                    placeholder="cth: 0812xxxxxxx"
                    inputMode="tel"
                    className="input mt-1"
                  />
                </label>
                {loginErr && (
                  <p className="text-xs font-semibold text-red-300">
                    {loginErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitMintaKode}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {loading ? "Memproses…" : "Kirim Kode Reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("masuk");
                      setLoginErr("");
                    }}
                    className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                  >
                    Batal
                  </button>
                </div>
              </>
            )}

            {mode === "lupa2" && (
              <>
                <h3 className="text-sm font-bold text-white">
                  Password Baru
                </h3>
                <p className="text-[11px] leading-relaxed text-white/70">
                  1. Tekan tombol <b>Buka WhatsApp</b> — kode reset otomatis
                  muncul di pesan ke nomormu sendiri, kirim pesannya.
                  <br />
                  2. Lihat kode di WhatsApp, lalu masukkan di bawah beserta
                  password barumu.
                </p>
                {resetWaLink ? (
                  <a
                    href={resetWaLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl bg-[#25d366] px-4 py-2.5 text-center text-sm font-bold text-white shadow transition hover:brightness-95"
                  >
                    Buka WhatsApp — Ambil Kode
                  </a>
                ) : (
                  <p className="text-[11px] text-white/70">
                    Kode belum dibuat — kembali dan minta kode dulu.
                  </p>
                )}
                <label className="block text-xs font-bold text-white/90">
                  Kode Reset (6 digit) *
                  <input
                    value={loginForm.code}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, code: e.target.value })
                    }
                    placeholder="cth: 482913"
                    inputMode="numeric"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Password Baru * (min. 6 karakter)
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password: e.target.value })
                    }
                    placeholder="Password baru"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-bold text-white/90">
                  Ulangi Password Baru *
                  <input
                    type="password"
                    value={loginForm.password2}
                    onChange={(e) =>
                      setLoginForm({ ...loginForm, password2: e.target.value })
                    }
                    placeholder="Ulangi password baru"
                    className="input mt-1"
                  />
                </label>
                {loginErr && (
                  <p className="text-xs font-semibold text-red-300">
                    {loginErr}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitPasswordBaru}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {loading ? "Memproses…" : "Simpan Password Baru"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("masuk");
                      setLoginErr("");
                    }}
                    className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                  >
                    Batal
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {loginMsg && !loginOpen && (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[11px] leading-relaxed text-white/90">
            {loginMsg}
          </p>
        )}
      </section>

      {/* data pengiriman yang diingat */}
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Data Pengiriman
          </h2>
          {form === null && (
            <button
              type="button"
              onClick={bukaForm}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-brand/40 hover:text-brand"
            >
              {saved || customer ? "Ubah" : "Isi data"}
            </button>
          )}
        </div>

        {form === null ? (
          (saved || customer) ? (
            <dl className="mt-3 space-y-2.5 text-sm">
              <Detail
                icon={<UserIcon className="h-4 w-4" />}
                label="Nama"
                value={customer?.name ?? saved?.name ?? ""}
              />
              <Detail
                icon={<PhoneIcon className="h-4 w-4" />}
                label="No. HP / WhatsApp"
                value={customer?.phone ?? saved?.phone ?? ""}
              />
              <Detail
                icon={<PinIcon className="h-4 w-4" />}
                label="Alamat"
                value={customer?.address ?? saved?.address ?? ""}
              />
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Belum ada data tersimpan. Isi sekali di sini (atau saat checkout)
              dan form pengiriman berikutnya terisi otomatis.
            </p>
          )
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-bold text-slate-600">
              Nama Lengkap *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="cth: Budi Santoso"
                className="input mt-1"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Nomor HP / WhatsApp *
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="cth: 0812xxxxxxx"
                inputMode="tel"
                className="input mt-1"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Alamat Lengkap *
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Nama jalan, RT/RW, desa/dusun, patokan…"
                rows={3}
                className="input mt-1 resize-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={simpanData}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(null);
                  setMsg("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300"
              >
                Batal
              </button>
              {saved && (
                <button
                  type="button"
                  onClick={hapusData}
                  className="ml-auto text-xs font-bold text-brand underline underline-offset-2"
                >
                  Hapus data
                </button>
              )}
            </div>
          </div>
        )}

        {msg && (
          <p className="mt-3 text-xs font-semibold text-emerald-600">{msg}</p>
        )}
      </section>

      {/* pintasan utama */}
      <section className="rounded-2xl bg-white p-2 shadow-sm">
        <Row
          href="/pesanan"
          icon={<ReceiptIcon className="h-5 w-5" />}
          title="Riwayat Pesanan"
          desc={
            orders.length > 0
              ? `${orders.length} pesanan dari perangkat ini`
              : "Belum ada pesanan"
          }
          badge={diproses > 0 ? `${diproses} diproses` : undefined}
        />
        <Row
          href="/pesanan?tab=favorit"
          icon={<HeartIcon className="h-5 w-5" />}
          title="Favorit"
          desc="Produk yang kamu tandai"
          badge={
            ready && favorites.length > 0 ? `${favorites.length}` : undefined
          }
        />
        <Row
          href="/keranjang"
          icon={<CartIcon className="h-5 w-5" />}
          title="Keranjang"
          desc="Lanjutkan belanja yang tertunda"
          badge={ready && count > 0 ? `${count} item` : undefined}
        />
        <Row
          href="/kategori"
          icon={<GridIcon className="h-5 w-5" />}
          title="Semua Kategori"
          desc="Jelajahi kebutuhan harian"
        />
      </section>

      {/* daftar agen — hanya untuk agen yang login di perangkat ini,
          tidak ditampilkan ke pelanggan umum */}
      {agenAuth && (
        <section className="rounded-2xl bg-brand-soft p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-brand-dark">
                Program Agen Lembang
              </h2>
              <p className="mt-0.5 text-xs text-brand-dark/80">
                Dapat komisi dari setiap pesanan lewat link referral-mu
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/agen/dashboard"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand/30 bg-white px-4 py-2.5 text-sm font-bold text-brand transition hover:border-brand/50"
            >
              Dashboard Agen
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-brand-dark/70">
            Pendaftaran agen melalui admin. Hubungi toko untuk mendaftar.
          </p>
        </section>
      )}

      {agentRef && (
        <section className="flex items-start gap-2.5 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
          <span className="text-lg">🤝</span>
          <p>
            Kode agen <b className="font-mono">{agentRef}</b> aktif dan otomatis
            dipakai di checkout dari perangkat ini.
          </p>
        </section>
      )}

      {/* info & bantuan */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-800">
          Info & Bantuan
        </h2>
        <div className="rounded-2xl bg-white p-2 shadow-sm">
          <Row
            href="/tentang"
            icon={<InfoIcon className="h-5 w-5" />}
            title="Tentang Kami"
            desc="Profil warung, alamat & jam buka"
          />
          <Row
            href="/cara-pesan"
            icon={<ChatIcon className="h-5 w-5" />}
            title="Cara Pesan"
            desc="Panduan belanja langkah demi langkah"
          />
          <Row
            href="/privasi"
            icon={<PinIcon className="h-5 w-5" />}
            title="Kebijakan Privasi"
            desc="Cara kami menjaga data pelanggan"
          />
        </div>
      </section>

      {/* kontak warung */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Hubungi Warung
        </h2>
        <div className="mt-3 space-y-2.5 text-sm text-slate-600">
          <p className="flex items-start gap-2">
            <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {settings.address}
          </p>
          <p className="flex items-start gap-2">
            <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {settings.hours}
          </p>
        </div>
        <a
          href={`https://wa.me/${settings.whatsapp}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-sm font-bold text-white shadow transition hover:brightness-95 active:scale-[0.98]"
        >
          <ChatIcon className="h-4.5 w-4.5" />
          Chat Lembang Online Mart
        </a>
        <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2.5 text-[11px] leading-relaxed text-brand-dark">
          Gratis ongkir untuk belanja di atas{" "}
          {formatRupiah(settings.freeOngkirMin)}.
        </p>
      </section>
    </div>
  );
}

/** angka besar + label kecil di kartu profil */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2.5">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] text-white/75">{label}</div>
    </div>
  );
}

/** satu baris data pengiriman (ikon + label kecil + isi) */
function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-brand">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="block break-words text-slate-700">{value}</span>
      </span>
    </div>
  );
}

/** baris menu: ikon + judul + keterangan + panah (ala daftar aplikasi) */
function Row({
  href,
  icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-navy">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800">{title}</span>
        <span className="block truncate text-xs text-slate-500">{desc}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}
