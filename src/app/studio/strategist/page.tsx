import Link from "next/link";
import { Download, Map as MapIcon, Sparkles } from "lucide-react";
import { EmptyPanel, MixBar, PILLAR_COLOR, Panel, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays, kualaLumpurDate, mondayOf } from "@/lib/dates";
import { dayParts, weekLabel } from "@/lib/display";
import { pillarLabel, tr } from "@/lib/i18n";
import { planByCode } from "@/lib/plans";
import { decidePlan, generateWeek } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";


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

  const field = "mt-1.5 h-10 w-full rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[14px] outline-none focus:border-[#1E9A6E] focus:ring-3 focus:ring-[#1E9A6E]/15";
  const labelCls = "block text-[13px] font-medium text-[#3F4C46]";
  const pct = (name: string, label: string, value: number) => (
    <label className={labelCls}>
      {label}
      <span className="relative mt-1.5 block">
        <input className={`${field} mt-0 pr-8`} type="number" name={name} min={0} max={100} defaultValue={value} />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-[#7A8781]">%</span>
      </span>
    </label>
  );

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Strategy", "策略")}
        lede={tr(
          locale,
          `Plan a week of videos, then approve it. Nothing is scripted until you do · ${workspace.planCode} plan, up to ${planLimit} videos a week`,
          `先规划一周的视频，再批准。批准前不会写脚本 · ${workspace.planCode} 方案，每周最多 ${planLimit} 条`,
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {plans.length === 0 ? (
            <Panel>
              <EmptyPanel icon={MapIcon} title={tr(locale, "No weeks planned yet", "还没有周计划")} body={tr(locale, "Use the planner to generate your first week. You’ll review it here before anything is written.", "用右边的规划器生成第一周。写任何内容之前，你会先在这里审阅。")} />
            </Panel>
          ) : null}
          {plans.map((plan, planIndex) => {
            const atCap = plan.capacity >= planLimit;
            const open = plan.status !== "approved";
            const items = (
              <ul className="divide-y divide-[#EEF1EF] border-t border-[#EEF1EF]">
                {plan.items.map((item) => {
                  const day = dayParts(addDays(plan.weekStart, item.dayIndex), locale);
                  return (
                    <li key={item.id}>
                      <Link href={`/studio/pipeline/${item.id}`} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-[#FAFBFA]">
                        <span className="flex flex-col items-center leading-tight">
                          <span className="text-[10.5px] font-semibold tracking-[0.04em] text-[#5E6B65] uppercase">{day.dow}</span>
                          <span className="nums text-[16px]">{day.day}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="font-cjk block truncate text-[14px] font-medium">{item.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[#5E6B65]">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: PILLAR_COLOR[item.pillar] ?? "#8A968F" }} aria-hidden />
                            {pillarLabel(locale, item.pillar)}
                            <span aria-hidden>·</span>
                            {tr(locale, "Keyword", "关键词")} <span className="font-cjk font-medium text-[#14201B]">{item.commentKeyword}</span>
                            {item.softSell ? <><span aria-hidden>·</span>{tr(locale, "Soft sell", "软性销售")}</> : null}
                          </span>
                        </span>
                        <StatusBadge locale={locale} status={item.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            );
            return (
              <article key={plan.id} className={`overflow-hidden rounded-[16px] border bg-white ${open ? "border-[#F0D9A8] shadow-[0_0_0_3px_rgba(217,147,13,0.08)]" : "border-[#E4E8E5]"}`}>
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{weekLabel(plan.weekStart, locale)}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge locale={locale} status={plan.status} />
                        <Tag>{plan.capacity} {tr(locale, "videos", "条")}</Tag>
                        <Tag>{tr(locale, "Soft sell", "软性销售")} {plan.softSellRatio}%</Tag>
                        {atCap ? <Tag tone="warn">{tr(locale, "At plan cap", "已到方案上限")}</Tag> : null}
                      </div>
                    </div>
                    {open ? (
                      user.platformRole === "admin" ? (
                        <Tag>{tr(locale, "Client approves", "由客户批准")}</Tag>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <form action={decidePlan}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="decision" value="changes" />
                            <SubmitButton variant="outline">{tr(locale, "Request changes", "退回修改")}</SubmitButton>
                          </form>
                          <form action={decidePlan}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <SubmitButton>{tr(locale, "Approve the week", "批准这一周")}</SubmitButton>
                          </form>
                        </div>
                      )
                    ) : (
                      <div className="flex gap-2">
                        <a href={`/api/export?planId=${plan.id}&format=xlsx`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[13.5px] font-medium hover:bg-[#F1F3F2]"><Download className="size-4" aria-hidden />Excel</a>
                        <a href={`/api/export?planId=${plan.id}&format=csv`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[13.5px] font-medium hover:bg-[#F1F3F2]">CSV</a>
                      </div>
                    )}
                  </div>
                  <MixBar
                    label={tr(locale, "Content mix", "内容配比")}
                    parts={[
                      { label: tr(locale, "Mindset", "心态"), value: plan.mixMindset, color: PILLAR_COLOR.mindset },
                      { label: tr(locale, "Practical", "实操"), value: plan.mixPractical, color: PILLAR_COLOR.practical },
                      { label: tr(locale, "Trends", "趋势"), value: plan.mixTrends, color: PILLAR_COLOR.trends },
                    ]}
                  />
                  {plan.rationale ? <p className="font-cjk text-[13.5px] leading-relaxed text-[#3F4C46]">{plan.rationale}</p> : null}
                </div>
                {planIndex === 0 || open ? items : (
                  <details className="group border-t border-[#EEF1EF]">
                    <summary className="cursor-pointer list-none px-5 py-3 text-[13px] font-medium text-[#0F6B4F] hover:bg-[#FAFBFA]">
                      <span className="group-open:hidden">{tr(locale, `Show ${plan.items.length} videos`, `显示 ${plan.items.length} 条视频`)}</span>
                      <span className="hidden group-open:inline">{tr(locale, "Hide videos", "收起")}</span>
                    </summary>
                    {items}
                  </details>
                )}
              </article>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-20">
          <Panel title={tr(locale, "Plan a new week", "规划新的一周")} subtitle={tr(locale, "The plan waits for your approval.", "生成后等你批准。")}>
            <form action={generateWeek} className="space-y-4 p-5">
              <label className={labelCls}>
                {tr(locale, "Week starting", "开始日期")}
                <input className={field} type="date" name="weekStart" defaultValue={nextWeek} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  {tr(locale, "Videos", "条数")}
                  <input className={field} type="number" name="capacity" min={1} max={21} defaultValue={workspace.postingCapacity} />
                </label>
                <label className={labelCls}>
                  {tr(locale, "Language", "语言")}
                  <select className={field} name="language" defaultValue={workspace.primaryLanguage}>
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ms">Bahasa Melayu</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="text-[13px] font-medium text-[#3F4C46]">{tr(locale, "Content mix", "内容配比")}</legend>
                <p className="mt-0.5 text-[12px] text-[#7A8781]">{tr(locale, "Should add up to 100%.", "合计应为 100%。")}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {pct("mixMindset", tr(locale, "Mindset", "心态"), workspace.mixMindset)}
                  {pct("mixPractical", tr(locale, "Practical", "实操"), workspace.mixPractical)}
                  {pct("mixTrends", tr(locale, "Trends", "趋势"), workspace.mixTrends)}
                </div>
              </fieldset>
              {pct("softSellRatio", tr(locale, "Soft-sell share", "软性销售占比"), workspace.softSellRatio)}
              <SubmitButton className="w-full">
                <Sparkles className="size-4" aria-hidden />
                {tr(locale, "Generate the week", "生成这一周")}
              </SubmitButton>
            </form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
