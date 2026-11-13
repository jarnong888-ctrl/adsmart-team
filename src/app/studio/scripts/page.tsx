import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { ScriptPanel } from "@/components/script-panel";
import { StatusBadge, STATUS_TONE } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { pillarLabel, statusLabel, tr, type Locale } from "@/lib/i18n";
import { requiresFactCheckAck } from "@/lib/pipeline";
import { parsePlatforms } from "@/lib/platforms";
import { approveScript, briefItem, generateScript, generateScriptsForPlan, queueItem, repurposeItem } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

type Search = { error?: string; notice?: string; week?: string; status?: string; q?: string; item?: string };

/** Status tabs. Each groups one or more pipeline statuses. */
const TABS: { key: string; en: string; zh: string; statuses: string[] }[] = [
  { key: "all", en: "All", zh: "全部", statuses: [] },
  { key: "write", en: "To write", zh: "待写", statuses: ["planned", "plan_approved"] },
  { key: "review", en: "Script ready", zh: "脚本已好", statuses: ["script_ready"] },
  { key: "production", en: "In production", zh: "制作中", statuses: ["repurposed", "brief_ready"] },
  { key: "queued", en: "Waiting to post", zh: "待批准发布", statuses: ["queued"] },
  { key: "approved", en: "Approved to post", zh: "已批准发布", statuses: ["schedule_approved"] },
  { key: "published", en: "Published", zh: "已发布", statuses: ["published"] },
];

/** Where an item sits in the six steps from week approval to posting. */
const STEP_OF: Record<string, number> = {
  planned: 0,
  plan_approved: 1,
  script_ready: 2,
  repurposed: 3,
  brief_ready: 4,
  queued: 4,
  schedule_approved: 5,
  published: 6,
};

const PLATFORM_NAME: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
const LANG_NAME: Record<string, string> = { zh: "中文", en: "EN", ms: "BM" };

function dayParts(iso: string, locale: Locale) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const loc = locale === "zh" ? "zh-CN" : "en-GB";
  return {
    dow: new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(date),
    day: d,
    long: new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date),
  };
}

