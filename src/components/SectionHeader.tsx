import Link from "next/link";
import { ChevronRightIcon } from "./Icons";

/** Judul seksi beranda dengan tautan "Lihat Semua" */
export default function SectionHeader({
  title,
  emoji,
  href,
  hrefLabel = "Lihat Semua",
}: {
  title: string;
  emoji?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-navy sm:text-lg">
        {emoji && <span>{emoji}</span>}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs font-semibold text-navy hover:text-brand sm:text-sm"
        >
          {hrefLabel}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
