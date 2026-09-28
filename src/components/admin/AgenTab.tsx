"use client";

import { useEffect, useState } from "react";
import { useProducts, listAgents, upsertAgent, deleteAgent, getCommissionSettings, saveCommissionSettings, listCommissions, commissionAction, overrideCommission, listAgentPrices, upsertAgentPrice, deleteAgentPrice, uploadKtp, getKtpUrl, deleteKtp } from "@/lib/store";
import { cloudMode } from "@/lib/auth";
import { formatWaDigits } from "@/lib/config";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { agentShareLink, storeOrigin, DEFAULT_COMMISSION_SETTINGS, effectiveCommission, isCommissionReady } from "@/lib/agent";
import type { Agent, AgentCommission, AgentPrice, CommissionSettings, Product } from "@/lib/types";
import { PencilIcon, TrashIcon, XIcon } from "@/components/Icons";

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
  pin: "" as string,
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
        pin: form.pin.trim() || undefined,
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
      pin: "",
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
            Komisi = <b>margin kotor</b>: (harga jual − HPP) × jumlah, dihitung
            dari harga khusus agen + HPP produk. Tidak memakai komisi persen.
            Isi <b>HPP</b> tiap produk dan <b>harga khusus</b> di bagian{" "}
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
        <label className="block">
          <span className="form-label">
            PIN agen (min. 4 karakter — untuk login dashboard)
          </span>
          <input
            type="text"
            value={form.pin}
            onChange={(e) => set({ pin: e.target.value })}
            placeholder={editingCode ? "kosongkan bila tidak diubah" : "mis. 4821"}
            className="input"
            autoComplete="off"
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
                    ? ` · mode margin (${(agentPrices ?? []).filter((x) => x.agentCode === a.code).length} produk)`
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

export default AgenTab;
