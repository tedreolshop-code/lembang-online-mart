"use client";

import { formatRupiah } from "@/lib/format";

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-brand text-white shadow"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ── tab produk (CRUD) ────────────────────────────────────────── */

export function Tag({ label }: { label: string }) {
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
      {label}
    </span>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#f97316]"
      />
      {label}
    </label>
  );
}

/* ── tab stok ─────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  tone,
  isRupiah,
}: {
  label: string;
  value: number;
  tone: "normal" | "warn" | "danger";
  isRupiah?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? value > 0
        ? "text-brand"
        : "text-slate-400"
      : tone === "warn"
        ? value > 0
          ? "text-amber-600"
          : "text-slate-400"
        : "text-slate-800";
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 text-center shadow-sm">
      <div className={`truncate text-xl font-extrabold ${toneClass}`}>
        {isRupiah ? formatRupiah(value) : value}
      </div>
      <div className="truncate text-[11px] font-semibold text-slate-400">
        {label}
      </div>
    </div>
  );
}