function weekLabel(weekStart: string, locale: Locale) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  if (locale === "zh") return `${y}年${m}月${d}日 这一周`;
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const fmt = (date: Date, withYear: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(date);
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

export default async function ScriptsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "scriptwriter", user.id);

  const plans = await prisma.contentPlan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { weekStart: "desc" },
    select: { id: true, weekStart: true, status: true },
  });
  const planIndex = Math.max(0, plans.findIndex((plan) => plan.id === sp.week));
  const plan = plans[planIndex];
  const items = plan
    ? await prisma.contentItem.findMany({
        where: { planId: plan.id, workspaceId: workspace.id },
        orderBy: [{ dayIndex: "asc" }, { slot: "asc" }],
        include: { script: true },
      })
    : [];

  const tab = TABS.find((entry) => entry.key === sp.status) ?? TABS[0];
  const q = (sp.q ?? "").trim();
  const inTab = (status: string, key: string) => {
    const group = TABS.find((entry) => entry.key === key);
    return !group || group.statuses.length === 0 || group.statuses.includes(status);
  };
  const filtered = items.filter(
    (item) => inTab(item.status, tab.key) && (!q || item.title.toLowerCase().includes(q.toLowerCase()) || item.hook.toLowerCase().includes(q.toLowerCase())),
  );
  const selected = items.find((item) => item.id === sp.item) ?? filtered[0] ?? null;
  const waiting = items.filter((item) => item.status === "plan_approved").length;

  const href = (over: Partial<Record<"week" | "status" | "q" | "item", string | undefined>>) => {
    const params = new URLSearchParams();
    const next = { week: plan?.id, status: tab.key === "all" ? undefined : tab.key, q: q || undefined, item: selected?.id, ...over };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const query = params.toString();
    return query ? `/studio/scripts?${query}` : "/studio/scripts";
  };
  const returnTo = href({});
  const older = plans[planIndex + 1];
  const newer = planIndex > 0 ? plans[planIndex - 1] : undefined;
  const canApprove = user.platformRole !== "admin";

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Scripts", "脚本")}
        lede={tr(locale, "30-second, timecoded scripts for the approved week · Mandarin, English or Malay", "已批准周计划的 30 秒脚本，带时间码 · 中文、英文或马来文")}
        actions={
          plan ? (
            <>
              <div className="flex h-10 items-center rounded-[10px] border border-[#E4E8E5] bg-white">
                {older ? (
                  <Link href={href({ week: older.id, item: undefined })} aria-label={tr(locale, "Previous week", "上一周")} className="grid size-10 place-items-center rounded-l-[10px] text-[#3F4C46] hover:bg-[#F1F3F2]">
                    <ChevronLeft className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <span className="grid size-10 place-items-center text-[#C4CBC7]" aria-hidden><ChevronLeft className="size-4" /></span>
                )}
                <span className="px-1 text-[14px] font-medium whitespace-nowrap">{weekLabel(plan.weekStart, locale)}</span>
                {newer ? (
                  <Link href={href({ week: newer.id, item: undefined })} aria-label={tr(locale, "Next week", "下一周")} className="grid size-10 place-items-center rounded-r-[10px] text-[#3F4C46] hover:bg-[#F1F3F2]">
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <span className="grid size-10 place-items-center text-[#C4CBC7]" aria-hidden><ChevronRight className="size-4" /></span>
                )}
              </div>
              {plan.status === "approved" && waiting > 0 ? (
                <form action={generateScriptsForPlan}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <SubmitButton>{tr(locale, `Write ${waiting} scripts`, `写 ${waiting} 条脚本`)}</SubmitButton>
                </form>
              ) : null}
            </>
          ) : null
        }
      />

      {!plan ? (
        <div className="rounded-[16px] border border-[#E4E8E5] bg-white px-6 py-14 text-center">
          <p className="type-h2">{tr(locale, "No week planned yet", "还没有周计划")}</p>
          <p className="type-caption mt-1">{tr(locale, "Scripts are written after a week is planned and approved.", "先规划并批准一周，再写脚本。")}</p>
          <Link href="/studio/strategist" className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-[#0F6B4F] px-4 text-[14px] font-medium text-white hover:bg-[#0A5540]">
            {tr(locale, "Plan a week", "规划一周")}
          </Link>
        </div>
      ) : (
        <>
          {plan.status !== "approved" ? (
            <p className="mb-5 rounded-[12px] border border-[#F3DFB5] bg-[#FDF8EC] px-4 py-3 text-[14px] text-[#5C4100]">
              {tr(locale, "This week is waiting for approval. Scripts can be written once it is approved.", "这一周还在等批准。批准后才能写脚本。")}{" "}
              <Link href="/studio/strategist" className="font-medium underline underline-offset-2">{tr(locale, "Review the week", "查看周计划")}</Link>
            </p>
          ) : null}

          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={tr(locale, "Filter by status", "按状态筛选")} className="flex flex-wrap gap-1.5">
              {TABS.map((entry) => {
                const count = items.filter((item) => inTab(item.status, entry.key)).length;
                const active = entry.key === tab.key;
                const dot = entry.statuses[0] ? STATUS_TONE[entry.statuses[0]]?.dot : undefined;
                return (
                  <Link
                    key={entry.key}
                    href={href({ status: entry.key === "all" ? undefined : entry.key, item: undefined })}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors ${active ? "border-[#14201B] bg-[#14201B] text-white" : "border-[#E4E8E5] bg-white text-[#14201B] hover:border-[#C9D0CC]"} ${count === 0 && !active ? "opacity-60" : ""}`}
                  >
                    {dot ? <span className={`size-1.5 rounded-full ${dot}`} aria-hidden /> : null}
                    {tr(locale, entry.en, entry.zh)}
                    <span className={`nums rounded-full px-1.5 text-[11.5px] ${active ? "bg-white/20" : "bg-[#EEF1EF] text-[#3F4C46]"}`}>{count}</span>
                  </Link>
                );
              })}
            </nav>
            <form action="/studio/scripts" className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-[#E4E8E5] bg-white px-3 focus-within:border-[#1E9A6E] sm:w-72">
              {plan ? <input type="hidden" name="week" value={plan.id} /> : null}
              {tab.key !== "all" ? <input type="hidden" name="status" value={tab.key} /> : null}
              <Search className="size-4 shrink-0 text-[#7A8781]" aria-hidden />
              <label htmlFor="script-search" className="sr-only">{tr(locale, "Search scripts", "搜索脚本")}</label>
              <input
                id="script-search"
                type="search"
                name="q"
                defaultValue={q}
                placeholder={tr(locale, "Search titles and hooks…", "搜索标题或钩子…")}
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#7A8781]"
              />
            </form>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
            {/* List */}
            <section aria-label={tr(locale, "Scripts this week", "本周脚本")} className="overflow-hidden rounded-[16px] border border-[#E4E8E5] bg-white">
              <div className="type-eyebrow grid grid-cols-[44px_minmax(0,1fr)_auto] gap-4 border-b border-[#EEF1EF] px-4 py-2.5">
                <span>{tr(locale, "Day", "日期")}</span>
                <span>{tr(locale, "Script", "脚本")}</span>
                <span>{tr(locale, "Status", "状态")}</span>
              </div>
              {filtered.length === 0 ? (
                <p className="px-6 py-12 text-center text-[14px] text-[#5E6B65]">
                  {q ? tr(locale, `Nothing matches “${q}”.`, `没有符合“${q}”的脚本。`) : tr(locale, "No scripts in this status.", "这个状态下没有脚本。")}
                </p>
              ) : (
                <ul>
                  {filtered.map((item) => {
                    const day = dayParts(addDays(plan.weekStart, item.dayIndex), locale);
                    const platforms = parsePlatforms(item.platforms).map((platform) => PLATFORM_NAME[platform] ?? platform);
                    const active = item.id === selected?.id;
                    return (
                      <li key={item.id} className="border-b border-[#EEF1EF] last:border-b-0">
                        <Link
                          href={href({ item: item.id })}
                          scroll={false}
                          aria-current={active ? "true" : undefined}
                          className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 transition-colors ${active ? "bg-[#F1F8F4] shadow-[inset_0_0_0_2px_#0F6B4F]" : "hover:bg-[#FAFBFA]"}`}
                        >
                          <span className="flex flex-col items-center leading-tight">
                            <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5E6B65] uppercase">{day.dow}</span>
                            <span className="nums text-[19px] text-[#14201B]">{day.day}</span>
                          </span>
                          <span className="min-w-0">
                            <span className="font-cjk block truncate text-[15px] leading-snug font-medium text-[#14201B]">{item.title}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[#5E6B65]">
                              <span>{pillarLabel(locale, item.pillar)}</span>
                              <span aria-hidden>·</span>
                              <span>{LANG_NAME[item.language] ?? item.language.toUpperCase()}</span>
                              {platforms.length ? (
                                <>
                                  <span aria-hidden>·</span>
                                  <span>{platforms.join(", ")}</span>
                                </>
                              ) : null}
                              {item.softSell ? (
                                <span className="ml-1 rounded-[6px] bg-[#EEF1EF] px-1.5 text-[11px] font-medium text-[#3F4C46]">{tr(locale, "Soft sell", "软性销售")}</span>
                              ) : null}
                            </span>
                          </span>
                          <StatusBadge locale={locale} status={item.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Detail */}
            {selected ? (
              <section
                aria-label={tr(locale, "Script detail", "脚本详情")}
                className="flex flex-col rounded-[16px] border border-[#E4E8E5] bg-white lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
              >
                <div className="space-y-3.5 border-b border-[#EEF1EF] px-6 pt-6 pb-5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#5E6B65]">
                    <StatusBadge locale={locale} status={selected.status} />
                    <span>{dayParts(addDays(plan.weekStart, selected.dayIndex), locale).long}</span>
                    <span aria-hidden>·</span>
                    <span>{pillarLabel(locale, selected.pillar)}</span>
                    <span aria-hidden>·</span>
                    <span>{LANG_NAME[selected.language] ?? selected.language.toUpperCase()}</span>
                    <Link href={`/studio/pipeline/${selected.id}?from=scripts`} className="ml-auto inline-flex items-center gap-1 font-medium text-[#0F6B4F] hover:text-[#0A4F3A]">
                      {tr(locale, "Full page", "完整页面")}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                  <h2 className="font-cjk text-[24px] leading-[1.3] font-semibold">{selected.title}</h2>
                  {selected.angle ? <p className="font-cjk text-[14.5px] leading-[1.7] text-[#3F4C46]">{selected.angle}</p> : null}
                  <Stepper locale={locale} step={STEP_OF[selected.status] ?? 0} />
                </div>

                <NextStep
                  locale={locale}
                  item={{
                    id: selected.id,
                    status: selected.status,
                    language: selected.language,
                    scriptApproved: Boolean(selected.script?.approvedAt),
                    needsAck: selected.script ? requiresFactCheckAck(selected.script.flags, selected.script.body) : false,
                    hasScript: Boolean(selected.script),
                  }}
                  canApprove={canApprove}
                  returnTo={returnTo}
                />


                <div className="space-y-5 px-6 py-5">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[12px] bg-[#F6F7F5] px-4 py-3.5">
                      <dt className="type-eyebrow">{tr(locale, "Hook · 0–3s", "钩子 · 0–3 秒")}</dt>
                      <dd className="font-cjk mt-1.5 text-[16px] leading-[1.45] font-semibold">{selected.hook}</dd>
                    </div>
                    <div className="rounded-[12px] bg-[#F6F7F5] px-4 py-3.5">
                      <dt className="type-eyebrow">{tr(locale, "Call to action", "行动号召")}</dt>
                      <dd className="font-cjk mt-1.5 text-[15px] leading-[1.5] font-medium">{selected.cta}</dd>
                      <dd className="mt-2 flex items-center gap-2 text-[12.5px] text-[#5E6B65]">
                        {tr(locale, "Comment keyword", "评论关键词")}
                        <span className="font-cjk rounded-[6px] border border-[#E4E8E5] bg-white px-2 py-0.5 font-semibold text-[#14201B]">{selected.commentKeyword}</span>
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="type-h2">{tr(locale, "Script", "脚本")}</h3>
                    {selected.script ? (
                      <ScriptPanel
                        itemId={selected.id}
                        body={selected.script.body}
                        flags={selected.script.flags}
                        sources={selected.script.sources}
                        locale={locale}
                        canEdit={canApprove}
                        returnTo={returnTo}
                      />
                    ) : (
                      <p className="mt-2 rounded-[12px] border border-dashed border-[#DCE1DE] px-4 py-6 text-center text-[14px] text-[#5E6B65]">
                        {selected.status === "planned"
                          ? tr(locale, "The script is written once the week is approved.", "周计划批准后才会写脚本。")
                          : tr(locale, "Not written yet.", "还没写。")}
                      </p>
                    )}
                  </div>
                </div>


              </section>
            ) : (
              <section className="hidden rounded-[16px] border border-dashed border-[#DCE1DE] px-6 py-16 text-center text-[14px] text-[#5E6B65] lg:block">
                {tr(locale, "Pick a script to see it here.", "选一条脚本，在这里查看。")}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({ locale, step }: { locale: Locale; step: number }) {
  const steps = [
    tr(locale, "Week", "周计划"),
    tr(locale, "Script", "脚本"),
    tr(locale, "Formats", "改写"),
    tr(locale, "Brief", "剪辑单"),
    tr(locale, "Approval", "批准发布"),
    tr(locale, "Posted", "已发布"),
  ];
  return (
    <ol aria-label={tr(locale, "Progress", "进度")} className="flex flex-wrap items-center gap-x-1.5 gap-y-2 pt-1">
      {steps.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex items-center gap-1.5" aria-current={current ? "step" : undefined}>
            <span
              className={`nums grid size-[22px] place-items-center rounded-full border-[1.5px] text-[11px] ${done ? "border-[#0F6B4F] bg-[#0F6B4F] text-white" : current ? "border-[#0F6B4F] bg-white text-[#0F6B4F]" : "border-[#DCE1DE] bg-white text-[#7A8781]"}`}
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5 9-10" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className={`text-[12.5px] ${current ? "font-semibold text-[#14201B]" : done ? "text-[#14201B]" : "text-[#7A8781]"}`}>
              {label}
              {done ? <span className="sr-only"> ({tr(locale, "done", "已完成")})</span> : null}
            </span>
            {index < steps.length - 1 ? <span aria-hidden className={`h-[1.5px] w-3 ${index < step ? "bg-[#0F6B4F]" : "bg-[#DCE1DE]"}`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function NextStep({
  locale,
  item,
  canApprove,
  returnTo,
}: {
  locale: Locale;
  item: { id: string; status: string; language: string; scriptApproved: boolean; needsAck: boolean; hasScript: boolean };
  canApprove: boolean;
  returnTo: string;
}) {
  const hidden = (
    <>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
  const linkClass = "inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-[14px] font-medium transition-colors";
  const primaryLink = `${linkClass} bg-[#0F6B4F] text-white hover:bg-[#0A5540]`;
  const outlineLink = `${linkClass} border border-[#DCE1DE] bg-white text-[#14201B] hover:bg-[#F1F3F2]`;

  let hint = "";
  let actions: React.ReactNode = null;

  switch (item.status) {
    case "planned":
      hint = tr(locale, "The week hasn’t been approved yet. Nothing is written until it is.", "这一周还没批准。批准之前不会写任何脚本。");
      actions = <Link href="/studio/strategist" className={primaryLink}>{tr(locale, "Review the week", "查看周计划")}</Link>;
      break;
    case "plan_approved":
      hint = tr(locale, "The week is approved. Pick a language and write the script.", "这一周已批准。选好语言就可以写脚本。");
      actions = (
        <form action={generateScript} className="flex flex-wrap items-center gap-2">
          {hidden}
          <label htmlFor="script-language" className="sr-only">{tr(locale, "Language", "语言")}</label>
          <select id="script-language" name="language" defaultValue={item.language} className="h-10 rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[14px]">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ms">Bahasa Melayu</option>
          </select>
          <SubmitButton>{tr(locale, "Write script", "写脚本")}</SubmitButton>
        </form>
      );
      break;
    case "script_ready":
      if (!item.scriptApproved && canApprove) {
        hint = tr(locale, "Read it through, then approve. You can turn it into other formats at any time.", "通读一遍再批准。随时可以改写成其他格式。");
        actions = (
          <>
            {item.needsAck ? (
              <Link href={`/studio/pipeline/${item.id}?ack=1`} className={primaryLink}>{tr(locale, "Review fact-checks & approve", "核对并批准")}</Link>
            ) : (
              <form action={approveScript}>{hidden}<SubmitButton>{tr(locale, "Approve script", "批准脚本")}</SubmitButton></form>
            )}
            <form action={repurposeItem}>{hidden}<SubmitButton variant="outline">{tr(locale, "Turn into other formats", "改写成其他格式")}</SubmitButton></form>
          </>
        );
      } else {
        hint = item.scriptApproved
          ? tr(locale, "Script approved. Next, turn it into captions, a carousel and a Facebook post.", "脚本已批准。下一步：改写成文案、轮播和 Facebook 帖子。")
          : tr(locale, "Next, turn it into captions, a carousel and a Facebook post.", "下一步：改写成文案、轮播和 Facebook 帖子。");
        actions = <form action={repurposeItem}>{hidden}<SubmitButton>{tr(locale, "Turn into other formats", "改写成其他格式")}</SubmitButton></form>;
      }
      break;
    case "repurposed":
      hint = tr(locale, "Formats are ready. Next, the edit brief for 9:16, 1:1, 4:5 and 16:9.", "格式已好。下一步：9:16、1:1、4:5、16:9 的剪辑单。");
      actions = <form action={briefItem}>{hidden}<SubmitButton>{tr(locale, "Write the edit brief", "写剪辑单")}</SubmitButton></form>;
      break;
    case "brief_ready":
      hint = tr(locale, "Queueing does not post anything. One approval later schedules every platform.", "放进队列不会发出。之后批准一次，会排到所有平台。");
      actions = <form action={queueItem}>{hidden}<SubmitButton>{tr(locale, "Add to the queue", "放进队列")}</SubmitButton></form>;
      break;
    case "queued":
      hint = tr(locale, "Waiting for your approval in Schedule. Approving schedules it; there is no separate publish step.", "在排期里等你批准。批准即排期，不需要再点发布。");
      actions = <Link href="/studio/schedule" className={primaryLink}>{tr(locale, "Approve in Schedule", "去排期批准")}</Link>;
      break;
    case "schedule_approved":
      hint = tr(locale, "Approved and scheduled. It goes out at the planned time.", "已批准并排期，会在计划时间发出。");
      actions = <Link href="/studio/schedule" className={outlineLink}>{tr(locale, "View schedule", "查看排期")}</Link>;
      break;
    case "published":
      hint = tr(locale, "Posted. Add views and followers in Analytics to track the goal.", "已发出。在数据页记录播放和粉丝，跟踪目标。");
      actions = <Link href="/studio/analytics" className={outlineLink}>{tr(locale, "Open analytics", "查看数据")}</Link>;
      break;
    default:
      hint = statusLabel(locale, item.status);
  }

  return (
    <div className="space-y-3 border-b border-[#EEF1EF] bg-[#FAFBFA] px-6 py-4">
      <p className="text-[13.5px] leading-[1.55] text-[#3F4C46]">{hint}</p>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
