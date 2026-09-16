"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCart, useCartLines } from "@/lib/cart";
import {
  checkCoupon,
  createOrder,
  saveCustomer,
  useAgentRef,
  useSavedCustomer,
  useSettings,
} from "@/lib/store";
import { hitungOngkir, type ShipOption } from "@/lib/config";
import { formatRupiah } from "@/lib/format";
import { lineSubtotal, unitPrice } from "@/lib/pricing";
import type { PaymentMethod } from "@/lib/types";
import ProductImage from "@/components/ProductImage";
import { CheckIcon, TruckIcon } from "@/components/Icons";

export default function CheckoutPage() {
  const router = useRouter();
  const { clearCart } = useCart();
  const lines = useCartLines();
  const settings = useSettings();

  // data pengiriman yang diingat perangkat ini (localStorage) — pola
  // "typed ?? tersimpan ?? kosong": field tetap bisa diketik ulang, tapi
  // begitu ada data tersimpan form langsung terisi tanpa efek/useEffect
  const saved = useSavedCustomer();
  const [nameTyped, setNameTyped] = useState<string | null>(null);
  const [phoneTyped, setPhoneTyped] = useState<string | null>(null);
  const [addressTyped, setAddressTyped] = useState<string | null>(null);
  const name = nameTyped ?? saved?.name ?? "";
  const phone = phoneTyped ?? saved?.phone ?? "";
  const address = addressTyped ?? saved?.address ?? "";
  // ketiga field masih memakai data tersimpan (belum diketik sendiri)
  const pakaiTersimpan =
    nameTyped === null && phoneTyped === null && addressTyped === null;
  const [note, setNote] = useState("");
  // metode pembayaran dipilih pembeli SETELAH pesanan dibuat (halaman sukses);
  // "COD" hanya placeholder yang akan diganti pemilihan sungguhan di /pesanan
  const [payment] = useState<PaymentMethod>("COD");
  const [shipOption, setShipOption] = useState<ShipOption>("reguler");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // kode agen (v6): terisi otomatis bila pengujung datang dari link
  // referral — ?ref= ditangkap komponen RefCapture di layout & disimpan,
  // di sini tinggal dibaca (plus masih bisa diketik manual)
  const agentRef = useAgentRef();
  const [agentTyped, setAgentTyped] = useState<string | null>(null);
  const agentInput = agentTyped ?? agentRef ?? "";

  // voucher — ternikat pada subtotal saat dipasang; ganti isi keranjang
  // = voucher otomatis lepas (dihitung saat render, tanpa efek)
  const [voucherInput, setVoucherInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; at: number } | null>(null);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  // harga grosir (v6): subtotal memakai harga efektif per jumlah
  const subtotal = useMemo(
    () => lines.reduce((a, l) => a + lineSubtotal(l.product, l.qty), 0),
    [lines],
  );
  const ongkir = hitungOngkir(settings, subtotal, shipOption);
  const voucherActive = applied !== null && applied.at === subtotal;
  const discount = voucherActive ? Math.min(applied?.discount ?? 0, subtotal) : 0;
  const total = Math.max(0, subtotal - discount + ongkir);

  const applyVoucher = async () => {
    if (checkingVoucher) return;
    setCheckingVoucher(true);
    setVoucherMsg("");
    try {
      const c = await checkCoupon(voucherInput, subtotal);
      const d =
        c.kind === "percent"
          ? Math.round((subtotal * c.value) / 100 / 100) * 100
          : Math.min(c.value, subtotal);
      setApplied({ code: c.code, discount: d, at: subtotal });
      setVoucherMsg(`Voucher ${c.code} diterapkan 🎉`);
    } catch (err) {
      setApplied(null);
      setVoucherMsg(err instanceof Error ? err.message : "Voucher tidak berlaku.");
    } finally {
      setCheckingVoucher(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-5xl">🧾</p>
        <h1 className="mt-3 text-lg font-bold text-slate-700">
          Tidak ada barang untuk di-checkout
        </h1>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow"
        >
          Mulai Belanja
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Mohon isi nama, nomor HP, dan alamat lengkap ya.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      // mode cloud: harga, stok, ongkir & voucher divalidasi server
      // (transaksi database); mode lokal: dihitung dari data browser
      const order = await createOrder({
        channel: "form",
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          note: note.trim() || undefined,
        },
        payment,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        shipOption,
        couponCode: voucherActive ? applied?.code : undefined,
        agentCode: agentInput.trim() || undefined,
      });
      // pembeli berikutnya tidak usah mengetik ulang data yang sama
      saveCustomer({ name, phone, address });
      clearCart();
      router.push(`/pesanan?sukses=${order.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal membuat pesanan, coba lagi.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Data Pengiriman 📦
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Isi data di bawah, pesananmu langsung kami proses.
      </p>

      <form
        onSubmit={submit}
        className="grid gap-5 lg:grid-cols-[1fr_340px]"
      >
        {/* form */}
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-5">
          {error && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
              {error}
            </p>
          )}

          {saved && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span>
                📦 Data pengiriman terakhir (<b>{saved.name}</b>){" "}
                {pakaiTersimpan
                  ? "terisi otomatis — ubah bila perlu."
                  : "tersimpan di perangkat ini."}
              </span>
              <button
                type="button"
                onClick={() => {
                  // "Kosongkan" ↔ "Pakai data tersimpan" (null = ikut data
                  // localStorage yang sama dengan halaman Akun)
                  const bersih = pakaiTersimpan;
                  setNameTyped(bersih ? "" : null);
                  setPhoneTyped(bersih ? "" : null);
                  setAddressTyped(bersih ? "" : null);
                }}
                className="font-bold underline underline-offset-2"
              >
                {pakaiTersimpan ? "Kosongkan" : "Pakai data tersimpan"}
              </button>
            </div>
          )}

          <Field label="Nama Lengkap *">
            <input
              value={name}
              onChange={(e) => setNameTyped(e.target.value)}
              placeholder="cth: Budi Santoso"
              className="input"
            />
          </Field>

          <Field label="Nomor HP / WhatsApp *">
            <input
              value={phone}
              onChange={(e) => setPhoneTyped(e.target.value)}
              placeholder="cth: 0812xxxxxxx"
              inputMode="tel"
              className="input"
            />
          </Field>

          <Field label="Alamat Lengkap *">
            <textarea
              value={address}
              onChange={(e) => setAddressTyped(e.target.value)}
              placeholder="Nama jalan, RT/RW, desa/dusun, patokan…"
              rows={3}
              className="input resize-none"
            />
          </Field>

          <Field label="Catatan (opsional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="cth: telur yang tidak retak ya"
              className="input"
            />
          </Field>

          <Field label="Kode Agen (opsional)">
            <input
              value={agentInput}
              onChange={(e) =>
                setAgentTyped(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="cth: AGABCD12 — bila kamu membeli lewat tautan agen"
              className="input font-mono uppercase"
              maxLength={12}
            />
            <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
              Terisi otomatis bila kamu datang dari tautan referral agen.
              Komisi dicatat untuk agen yang kodenya valid &amp; aktif.
            </span>
          </Field>

          <Field label="Layanan Antar *">
            <div className="grid gap-2 sm:grid-cols-2">
              <ShipOptionCard
                active={shipOption === "reguler"}
                onClick={() => setShipOption("reguler")}
                title="Reguler (antar warung)"
                desc={
                  subtotal >= settings.freeOngkirMin
                    ? `Gratis 🎉 (min. ${formatRupiah(settings.freeOngkirMin)})`
                    : `${formatRupiah(settings.ongkir)} · gratis di atas ${formatRupiah(settings.freeOngkirMin)}`
                }
              />
              <ShipOptionCard
                active={shipOption === "xpress"}
                onClick={() => setShipOption("xpress")}
                title={settings.xpressLabel}
                desc={`+ ${formatRupiah(settings.xpressOngkir)} · tiba hari ini`}
              />
            </div>
            {settings.ongkirNote && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-navy-soft p-2.5 text-xs leading-relaxed text-navy">
                <TruckIcon className="h-4 w-4 shrink-0" />
                <span>{settings.ongkirNote}</span>
              </div>
            )}
          </Field>

          {/* metode pembayaran TIDAK di sini — dipilih pembeli setelah
              pesanan dibuat (di halaman sukses /pesanan?sukses=…) */}
        </div>

        {/* ringkasan */}
        <div className="h-fit rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-32">
          <h2 className="font-extrabold text-slate-800">Pesananmu</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lines.map(({ product, qty }) => {
              const harga = unitPrice(product, qty);
              return (
              <li key={product.id} className="flex items-center gap-2">
                <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-md">
                  <ProductImage
                    product={product}
                    className="h-full w-full"
                    emojiClassName="text-base"
                  />
                </span>
                <span className="flex-1 leading-tight text-slate-600">
                  {product.name}
                  <span className="text-slate-400"> ×{qty}</span>
                  {harga < product.price && (
                    <span className="ml-1 text-[10px] font-bold text-emerald-600">
                      grosir
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-700">
                  {formatRupiah(harga * qty)}
                </span>
              </li>
              );
            })}
          </ul>

          {/* voucher */}
          <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
            {applied && voucherActive ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                <span className="font-bold text-emerald-700">
                  🎟 {applied.code}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setApplied(null);
                    setVoucherMsg("");
                    setVoucherInput("");
                  }}
                  className="text-xs font-bold text-emerald-700 underline"
                >
                  Lepas
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={voucherInput}
                  onChange={(e) =>
                    setVoucherInput(e.target.value.toUpperCase())
                  }
                  placeholder="Kode voucher"
                  className="input flex-1 uppercase"
                  aria-label="Kode voucher"
                />
                <button
                  type="button"
                  onClick={applyVoucher}
                  disabled={checkingVoucher}
                  className="rounded-lg border-2 border-brand px-3 py-1.5 text-sm font-bold text-brand transition hover:bg-brand-soft disabled:opacity-50"
                >
                  {checkingVoucher ? "…" : "Pakai"}
                </button>
              </div>
            )}
            {applied && !voucherActive && (
              <p className="mt-1.5 text-xs font-semibold text-amber-600">
                Keranjang berubah — pasang ulang voucher ya.
              </p>
            )}
            {voucherMsg && !(applied && !voucherActive) && (
              <p
                className={`mt-1.5 text-xs font-semibold ${
                  voucherActive ? "text-emerald-600" : "text-brand"
                }`}
              >
                {voucherMsg}
              </p>
            )}
          </div>

          <dl className="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-semibold">{formatRupiah(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  Diskon voucher{" "}
                  <span className="text-emerald-600">({applied?.code})</span>
                </dt>
                <dd className="font-semibold text-emerald-600">
                  −{formatRupiah(discount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">
                Ongkir{" "}
                <span className="text-xs text-slate-400">
                  ({shipOption === "xpress" ? "Xpress" : "Reguler"})
                </span>
              </dt>
              <dd className="font-semibold">
                {ongkir === 0 ? (
                  <span className="text-emerald-600">GRATIS</span>
                ) : (
                  formatRupiah(ongkir)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-extrabold text-brand">
                {formatRupiah(total)}
              </dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CheckIcon className="h-4.5 w-4.5" />
            {submitting ? "Memproses…" : "Buat Pesanan"}
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Setelah pesanan dibuat, kamu akan diminta konfirmasi ke WhatsApp
            warung ({settings.hours}).
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ShipOptionCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-3 text-left transition ${
        active
          ? "border-brand bg-brand-soft"
          : "border-slate-200 hover:border-brand/40"
      }`}
    >
      <span className="block text-sm font-bold text-slate-800">🚚 {title}</span>
      <span className="text-xs text-slate-500">{desc}</span>
    </button>
  );
}
