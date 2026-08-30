"use client";

import { MinusIcon, PlusIcon } from "./Icons";

export default function QtySelector({
  qty,
  onChange,
  max,
  size = "sm",
}: {
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  size?: "sm" | "lg";
}) {
  const btn =
    size === "lg"
      ? "h-9 w-9 text-slate-600"
      : "h-7 w-7 text-slate-600";
  const num =
    size === "lg"
      ? "w-10 text-base font-bold"
      : "w-8 text-sm font-bold";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
      <button
        type="button"
        aria-label="Kurangi jumlah"
        onClick={() => onChange(qty - 1)}
        className={`${btn} flex items-center justify-center rounded-md transition hover:bg-slate-100 active:scale-95`}
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className={`${num} text-center text-slate-800`}>{qty}</span>
      <button
        type="button"
        aria-label="Tambah jumlah"
        disabled={max !== undefined && qty >= max}
        onClick={() => onChange(qty + 1)}
        className={`${btn} flex items-center justify-center rounded-md transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300`}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
