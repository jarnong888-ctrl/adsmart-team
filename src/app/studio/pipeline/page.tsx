import Link from "next/link";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Columns3, LayoutList } from "lucide-react";
import { EmptyPanel, LinkButton, MixBar, PILLAR_COLOR, Panel, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, STATUS_TONE } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { dayParts, weekLabel } from "@/lib/display";
import { pillarLabel, tr, type Locale } from "@/lib/i18n";
import { decidePlan } from "@/server/studio-actions";
import { studioContext } from "@/server/context";

const STAGES = [
  { key: "plan", en: "Plan", zh: "计划", hint: ["Waiting for a script", "等脚本"], statuses: ["planned", "plan_approved"], tone: "plan_approved" },
  { key: "script", en: "Script", zh: "脚本", hint: ["Ready for review", "待审阅"], statuses: ["script_ready"], tone: "script_ready" },
  { key: "repurpose", en: "Formats", zh: "改写", hint: ["Captions & carousel", "文案与轮播"], statuses: ["repurposed"], tone: "repurposed" },
  { key: "edit", en: "Edit brief", zh: "剪辑单", hint: ["With the editor", "在剪辑"], statuses: ["brief_ready"], tone: "brief_ready" },
  { key: "schedule", en: "Schedule", zh: "排期", hint: ["Queued or posted", "排队或已发"], statuses: ["queued", "schedule_approved", "published"], tone: "schedule_approved" },
] as const;

