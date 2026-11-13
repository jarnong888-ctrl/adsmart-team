"use client";

import { usePathname } from "next/navigation";
import { setLocale } from "@/server/auth-actions";

export function LocaleSwitch({ locale }: { locale: "en" | "zh" }) {
  const pathname = usePathname();
  return (
    <form action={setLocale} className="flex h-7 items-center rounded-[6px] border border-[#E4E8E5] bg-white p-0.5 text-[13px]">
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={locale === "en"}
        className={`h-6 rounded-[4px] px-2 font-semibold ${locale === "en" ? "bg-[#0F6B4F] text-white" : "text-[#5E6B65]"}`}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="zh"
        aria-pressed={locale === "zh"}
        className={`h-6 rounded-[4px] px-2 font-semibold ${locale === "zh" ? "bg-[#0F6B4F] text-white" : "text-[#5E6B65]"}`}
      >
        中文
      </button>
    </form>
  );
}
