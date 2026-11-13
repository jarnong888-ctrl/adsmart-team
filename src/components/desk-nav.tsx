"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ChartColumn,
  Clapperboard,
  Columns3,
  Eye,
  FileText,
  House,
  Map,
  Plug,
  Repeat2,
  Settings2,
  Shield,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  house: House,
  columns: Columns3,
  map: Map,
  file: FileText,
  repeat: Repeat2,
  clapper: Clapperboard,
  calendar: CalendarClock,
  plug: Plug,
  chart: ChartColumn,
  eye: Eye,
  settings: Settings2,
  shield: Shield,
  wallet: Wallet,
};

export function DeskNav({
  items,
}: {
  items: { href: string; label: string; icon: string; badge?: number }[];
}) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/studio" && pathname.startsWith(`${item.href}/`));
        const Icon = ICONS[item.icon] ?? House;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1E9A6E] ${active ? "bg-[#E9F4EE] text-[#0B5A42]" : "text-[#3F4C46] hover:bg-[#F1F3F2] hover:text-[#14201B]"}`}
          >
            <Icon className="size-[18px] stroke-[1.75]" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0F6B4F] px-1.5 text-[11px] font-semibold text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </>
  );
}