type Item = {
  id: string;
  title: string;
  status: string;
  pillar: string;
  softSell: boolean;
  dayIndex: number;
  script: { flags: string } | null;
};

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; week?: string; view?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  const plans = await prisma.contentPlan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { weekStart: "desc" },
    include: { items: { orderBy: [{ dayIndex: "asc" }, { slot: "asc" }], include: { script: true } } },
  });
  const richness = (candidate: (typeof plans)[number]) =>
    candidate.items.filter((item) => item.status !== "planned" && item.status !== "plan_approved").length;
  const plan = plans.find((candidate) => candidate.weekStart === sp.week)
    ?? [...plans].sort((a, b) => richness(b) - richness(a) || b.weekStart.localeCompare(a.weekStart))[0];
  const view = sp.view === "week" ? "week" : "board";
  const index = plan ? plans.findIndex((candidate) => candidate.id === plan.id) : -1;
  const older = index >= 0 ? plans[index + 1] : undefined;
  const newer = index > 0 ? plans[index - 1] : undefined;
  const href = (over: { week?: string; view?: string }) => {
    const params = new URLSearchParams();
    const week = over.week ?? plan?.weekStart;
    const nextView = over.view ?? view;
    if (week) params.set("week", week);
    if (nextView !== "board") params.set("view", nextView);
    return `/studio/pipeline?${params.toString()}`;
  };

  if (!plan) {
    return (
      <div>
        <Flash locale={locale} error={sp.error} notice={sp.notice} />
        <PageHeader title={tr(locale, "Pipeline", "流水线")} />
        <Panel>
          <EmptyPanel
            icon={CalendarRange}
            title={tr(locale, "No week planned yet", "这一周还没有计划")}
            body={tr(locale, "Once the strategist writes a week, every video moves through here from plan to post.", "内容策略写好一周之后，每条视频都会在这里从计划走到发布。")}
          >
            <LinkButton href="/studio/strategist">{tr(locale, "Plan a week", "规划一周")}</LinkButton>
          </EmptyPanel>
        </Panel>
      </div>
    );
  }

  const factChecks = plan.items.filter((item) => item.script?.flags.includes("NEEDS_FACT_CHECK")).length;
  const posted = plan.items.filter((item) => item.status === "published").length;

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Pipeline", "流水线")}
        lede={tr(locale, `Every video this week, from plan to post · ${plan.items.length} videos, ${posted} posted`, `本周每条视频从计划到发布 · 共 ${plan.items.length} 条，已发 ${posted} 条`)}
        actions={
          <>
            <div className="flex h-10 items-center rounded-[10px] border border-[#E4E8E5] bg-white">
              {older ? (
                <Link href={href({ week: older.weekStart })} aria-label={tr(locale, "Previous week", "上一周")} className="grid size-10 place-items-center rounded-l-[10px] text-[#3F4C46] hover:bg-[#F1F3F2]"><ChevronLeft className="size-4" aria-hidden /></Link>
              ) : <span className="grid size-10 place-items-center text-[#C4CBC7]" aria-hidden><ChevronLeft className="size-4" /></span>}
              <span className="px-1 text-[14px] font-medium whitespace-nowrap">{weekLabel(plan.weekStart, locale)}</span>
              {newer ? (
                <Link href={href({ week: newer.weekStart })} aria-label={tr(locale, "Next week", "下一周")} className="grid size-10 place-items-center rounded-r-[10px] text-[#3F4C46] hover:bg-[#F1F3F2]"><ChevronRight className="size-4" aria-hidden /></Link>
              ) : <span className="grid size-10 place-items-center text-[#C4CBC7]" aria-hidden><ChevronRight className="size-4" /></span>}
            </div>
            {plan.status === "approved" ? null : user.platformRole === "admin" ? (
              <Tag>{tr(locale, "Client approves", "由客户批准")}</Tag>
            ) : (
              <form action={decidePlan}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton>{tr(locale, "Approve week", "批准本周")}</SubmitButton>
              </form>
            )}
          </>
        }
      />

      {/* Week summary */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {plan.status === "approved" ? (
                <StatusBadge locale={locale} status="approved" label={tr(locale, "Week approved", "整周已批准")} />
              ) : (
                <StatusBadge locale={locale} status="pending_approval" label={tr(locale, "Week waiting for approval", "整周待批准")} />
              )}
              {factChecks > 0 ? <Tag tone="warn"><AlertTriangle className="size-3.5" aria-hidden />{tr(locale, `${factChecks} need fact-check`, `${factChecks} 条待核实`)}</Tag> : null}
            </div>
            <MixBar
              label={tr(locale, "Content mix", "内容配比")}
              parts={[
                { label: tr(locale, "Mindset", "心态"), value: plan.mixMindset, color: PILLAR_COLOR.mindset },
                { label: tr(locale, "Practical", "实操"), value: plan.mixPractical, color: PILLAR_COLOR.practical },
                { label: tr(locale, "Trends", "趋势"), value: plan.mixTrends, color: PILLAR_COLOR.trends },
              ]}
            />
            {plan.rationale ? (
              <details className="group">
                <summary className="cursor-pointer list-none text-[13px] font-medium text-[#0F6B4F] hover:text-[#0A4F3A]">
                  <span className="group-open:hidden">{tr(locale, "Why this mix →", "为什么这样配比 →")}</span>
                  <span className="hidden group-open:inline">{tr(locale, "Hide reasoning", "收起")}</span>
                </summary>
                <p className="font-cjk mt-2 text-[13.5px] leading-relaxed text-[#3F4C46]">{plan.rationale}</p>
              </details>
            ) : null}
          </div>
        </Panel>

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label={tr(locale, "Videos per stage", "各阶段视频数")}>
          {STAGES.map((stage, stageIndex) => {
            const count = plan.items.filter((item) => (stage.statuses as readonly string[]).includes(item.status)).length;
            const tone = STATUS_TONE[stage.tone];
            return (
              <li key={stage.key} className="flex flex-col justify-between rounded-[16px] border border-[#E4E8E5] bg-white p-4">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#5E6B65]">
                  <span className={`size-2 rounded-full ${tone?.dot ?? "bg-[#8A968F]"}`} aria-hidden />
                  <span className="nums text-[#7A8781]">{stageIndex + 1}</span>
                  {tr(locale, stage.en, stage.zh)}
                </div>
                <p className="nums mt-3 text-[28px] leading-none">{count}</p>
                <p className="mt-1.5 text-[12px] leading-snug text-[#7A8781]">{tr(locale, stage.hint[0], stage.hint[1])}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* View switch */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h2">{view === "board" ? tr(locale, "By stage", "按阶段") : tr(locale, "By day", "按日期")}</h2>
        <nav aria-label={tr(locale, "View", "视图")} className="flex rounded-[10px] bg-[#EEF1EF] p-1">
          <Link href={href({ view: "board" })} scroll={false} aria-current={view === "board" ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium ${view === "board" ? "bg-white text-[#14201B] shadow-[0_1px_2px_rgba(20,32,27,0.12)]" : "text-[#5E6B65] hover:text-[#14201B]"}`}>
            <Columns3 className="size-4" aria-hidden />{tr(locale, "Board", "看板")}
          </Link>
          <Link href={href({ view: "week" })} scroll={false} aria-current={view === "week" ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium ${view === "week" ? "bg-white text-[#14201B] shadow-[0_1px_2px_rgba(20,32,27,0.12)]" : "text-[#5E6B65] hover:text-[#14201B]"}`}>
            <LayoutList className="size-4" aria-hidden />{tr(locale, "Week", "周视图")}
          </Link>
        </nav>
      </div>

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="grid min-w-[980px] grid-cols-5 gap-3">
            {STAGES.map((stage) => {
              const items = plan.items.filter((item) => (stage.statuses as readonly string[]).includes(item.status));
              return (
                <section key={stage.key} className="flex min-h-48 flex-col rounded-[16px] bg-[#EEF1EF]/70 p-2.5" aria-label={tr(locale, stage.en, stage.zh)}>
                  <h3 className="mb-2.5 flex items-center justify-between px-1.5 pt-1 text-[13px] font-semibold">
                    {tr(locale, stage.en, stage.zh)}
                    <span className="nums grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11.5px] text-[#3F4C46]">{items.length}</span>
                  </h3>
                  <div className="space-y-2">
                    {items.length === 0 ? <p className="px-1.5 py-3 text-[12.5px] text-[#7A8781]">{tr(locale, "Nothing here", "暂无")}</p> : null}
                    {items.map((item) => (
                      <BoardCard key={item.id} item={item} locale={locale} when={dayParts(addDays(plan.weekStart, item.dayIndex), locale).long} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="grid min-w-[980px] grid-cols-7 gap-2.5">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const day = dayParts(addDays(plan.weekStart, dayIndex), locale);
              const items = plan.items.filter((item) => item.dayIndex % 7 === dayIndex);
              return (
                <section key={dayIndex} className="flex min-h-56 flex-col rounded-[16px] border border-[#E4E8E5] bg-white">
                  <h3 className="flex items-baseline justify-between border-b border-[#EEF1EF] px-3 py-2.5">
                    <span className="text-[11.5px] font-semibold tracking-[0.04em] text-[#5E6B65] uppercase">{day.dow}</span>
                    <span className="nums text-[18px]">{day.day}</span>
                  </h3>
                  <div className="space-y-2 p-2">
                    {items.map((item) => (
                      <DayCard key={item.id} item={item} locale={locale} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BoardCard({ item, locale, when }: { item: Item; locale: Locale; when: string }) {
  const fact = item.script?.flags.includes("NEEDS_FACT_CHECK");
  return (
    <Link href={`/studio/pipeline/${item.id}`} className="block rounded-[12px] border border-[#E4E8E5] bg-white p-3 shadow-[0_1px_2px_rgba(20,32,27,0.04)] transition hover:-translate-y-px hover:border-[#C9D0CC] hover:shadow-[0_4px_12px_-4px_rgba(20,32,27,0.15)]">
      <p className="font-cjk line-clamp-2 text-[14px] leading-snug font-medium">{item.title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge locale={locale} status={item.status} />
        {fact ? <Tag tone="warn">{tr(locale, "Fact-check", "待核实")}</Tag> : null}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#5E6B65]">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: PILLAR_COLOR[item.pillar] ?? "#8A968F" }} aria-hidden />
        {pillarLabel(locale, item.pillar)} · {when}{item.softSell ? ` · ${tr(locale, "Soft sell", "软性销售")}` : ""}
      </p>
    </Link>
  );
}

function DayCard({ item, locale }: { item: Item; locale: Locale }) {
  const fact = item.script?.flags.includes("NEEDS_FACT_CHECK");
  const tone = STATUS_TONE[item.status];
  return (
    <Link href={`/studio/pipeline/${item.id}`} className="block rounded-[10px] border border-[#EEF1EF] bg-[#FAFBFA] p-2.5 transition hover:border-[#C9D0CC] hover:bg-white">
      <p className="font-cjk line-clamp-3 text-[13px] leading-snug font-medium">{item.title}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#5E6B65]">
        <span className={`size-1.5 shrink-0 rounded-full ${fact ? "bg-[#D9930D]" : tone?.dot ?? "bg-[#8A968F]"}`} aria-hidden />
        <span className="truncate">{fact ? tr(locale, "Fact-check", "待核实") : pillarLabel(locale, item.pillar)}</span>
      </p>
    </Link>
  );
}
