import { Check, Coins, Receipt, Sparkles } from "lucide-react";
import { EmptyPanel, Panel, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatMyr } from "@/lib/credit-catalog";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { ensureWallet, usageByAction } from "@/server/credits";
import { buyCredits } from "@/server/studio-actions";
import { studioContext } from "@/server/context";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { locale, workspace, user } = await studioContext();
  const sp = await searchParams;
  const wallet = await ensureWallet(workspace.id);
  const [packs, costs, payments, usage] = await Promise.all([
    prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.creditCost.findMany({ orderBy: { credits: "desc" } }),
    prisma.payment.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    usageByAction(workspace.id),
  ]);
  const label = (row: { labelZh: string; labelEn: string }) => (locale === "zh" ? row.labelZh : row.labelEn);
  const labels = new Map(costs.map((row) => [row.action, label(row)]));
  const spent = usage.reduce((sum, row) => sum + row.credits, 0);
  const maxUsage = Math.max(1, ...usage.map((row) => row.credits));
  // What the balance buys, using the everyday content actions when they exist.
  const everyday = ["write_script", "repurpose", "write_brief", "generate_week"];
  const preferred = everyday.flatMap((action) => costs.filter((row) => row.action === action && row.credits > 0));
  const examples = (preferred.length ? preferred : [...costs].filter((row) => row.credits > 0).sort((a, b) => a.credits - b.credits)).slice(0, 3);
  const featured = packs.find((pack) => pack.code === "intermediate")?.code;
  const canBuy = user.platformRole !== "admin";

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Credits", "点数")}
        lede={tr(locale, "Pay as you go. Each AI action uses credits; top up whenever you need more. Prices are placeholders and the demo checkout does not charge a card.", "按用量付费。每个 AI 动作扣点数，不够随时充值。价格是占位，演示付款不会扣卡。")}
      />

      {/* Balance */}
      <section className="grid overflow-hidden rounded-[20px] bg-[#14201B] text-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="p-6 sm:p-7">
          <p className="flex items-center gap-2 text-[13px] font-medium text-white/70"><Coins className="size-4" aria-hidden />{tr(locale, "Balance", "余额")}</p>
          <p className="nums mt-3 text-[52px] leading-none tracking-[-0.03em]">{wallet.balance}</p>
          <p className="mt-2 text-[14px] text-white/70">{tr(locale, `credits left · ${spent} used so far`, `点剩余 · 已用 ${spent} 点`)}</p>
        </div>
        {examples.length ? (
          <div className="border-t border-white/10 p-6 sm:p-7 lg:border-t-0 lg:border-l">
            <p className="text-[13px] font-medium text-white/70">{tr(locale, "Enough for about", "大约够用")}</p>
            <ul className="mt-3 space-y-2.5">
              {examples.map((row) => (
                <li key={row.action} className="flex items-center justify-between gap-3">
                  <span className="text-[14px] text-white/90">{label(row)}</span>
                  <span className="text-right"><span className="nums text-[18px]">{Math.floor(wallet.balance / row.credits)}×</span><span className="block text-[11.5px] text-white/60">{row.credits} {tr(locale, "credits each", "点/次")}</span></span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Packs */}
      <section aria-labelledby="packs-heading">
        <h2 id="packs-heading" className="type-h2 mb-3">{tr(locale, "Top up", "充值")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {packs.map((pack) => {
            const name = locale === "zh" ? pack.nameZh : pack.nameEn;
            const blurb = locale === "zh" ? pack.blurbZh : pack.blurbEn;
            const isFeatured = pack.code === featured;
            const perCredit = pack.credits > 0 && pack.priceMyrCents > 0 ? `RM${(pack.priceMyrCents / 100 / pack.credits).toFixed(3)}` : null;
            return (
              <article key={pack.code} className={`relative flex flex-col rounded-[16px] bg-white p-6 ${isFeatured ? "border-2 border-[#0F6B4F] shadow-[0_12px_30px_-16px_rgba(15,107,79,0.45)]" : "border border-[#E4E8E5]"}`}>
                {isFeatured ? (
                  <span className="absolute -top-3 left-6 inline-flex h-6 items-center gap-1 rounded-full bg-[#0F6B4F] px-2.5 text-[11.5px] font-semibold text-white">
                    <Sparkles className="size-3" aria-hidden />{tr(locale, "Most popular", "最受欢迎")}
                  </span>
                ) : null}
                <h3 className="text-[15px] font-semibold">{name}</h3>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="nums text-[34px] leading-none tracking-[-0.02em]">{formatMyr(pack.priceMyrCents)}</span>
                  {pack.cadence !== "pack" ? <span className="text-[13px] text-[#5E6B65]">{tr(locale, "/ month", "/ 月")}</span> : null}
                </p>
                <p className="mt-2 text-[14px]"><span className="nums">{pack.credits}</span> {tr(locale, "credits", "点")}{perCredit ? <span className="text-[#7A8781]"> · {perCredit}/{tr(locale, "credit", "点")}</span> : null}</p>
                {blurb ? (
                  <p className="font-cjk mt-4 flex items-start gap-2 border-t border-[#EEF1EF] pt-4 text-[13.5px] leading-relaxed text-[#3F4C46]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#1E9A6E]" aria-hidden />{blurb}
                  </p>
                ) : null}
                <div className="mt-auto pt-5">
                  {pack.cadence === "pack" && canBuy ? (
                    <form action={buyCredits}>
                      <input type="hidden" name="packageCode" value={pack.code} />
                      <SubmitButton variant={isFeatured ? "default" : "outline"} className="w-full">{tr(locale, `Buy ${name}`, `购买${name}`)}</SubmitButton>
                    </form>
                  ) : (
                    <p className="rounded-[10px] bg-[#F6F7F5] px-3 py-2.5 text-center text-[13px] text-[#5E6B65]">
                      {pack.cadence === "pack" ? tr(locale, "Clients buy their own credits", "由客户自行购买") : tr(locale, "Included with every workspace", "每个工作区都包含")}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title={tr(locale, "Where your credits went", "点数用在哪里")} subtitle={tr(locale, "This workspace, all time", "本工作区，全部时间")}>
          {usage.length === 0 ? (
            <EmptyPanel compact title={tr(locale, "No credits used yet", "还没有用过点数")} body={tr(locale, "AI actions show up here as you use them.", "使用 AI 动作后会显示在这里。")} />
          ) : (
            <ul className="space-y-3.5 px-5 py-4">
              {usage.map((row) => (
                <li key={row.action}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span>{labels.get(row.action) ?? row.action}</span>
                    <span className="nums text-[#14201B]">{row.credits}<span className="ml-1 font-normal text-[#7A8781]">· {row.count}×</span></span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEF1EF]">
                    <div className="h-full rounded-full bg-[#1E9A6E]" style={{ width: `${(row.credits / maxUsage) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={tr(locale, "What each action costs", "每个动作扣多少")}>
          <ul className="divide-y divide-[#EEF1EF]">
            {costs.map((row) => (
              <li key={row.action} className="flex items-center justify-between gap-3 px-5 py-3 text-[13.5px]">
                <span>{label(row)}</span>
                <Tag>{row.credits} {tr(locale, "credits", "点")}</Tag>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={tr(locale, "Purchase history", "购买记录")}>
        {payments.length === 0 ? (
          <EmptyPanel compact icon={Receipt} title={tr(locale, "No purchases yet", "还没有购买")} body={tr(locale, "Your free monthly allowance is added automatically.", "每月免费额度会自动加上。")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr className="type-eyebrow border-b border-[#EEF1EF]">
                  <th className="px-5 py-2.5 font-semibold">{tr(locale, "Date", "时间")}</th>
                  <th className="px-3 py-2.5 font-semibold">{tr(locale, "Pack", "套餐")}</th>
                  <th className="px-3 py-2.5 font-semibold">{tr(locale, "Status", "状态")}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{tr(locale, "Credits", "点数")}</th>
                  <th className="px-5 py-2.5 text-right font-semibold">{tr(locale, "Amount", "金额")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1EF]">
                {payments.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 text-[#3F4C46]">{formatWhen(row.createdAt, locale)}</td>
                    <td className="px-3 py-3 capitalize">{row.packageCode}</td>
                    <td className="px-3 py-3">
                      <Tag tone={row.status === "paid" || row.status === "succeeded" ? "good" : "neutral"}>{row.status}</Tag>
                      <span className="ml-2 text-[12px] text-[#7A8781]">{row.provider}</span>
                    </td>
                    <td className="nums px-3 py-3 text-right">+{row.credits}</td>
                    <td className="nums px-5 py-3 text-right">{formatMyr(row.amountMyrCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
