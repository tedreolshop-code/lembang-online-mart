"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart, useCartLines } from "@/lib/cart";
import { createOrder } from "@/lib/store";
import { hitungOngkir } from "@/lib/config";
import { useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import ProductImage from "@/components/ProductImage";
import { CheckIcon } from "@/components/Icons";

export default function CheckoutPage() {
  const router = useRouter();
  const { clearCart } = useCart();
  const lines = useCartLines();
  const settings = useSettings();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subtotal = lines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const ongkir = hitungOngkir(settings, subtotal);
  const total = subtotal + ongkir;

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
      // mode cloud: harga & stok divalidasi server (transaksi database);
      // mode lokal: dihitung dari data browser
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
      });
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

          <Field label="Nama Lengkap *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Budi Santoso"
              className="input"
            />
          </Field>

          <Field label="Nomor HP / WhatsApp *">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="cth: 0812xxxxxxx"
              inputMode="tel"
              className="input"
            />
          </Field>

          <Field label="Alamat Lengkap *">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
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

          <Field label="Metode Pembayaran *">
            <div className="grid gap-2 sm:grid-cols-2">
              <PaymentOption
                active={payment === "COD"}
                onClick={() => setPayment("COD")}
                title="COD (Bayar di Tempat)"
                desc="Bayar tunai saat barang tiba"
              />
              <PaymentOption
                active={payment === "Transfer Bank"}
                onClick={() => setPayment("Transfer Bank")}
                title="Transfer Bank"
                desc="BCA 1234567890 a.n. Lembang Store"
              />
            </div>
          </Field>
        </div>

        {/* ringkasan */}
        <div className="h-fit rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-32">
          <h2 className="font-extrabold text-slate-800">Pesananmu</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lines.map(({ product, qty }) => (
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
                </span>
                <span className="font-semibold text-slate-700">
                  {formatRupiah(product.price * qty)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-semibold">{formatRupiah(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Ongkir</dt>
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

function PaymentOption({
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
      <span className="block text-sm font-bold text-slate-800">{title}</span>
      <span className="text-xs text-slate-500">{desc}</span>
    </button>
  );
}
