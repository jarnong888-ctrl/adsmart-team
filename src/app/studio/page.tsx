import Link from "next/link";
import { Flash } from "@/components/flash";
import { PlatformChips } from "@/components/status-badge";
import { Activity, ArrowRight, CalendarClock, CalendarDays, CheckCircle2, Inbox, Send, Sparkles } from "lucide-react";
import { EmptyPanel, LinkButton, Meter, Panel, StatTile, Tag } from "@/components/kit";
import { Sparkline } from "@/components/visual";
import { SubmitButton } from "@/components/submit-button";
import { paceReport } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { daysBetween, formatWhen, kualaLumpurDate } from "@/lib/dates";
import { activityLine, tr } from "@/lib/i18n";
import { recommendationCopy } from "@/lib/access";
import { decidePlan, decidePost } from "@/server/studio-actions";
import { releaseDuePosts } from "@/server/approvals";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const MONO: Record<string, string> = {
  strategist: "策",
  scriptwriter: "编",
  repurposer: "改",
  editor: "剪",
  social: "社",
  analytics: "数",
  analyst: "析",
  cmo: "总",
  client: "客",
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; confirm?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "cmo", user.id);
  await releaseDuePosts(workspace.id);
  const since = new Date(new Date().getTime() - 48 * 60 * 60 * 1000);
  const [activities, posts, scheduled, snapshots, recommendations, latestPlan] = await Promise.all([
    prisma.activity.findMany({ where: { workspaceId: workspace.id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } }),
    prisma.scheduleEntry.findMany({
      where: { workspaceId: workspace.id, status: { in: ["pending_approval", "unscheduled"] } },
      include: { contentItem: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { workspaceId: workspace.id, status: "approved", scheduledFor: { gt: new Date() } },
      include: { contentItem: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.analyticsSnapshot.findMany({ where: { workspaceId: workspace.id, platform: workspace.goalPlatform }, orderBy: { recordedOn: "asc" } }),
    prisma.recommendation.findMany({ where: { workspaceId: workspace.id, status: "sent" }, orderBy: { createdAt: "desc" }, take: 1 }),
    prisma.contentPlan.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { weekStart: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);
  const latest = snapshots.at(-1);
  const today = kualaLumpurDate(new Date());
  const elapsed = workspace.baselineOn ? Math.max(0, daysBetween(workspace.baselineOn, today)) : 0;
  const currentFollowers = latest?.followers ?? workspace.baselineFollowers;
  const pace = paceReport({
    baseline: workspace.baselineFollowers,
    latest: currentFollowers,
    goal: workspace.goalFollowers,
    horizonDays: workspace.goalHorizonDays,
    elapsedDays: elapsed,
  });
  const videos = [...posts.reduce((groups, post) => {
    const group = groups.get(post.contentItemId) ?? [];
    group.push(post);
    groups.set(post.contentItemId, group);
    return groups;
  }, new Map<string, typeof posts>()).values()];
  const upcoming = [...scheduled.reduce((groups, post) => {
    const group = groups.get(post.contentItemId) ?? [];
    group.push(post);
    groups.set(post.contentItemId, group);
    return groups;
  }, new Map<string, typeof scheduled>()).values()];
  const planOpen = latestPlan && latestPlan.status !== "approved";
  const waiting = videos.length;
  const canApprove = user.platformRole !== "admin";
  const insight = recommendations[0] ? recommendationCopy(recommendations[0], locale) : null;
  const connections = await prisma.integration.findMany({ where: { workspaceId: workspace.id, status: "connected" }, select: { provider: true } });
  const connected = new Set(connections.map((row) => row.provider));
  const socialReady = ["tiktok", "instagram", "facebook", "youtube"].some((provider) => connected.has(provider));
  const behind = pace.actualDaily < pace.requiredDaily;
  const next = nextAction({
    locale,
    canApprove,
    planOpen: Boolean(planOpen),
    planId: latestPlan?.id,
    google: connected.has("google"),
    socialReady,
    waiting,
  });

  const goalSpan = Math.max(1, workspace.goalFollowers - workspace.baselineFollowers);
  const goalPct = ((currentFollowers - workspace.baselineFollowers) / goalSpan) * 100;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kuala_Lumpur" }).format(new Date()));
  const greeting = hour < 12 ? tr(locale, "Good morning", "早上好") : hour < 18 ? tr(locale, "Good afternoon", "下午好") : tr(locale, "Good evening", "晚上好");
  const dateLine = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="type-eyebrow mb-1.5">{dateLine}</p>
          <h1 className="type-h1">{greeting}, {firstName}</h1>
          <p className="type-body mt-1.5 text-[#5E6B65]">
            {waiting > 0
              ? tr(locale, `${waiting} ${waiting === 1 ? "video is" : "videos are"} waiting for your approval.`, `有 ${waiting} 条视频等你批准。`)
              : tr(locale, "Nothing is waiting on you right now.", "现在没有等你处理的事。")}
          </p>
        </div>
        <LinkButton href="/studio/pipeline" variant="outline">
          {tr(locale, "Open pipeline", "查看流水线")}
          <ArrowRight className="size-4" aria-hidden />
        </LinkButton>
      </header>

      {next ? (
        <section className="flex flex-col gap-4 rounded-[16px] border border-[#CFE6DA] bg-gradient-to-br from-[#F1F8F4] to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#0F6B4F] text-white">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-eyebrow text-[#0B5A42]">{tr(locale, "Next up", "下一步")}</p>
              <h2 className="mt-0.5 text-[18px] font-semibold leading-snug">{next.title}</h2>
              <p className="mt-0.5 text-[14px] text-[#3F4C46]">{next.line}</p>
            </div>
          </div>
          {next.kind === "plan" && next.planId ? (
            <form action={decidePlan} className="shrink-0">
              <input type="hidden" name="planId" value={next.planId} />
              <input type="hidden" name="decision" value="approve" />
              <SubmitButton>{next.cta}</SubmitButton>
            </form>
          ) : next.href ? (
            <LinkButton href={next.href} className="shrink-0">{next.cta}</LinkButton>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={tr(locale, "Waiting for approval", "待批准")} value={waiting} icon={Inbox} tone={waiting > 0 ? "warn" : "default"}
          sub={waiting > 0 ? tr(locale, "One yes covers every platform", "批准一次覆盖所有平台") : tr(locale, "All clear", "都处理好了")} />
        <StatTile label={tr(locale, "This week", "本周")} value={latestPlan?._count.items ?? 0} icon={CalendarDays}
          sub={latestPlan ? (latestPlan.status === "approved" ? tr(locale, "Videos · week approved", "条视频 · 已批准") : tr(locale, "Videos · week not approved yet", "条视频 · 还没批准")) : tr(locale, "No week planned", "还没有周计划")} />
        <StatTile label={tr(locale, "Scheduled", "已排期")} value={upcoming.length} icon={Send}
          sub={upcoming[0] ? tr(locale, `Next: ${formatWhen(upcoming[0][0]!.scheduledFor, locale)}`, `下一条：${formatWhen(upcoming[0][0]!.scheduledFor, locale)}`) : tr(locale, "Nothing queued to go out", "没有待发内容")} />
        <StatTile label={tr(locale, "Team activity", "团队动态")} value={activities.length} icon={Activity} sub={tr(locale, "Actions in the last 48 hours", "过去 48 小时的动作")} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel
            id="approve"
            title={tr(locale, "Waiting for your approval", "等你批准")}
            subtitle={tr(locale, "Approving schedules every platform. You can unschedule before it goes out.", "批准即排期到所有平台。发出前可以取消。")}
            action={waiting > 0 ? <Tag tone="warn">{waiting}</Tag> : null}
          >
            {waiting === 0 ? (
              <EmptyPanel compact icon={CheckCircle2} title={tr(locale, "You’re all caught up", "都处理好了")} body={tr(locale, "New posts show up here once they’re queued.", "内容排队后会出现在这里。")} />
            ) : (
              <ul className="divide-y divide-[#EEF1EF]">
                {videos.map((group) => {
                  const post = group[0]!;
                  return (
                    <li key={post.contentItemId} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1 basis-64">
                        <Link href={`/studio/approve/${post.id}`} className="font-cjk block text-[15px] font-medium leading-snug hover:text-[#0F6B4F]">{post.contentItem.title}</Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#5E6B65]">
                          <PlatformChips platforms={group.map((row) => row.platform)} />
                          <span className="nums font-normal">{formatWhen(group[0]!.scheduledFor, locale)}{group.length > 1 ? ` +${group.length - 1}` : ""}</span>
                        </div>
                      </div>
                      {canApprove ? <RowActions entryId={post.id} locale={locale} /> : <StaffNote locale={locale} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={tr(locale, "Going out next", "即将发出")} action={<LinkButton href="/studio/schedule" variant="ghost" size="sm">{tr(locale, "Schedule", "排期")}<ArrowRight className="size-3.5" aria-hidden /></LinkButton>}>
            {upcoming.length === 0 ? (
              <EmptyPanel compact icon={CalendarClock} title={tr(locale, "Nothing scheduled", "没有已排期内容")} body={tr(locale, "Approved posts wait here until their time.", "批准的内容会在这里等到发出时间。")} />
            ) : (
              <ul className="divide-y divide-[#EEF1EF]">
                {upcoming.map((group) => {
                  const post = group[0]!;
                  return (
                    <li key={post.contentItemId} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                      <div className="grid w-14 shrink-0 text-center leading-tight">
                        <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5E6B65] uppercase">{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { weekday: "short", timeZone: "Asia/Kuala_Lumpur" }).format(post.scheduledFor)}</span>
                        <span className="nums text-[19px]">{new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(post.scheduledFor)}</span>
                      </div>
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="font-cjk truncate text-[14.5px] font-medium">{post.contentItem.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-[#5E6B65]">
                          <PlatformChips platforms={group.map((row) => row.platform)} />
                          <span className="nums font-normal">{formatWhen(post.scheduledFor, locale)}</span>
                        </div>
                      </div>
                      {canApprove ? (
                        <form action={decidePost}>
                          <input type="hidden" name="entryId" value={post.id} />
                          <input type="hidden" name="decision" value="unschedule" />
                          <SubmitButton variant="outline" size="sm">{tr(locale, "Unschedule", "取消排期")}</SubmitButton>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title={tr(locale, "Follower goal", "粉丝目标")} subtitle={`${workspace.goalPlatform === "tiktok" ? "TikTok" : workspace.goalPlatform} · ${workspace.goalFollowers.toLocaleString()}`}>
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-end justify-between gap-2">
                <p className="nums text-[30px] leading-none tracking-[-0.02em]">{currentFollowers.toLocaleString()}</p>
                <p className="nums pb-0.5 text-[13px] text-[#5E6B65]">{Math.max(0, Math.round(goalPct))}%</p>
              </div>
              <Meter value={goalPct} label={tr(locale, "Progress to the follower goal", "粉丝目标进度")} tone={behind ? "warn" : "good"} />
              <dl className="grid grid-cols-2 gap-3 pt-1 text-[12.5px]">
                <div>
                  <dt className="text-[#5E6B65]">{tr(locale, "Per day now", "现在每天")}</dt>
                  <dd className={`nums mt-0.5 text-[15px] ${behind ? "text-[#9A5B00]" : ""}`}>{pace.actualDaily.toFixed(1)}</dd>
                </div>
                <div>
                  <dt className="text-[#5E6B65]">{tr(locale, "Per day needed", "每天需要")}</dt>
                  <dd className="nums mt-0.5 text-[15px]">{Math.round(pace.requiredDaily)}</dd>
                </div>
              </dl>
              {snapshots.length > 1 ? <Sparkline values={snapshots.map((row) => row.followers)} label={tr(locale, "Followers over time", "粉丝变化")} /> : null}
              <p className="text-[12.5px] leading-snug text-[#5E6B65]">
                {behind ? tr(locale, "Behind the pace the goal needs.", "落后于目标需要的节奏。") : tr(locale, "On the pace the goal needs.", "跟上了目标节奏。")}
              </p>
            </div>
          </Panel>

          {insight ? (
            <Panel title={tr(locale, "From your Adsmart team", "Adsmart 团队建议")}>
              <div className="px-5 py-4">
                <p className="font-cjk text-[14.5px] font-semibold leading-snug">{insight.title}</p>
                {insight.body ? <p className="font-cjk mt-1.5 line-clamp-5 text-[13.5px] leading-relaxed text-[#3F4C46]">{insight.body}</p> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={tr(locale, "Last 48 hours", "过去 48 小时")}>
            {activities.length === 0 ? (
              <EmptyPanel compact title={tr(locale, "No activity yet", "还没有动态")} />
            ) : (
              <ol className="space-y-0 px-5 py-4">
                {activities.slice(0, 7).map((row, index, list) => (
                  <li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < list.length - 1 ? <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-px bg-[#E4E8E5]" /> : null}
                    <span className="font-cjk relative grid size-7 shrink-0 place-items-center rounded-full bg-[#F1F5F2] text-[12px] font-medium text-[#0B5A42]">{MONO[row.role] ?? "·"}</span>
                    <div className="min-w-0 pt-0.5">
                      <p className="font-cjk text-[13px] leading-snug">{activityLine(locale, row.code, row.detail.replace(/_stub_[a-z0-9]+/gi, "").replace(/\s+·\s*$/, ""))}</p>
                      <p className="mt-0.5 text-[11.5px] text-[#7A8781]">{formatWhen(row.createdAt, locale)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
      {sp.confirm ? <ScheduleConfirm locale={locale} groups={videos} entryId={sp.confirm} /> : null}
    </div>
  );
}

function nextAction({
  locale,
  canApprove,
  planOpen,
  planId,
  google,
  socialReady,
  waiting,
}: {
  locale: "en" | "zh";
  canApprove: boolean;
  planOpen: boolean;
  planId?: string;
  google: boolean;
  socialReady: boolean;
  waiting: number;
}): { title: string; line: string; cta: string; kind: "plan" | "link" | "note"; href?: string; planId?: string } | null {
  if (planOpen && canApprove && planId) {
    return {
      kind: "plan",
      planId,
      title: tr(locale, "Approve this week", "批准本周"),
      line: tr(locale, "Scripts stay locked until you do.", "批准前不能写脚本。"),
      cta: tr(locale, "Approve week", "批准本周"),
    };
  }
  if (planOpen) {
    return {
      kind: "note",
      title: tr(locale, "Week plan is waiting", "周计划待批"),
      line: tr(locale, "Only a workspace member can approve it.", "只有工作区成员可以批准。"),
      cta: "",
    };
  }
  if (!google && canApprove) {
    return {
      kind: "link",
      href: "/studio/connections",
      title: tr(locale, "Connect Google", "连接 Google"),
      line: tr(locale, "Drive and Sheets share one login.", "Drive 和表格同一次登录。"),
      cta: tr(locale, "Connect", "连接"),
    };
  }
  if (!socialReady && canApprove) {
    return {
      kind: "link",
      href: "/studio/connections",
      title: tr(locale, "Connect a social account", "连接社交账号"),
      line: tr(locale, "Approved posts go to the account you connect.", "批准后的内容发到你连的账号。"),
      cta: tr(locale, "Connect", "连接"),
    };
  }
  if (waiting > 0) {
    return {
      kind: "link",
      href: "#approve",
      title: tr(locale, `${waiting} to schedule`, `${waiting} 条待排期`),
      line: tr(locale, "One approval covers every platform.", "一次批准覆盖各平台。"),
      cta: tr(locale, "Review", "查看"),
    };
  }
  return null;
}

function ScheduleConfirm({
  locale,
  groups,
  entryId,
}: {
  locale: "en" | "zh";
  groups: { id: string; platform: string; scheduledFor: Date; contentItem: { title: string } }[][];
  entryId: string;
}) {
  const group = groups.find((rows) => rows.some((row) => row.id === entryId));
  if (!group) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#14201B]/40 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-[16px] border border-[#E4E8E5] bg-white p-6 shadow-[0_20px_50px_-12px_rgba(20,32,27,0.35)]">
        <h2 id="confirm-title" className="text-[18px] font-semibold">{tr(locale, "Approve and schedule", "批准并排期")}</h2>
        <p className="mt-1 text-[13px] text-[#5E6B65]">{tr(locale, "Goes out at these times. Unschedule before then.", "将在这些时间发出。发出前可取消。")}</p>
        <p className="font-cjk mt-4 text-[15px] font-medium">{group[0]?.contentItem.title}</p>
        <div className="mt-2"><PlatformChips platforms={group.map((row) => row.platform)} /></div>
        <ul className="mt-3 divide-y divide-[#EEF1EF] rounded-[12px] border border-[#E4E8E5] text-[13px]">
          {group.map((row) => <li key={row.id} className="flex items-center justify-between px-3 py-2"><span className="capitalize">{row.platform}</span><span className="nums font-normal text-[#3F4C46]">{formatWhen(row.scheduledFor, locale)}</span></li>)}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <LinkButton href="/studio" variant="outline">{tr(locale, "Cancel", "取消")}</LinkButton>
          <form action={decidePost}>
            <input type="hidden" name="entryId" value={entryId} />
            <input type="hidden" name="decision" value="approve" />
            <input type="hidden" name="next" value="/studio" />
            <SubmitButton>{tr(locale, "Approve & schedule", "批准并排期")}</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function RowActions({ entryId, locale }: { entryId: string; locale: "en" | "zh" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={decidePost}>
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="decision" value="reject" />
        <SubmitButton variant="outline" size="sm">{tr(locale, "Request changes", "要求修改")}</SubmitButton>
      </form>
      <LinkButton href={`/studio?confirm=${entryId}`} size="sm" scroll={false}>{tr(locale, "Approve & schedule", "批准并排期")}</LinkButton>
    </div>
  );
}

function StaffNote({ locale }: { locale: "en" | "zh" }) {
  return <Tag>{tr(locale, "Client approves", "由客户批准")}</Tag>;
}
