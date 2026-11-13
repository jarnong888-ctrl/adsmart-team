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
            className={`flex h-8 items-center gap-2 rounded-[6px] px-2 text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#0B624C] ${active ? "bg-[#E6F2ED] text-[#0B624C]" : "text-[#1C453A] hover:bg-[#E7F1EC]"}`}
          >
            <Icon className="size-4 stroke-[2]" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="grid h-4 min-w-4 place-items-center rounded-[4px] bg-[#0B624C] px-1 text-[13px] text-white">{item.badge}</span> : null}
          </Link>
        );
      })}
    </>
  );
}
