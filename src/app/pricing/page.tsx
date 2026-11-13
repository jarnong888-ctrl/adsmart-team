import Link from "next/link";
import { LocaleSwitch } from "@/components/locale-switch";
import { formatMyr } from "@/lib/credit-catalog";
import { tr } from "@/lib/i18n";
import { ensureCatalog } from "@/server/credits";
import { prisma } from "@/lib/db";
import { getLocale } from "@/server/guard";

export default async function PricingPage() {
  const locale = await getLocale();
  await ensureCatalog();
  const packs = await prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#14201B]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold text-[#14201B] no-underline">
          <span className="grid size-5 place-items-center rounded-[4px] bg-[#0F6B4F] text-[13px] text-white">A</span>
          Adsmart Team
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <LocaleSwitch locale={locale} />
          <Link href="/login">{tr(locale, "Log in", "登录")}</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 pb-16">
        <h1 className="max-w-2xl text-[28px] leading-[1.3] font-semibold">{tr(locale, "Pay for credits. Nothing is billed yet.", "按点数付费。现在不会扣款。")}</h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-[1.65] text-[#5E6B65]">
          {tr(
            locale,
            "Plans are no longer a monthly subscription. Each AI action spends credits. These pack prices are placeholders until Jarno sets them. The RM29.90 class, the RM399 class, consulting, and the Adsmart plugin stay separate offers.",
            "不再按月订阅。每个 AI 动作扣点数。这些套餐价格是占位，等 Jarno 定价。RM29.90 的课、RM399 的课、咨询和 Adsmart 插件仍是另外的产品。",
          )}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {packs.map((pack) => (
            <article key={pack.code} className={`rounded-[8px] bg-white p-5 ${pack.code === "intermediate" ? "border-2 border-[#14201B]" : "border border-[#E4E8E5]"}`}>
              {pack.code === "intermediate" ? <p className="text-[13px] font-medium text-[#5E6B65]">{tr(locale, "Placeholder", "占位")}</p> : null}
              <h2 className="mt-1 text-[16px] font-semibold">{locale === "zh" ? pack.nameZh : pack.nameEn}</h2>
              <p className="mt-2 text-[28px] font-semibold tabular-nums">
                {formatMyr(pack.priceMyrCents)}
                <span className="text-[14px] font-normal text-[#5E6B65]">
                  {pack.cadence === "monthly" ? tr(locale, " / month", " / 月") : pack.cadence === "once" ? tr(locale, " once", " 一次") : ""}
                </span>
              </p>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#3F4C46]">{locale === "zh" ? pack.blurbZh : pack.blurbEn}</p>
              <p className="mt-4 text-[14px]">{pack.credits} {tr(locale, "credits", "点")}</p>
              <Link href="/signup" className="mt-5 inline-flex h-9 items-center justify-center rounded-[8px] border border-[#0F6B4F] bg-[#0F6B4F] px-4 text-[14px] font-semibold text-white no-underline shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#0A5540]">{tr(locale, "Start with free credits", "用免费点数开始")}</Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
