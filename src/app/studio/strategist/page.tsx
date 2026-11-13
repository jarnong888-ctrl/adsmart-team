import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays, kualaLumpurDate, mondayOf } from "@/lib/dates";
import { pillarLabel, tr } from "@/lib/i18n";
import { planByCode } from "@/lib/plans";
import { decidePlan, generateWeek } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const control = "mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

export default async function StrategistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "strategist", user.id);
  const plans = await prisma.contentPlan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { weekStart: "desc" },
    include: { items: { orderBy: [{ dayIndex: "asc" }, { slot: "asc" }] } },
  });
  const planLimit = planByCode(workspace.planCode).videosPerWeek;
  const nextWeek = mondayOf(addDays(kualaLumpurDate(new Date()), 7));
  const days = locale === "zh" ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Content strategist", "内容策略")}
        title={tr(locale, "Build the week, then wait", "先排一周，然后停下来")}
        lede={tr(
          locale,
          `${workspace.name} is on ${workspace.planCode}: ${planLimit} videos a week. A generated plan is not approved, and scripts cannot start until you say so.`,
          `${workspace.name} 现在是 ${workspace.planCode}：每周 ${planLimit} 条。生成的计划还没批准，你点头之前不会写脚本。`,
        )}
      />
      <form action={generateWeek} className="mb-8 grid max-w-3xl gap-3 rounded-[8px] border border-border bg-card p-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          {tr(locale, "Week starting", "这一周从")}
          <input className={control} type="date" name="weekStart" defaultValue={nextWeek} required />
        </label>
        <label className="text-sm">
          {tr(locale, "Videos", "条数")}
          <input className={control} type="number" name="capacity" min={1} max={21} defaultValue={workspace.postingCapacity} />
        </label>
        <label className="text-sm">
          {tr(locale, "Language", "语言")}
          <select className={control} name="language" defaultValue={workspace.primaryLanguage}>
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ms">Bahasa Melayu</option>
          </select>
        </label>
        <label className="text-sm">
          {tr(locale, "Mindset %", "心态 %")}
          <input className={control} type="number" name="mixMindset" min={0} max={100} defaultValue={workspace.mixMindset} />
        </label>
        <label className="text-sm">
          {tr(locale, "Practical %", "实操 %")}
          <input className={control} type="number" name="mixPractical" min={0} max={100} defaultValue={workspace.mixPractical} />
        </label>
        <label className="text-sm">
          {tr(locale, "Trends %", "趋势 %")}
          <input className={control} type="number" name="mixTrends" min={0} max={100} defaultValue={workspace.mixTrends} />
        </label>
        <label className="text-sm">
          {tr(locale, "Soft-sell %", "软性销售 %")}
          <input className={control} type="number" name="softSellRatio" min={0} max={100} defaultValue={workspace.softSellRatio} />
        </label>
        <div className="sm:col-span-2">
          <SubmitButton>{tr(locale, "Generate the week", "生成这一周")}</SubmitButton>
        </div>
      </form>

      <div className="space-y-8">
        {plans.map((plan) => (
          <section key={plan.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-semibold">{plan.title}</h2>
              <StatusBadge locale={locale} status={plan.status} />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{plan.rationale}</p>
            <p className="mt-2 text-sm">
              {plan.capacity} {tr(locale, "videos", "条")} · {plan.mixMindset}/{plan.mixPractical}/{plan.mixTrends} · {tr(locale, "soft sell", "软性销售")} {plan.softSellRatio}%
              {plan.capacity >= planLimit ? ` · ${tr(locale, "at the plan cap", "已经到方案上限")}` : ""}
            </p>
            {plan.status !== "approved" ? (
              user.platformRole === "admin" ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {tr(locale, "Only a member of this workspace can approve. Staff cannot approve on a client's behalf.", "只有这个工作区的成员可以批准。员工不能代客户批准。")}
                </p>
              ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={decidePlan}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <SubmitButton className="w-full sm:w-auto">{tr(locale, "Approve the week", "批准这一周")}</SubmitButton>
                </form>
                <form action={decidePlan}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="decision" value="changes" />
                  <SubmitButton variant="secondary">{tr(locale, "Request changes", "退回修改")}</SubmitButton>
                </form>
              </div>
              )
            ) : (
              <p className="mt-3 text-sm">
                <a className="underline" href={`/api/export?planId=${plan.id}&format=csv`}>CSV</a>
                {" · "}
                <a className="underline" href={`/api/export?planId=${plan.id}&format=xlsx`}>XLSX</a>
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{tr(locale, "Day", "天")}</th>
                    <th className="py-2 pr-3 font-medium">{tr(locale, "Pillar", "栏目")}</th>
                    <th className="py-2 pr-3 font-medium">{tr(locale, "Title", "标题")}</th>
                    <th className="py-2 pr-3 font-medium">CTA</th>
                    <th className="py-2 font-medium">{tr(locale, "Status", "状态")}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="py-2 pr-3">{days[item.dayIndex]}</td>
                      <td className="py-2 pr-3">{pillarLabel(locale, item.pillar)}{item.softSell ? " · $" : ""}</td>
                      <td className="py-2 pr-3">{item.title}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{item.commentKeyword}</td>
                      <td className="py-2"><StatusBadge locale={locale} status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
