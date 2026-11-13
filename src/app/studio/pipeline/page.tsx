import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Flash } from "@/components/flash";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { pillarLabel, tr } from "@/lib/i18n";
import { decidePlan } from "@/server/studio-actions";
import { studioContext } from "@/server/context";

const STAGES = [
  { key: "plan", en: "Plan", zh: "计划", statuses: ["planned", "plan_approved"] },
  { key: "script", en: "Scripts", zh: "脚本", statuses: ["script_ready"] },
  { key: "repurpose", en: "Repurpose", zh: "改写", statuses: ["repurposed"] },
  { key: "edit", en: "Editor", zh: "剪辑", statuses: ["brief_ready"] },
  { key: "schedule", en: "Schedule", zh: "排期", statuses: ["queued", "schedule_approved", "published"] },
] as const;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; week?: string }>;
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
  const days = locale === "zh" ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      {!plan ? (
        <EmptyState
          title={tr(locale, "This week has no plan yet.", "这一周还没有计划")}
          body={tr(locale, "After the strategist writes this week’s posts, they land here for you to approve.", "内容策略写好本周之后，会先送到这里等你批准。")}
        >
          <Link href="/studio/strategist" className="inline-flex h-8 items-center rounded-[6px] border border-[#C5D9D1] bg-white px-3 text-[13px]">{tr(locale, "Open strategy", "查看策略")}</Link>
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="type-h1">{plan.weekStart}</h1>
              <details className="mt-1 max-w-xl">
                <summary className="cursor-pointer text-[13px] text-[#3D5C54]">{tr(locale, "Mix", "配比")}</summary>
                <p className="mt-1 text-[13px] leading-[1.55] text-[#1C453A]">{plan.rationale}</p>
              </details>
            </div>
            {plan.status === "approved" ? (
              <StatusBadge locale={locale} status="plan_approved" label={tr(locale, "Week approved", "整周已批准")} />
            ) : user.platformRole === "admin" ? (
              <p className="max-w-xs text-[13px] text-[#3D5C54]">{tr(locale, "Client approval only.", "仅客户可批。")}</p>
            ) : (
              <form action={decidePlan}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton>{tr(locale, "Approve week", "批准本周")}</SubmitButton>
              </form>
            )}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px] font-medium text-[#3D5C54]">
            <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#0C2E28]" />{tr(locale, "Mindset", "心态")} {plan.mixMindset}%</span>
            <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#0B624C]" />{tr(locale, "Practical", "实操")} {plan.mixPractical}%</span>
            <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#167e6c]" />{tr(locale, "Trends", "趋势")} {plan.mixTrends}%</span>
          </div>
          <div className="mb-6 overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
            <div className="grid grid-cols-1 md:grid-cols-7 md:divide-x md:divide-[#D5E3DD]">
              {days.map((day, index) => {
                const items = plan.items.filter((item) => item.dayIndex % 7 === index);
                return (
                  <div key={day} className="min-h-32 border-b border-[#D5E3DD] p-2 last:border-b-0 md:border-b-0">
                    <p className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-[#3D5C54]">
                      {day}
                      <span className="nums text-[13px] text-[#10251F]">{addDays(plan.weekStart, index).slice(8)}</span>
                    </p>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const fact = item.script?.flags.includes("NEEDS_FACT_CHECK");
                        const dot = item.pillar === "practical" ? "bg-[#0B624C]" : item.pillar === "trends" ? "bg-[#167e6c]" : "bg-[#0C2E28]";
                        return (
                          <Link key={item.id} href={`/studio/pipeline/${item.id}`} className="block rounded-[4px] border border-[#D5E3DD] bg-[#F2F6F4] px-2 py-1.5">
                            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[#10251F]">{item.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-[#3D5C54]">
                              <span className={`size-1.5 rounded-full ${fact ? "bg-[#B45309]" : dot}`} />
                              {fact ? tr(locale, "Check", "待核实") : pillarLabel(locale, item.pillar)}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="hidden gap-3 md:grid md:grid-cols-5">
            {STAGES.map((stage) => {
              const items = plan.items.filter((item) => (stage.statuses as readonly string[]).includes(item.status));
              return (
                <section key={stage.key} className="rounded-[8px] bg-[#E7F1EC] p-2">
                  <h2 className="mb-2 flex items-center justify-between px-1 text-[13px] font-medium">
                    {tr(locale, stage.en, stage.zh)}
                    <span className="text-[13px] text-[#3D5C54]">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <BoardCard key={item.id} item={item} locale={locale} when={`${days[item.dayIndex]} ${addDays(plan.weekStart, item.dayIndex).slice(5)}`} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="space-y-4 md:hidden">
            {STAGES.map((stage) => {
              const items = plan.items.filter((item) => (stage.statuses as readonly string[]).includes(item.status));
              if (!items.length) return null;
              return (
                <section key={stage.key}>
                  <h2 className="mb-2 text-[13px] font-medium">{tr(locale, stage.en, stage.zh)} · {items.length}</h2>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <BoardCard key={item.id} item={item} locale={locale} when={`${days[item.dayIndex]} ${addDays(plan.weekStart, item.dayIndex).slice(5)}`} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BoardCard({
  item,
  locale,
  when,
}: {
  item: { id: string; title: string; status: string; pillar: string; softSell: boolean; script: { flags: string } | null };
  locale: "en" | "zh";
  when: string;
}) {
  const fact = item.script?.flags.includes("NEEDS_FACT_CHECK");
  return (
    <Link href={`/studio/pipeline/${item.id}`} className="block rounded-[6px] border border-[#D5E3DD] bg-white p-3">
      <div className="mb-2 flex flex-wrap gap-1">
        <StatusBadge locale={locale} status={item.status} />
        {fact ? <span className="inline-flex h-5 items-center rounded-[4px] border border-[#EED6A3] bg-[#FDF6E7] px-1.5 text-[13px] font-medium text-[#B45309]">{tr(locale, "Needs fact-check", "待核实")}</span> : null}
        {item.softSell ? <span className="text-[13px] text-[#3D5C54]">{tr(locale, "Soft sell", "软性销售")}</span> : null}
      </div>
      <p className="text-[13px] leading-[1.45] font-medium">{item.title}</p>
      <p className="mt-2 text-[13px] text-[#3D5C54]">{when} · {pillarLabel(locale, item.pillar)}</p>
    </Link>
  );
}
