import Link from "next/link";
import { Flash } from "@/components/flash";
import { PlatformChips, StatusBadge } from "@/components/status-badge";
import { InfoTip, Sparkline } from "@/components/visual";
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

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <header className="mb-4">
        <h1 className="type-h1 inline-flex items-center gap-2">
          {tr(locale, "Today", "今天")}
          <InfoTip text={tr(locale, "Approve the week before scripts. Approve & schedule sends at the planned time.", "先批周计划再写脚本。批准并排期会按时发出。")} />
        </h1>
      </header>

      {next ? (
        <section className="mb-4 flex flex-col gap-3 rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-snug">{next.title}</h2>
            <p className="mt-1 text-[16px] text-[#3D5C54]">{next.line}</p>
          </div>
          {next.kind === "plan" && next.planId ? (
            <form action={decidePlan}>
              <input type="hidden" name="planId" value={next.planId} />
              <input type="hidden" name="decision" value="approve" />
              <SubmitButton>{next.cta}</SubmitButton>
            </form>
          ) : next.href ? (
            <Link href={next.href} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#086B54] bg-[#0B624C] px-4 text-[14px] font-bold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#094E3D]">{next.cta}</Link>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
        <div className="grid grid-cols-2 xl:grid-cols-4">
          <Metric label={tr(locale, "Waiting", "待处理")} value={String(waiting)} hint={tr(locale, "Posts to approve", "待批准的内容")} spark={videos.map((_, index) => index + 1)} />
          <Metric
            label={tr(locale, "This week", "本周")}
            value={String(latestPlan?._count.items ?? 0)}
            hint={latestPlan?.status === "approved" ? tr(locale, "Week approved", "整周已批准") : tr(locale, "Week not approved", "整周未批准")}
          />
          <Metric
            label={tr(locale, "Followers", "粉丝")}
            value={currentFollowers.toLocaleString()}
            hint={insight?.title ?? (behind
              ? tr(locale, `${pace.actualDaily.toFixed(1)}/day vs ${Math.round(pace.requiredDaily)} needed`, `每天 ${pace.actualDaily.toFixed(1)}，需要 ${Math.round(pace.requiredDaily)}`)
              : tr(locale, "On the goal pace", "跟上目标节奏"))}
            warn={behind}
            spark={snapshots.map((row) => row.followers)}
          />
          <Metric label={tr(locale, "48h", "48小时")} value={String(activities.length)} hint={tr(locale, "Team activity", "团队动态")} />
        </div>
      </section>

      <section id="approve" className="mt-6">
        <h2 className="type-h2 mb-2 inline-flex items-center gap-1">
          {tr(locale, "Approve", "待批准")}
          <InfoTip text={tr(locale, "One yes schedules every platform. Unschedule before send time.", "一次批准覆盖各平台。发出前可取消。")} />
        </h2>
        {waiting === 0 ? (
          <p className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-8 text-center text-[14px]">{tr(locale, "Nothing waiting.", "没有待批内容。")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
            <table className="hidden w-full text-left text-[13px] md:table">
              <thead className="text-[13px] text-[#3D5C54]">
                <tr className="border-b border-[#D5E3DD]">
                  <th className="px-4 py-2 font-medium">{tr(locale, "Item", "内容")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "Where", "平台")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "When", "时间")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "Status", "状态")}</th>
                  <th className="px-4 py-2 font-medium">{tr(locale, "Action", "操作")}</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((group) => {
                  const post = group[0]!;
                  const platforms = group.map((row) => row.platform);
                  return (
                    <tr key={post.contentItemId} className="border-b border-[#D5E3DD] last:border-0">
                      <td className="px-4 py-3 font-medium">{post.contentItem.title}</td>
                      <td className="px-3 py-3"><PlatformChips platforms={platforms} /></td>
                      <td className="px-3 py-3 tabular-nums">{group.map((row) => <span key={row.id} className="block">{formatWhen(row.scheduledFor, locale)}</span>)}</td>
                      <td className="px-3 py-3"><StatusBadge locale={locale} status="pending_approval" /></td>
                      <td className="px-4 py-3">{canApprove ? <RowActions entryId={post.id} locale={locale} /> : <StaffNote locale={locale} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="md:hidden">
              {videos.map((group) => {
                const post = group[0]!;
                return (
                  <li key={post.contentItemId} className="border-b border-[#D5E3DD] px-4 py-3 last:border-0">
                    <Link href={`/studio/approve/${post.id}`} className="block">
                      <StatusBadge locale={locale} status="pending_approval" />
                      <p className="mt-2 text-[14px] font-medium">{post.contentItem.title}</p>
                      <div className="mt-2"><PlatformChips platforms={group.map((row) => row.platform)} /></div>
                      <p className="text-[13px] text-[#3D5C54]">{group.map((row) => formatWhen(row.scheduledFor, locale)).join(" · ")}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="type-h2 mb-2">{tr(locale, "Scheduled", "即将发出")}</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-6 text-center text-[13px] text-[#3D5C54]">{tr(locale, "Nothing scheduled.", "没有已排期内容。")}</p>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
            <table className="w-full text-left text-[13px]">
              <tbody>
                {upcoming.map((group) => {
                  const post = group[0]!;
                  return (
                    <tr key={post.contentItemId} className="border-b border-[#D5E3DD] last:border-0">
                      <td className="px-4 py-3 font-medium">{post.contentItem.title}</td>
                      <td className="px-3 py-3"><PlatformChips platforms={group.map((row) => row.platform)} /></td>
                      <td className="px-3 py-3 tabular-nums">{group.map((row) => <span key={row.id} className="block">{formatWhen(row.scheduledFor, locale)}</span>)}</td>
                      <td className="px-3 py-3"><StatusBadge locale={locale} status="approved" label={tr(locale, "Scheduled", "已排期")} /></td>
                      <td className="px-4 py-3">
                        {canApprove ? (
                          <form action={decidePost}>
                            <input type="hidden" name="entryId" value={post.id} />
                            <input type="hidden" name="decision" value="unschedule" />
                            <SubmitButton variant="outline">{tr(locale, "Unschedule", "取消排期")}</SubmitButton>
                          </form>
                        ) : <StaffNote locale={locale} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="type-h2 mb-2">{tr(locale, "Last 48 hours", "过去 48 小时")}</h2>
        {activities.length === 0 ? (
          <p className="rounded-[8px] border border-[#D5E3DD] bg-white px-4 py-6 text-center text-[13px] text-[#3D5C54]">{tr(locale, "No activity.", "没有动态。")}</p>
        ) : (
          <ul className="overflow-hidden rounded-[8px] border border-[#D5E3DD] bg-white">
            {activities.slice(0, 6).map((row) => (
              <li key={row.id} className="flex items-start gap-3 border-b border-[#D5E3DD] px-4 py-2.5 last:border-0">
                <span className="grid size-6 shrink-0 place-items-center rounded-[6px] border border-[#D5E3DD] bg-[#F2F6F4] text-[13px] font-semibold">{MONO[row.role] ?? "·"}</span>
                <p className="text-[13px] leading-snug">{activityLine(locale, row.code, row.detail.replace(/_stub_[a-z0-9]+/gi, "").replace(/\s+·\s*$/, ""))}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251F]/35 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Approve and schedule", "批准并排期")}</h2>
        <p className="mt-1 text-[13px] text-[#3D5C54]">{tr(locale, "Goes out at these times. Unschedule before then.", "将在这些时间发出。发出前可取消。")}</p>
        <p className="mt-3 text-[14px] font-medium">{group[0]?.contentItem.title}</p>
        <div className="mt-2"><PlatformChips platforms={group.map((row) => row.platform)} /></div>
        <ul className="mt-2 space-y-1 text-[13px] text-[#1C453A]">
          {group.map((row) => <li key={row.id}>{row.platform} · {formatWhen(row.scheduledFor, locale)}</li>)}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Link href="/studio" className="inline-flex h-9 items-center rounded-[6px] border border-[#D5E3DD] bg-white px-3 text-[13px]">{tr(locale, "Cancel", "取消")}</Link>
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

function Metric({ label, value, hint, warn, spark }: { label: string; value: string; hint: string; warn?: boolean; spark?: number[] }) {
  return (
    <article className="border-r border-b border-[#D5E3DD] px-4 py-3 last:border-r-0 xl:border-b-0">
      <p className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3D5C54]">
        {label}
        <InfoTip text={hint} />
      </p>
      <p className={`nums mt-2 text-[28px] leading-none font-semibold ${warn ? "text-[#B45309]" : ""}`}>{value}</p>
      {spark && spark.length > 1 ? <Sparkline values={spark} label={label} /> : null}
    </article>
  );
}

function RowActions({ entryId, locale }: { entryId: string; locale: "en" | "zh" }) {
  return (
    <div className="flex gap-2">
      <Link href={`/studio?confirm=${entryId}`} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#086B54] bg-[#0B624C] px-4 text-[14px] font-bold text-white shadow-[0_1px_0_rgba(8,107,84,0.9),0_1px_2px_rgba(12,46,40,0.18)] hover:bg-[#094E3D]">{tr(locale, "Approve & schedule", "批准并排期")}</Link>
      <form action={decidePost}>
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="decision" value="reject" />
        <SubmitButton variant="secondary">{tr(locale, "Request changes", "要求修改")}</SubmitButton>
      </form>
    </div>
  );
}

function StaffNote({ locale }: { locale: "en" | "zh" }) {
  return <p className="text-[13px] text-[#3D5C54]">{tr(locale, "Client approval only.", "仅客户可批。")}</p>;
}
