"use client";

import { usePathname } from "next/navigation";
import { setLocale } from "@/server/auth-actions";

export function LocaleSwitch({ locale }: { locale: "en" | "zh" }) {
  const pathname = usePathname();
  return (
    <form action={setLocale} className="flex h-7 items-center rounded-[6px] border border-[#D5E3DD] bg-white p-0.5 text-[13px]">
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={locale === "en"}
        className={`h-6 rounded-[4px] px-2 font-bold ${locale === "en" ? "bg-[#0B624C] text-white" : "text-[#3D5C54]"}`}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="zh"
        aria-pressed={locale === "zh"}
        className={`h-6 rounded-[4px] px-2 font-bold ${locale === "zh" ? "bg-[#0B624C] text-white" : "text-[#3D5C54]"}`}
      >
        中文
      </button>
    </form>
  );
}
