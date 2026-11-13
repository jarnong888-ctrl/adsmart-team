import { Flash } from "@/components/flash";
import { BarChart } from "@/components/bar-chart";
import { InfoTip, ProgressRing } from "@/components/visual";
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
  const labels = new Map(costs.map((row) => [row.action, locale === "zh" ? row.labelZh : row.labelEn]));

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <h1 className="type-h1 mb-4 inline-flex items-center gap-2">
        {tr(locale, "Credits", "充值")}
        <InfoTip text={tr(locale, "Placeholder prices. Mock checkout does not charge a card.", "价格是占位。模拟付款不扣卡。")} />
      </h1>
      <section className="mb-4 flex items-center gap-4 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <ProgressRing value={Math.min(100, wallet.balance)} label={tr(locale, "Balance", "余额")} />
        <div>
          <p className="nums text-[28px] leading-none font-semibold">{wallet.balance}</p>
          <p className="type-caption mt-1">{tr(locale, "Remaining", "剩余")}</p>
        </div>
        <div className="min-w-0 flex-1">
          <BarChart rows={usage.map((row) => ({ label: (labels.get(row.action) ?? row.action).slice(0, 6), value: row.credits }))} label={tr(locale, "Credit use", "点数消耗")} />
        </div>
      </section>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {packs.map((pack) => {
          const name = locale === "zh" ? pack.nameZh : pack.nameEn;
          const blurb = locale === "zh" ? pack.blurbZh : pack.blurbEn;
          return (
            <article key={pack.code} className={`flex flex-col rounded-[8px] bg-white p-4 ${pack.code === "intermediate" ? "border-2 border-[#10251F]" : "border border-[#D5E3DD]"}`}>
              <h2 className="text-[16px] font-semibold">{name}</h2>
              <p className="mt-2 text-[28px] font-semibold tabular-nums">{formatMyr(pack.priceMyrCents)}</p>
              <p className="mt-1 text-[14px]">{pack.credits} {tr(locale, "credits", "点")}</p>
              <p className="mt-2 text-[13px] text-[#3D5C54]"><InfoTip text={blurb} /> {pack.credits} {tr(locale, "cr", "点")}</p>
              {pack.cadence === "pack" && user.platformRole !== "admin" ? (
                <form action={buyCredits} className="mt-4">
                  <input type="hidden" name="packageCode" value={pack.code} />
                  <SubmitButton className="w-full">{tr(locale, `Buy ${name}`, `购买${name}`)}</SubmitButton>
                </form>
              ) : (
                <p className="mt-4 text-[13px] text-[#3D5C54]">{tr(locale, "Included with the workspace. Not a separate purchase.", "含在工作区里，不用另外购买。")}</p>
              )}
            </article>
          );
        })}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[8px] border border-[#D5E3DD] bg-white p-4">
          <h2 className="text-[16px] font-semibold">{tr(locale, "What each action costs", "每个动作扣多少")}</h2>
          <table className="mt-3 w-full text-left text-[13px]">
            <tbody>
              {costs.map((row) => (
                <tr key={row.action} className="border-t border-[#D5E3DD]">
                  <td className="py-2">{locale === "zh" ? row.labelZh : row.labelEn}</td>
                  <td className="py-2 text-right tabular-nums">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[8px] border border-[#D5E3DD] bg-white p-4">
          <h2 className="text-[16px] font-semibold">{tr(locale, "Used in this workspace", "这个工作区已用")}</h2>
          {usage.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#3D5C54]">{tr(locale, "No AI actions have spent credits yet.", "还没有 AI 动作扣过点数。")}</p>
          ) : (
            <table className="mt-3 w-full text-left text-[13px]">
              <thead className="text-[13px] text-[#3D5C54]">
                <tr>
                  <th className="py-1 font-medium">{tr(locale, "Action", "动作")}</th>
                  <th className="py-1 text-right font-medium">{tr(locale, "Times", "次数")}</th>
                  <th className="py-1 text-right font-medium">{tr(locale, "Credits", "点数")}</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.action} className="border-t border-[#D5E3DD]">
                    <td className="py-2">{labels.get(row.action) ?? row.action}</td>
                    <td className="py-2 text-right tabular-nums">{row.count}</td>
                    <td className="py-2 text-right tabular-nums">{row.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Purchases", "购买记录")}</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#3D5C54]">{tr(locale, "No purchases yet. The free allowance is added on its own.", "还没有购买。免费额度会自己加上。")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-[13px] text-[#3D5C54]">
                <tr>
                  <th className="py-1 font-medium">{tr(locale, "When", "时间")}</th>
                  <th className="py-1 font-medium">{tr(locale, "Pack", "套餐")}</th>
                  <th className="py-1 font-medium">{tr(locale, "Status", "状态")}</th>
                  <th className="py-1 text-right font-medium">{tr(locale, "Credits", "点数")}</th>
                  <th className="py-1 text-right font-medium">{tr(locale, "Amount", "金额")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.id} className="border-t border-[#D5E3DD]">
                    <td className="py-2">{formatWhen(row.createdAt, locale)}</td>
                    <td className="py-2">{row.packageCode}</td>
                    <td className="py-2">{row.status} · {row.provider}</td>
                    <td className="py-2 text-right tabular-nums">{row.credits}</td>
                    <td className="py-2 text-right tabular-nums">{formatMyr(row.amountMyrCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
