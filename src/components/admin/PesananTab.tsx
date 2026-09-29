"use client";

import { useState } from "react";
import { useOrders, useProducts, updateOrderStatus, useSettings, acceptOrder, cancelOrder, deleteOrder, loadOlderOrders } from "@/lib/store";
import { printOrderStruk } from "@/lib/printStruk";
import { formatRupiah, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { BagIcon, TrashIcon } from "@/components/Icons";

function PesananTab() {
  const orders = useOrders();
  const products = useProducts();
  const settings = useSettings();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  // daftar dimuat 200 terbaru; tombol hanya muncul bila kemungkinan terpotong
  const canLoadMore = orders.length >= 200 && !noMore;

  if (orders.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm">
        <BagIcon className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-2 font-bold text-slate-700">Belum ada pesanan masuk</p>
        <p className="mt-1 text-sm text-slate-500">
          Pesanan dari form checkout akan muncul di sini. Pesanan lewat WhatsApp
          masuk langsung ke chat WhatsApp warung.
        </p>
      </div>
    );
  }

  // tampilkan toast lalu hilangkan otomatis (diterima / gagal / dihapus)
  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  const terima = async (o: Order) => {
    try {
      await acceptOrder(o);
      showToast(true, `Pesanan ${o.id} diterima & stok dikurangi.`);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : "Gagal menerima pesanan.");
    }
  };

  // hapus permanen: konfirmasi ketik id → baru dihapus + notifikasi hasil
  const hapus = async (o: Order) => {
    const jawab = prompt(
      `⚠️ Hapus permanen pesanan ${o.id}?\n\n` +
        `Tindakan ini TIDAK bisa dibatalkan: data pesanan hilang dari daftar ` +
        `dan laporan. Ketik HAPUS untuk melanjutkan.`,
    );
    if (jawab === null) return; // dibatalkan
    if (jawab.trim().toUpperCase() !== "HAPUS") {
      showToast(false, "❌ Penghapusan dibatalkan — ketikan tidak sesuai.");
      return;
    }
    try {
      await deleteOrder(o.id);
      showToast(true, `✅ Pesanan ${o.id} berhasil dihapus.`);
    } catch (err) {
      showToast(
        false,
        err instanceof Error ? err.message : "Gagal menghapus pesanan.",
      );
    }
  };

  const stokCukup = (o: Order) =>
    o.items.every((i) => {
      const p = products.find((x) => x.id === i.productId);
      return !p || p.stock >= i.qty;
    });

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-navy-soft p-3 text-xs text-navy sm:text-sm">
        📦 Pesanan <b>form checkout</b> otomatis mengurangi stok. Pesanan{" "}
        <b>WhatsApp</b>: tekan &quot;Terima&quot; setelah pelanggan konfirmasi agar stok
        juga berkurang.
      </div>
      {orders.map((o: Order) => (
        <div key={o.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="break-all font-mono font-extrabold text-slate-800">
                {o.id}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                {formatDateTime(o.createdAt)}
              </span>
              {o.agentCode && (
                <span
                  className="ml-2 rounded bg-navy-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy"
                  title={
                    (o.agentCommission ?? 0) > 0
                      ? `Komisi agen ${formatRupiah(o.agentCommission ?? 0)}`
                      : "Agen tercatat tanpa komisi (lihat tab Agen)"
                  }
                >
                  🤝 {o.agentCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.status === "dibatalkan" && (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  dibatalkan
                </span>
              )}
              {o.channel === "whatsapp" && !o.stockApplied && o.status !== "dibatalkan" && (
                <button
                  type="button"
                  onClick={() => terima(o)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow transition hover:brightness-95 ${
                    stokCukup(o) ? "bg-brand" : "bg-slate-400"
                  }`}
                  title={
                    stokCukup(o)
                      ? "Kurangi stok & proses pesanan"
                      : "Stok tidak cukup — stok akan dikurangi sebisanya"
                  }
                >
                  Terima &amp; kurangi stok
                </button>
              )}
              {o.stockApplied && o.status !== "dibatalkan" && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ stok dikurangi
                </span>
              )}
              <select
                value={o.status}
                onChange={async (e) => {
                  const next = e.target.value as OrderStatus;
                  try {
                    await updateOrderStatus(o.id, next);
                    if (next === "dibatalkan") {
                      showToast(true, "Pesanan dibatalkan & stok dikembalikan.");
                    }
                  } catch (err) {
                    showToast(
                      false,
                      err instanceof Error ? err.message : "Gagal mengubah status.",
                    );
                  }
                }}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold capitalize outline-none"
              >
                <option value="menunggu">menunggu</option>
                <option value="diproses">diproses</option>
                <option value="selesai">selesai</option>
                <option value="dibatalkan">dibatalkan</option>
              </select>
              {o.status !== "dibatalkan" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Batalkan pesanan ${o.id}? Stok yang sudah dikurangi akan dikembalikan.`,
                      )
                    )
                      return;
                    try {
                      await cancelOrder(o);
                      showToast(true, "Pesanan dibatalkan & stok dikembalikan.");
                    } catch (err) {
                      showToast(
                        false,
                        err instanceof Error ? err.message : "Gagal membatalkan pesanan.",
                      );
                    }
                  }}
                  title="Batalkan pesanan & kembalikan stok"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-brand/40 hover:text-brand"
                >
                  Batalkan
                </button>
              )}
              <button
                type="button"
                onClick={() => printOrderStruk(o, settings)}
                title="Cetak struk pesanan"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-brand/40 hover:text-brand"
              >
                🖨 Struk
              </button>
              <button
                type="button"
                onClick={() => void hapus(o)}
                title="Hapus permanen pesanan"
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Hapus
              </button>
            </div>
          </div>

          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div className="text-slate-600">
              <p className="font-bold text-slate-700">{o.customer.name}</p>
              <p>{o.customer.phone}</p>
              <p className="text-xs">{o.customer.address}</p>
              {o.customer.note && (
                <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  📝 {o.customer.note}
                </p>
              )}
            </div>
            <ul className="text-slate-600">
              {o.items.map((i) => {
                const p = products.find((x) => x.id === i.productId);
                return (
                  <li key={i.productId}>
                    {i.emoji} {i.name}{" "}
                    <span className="text-slate-400">×{i.qty}</span>
                    {o.stockApplied && p && (
                      <span className="text-[11px] text-slate-400">
                        {" "}
                        · sisa {p.stock}
                      </span>
                    )}
                  </li>
                );
              })}
              <li className="mt-1 border-t border-dashed border-slate-200 pt-1 font-bold text-slate-800">
                Total: {formatRupiah(o.total)}{" "}
                <span className="font-normal text-slate-400">
                  ({o.payment})
                </span>
              </li>
            </ul>
          </div>
        </div>
      ))}

      {canLoadMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            try {
              const { more } = await loadOlderOrders(50);
              if (!more) setNoMore(true);
            } catch (err) {
              showToast(
                false,
                err instanceof Error ? err.message : "Gagal memuat pesanan lama.",
              );
            } finally {
              setLoadingMore(false);
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          {loadingMore ? "Memuat…" : "Muat pesanan lama"}
        </button>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition ${
            toast.ok ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/** Tab Voucher — pemilik membuat kode potongan harga. Pembeli mengetik
    kodenya di halaman checkout; validasi final tetap di server. */

export default PesananTab;
