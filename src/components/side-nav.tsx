"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({
  items,
}: {
  items: { href: string; label: string; badge?: number }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 md:flex md:flex-col" aria-label="Studio">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/studio" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-primary-foreground/20" : "bg-persimmon/15 text-persimmon"}`}>
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
