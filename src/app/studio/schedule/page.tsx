import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Flash } from "@/components/flash";
import { PlatformChips, StatusBadge } from "@/components/status-badge";
import { InfoTip } from "@/components/visual";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { addDays, daysBetween, kualaLumpurDate, mondayOf } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { decidePost } from "@/server/studio-actions";
import { releaseDuePosts } from "@/server/approvals";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const KL = "Asia/Kuala_Lumpur";

const EDGE: Record<string, string> = {
  pending_approval: "border-l-[#1A7A5E]",
  approved: "border-l-[#0F6B4F]",
  published: "border-l-[#5E7D74]",
  unscheduled: "border-l-[#7DADA0]",
  changes_requested: "border-l-[#B45309]",
  rejected: "border-l-[#B42318]",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "schedule", user.id);
  await releaseDuePosts(workspace.id);
  const entries = await prisma.scheduleEntry.findMany({
    where: { workspaceId: workspace.id },
    include: { contentItem: true },
    orderBy: { scheduledFor: "asc" },
  });
  const videos = [...entries.reduce((groups, entry) => {
    const group = groups.get(entry.contentItemId) ?? [];
    group.push(entry);
    groups.set(entry.contentItemId, group);
    return groups;
  }, new Map<string, typeof entries>()).values()];
  const weeks = new Map<string, typeof videos>();
  for (const group of videos) {
    const start = mondayOf(kualaLumpurDate(group[0]!.scheduledFor));
    const list = weeks.get(start) ?? [];
    list.push(group);
    weeks.set(start, list);
  }
  const weekStarts = [...weeks.keys()].sort();
  const days = locale === "zh" ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <header className="mb-4">
        <h1 className="type-h1 inline-flex items-center gap-2">
          {tr(locale, "Schedule", "排期")}
          <InfoTip text={tr(locale, "One approval covers every platform. Unschedule before send time.", "一次批准覆盖各平台。发出前可取消。")} />
        </h1>
      </header>
      {entries.length === 0 ? (
        <EmptyState
          title={tr(locale, "Nothing queued", "队列是空的")}
          body={tr(locale, "Queueing does not publish. Approval does.", "放进队列不会发布。批准才会排期。")}
        />
      ) : (
        <div className="space-y-6">
          {weekStarts.map((start) => (
            <section key={start}>
              <h2 className="mb-2 text-[13px] font-semibold text-[#3F4C46]">{weekLabel(start, locale)}</h2>
              <div className="overflow-hidden rounded-[8px] border border-[#E4E8E5] bg-white">
                <div className="grid grid-cols-1 md:grid-cols-7 md:divide-x md:divide-[#E4E8E5]">
                  {days.map((day, index) => {
                    const date = addDays(start, index);
                    const dayGroups = (weeks.get(start) ?? []).filter((group) => daysBetween(start, kualaLumpurDate(group[0]!.scheduledFor)) === index);
                    return (
                      <div key={day} className="min-h-28 border-b border-[#E4E8E5] p-2 last:border-b-0 md:min-h-40 md:border-b-0">
                        <p className="mb-2 flex items-baseline justify-between text-[13px] font-medium text-[#5E6B65]">
                          {day}
                          <span className="nums text-[13px] text-[#14201B]">{date.slice(8)}</span>
                        </p>
                        <div className="space-y-2">
                          {dayGroups.map((group) => {
                            const entry = group.find((row) => row.status === "pending_approval") ?? group[0]!;
                            const platforms = group.map((row) => row.platform);
                            return (
                              <article key={entry.contentItemId} className={`rounded-[4px] border border-[#E4E8E5] border-l-2 bg-[#F6F7F5] px-2 py-2 ${EDGE[entry.status] ?? "border-l-[#E4E8E5]"}`}>
                                <Link href={`/studio/pipeline/${entry.contentItemId}`} className="line-clamp-2 text-[13px] font-medium leading-snug">{entry.contentItem.title}</Link>
                                <p className="mt-1 text-[13px] font-medium text-[#5E6B65]">{group.map((row) => clock(row.scheduledFor, locale)).join(" · ")}</p>
                                <div className="mt-1.5"><PlatformChips platforms={platforms} /></div>
                                <div className="mt-1.5"><StatusBadge locale={locale} status={entry.status} /></div>
                                <div className="mt-2">{decision(entry, user.platformRole, locale)}</div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function weekLabel(start: string, locale: "en" | "zh") {
  const format = (iso: string) => new Intl.DateTimeFormat(locale === "zh" ? "zh-Hans-MY" : "en-MY", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
  return `${format(start)} – ${format(addDays(start, 6))}`;
}

function clock(date: Date, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-Hans-MY" : "en-MY", {
    timeZone: KL,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function decision(
  entry: { id: string; status: string; publishResult: string },
  role: string,
  locale: "en" | "zh",
) {
  if ((entry.status === "pending_approval" || entry.status === "unscheduled") && role === "admin") {
    return <p className="text-[13px] text-[#5E6B65]">{tr(locale, "Client only", "仅客户")}</p>;
  }
  if (entry.status === "pending_approval" || entry.status === "unscheduled") {
    return (
      <div className="flex flex-col gap-1">
        <form action={decidePost}>
          <input type="hidden" name="entryId" value={entry.id} />
          <input type="hidden" name="decision" value="approve" />
          <SubmitButton className="w-full">{tr(locale, "Approve & schedule", "批准并排期")}</SubmitButton>
        </form>
        {entry.status === "pending_approval" ? (
          <form action={decidePost}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="decision" value="reject" />
            <SubmitButton variant="secondary" className="w-full">{tr(locale, "Changes", "修改")}</SubmitButton>
          </form>
        ) : null}
      </div>
    );
  }
  if (entry.status === "approved" && role === "admin") {
    return <p className="text-[13px] text-[#5E6B65]">{tr(locale, "Client only", "仅客户")}</p>;
  }
  if (entry.status === "approved") {
    return (
      <form action={decidePost}>
        <input type="hidden" name="entryId" value={entry.id} />
        <input type="hidden" name="decision" value="unschedule" />
        <SubmitButton variant="outline" className="w-full">{tr(locale, "Unschedule", "取消排期")}</SubmitButton>
      </form>
    );
  }
  if (entry.status === "published") return null;
  return entry.publishResult ? <span className="text-[13px] text-[#5E6B65]">{entry.publishResult}</span> : null;
}
