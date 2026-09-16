"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  setOrderPayment,
  useFavorites,
  useOrders,
  useProducts,
} from "@/lib/store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { buildOrderRepeatMessage, waLink } from "@/lib/whatsapp";
import { printOrderStruk } from "@/lib/printStruk";
import { useSettings } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import { CheckIcon, ChatIcon } from "@/components/Icons";

const STATUS_STYLE: Record<OrderStatus, string> = {
  menunggu: "bg-amber-100 text-amber-700",
  diproses: "bg-navy-soft text-navy",
  selesai: "bg-emerald-100 text-emerald-700",
  dibatalkan: "bg-slate-200 text-slate-500",
};

type Tab = "pesanan" | "favorit";

/** Halaman Pesanan: tab Riwayat Pesanan + tab Favorit (menu favorit
    digabung ke sini, tidak ada halaman terpisah lagi). Tab disimpan di
    query URL (?tab=favorit) agar bisa ditautkan langsung dari Tentang Kami. */
function PesananContent() {
  const params = useSearchParams();
  const router = useRouter();
  const orders = useOrders();
  const settings = useSettings();
  const tab: Tab = params.get("tab") === "favorit" ? "favorit" : "pesanan";

  const switchTab = (t: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (t === "favorit") sp.set("tab", "favorit");
    else sp.delete("tab");
    const qs = sp.toString();
    router.replace(`/pesanan${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const suksesId = params.get("sukses");

  return (
    <div>
      {suksesId && tab === "pesanan" && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-2 text-lg font-extrabold text-emerald-800">
            Pesanan Berhasil Dibuat! 🎉
          </h1>
          <p className="mt-1 text-sm text-emerald-700">
            Kode pesanan kamu:{" "}
            <b className="rounded bg-white px-2 py-0.5 font-mono">{suksesId}</b>
            <br />
            Pilih dulu metode pembayaran di bawah, lalu konfirmasi pesanan
            ke WhatsApp warung agar segera diantar.
          </p>
          {(() => {
            const order = orders.find((o) => o.id === suksesId);
            if (!order) return null;
            return (
              <>
              {/* pilih metode pembayaran — hanya untuk pesanan lewat form,
                  sekali saja (setelah dipilih tidak bisa diganti di sini) */}
              {order.channel === "form" && (
                <PaymentChooser orderId={order.id} current={order.payment} />
              )}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <a
                  href={waLink(buildOrderRepeatMessage(order, settings), settings.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2 text-sm font-bold text-white shadow transition hover:brightness-95"
                >
                  <ChatIcon className="h-4 w-4" />
                  Konfirmasi via WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => printOrderStruk(order, settings)}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-600 bg-white px-5 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  🖨 Cetak Struk
                </button>
              </div>
              </>
            );
          })()}
        </div>
      )}

      {/* tab */}
      <div className="mb-5 inline-flex gap-1 rounded-full bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => switchTab("pesanan")}
          className={`rounded-full px-4 py-2 text-xs font-bold transition sm:px-5 sm:text-sm ${
            tab === "pesanan"
              ? "bg-navy text-white shadow"
              : "text-slate-500 hover:text-navy"
          }`}
        >
          Riwayat Pesanan
        </button>
        <button
          type="button"
          onClick={() => switchTab("favorit")}
          className={`rounded-full px-4 py-2 text-xs font-bold transition sm:px-5 sm:text-sm ${
            tab === "favorit"
              ? "bg-navy text-white shadow"
              : "text-slate-500 hover:text-navy"
          }`}
        >
          Favorit ❤️
        </button>
      </div>

      {tab === "pesanan" ? <RiwayatTab orders={orders} settings={settings} /> : <FavoritTab />}
    </div>
  );
}

/** tab riwayat pesanan */
function RiwayatTab({
  orders,
  settings,
}: {
  orders: ReturnType<typeof useOrders>;
  settings: ReturnType<typeof useSettings>;
}) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Riwayat Pesanan 🧾
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Semua pesanan dari perangkat ini tersimpan di sini
      </p>

      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-5xl">📭</p>
          <p className="mt-3 font-bold text-slate-700">
            Belum ada pesanan
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Pesanan yang dibuat lewat form checkout akan muncul di sini.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm font-extrabold text-slate-800">
                    {o.id}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {formatDateTime(o.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {o.channel === "whatsapp" && (
                    <span className="rounded bg-[#25d366]/15 px-2 py-0.5 text-[11px] font-bold text-[#128c4a]">
                      WhatsApp
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[o.status]}`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {o.items.map((i) => (
                  <li key={i.productId} className="flex items-center gap-2">
                    <span>{i.emoji}</span>
                    <span className="flex-1 truncate">
                      {i.name}{" "}
                      <span className="text-slate-400">×{i.qty}</span>
                    </span>
                    <span className="font-semibold">
                      {formatRupiah(i.price * i.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-3">
                <span className="text-xs text-slate-500">
                  {o.payment} · Antar {o.shipOption === "xpress" ? "Xpress" : "Reguler"}
                  {o.discount > 0 && (
                    <span className="text-emerald-600">
                      {" "}· 🎟 −{formatRupiah(o.discount)}
                    </span>
                  )}
                  <br />
                  {o.customer.name} · {o.customer.phone}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printOrderStruk(o, settings)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                  >
                    🖨 Struk
                  </button>
                  <span className="font-extrabold text-brand">
                    Total: {formatRupiah(o.total)}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** tab produk favorit (dipindah dari halaman /favorit lama) */
function FavoritTab() {
  const favorites = useFavorites();
  const products = useProducts();
  const items = products.filter((p) => favorites.includes(p.id));

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Produk Favorit ❤️
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Barang yang kamu tandai dengan hati, biar gampang dicari lagi
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-5xl">🤍</p>
          <p className="mt-3 font-bold text-slate-700">
            Belum ada produk favorit
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Tekan ikon hati di kartu produk untuk menyimpannya di sini.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow"
          >
            Cari Barang
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PesananPage() {
  return (
    <Suspense>
      <PesananContent />
    </Suspense>
  );
}

/** Penanda per-perangkat: pesanan ini sudah lewat kartu pemilihan pembayaran
    (diperlukan karena memilih COD = nilai awal DB, tak terbedakan saat reload). */
const PAYMENT_CHOSEN_KEY = "los_payment_chosen_v1";

function bacaSudahPilihPembayaran(orderId: string): boolean {
  try {
    const ids = JSON.parse(
      localStorage.getItem(PAYMENT_CHOSEN_KEY) ?? "[]",
    ) as string[];
    return ids.includes(orderId);
  } catch {
    return false;
  }
}

function tandaiSudahPilihPembayaran(orderId: string): void {
  try {
    const ids = JSON.parse(
      localStorage.getItem(PAYMENT_CHOSEN_KEY) ?? "[]",
    ) as string[];
    localStorage.setItem(
      PAYMENT_CHOSEN_KEY,
      JSON.stringify([orderId, ...ids.filter((x) => x !== orderId)]),
    );
  } catch {
    /* penyimpanan penuh/blokir — pilihan tetap tersimpan di pesanan */
  }
}

/** Pemilih metode pembayaran untuk pesanan form — muncul di banner sukses
    SETELAH pesanan dibuat (alur baru: checkout form tanpa kartu COD/Transfer,
    metode dipilih di sini sekali saja). Pending state + error inline. */
function PaymentChooser({
  orderId,
  current,
}: {
  orderId: string;
  current: "COD" | "Transfer Bank";
}) {
  const [pilih, setPilih] = useState<"COD" | "Transfer Bank" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Transfer Bank terlihat langsung dari data pesanan; COD perlu penanda
  // perangkat karena "COD" juga nilai awal sebelum dipilih
  const [selesai, setSelesai] = useState(
    () => current !== "COD" || bacaSudahPilihPembayaran(orderId),
  );
  const sudahPilih = selesai;

  const simpan = async (metode: "COD" | "Transfer Bank") => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await setOrderPayment(orderId, metode);
      tandaiSudahPilihPembayaran(orderId);
      setSelesai(true);
      setPilih(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pilihan.");
    } finally {
      setSaving(false);
    }
  };

  if (sudahPilih) {
    return (
      <p className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-sm font-bold text-emerald-700 shadow-sm">
        💳 Pembayaran: {current}
      </p>
    );
  }

  const metode = pilih ?? "COD";
  return (
    <div className="mt-3 rounded-xl bg-white p-4 text-left shadow-sm">
      <p className="text-sm font-bold text-slate-800">💳 Metode Pembayaran</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Pilih salah satu — pilihan tidak bisa diganti setelah ini.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPilih("COD")}
          className={`rounded-xl border-2 p-3 text-left transition ${
            metode === "COD"
              ? "border-brand bg-brand-soft"
              : "border-slate-200 hover:border-brand/40"
          }`}
        >
          <span className="block text-sm font-bold text-slate-800">
            COD (Bayar di Tempat)
          </span>
          <span className="text-xs text-slate-500">
            Bayar tunai saat barang tiba
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPilih("Transfer Bank")}
          className={`rounded-xl border-2 p-3 text-left transition ${
            metode === "Transfer Bank"
              ? "border-brand bg-brand-soft"
              : "border-slate-200 hover:border-brand/40"
          }`}
        >
          <span className="block text-sm font-bold text-slate-800">
            Transfer Bank
          </span>
          <span className="text-xs text-slate-500">
            BCA 1234567890 a.n. Lembang Store
          </span>
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-brand">{error}</p>
      )}
      <button
        type="button"
        onClick={() => simpan(metode)}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {saving ? "Menyimpan…" : `Pakai ${metode}`}
      </button>
    </div>
  );
}
