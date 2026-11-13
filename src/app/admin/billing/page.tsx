import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatMyr } from "@/lib/credit-catalog";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { estimateTokenTable, weekRollup } from "@/lib/token-estimate";
import { creditReports, ensureCatalog } from "@/server/credits";
import { saveCreditPackage, saveCreditSettings } from "@/server/admin-actions";
import { getLocale } from "@/server/guard";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  await ensureCatalog();
  const [costs, packs, reports] = await Promise.all([
    prisma.creditCost.findMany({ orderBy: { credits: "desc" } }),
    prisma.creditPackage.findMany({ orderBy: { sort: "asc" } }),
    creditReports(),
  ]);
  const tokens = estimateTokenTable();
  const fullWeek = weekRollup(tokens, 12);
  const labels = new Map(costs.map((row) => [row.action, locale === "zh" ? row.labelZh : row.labelEn]));

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <Link href="/admin" className="text-[13px] text-[#3D5C54] underline">{tr(locale, "All workspaces", "全部工作区")}</Link>
      <PageHeader
        eyebrow={tr(locale, "Staff", "内部")}
        title={tr(locale, "Credits, revenue, and model cost", "点数、收入和模型成本")}
        lede={tr(
          locale,
          "Pack prices and credit costs are placeholders you can change. Revenue here is from the mock provider: no real charge has been made. Token counts use the prompts in the code and a 12-video Mandarin week for Jarno.",
          "套餐价格和点数成本都是占位，你可以改。这里的收入来自模拟付款，没有真实扣款。Token 按代码里的提示词，以及 Jarno 一周 12 条中文视频来估算。",
        )}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-3">
          <p className="text-[13px] text-[#3D5C54]">{tr(locale, "Recorded revenue", "记录的收入")}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">{formatMyr(reports.revenueCents)}</p>
        </article>
        <article className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-3">
          <p className="text-[13px] text-[#3D5C54]">{tr(locale, "Paid checkouts", "已支付次数")}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">{reports.purchases}</p>
        </article>
        <article className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-3">
          <p className="text-[13px] text-[#3D5C54]">{tr(locale, "Credits burned", "已消耗点数")}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">{reports.burn.reduce((sum, row) => sum + row.credits, 0)}</p>
        </article>
      </section>

      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Credit burn by action", "按动作的点数消耗")}</h2>
        {reports.burn.length === 0 ? <p className="mt-3 text-[13px] text-[#3D5C54]">{tr(locale, "No spend yet.", "还没有消耗。")}</p> : (
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[13px] text-[#3D5C54]">
              <tr>
                <th className="py-1 font-medium">{tr(locale, "Action", "动作")}</th>
                <th className="py-1 text-right font-medium">{tr(locale, "Times", "次数")}</th>
                <th className="py-1 text-right font-medium">{tr(locale, "Credits", "点数")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.burn.map((row) => (
                <tr key={row.action} className="border-t border-[#D5E3DD]">
                  <td className="py-2">{labels.get(row.action) ?? row.action}</td>
                  <td className="py-2 text-right tabular-nums">{row.count}</td>
                  <td className="py-2 text-right tabular-nums">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Cost per action", "每个动作的点数")}</h2>
        <div className="mt-3 space-y-2">
          {costs.map((row) => (
            <form key={row.action} action={saveCreditSettings} className="flex flex-wrap items-end gap-2 border-t border-[#D5E3DD] py-2">
              <input type="hidden" name="action" value={row.action} />
              <p className="min-w-48 flex-1 text-[13px]">{locale === "zh" ? row.labelZh : row.labelEn}</p>
              <label className="text-[13px] text-[#3D5C54]">
                {tr(locale, "Credits", "点数")}
                <input name="credits" type="number" min={0} defaultValue={row.credits} className="mt-1 block h-10 w-24 rounded-[6px] border border-[#C5D9D1] px-3 text-[14px] text-[#10251F]" />
              </label>
              <SubmitButton variant="secondary">{tr(locale, "Save", "保存")}</SubmitButton>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Packs", "套餐")}</h2>
        <div className="mt-3 space-y-3">
          {packs.map((pack) => (
            <form key={pack.code} action={saveCreditPackage} className="grid gap-2 border-t border-[#D5E3DD] py-3 sm:grid-cols-[1fr_8rem_8rem_9rem_auto] sm:items-end">
              <input type="hidden" name="code" value={pack.code} />
              <p className="text-[14px] font-medium">{locale === "zh" ? pack.nameZh : pack.nameEn}</p>
              <label className="text-[13px] text-[#3D5C54]">
                RM
                <input name="priceMyr" type="number" min={0} step="0.01" defaultValue={pack.priceMyrCents / 100} className="mt-1 block h-10 w-full rounded-[6px] border border-[#C5D9D1] px-3 text-[14px] text-[#10251F]" />
              </label>
              <label className="text-[13px] text-[#3D5C54]">
                {tr(locale, "Credits", "点数")}
                <input name="credits" type="number" min={0} defaultValue={pack.credits} className="mt-1 block h-10 w-full rounded-[6px] border border-[#C5D9D1] px-3 text-[14px] text-[#10251F]" />
              </label>
              <label className="text-[13px] text-[#3D5C54]">
                {tr(locale, "Cadence", "方式")}
                <select name="cadence" defaultValue={pack.cadence} className="mt-1 block h-10 w-full rounded-[6px] border border-[#C5D9D1] bg-white px-2 text-[14px]">
                  <option value="once">{tr(locale, "Once", "一次")}</option>
                  <option value="monthly">{tr(locale, "Monthly", "每月")}</option>
                  <option value="pack">{tr(locale, "Each purchase", "每次购买")}</option>
                </select>
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="active" value="on" defaultChecked={pack.active} />
                  {tr(locale, "On", "启用")}
                </label>
                <SubmitButton variant="secondary">{tr(locale, "Save", "保存")}</SubmitButton>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Token table for pricing", "用来定价的 token 表")}</h2>
        <p className="mt-1 text-[13px] leading-[1.55] text-[#3D5C54]">
          {tr(
            locale,
            "o200k_base, the encoding used by gpt-4o-mini. Prompt tokens are the system message plus the user message. Completion tokens are the JSON the current templates return. Chat-wrapper tokens are not included.",
            "o200k_base，也就是 gpt-4o-mini 用的编码。提示 token 是系统消息加用户消息。完成 token 是当前模板返回的 JSON。没有计入对话包装的少量 token。",
          )}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[13px] text-[#3D5C54]">
              <tr>
                <th className="py-2 font-medium">{tr(locale, "Action", "动作")}</th>
                <th className="py-2 text-right font-medium">{tr(locale, "Prompt tokens", "提示 token")}</th>
                <th className="py-2 text-right font-medium">{tr(locale, "Completion tokens", "完成 token")}</th>
                <th className="py-2 text-right font-medium">{tr(locale, "Calls", "调用次数")}</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((row) => (
                <tr key={row.action} className="border-t border-[#D5E3DD]">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 text-right tabular-nums">{row.promptTokens.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{row.completionTokens.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{row.calls}</td>
                </tr>
              ))}
              <tr className="border-t border-[#D5E3DD] font-medium">
                <td className="py-2">{tr(locale, "Full 12-video week, including one polish", "完整的 12 条视频一周，含一次润色")}</td>
                <td className="py-2 text-right tabular-nums">{fullWeek.promptTokens.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">{fullWeek.completionTokens.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">{fullWeek.calls}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
