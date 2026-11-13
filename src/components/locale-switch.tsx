"use client";

import { usePathname } from "next/navigation";
import { setLocale } from "@/server/auth-actions";

export function LocaleSwitch({ locale }: { locale: "en" | "zh" }) {
  const pathname = usePathname();
  return (
    <form
      action={setLocale}
      onSubmit={(event) => {
        // Keep the current filters and selection (?week=…&item=…) across the switch.
        const field = event.currentTarget.elements.namedItem("next");
        if (field instanceof HTMLInputElement) field.value = window.location.pathname + window.location.search;
      }}
      className="flex h-8 items-center rounded-[8px] border border-[#E4E8E5] bg-white p-0.5 text-[13px]"
    >
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={locale === "en"}
        className={`h-7 rounded-[6px] px-2.5 font-medium ${locale === "en" ? "bg-[#0F6B4F] text-white" : "text-[#5E6B65]"}`}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="zh"
        aria-pressed={locale === "zh"}
        className={`h-7 rounded-[6px] px-2.5 font-medium ${locale === "zh" ? "bg-[#0F6B4F] text-white" : "text-[#5E6B65]"}`}
      >
        中文
      </button>
    </form>
  );
}
