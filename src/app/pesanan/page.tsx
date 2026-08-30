"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useOrders } from "@/lib/store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { buildOrderRepeatMessage, waLink } from "@/lib/whatsapp";
import { useSettings } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";
import { CheckIcon, ChatIcon } from "@/components/Icons";

const STATUS_STYLE: Record<OrderStatus, string> = {
  menunggu: "bg-amber-100 text-amber-700",
  diproses: "bg-navy-soft text-navy",
  selesai: "bg-emerald-100 text-emerald-700",
  dibatalkan: "bg-slate-200 text-slate-500",
};

function PesananContent() {
  const params = useSearchParams();
  const orders = useOrders();
  const settings = useSettings();
  const suksesId = params.get("sukses");

  return (
    <div>
      {suksesId && (
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
            Selanjutnya, konfirmasi pesanan ke WhatsApp warung agar segera
            diantar.
          </p>
          {(() => {
            const order = orders.find((o) => o.id === suksesId);
            if (!order) return null;
            return (
              <a
                href={waLink(buildOrderRepeatMessage(order, settings), settings.whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2 text-sm font-bold text-white shadow transition hover:brightness-95"
              >
                <ChatIcon className="h-4 w-4" />
                Konfirmasi via WhatsApp
              </a>
            );
          })()}
        </div>
      )}

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
                  {o.payment} · {o.customer.name} · {o.customer.phone}
                </span>
                <span className="font-extrabold text-brand">
                  Total: {formatRupiah(o.total)}
                </span>
              </div>
            </div>
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
