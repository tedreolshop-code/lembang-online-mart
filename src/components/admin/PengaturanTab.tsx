"use client";

import { useState } from "react";
import { useSettings, saveSettings } from "@/lib/store";
import { cloudMode, authHeaders } from "@/lib/auth";
import { formatWaDigits } from "@/lib/config";
import type { StoreSettings } from "@/lib/config";

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

        {/* ── metode pembayaran ── */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              💳 Metode Pembayaran
            </h3>
            <p className="text-xs text-slate-400">
              Atur pilihan yang muncul saat pembeli memilih pembayaran. COD
              bisa dimatikan, dan metode transfer/e-wallet bisa ditambah,
              diedit, atau dihapus.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <span>
              <span className="block text-sm font-bold text-slate-800">
                COD (Bayar di Tempat)
              </span>
              <span className="text-xs text-slate-500">
                Pembeli bayar tunai saat barang tiba
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.codEnabled}
              onChange={(e) => set({ codEnabled: e.target.checked })}
              className="h-5 w-5 shrink-0 accent-brand"
            />
          </label>

          <div className="space-y-2">
            {form.paymentMethods.map((m, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={m.label}
                    onChange={(e) =>
                      set({
                        paymentMethods: form.paymentMethods.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Nama metode, mis. DANA"
                    className="input flex-1 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        paymentMethods: form.paymentMethods.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  value={m.detail}
                  onChange={(e) =>
                    set({
                      paymentMethods: form.paymentMethods.map((x, j) =>
                        j === i ? { ...x, detail: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Tujuan, mis. DANA 0812-3456-7890 a.n. Budi"
                  className="input text-sm"
                />
                <input
                  value={m.note}
                  onChange={(e) =>
                    set({
                      paymentMethods: form.paymentMethods.map((x, j) =>
                        j === i ? { ...x, note: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Instruksi singkat, mis. Kirim bukti transfer ke WhatsApp"
                  className="input text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const presets = [
                  { id: "dana", label: "DANA", detail: "", note: "" },
                  { id: "ovo", label: "OVO", detail: "", note: "" },
                  { id: "gopay", label: "GoPay", detail: "", note: "" },
                  { id: "shopeepay", label: "ShopeePay", detail: "", note: "" },
                  { id: "bank", label: "Transfer Bank", detail: "", note: "" },
                ];
                const dipakai = new Set(
                  form.paymentMethods.map((m) => m.id.toLowerCase()),
                );
                const preset =
                  presets.find((p) => !dipakai.has(p.id)) ??
                  presets.find((p) => !dipakai.has(p.id + "-2")) ?? {
                    id: `metode-${Date.now()}`,
                    label: "Metode Baru",
                    detail: "",
                    note: "",
                  };
                set({
                  paymentMethods: [
                    ...form.paymentMethods,
                    {
                      ...preset,
                      id: dipakai.has(preset.id) ? `${preset.id}-2` : preset.id,
                    },
                  ],
                });
              }}
              className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-bold text-slate-500 transition hover:border-brand/50 hover:text-brand"
            >
              + Tambah Metode (Bank, DANA, OVO, GoPay, …)
            </button>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Kosongkan daftar ini (hapus semua) bila hanya ingin menawarkan
              COD. Id metode dipakai untuk mencatat pilihan pembeli di
              pesanan — jangan diubah-ubah setelah dipakai.
            </p>
          </div>
        </div>

        {/* ── notifikasi pesanan masuk ── */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              🔔 Notifikasi Pesanan Masuk
            </h3>
            <p className="text-xs text-slate-400">
              Pemilik langsung diberi tahu di WhatsApp/Telegram/Discord setiap
              ada pesanan baru dari website. Discord webhook juga menerima
              notifikasi pendaftaran agen baru.
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
              <option value="discord">Discord Webhook</option>
            </select>
          </label>

          {form.notifyProvider !== "off" && (
            <>
              {form.notifyProvider === "discord" ? (
                <label className="block">
                  <span className="form-label">Discord Webhook URL</span>
                  <input
                    value={form.discordWebhook}
                    onChange={(e) =>
                      set({ discordWebhook: e.target.value })
                    }
                    placeholder="https://discord.com/api/webhooks/…"
                    className="input"
                  />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="form-label">
                      {form.notifyProvider === "fonnte"
                        ? "Nomor WA Penerima (62…)"
                        : "Chat ID Telegram"}
                    </span>
                    <input
                      value={form.notifyTarget}
                      onChange={(e) =>
                        set({ notifyTarget: e.target.value })
                      }
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
                      onChange={(e) =>
                        set({ notifyToken: e.target.value })
                      }
                      placeholder={
                        form.notifyToken
                          ? "tersimpan — kosongkan bila tidak diubah"
                          : "tempel token di sini"
                      }
                      className="input"
                    />
                  </label>
                </div>
              )}
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
                  : form.notifyProvider === "telegram"
                    ? "Buat bot lewat @BotFather → salin token → kirim pesan ke bot sekali → ambil chat_id lewat @userinfobot."
                    : "Discord: Server Settings → Integrations → Webhooks → New Webhook → salin URL. Webhook ini juga menerima notifikasi pendaftaran agen baru."}
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

export default PengaturanTab;
