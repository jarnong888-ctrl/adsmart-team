import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { PlatformChips, StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/dates";
import { pillarLabel, tr } from "@/lib/i18n";
import { decidePost } from "@/server/studio-actions";
import { studioContext } from "@/server/context";

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const { id } = await params;
  const sp = await searchParams;
  const open = await prisma.scheduleEntry.findMany({
    where: { workspaceId: workspace.id, status: { in: ["pending_approval", "unscheduled"] } },
    orderBy: { scheduledFor: "asc" },
  });
  const videos = [...new Set(open.map((row) => row.contentItemId))];
  const entry = await prisma.scheduleEntry.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { contentItem: { include: { script: true } } },
  });
  if (!entry) notFound();
  const siblings = await prisma.scheduleEntry.findMany({
    where: { contentItemId: entry.contentItemId, status: { not: "rejected" } },
    orderBy: { scheduledFor: "asc" },
  });
  const index = Math.max(0, videos.indexOf(entry.contentItemId));
  const position = videos.length ? `${index + 1} / ${videos.length}` : "1 / 1";
  const canApprove = user.platformRole !== "admin" && (entry.status === "pending_approval" || entry.status === "unscheduled");
  const canUnschedule = user.platformRole !== "admin" && entry.status === "approved" && entry.scheduledFor.getTime() > new Date().getTime();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[440px] flex-col">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <header className="flex h-11 items-center justify-between">
        <Link href="/studio" aria-label={tr(locale, "Back", "返回")} className="grid size-11 place-items-center text-[18px]">←</Link>
        <h1 className="text-[16px] font-semibold">{tr(locale, "Approval", "审批")}</h1>
        <p className="w-11 text-right text-[13px] text-[#3D5C54] tabular-nums">{position}</p>
      </header>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge locale={locale} status={entry.status} label={entry.status === "approved" ? tr(locale, "Scheduled", "已排期") : undefined} />
        <PlatformChips platforms={siblings.map((row) => row.platform)} />
      </div>
      <ul className="mt-2 space-y-0.5 text-[13px] text-[#1C453A]">
        {siblings.map((row) => (
          <li key={row.id}>{row.platform === "tiktok" ? "TikTok" : row.platform === "instagram" ? "Instagram" : row.platform === "facebook" ? "Facebook" : row.platform} · {formatWhen(row.scheduledFor, locale)}</li>
        ))}
      </ul>
      <h2 className="mt-3 text-[22px] leading-[1.35] font-semibold">{entry.contentItem.title}</h2>
      <div className="mt-4 rounded-[8px] bg-[#E7F1EC] px-3 py-3 text-[14px] leading-[1.7] whitespace-pre-wrap">{entry.caption}</div>
      <p className="mt-3 text-[13px] text-[#3D5C54]">
        {pillarLabel(locale, entry.contentItem.pillar)}
        {entry.contentItem.softSell ? ` · ${tr(locale, "Soft sell", "软性销售")}` : ""}
        {entry.contentItem.script ? ` · ${entry.contentItem.script.durationSec}s` : ""}
      </p>
      <p className="mt-3 text-[13px] leading-[1.55] text-[#1C453A]">
        {canUnschedule
          ? tr(locale, "Scheduled", "已排期")
          : tr(locale, "Approve & schedule", "批准并排期")}
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-6 pb-4">
        {canApprove ? (
          <>
            <form action={decidePost}>
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="decision" value="approve" />
              <input type="hidden" name="next" value="/studio" />
              <SubmitButton className="w-full">{tr(locale, "Approve & schedule", "批准并排期")}</SubmitButton>
            </form>
            <form action={decidePost} className="space-y-2">
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="decision" value="reject" />
              <input type="hidden" name="next" value="/studio" />
              <label className="block text-[13px] text-[#1C453A]">
                {tr(locale, "Tell the team what to change.", "告诉团队要改什么。他们改完你会再看到。")}
                <textarea name="note" className="mt-1 min-h-16 w-full rounded-[6px] border border-[#C5D9D1] bg-white px-3 py-2 text-[14px]" />
              </label>
              <SubmitButton variant="secondary" className="w-full">{tr(locale, "Request changes", "要求修改")}</SubmitButton>
            </form>
            <form action={decidePost}>
              <input type="hidden" name="entryId" value={entry.id} />
              <input type="hidden" name="decision" value="reject" />
              <input type="hidden" name="next" value="/studio" />
              <SubmitButton variant="destructive" className="w-full">{tr(locale, "Reject", "拒绝")}</SubmitButton>
            </form>
          </>
        ) : canUnschedule ? (
          <form action={decidePost}>
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="decision" value="unschedule" />
            <input type="hidden" name="next" value="/studio" />
            <SubmitButton variant="outline" className="w-full">{tr(locale, "Unschedule", "取消排期")}</SubmitButton>
          </form>
        ) : (
          <p className="text-center text-[13px] text-[#3D5C54]">{tr(locale, "Only a member of this workspace can approve.", "只有这个工作区的成员可以批准。")}</p>
        )}
      </div>
    </div>
  );
}
