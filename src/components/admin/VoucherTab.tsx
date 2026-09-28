"use client";

import { useEffect, useState } from "react";
import { listCoupons, upsertCoupon, deleteCoupon } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import type { Coupon } from "@/lib/types";
import { TrashIcon } from "@/components/Icons";

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

export default VoucherTab;
