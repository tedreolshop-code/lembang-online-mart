"use client";

import Link from "next/link";
import { useCart, useCartLines } from "@/lib/cart";
import { hitungOngkir } from "@/lib/config";
import { useAgentPrices, useAgentRef, useSettings } from "@/lib/store";
import { formatRupiah } from "@/lib/format";
import {
  agentPriceFor,
  lineSubtotalWithAgent,
  unitPriceWithAgent,
} from "@/lib/pricing";
import QtySelector from "@/components/QtySelector";
import ProductImage from "@/components/ProductImage";
import { TrashIcon, TruckIcon } from "@/components/Icons";

export default function KeranjangPage() {
  const { setQty, removeItem } = useCart();
  const lines = useCartLines();
  const settings = useSettings();
  // kode referral tersimpan (v6) — reaktif lewat pub-sub store, SSR aman
  const agentRef = useAgentRef();
  // harga khusus agen milik kode referral (v9) — [] bila tidak ada
  const agentPrices = useAgentPrices();

  // harga grosir (v6) + harga khusus agen (v9): tiap baris memakai harga
  // efektif sesuai jumlahnya, ditimpa harga agen bila ada
  const subtotal = lines.reduce(
    (a, l) => a + lineSubtotalWithAgent(l.product, l.qty, agentPrices),
    0,
  );
  const ongkir = hitungOngkir(settings, subtotal);
  const total = subtotal + ongkir;
  const kurangGratis = Math.max(0, settings.freeOngkirMin - subtotal);

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-3 text-lg font-bold text-slate-700">
          Keranjang masih kosong
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Yuk mulai belanja kebutuhan harianmu!
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
        >
          Mulai Belanja
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-slate-800 sm:text-2xl">
        Keranjang Belanja ({lines.length})
      </h1>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* daftar barang */}
        <div className="space-y-3">
          {lines.map(({ product, qty }) => {
            const harga = unitPriceWithAgent(product, qty, agentPrices);
            const hargaAgen = agentPriceFor(agentPrices, product.id) != null;
            const grosir = !hargaAgen && harga < product.price;
            return (
            <div
              key={product.id}
              className="flex gap-3 rounded-xl bg-white p-3 shadow-sm"
            >
              <Link
                href={`/produk/${product.id}`}
                className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg"
              >
                <ProductImage
                  product={product}
                  className="h-full w-full"
                  emojiClassName="text-4xl"
                />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/produk/${product.id}`}
                    className="text-sm font-bold text-slate-800 hover:text-brand"
                  >
                    {product.name}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Hapus ${product.name}`}
                    onClick={() => removeItem(product.id)}
                    className="text-slate-300 transition hover:text-brand"
                  >
                    <TrashIcon className="h-4.5 w-4.5" />
                  </button>
                </div>
                <span className="text-xs text-slate-400">
                  {product.unit}
                  {hargaAgen ? (
                    <span className="ml-1.5 rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-bold text-navy">
                      harga agen {formatRupiah(harga)}
                    </span>
                  ) : (
                    grosir && (
                      <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                        harga grosir {formatRupiah(harga)}
                      </span>
                    )
                  )}
                </span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-extrabold text-brand">
                    {formatRupiah(harga * qty)}
                  </span>
                  <QtySelector
                    qty={qty}
                    onChange={(q) => setQty(product.id, q)}
                    max={product.stock}
                  />
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* ringkasan */}
        <div className="h-fit rounded-xl bg-white p-4 shadow-sm lg:sticky lg:top-32">
          <h2 className="font-extrabold text-slate-800">Ringkasan Belanja</h2>

          {agentPrices.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-navy-soft p-2.5 text-xs text-navy">
              <span>🏷️</span>
              <span>
                <b>Harga khusus agen {agentRef}</b> sudah diterapkan pada
                barang di keranjang ini.
              </span>
            </div>
          )}

          {kurangGratis > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-navy-soft p-2.5 text-xs text-navy">
              <TruckIcon className="h-4 w-4 shrink-0" />
              <span>
                Tambah <b>{formatRupiah(kurangGratis)}</b> lagi untuk{" "}
                <b>gratis ongkir!</b>
              </span>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">
              <TruckIcon className="h-4 w-4 shrink-0" />
              <span>
                Selamat, belanja kamu <b>gratis ongkir!</b> 🎉
              </span>
            </div>
          )}

          <dl className="mt-3 space-y-1.5 text-sm">
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

          {settings.ongkirNote && (
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
              {settings.ongkirNote}
            </p>
          )}

          {/* form checkout */}
          <Link
            href="/checkout"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-navy-dark active:scale-[0.98]"
          >
            Checkout
          </Link>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Pesanan dikonfirmasi lewat WhatsApp ke nomor warung sebelum diantar.
          </p>
        </div>
      </div>
    </div>
  );
}
