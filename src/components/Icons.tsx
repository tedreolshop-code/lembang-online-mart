import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.5 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L21 8H6" />
    </svg>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)} fill={filled ? "currentColor" : "none"}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8h12l1 12H5L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20l4-1L20 7l-3-3L5 16l-1 4z" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M1 5h13v11H1z" />
      <path d="M14 9h4l3 3v4h-7V9z" />
      <circle cx="6" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── ikon kategori (garis, ala mockup GrosirMaju) ─────────────── */

function BowlIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12h18a9 9 0 0 1-9 9 9 9 0 0 1-9-9z" />
      <path d="M8 8V6M12 8V5M16 8V6" />
    </svg>
  );
}

function BottleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.5h4v3l2.5 3.5V21a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5V9L10 5.5v-3z" />
      <path d="M7.5 13h9" />
    </svg>
  );
}

function CupIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8h12l-1.4 12.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6 8z" />
      <path d="M9.5 8 12 3" />
    </svg>
  );
}

function CookieIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3a9 9 0 1 0 9 9 3.5 3.5 0 0 1-4.5-3.4A3.5 3.5 0 0 1 13 5.2 3.5 3.5 0 0 1 12 3z" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BabyBottleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 8h6v11a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 9 19V8z" />
      <path d="M10 8V5.5h4V8" />
      <path d="M9 13h6" />
    </svg>
  );
}

function SprayIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5h4V7h-4z" />
      <path d="M9 10h6l1 11H8l1-11z" />
      <path d="M15.5 4.5H19M15.5 7h2" />
    </svg>
  );
}

function PanIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="13.5" r="6.5" />
      <path d="M16.5 13.5H22" />
      <path d="M8 4.5v2M12 4.5v2" />
    </svg>
  );
}

/** Ikon garis per kategori (ala mockup). Null → pemanggil pakai emoji. */
export function CategoryGlyph({
  slug,
  className = "h-9 w-9",
}: {
  slug: string;
  className?: string;
}) {
  const map: Record<string, (p: IconProps) => React.JSX.Element> = {
    "mie-instan": BowlIcon,
    sembako: BottleIcon,
    minuman: CupIcon,
    snack: CookieIcon,
    bayi: BabyBottleIcon,
    kebersihan: SprayIcon,
    dapur: PanIcon,
  };
  const Icon = map[slug];
  return Icon ? <Icon className={className} /> : null;
}
