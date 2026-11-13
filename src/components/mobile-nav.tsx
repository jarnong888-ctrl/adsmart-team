"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function MobileNav({
  items,
  label,
}: {
  items: { href: string; label: string; badge?: number }[];
  label: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="h-11 rounded-[6px] border border-[#E4E8E5] bg-white px-3 text-[13px]"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-[#14201B]/20" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={label}
            className="absolute inset-x-3 top-14 max-h-[80vh] overflow-y-auto rounded-[8px] border border-[#E4E8E5] bg-white p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[14px] font-medium">{label}</p>
              <button type="button" className="h-8 px-2 text-[13px] text-[#5E6B65]" onClick={() => setOpen(false)} aria-label={label}>
                ×
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label={label}>
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/studio" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-between rounded-[6px] px-3 text-[14px] font-semibold ${active ? "bg-[#E9F4EE] text-[#0F6B4F]" : "text-[#3F4C46]"}`}
                    onClick={() => setOpen(false)}
                  >
                    <span>{item.label}</span>
                    {item.badge ? <span className="grid h-4 min-w-4 place-items-center rounded-[4px] bg-[#0F6B4F] px-1 text-[13px] text-white">{item.badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
