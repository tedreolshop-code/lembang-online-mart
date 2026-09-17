"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { agenLogin, agenLogout, useAgenAuth } from "@/lib/store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { agentShareLink } from "@/lib/agent";
import type { Agent, AgentCommission } from "@/lib/types";
import {
  ChevronRightIcon,
  ClockIcon,
  PinIcon,
  ReceiptIcon,
  UserIcon,
} from "@/components/Icons";

/** Dashboard agen: ringkasan komisi + riwayat pesanan + link referral + edit profil.
    Login: No. WA + kode agen (diberikan saat daftar disetujui admin). */

interface DashboardData {
  agent: Agent;
  summary: {
    totalPending: number;
    totalReady: number;
    totalPaid: number;
    totalCancelled: number;
    totalOrders: number;
    totalKlik: number;
  };
  commissions: (AgentCommission & { createdAt?: string })[];
  orders: {
    id: string;
    createdAt: number;
    status: string;
    customerName: string;
    customerPhone: string;
    total: number;
    commission: number;
    itemCount: number;
  }[];
}

export default function AgenDashboardPage() {
  const auth = useAgenAuth();
  const [loginForm, setLoginForm] = useState({ wa: "", code: "" });
  const [loginErr, setLoginErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchErr, setFetchErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nama: "",
    alamat: "",
    payMethod: "ewallet" as "transfer" | "ewallet",
    payTarget: "",
    email: "",
  });
  const [editMsg, setEditMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // fetch dashboard data saat auth berubah
  useEffect(() => {
    if (!auth) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setFetchErr("");
      try {
        const res = await fetch(
          `/api/agents/me?wa=${encodeURIComponent(auth.wa)}&code=${encodeURIComponent(auth.code)}`,
        );
        const body = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setFetchErr(body.error ?? "Gagal memuat data.");
            agenLogout();
          } else {
            setData(body);
          }
        }
      } catch {
        if (!cancelled) setFetchErr("Gagal terhubung ke server.");
      }
    })();
    return () => { cancelled = true; };
  }, [auth]);

  const submitLogin = async () => {
    if (!loginForm.wa.trim() || !loginForm.code.trim()) {
      setLoginErr("No. WhatsApp dan kode agen wajib diisi.");
      return;
    }
    setLoading(true);
    setLoginErr("");
    try {
      const res = await fetch(
        `/api/agents/me?wa=${encodeURIComponent(loginForm.wa)}&code=${encodeURIComponent(loginForm.code.toUpperCase())}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setLoginErr(body.error ?? "Gagal masuk.");
      } else {
        agenLogin(body.agent.code, loginForm.wa.replace(/[^0-9]/g, "").replace(/^0/, "62"), body.agent.nama);
      }
    } catch {
      setLoginErr("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    agenLogout();
    setLoginForm({ wa: "", code: "" });
    setData(null);
    setEditing(false);
  };

  const startEdit = () => {
    if (!data) return;
    setEditForm({
      nama: data.agent.nama,
      alamat: data.agent.alamat,
      payMethod: data.agent.payMethod,
      payTarget: data.agent.payTarget,
      email: data.agent.email ?? "",
    });
    setEditMsg("");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!auth) return;
    setSaving(true);
    setEditMsg("");
    try {
      const res = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wa: auth.wa,
          code: auth.code,
          ...editForm,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEditMsg(body.error ?? "Gagal menyimpan.");
      } else {
        setEditMsg("Profil berhasil diperbarui.");
        setEditing(false);
        // refresh data
        const dashRes = await fetch(
          `/api/agents/me?wa=${encodeURIComponent(auth.wa)}&code=${encodeURIComponent(auth.code)}`,
        );
        const dashBody = await dashRes.json();
        if (dashRes.ok) setData(dashBody);
      }
    } catch {
      setEditMsg("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  const copyRefLink = () => {
    if (typeof window === "undefined" || !auth) return;
    const link = agentShareLink(auth.code, window.location.origin);
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── belum login → form login ──
  if (!auth) {
    return (
      <div className="mx-auto max-w-lg">
        <section className="rounded-2xl bg-navy p-5 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h1 className="text-lg font-extrabold">Dashboard Agen</h1>
              <p className="mt-0.5 text-xs text-white/80">
                Lihat komisi & riwayat pesanan dari link referral-mu
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Masukkan No. WhatsApp dan kode agen yang kamu dapat saat pendaftaran
            disetujui admin.
          </p>

          <label className="block text-xs font-bold text-slate-600">
            Nomor WhatsApp *
            <input
              value={loginForm.wa}
              onChange={(e) => setLoginForm({ ...loginForm, wa: e.target.value })}
              placeholder="cth: 0812xxxxxxx"
              inputMode="tel"
              className="input mt-1"
            />
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Kode Agen *
            <input
              value={loginForm.code}
              onChange={(e) => setLoginForm({ ...loginForm, code: e.target.value.toUpperCase() })}
              placeholder="cth: AGXXXX"
              className="input mt-1"
              style={{ textTransform: "uppercase" }}
            />
          </label>

          {loginErr && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {loginErr}
            </p>
          )}

          <button
            type="button"
            onClick={submitLogin}
            disabled={loading}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Memproses…" : "Masuk Dashboard"}
          </button>

          <div className="border-t border-slate-100 pt-3 text-center">
            <Link
              href="/agen/daftar"
              className="text-xs font-bold text-brand underline underline-offset-2"
            >
              Belum daftar? Daftar jadi agen di sini
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // ── loading / error ──
  if (!data) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between rounded-2xl bg-navy p-5 text-white">
          <h1 className="text-lg font-extrabold">Dashboard Agen</h1>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
          >
            Keluar
          </button>
        </div>
        <div className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm">
          {fetchErr ? (
            <p className="text-sm font-semibold text-red-600">{fetchErr}</p>
          ) : (
            <p className="text-sm text-slate-500">Memuat data…</p>
          )}
        </div>
      </div>
    );
  }

  // ── agen pending ──
  if (data.agent.status === "pending") {
    return (
      <div className="mx-auto max-w-lg">
        <section className="rounded-2xl bg-navy p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold">Dashboard Agen</h1>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
            >
              Keluar
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <ClockIcon className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-slate-800">
            Menunggu Approval Admin
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Pendaftaranmu sedang ditinjau. Kamu akan diberi tahu via WhatsApp
            setelah admin menyetujui. Setelah disetujui, dashboard ini akan
            menampilkan ringkasan komisi dan link referral-mu.
          </p>
          <div className="mt-4 rounded-xl bg-brand-soft px-4 py-3">
            <p className="text-xs text-brand-dark">Kode Agen Kamu</p>
            <p className="font-mono text-xl font-bold text-brand">{data.agent.code}</p>
          </div>
        </section>
      </div>
    );
  }

  // ── agen nonaktif ──
  if (data.agent.status === "nonaktif") {
    return (
      <div className="mx-auto max-w-lg">
        <section className="rounded-2xl bg-navy p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold">Dashboard Agen</h1>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
            >
              Keluar
            </button>
          </div>
        </section>
        <section className="mt-5 rounded-2xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-800">Akun Dinonaktifkan</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Akun agen kamu saat ini nonaktif. Hubungi admin untuk informasi
            lebih lanjut.
          </p>
        </section>
      </div>
    );
  }

  // ── dashboard utama ──
  const { agent, summary, orders } = data;
  const refLink = typeof window !== "undefined"
    ? agentShareLink(agent.code, window.location.origin)
    : agentShareLink(agent.code, "");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* header */}
      <section className="rounded-2xl bg-navy p-5 text-white shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <UserIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold sm:text-xl">{agent.nama}</h1>
              <p className="mt-0.5 text-xs text-white/80">
                Kode: <span className="font-mono font-bold">{agent.code}</span>
                {" · "}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  ● Aktif
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/10"
          >
            Keluar
          </button>
        </div>
      </section>

      {/* ringkasan komisi */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CommissionCard
          label="Siap Cair"
          value={summary.totalReady}
          highlight
        />
        <CommissionCard label="Menunggu" value={summary.totalPending} />
        <CommissionCard label="Sudah Dibayar" value={summary.totalPaid} />
        <CommissionCard label="Total Pesanan" value={summary.totalOrders} isCount />
      </section>

      {/* link referral */}
      <section className="rounded-2xl bg-brand-soft p-4 sm:p-5">
        <h2 className="text-sm font-bold text-brand-dark">Link Referral Kamu</h2>
        <p className="mt-1 text-xs leading-relaxed text-brand-dark/80">
          Sebarkan link ini ke calon pembeli. Setiap pesanan dari link-mu
          otomatis menghasilkan komisi.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={refLink}
            readOnly
            className="flex-1 rounded-xl border border-brand/20 bg-white px-3 py-2.5 text-xs font-mono text-slate-700 outline-none"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={copyRefLink}
            className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-brand-dark"
          >
            {copied ? "Tersalin!" : "Salin"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <p className="text-lg font-extrabold text-brand">{summary.totalKlik}</p>
            <p className="text-[11px] text-brand-dark/70">Klik Link</p>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <p className="text-lg font-extrabold text-brand">{summary.totalOrders}</p>
            <p className="text-[11px] text-brand-dark/70">Pesanan via Link</p>
          </div>
        </div>
      </section>

      {/* profil agen */}
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Profil Agen
          </h2>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-brand/40 hover:text-brand"
            >
              Ubah
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-slate-600">
              Nama Lengkap *
              <input
                value={editForm.nama}
                onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                className="input mt-1"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Alamat
              <textarea
                value={editForm.alamat}
                onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
                rows={2}
                className="input mt-1 resize-none"
              />
            </label>
            <div>
              <span className="block text-xs font-bold text-slate-600">
                Metode Pencairan Komisi
              </span>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, payMethod: "ewallet" })}
                  className={`flex-1 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                    editForm.payMethod === "ewallet"
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  E-Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, payMethod: "transfer" })}
                  className={`flex-1 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                    editForm.payMethod === "transfer"
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Transfer Bank
                </button>
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-600">
              {editForm.payMethod === "transfer" ? "Nomor Rekening *" : "Nomor E-Wallet *"}
              <input
                value={editForm.payTarget}
                onChange={(e) => setEditForm({ ...editForm, payTarget: e.target.value })}
                className="input mt-1"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Email (opsional)
              <input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                inputMode="email"
                className="input mt-1"
              />
            </label>
            {editMsg && (
              <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                editMsg.includes("berhasil") ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}>
                {editMsg}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setEditMsg(""); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-3 space-y-2.5 text-sm">
            <Detail label="Nama" value={agent.nama} />
            <Detail label="No. WhatsApp" value={agent.wa} />
            <Detail label="Alamat" value={agent.alamat || "—"} />
            <Detail
              label="Metode Pencairan"
              value={agent.payMethod === "transfer" ? "Transfer Bank" : "E-Wallet"}
            />
            <Detail label="Tujuan Pencairan" value={agent.payTarget || "—"} />
            {agent.email && <Detail label="Email" value={agent.email} />}
          </dl>
        )}
      </section>

      {/* riwayat pesanan via link */}
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <ReceiptIcon className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Pesanan via Link Kamu
          </h2>
        </div>

        {orders.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Belum ada pesanan dari link referral-mu. Sebarkan link ke lebih
            banyak calon pembeli untuk mulai mendapat komisi.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Kartu ringkasan komisi */
function CommissionCard({
  label,
  value,
  highlight,
  isCount,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  isCount?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center shadow-sm ${
        highlight ? "bg-brand text-white" : "bg-white"
      }`}
    >
      <p className={`text-lg font-extrabold ${highlight ? "" : "text-slate-800"}`}>
        {isCount ? value : formatRupiah(value)}
      </p>
      <p className={`text-[11px] ${highlight ? "text-white/80" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  );
}

/** Satu baris detail profil */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="block break-words text-slate-700">{value}</span>
      </span>
    </div>
  );
}

/** Baris riwayat pesanan */
function OrderRow({
  order,
}: {
  order: {
    id: string;
    createdAt: number;
    status: string;
    customerName: string;
    customerPhone: string;
    total: number;
    commission: number;
    itemCount: number;
  };
}) {
  const statusColor: Record<string, string> = {
    menunggu: "bg-amber-100 text-amber-700",
    diproses: "bg-blue-100 text-blue-700",
    selesai: "bg-emerald-100 text-emerald-700",
    dibatalkan: "bg-red-100 text-red-700",
  };
  const statusLabel: Record<string, string> = {
    menunggu: "Menunggu",
    diproses: "Diproses",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
  };

  return (
    <Link
      href={`/pesanan/${order.id}`}
      className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">{order.id}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor[order.status] ?? "bg-slate-100 text-slate-600"}`}>
            {statusLabel[order.status] ?? order.status}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {formatDateTime(order.createdAt)} · {order.itemCount} item · {order.customerName}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-slate-800">{formatRupiah(order.total)}</span>
        {order.commission > 0 && (
          <span className="block text-[11px] font-semibold text-brand">
            Komisi {formatRupiah(order.commission)}
          </span>
        )}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
    </Link>
  );
}
