import Link from "next/link";
import { CalendarClock, Clapperboard, FileVideo, ListChecks, Send } from "lucide-react";
import { EmptyPanel, Panel, StatTile, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { pillarLabel, tr } from "@/lib/i18n";
import { briefItem, queueItem } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const RATIOS = [
  { label: "9:16", w: 9, h: 16 },
  { label: "1:1", w: 1, h: 1 },
  { label: "4:5", w: 4, h: 5 },
  { label: "16:9", w: 16, h: 9 },
];

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "editor", user.id);
  const items = await prisma.contentItem.findMany({
    where: { workspaceId: workspace.id, status: { in: ["repurposed", "brief_ready", "queued", "schedule_approved", "published"] } },
    include: { brief: true },
    orderBy: { updatedAt: "desc" },
  });
  const needsBrief = items.filter((item) => item.status === "repurposed");
  const briefReady = items.filter((item) => item.status === "brief_ready");
  const handedOff = items.filter((item) => ["queued", "schedule_approved", "published"].includes(item.status));

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Editor", "剪辑")}
        lede={tr(locale, "Edit briefs with cuts, captions, music and four aspect ratios. The raw video stays on your computer; only its filename is kept.", "剪辑单包含剪点、字幕、音乐和四种画幅。原片留在你的电脑上，这里只记文件名。")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={tr(locale, "Needs a brief", "待写剪辑单")} value={needsBrief.length} icon={ListChecks} tone={needsBrief.length ? "warn" : "default"} sub={tr(locale, "Repurposed and ready for the editor", "已改写，等剪辑")} />
        <StatTile label={tr(locale, "Brief ready", "剪辑单已好")} value={briefReady.length} icon={Clapperboard} sub={tr(locale, "Edit, then add to the queue", "剪好后放进队列")} />
        <StatTile label={tr(locale, "Handed to Schedule", "已交给排期")} value={handedOff.length} icon={Send} sub={tr(locale, "Queued, approved or posted", "排队、已批准或已发")} />
      </div>

      <Panel title={tr(locale, "Needs an edit brief", "待写剪辑单")} action={needsBrief.length ? <Tag tone="warn">{needsBrief.length}</Tag> : null}>
        {needsBrief.length === 0 ? (
          <EmptyPanel compact icon={ListChecks} title={tr(locale, "Nothing waiting", "没有待写的剪辑单")} body={tr(locale, "Videos land here after they’re repurposed.", "改写完成后会出现在这里。")} />
        ) : (
          <ul className="divide-y divide-[#EEF1EF]">
            {needsBrief.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <Link href={`/studio/pipeline/${item.id}`} className="font-cjk block text-[15px] font-medium leading-snug hover:text-[#0F6B4F]">{item.title}</Link>
                  <p className="mt-1 text-[12.5px] text-[#5E6B65]">{pillarLabel(locale, item.pillar)}</p>
                </div>
                <form action={briefItem}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="returnTo" value="/studio/editor" />
                  <SubmitButton size="sm">{tr(locale, "Write brief", "写剪辑单")}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section aria-labelledby="ready-heading">
        <h2 id="ready-heading" className="type-h2 mb-3">{tr(locale, "Brief ready", "剪辑单已好")}</h2>
        {briefReady.length === 0 ? (
          <Panel><EmptyPanel compact icon={Clapperboard} title={tr(locale, "No briefs ready", "还没有剪辑单")} /></Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {briefReady.map((item) => (
              <article key={item.id} className="flex flex-col rounded-[16px] border border-[#E4E8E5] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/studio/pipeline/${item.id}`} className="font-cjk text-[15px] leading-snug font-medium hover:text-[#0F6B4F]">{item.title}</Link>
                  <StatusBadge locale={locale} status={item.status} />
                </div>
                <div className="mt-4 flex items-end gap-3" aria-label={tr(locale, "Aspect ratios in the brief", "剪辑单里的画幅")}>
                  {RATIOS.map((ratio) => (
                    <div key={ratio.label} className="flex flex-col items-center gap-1.5">
                      <span className="block rounded-[4px] border-[1.5px] border-[#14201B]/70 bg-[#F6F7F5]" style={{ width: `${(ratio.w / Math.max(ratio.w, ratio.h)) * 30}px`, height: `${(ratio.h / Math.max(ratio.w, ratio.h)) * 30}px` }} aria-hidden />
                      <span className="nums text-[11.5px] text-[#5E6B65]">{ratio.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-center gap-2 text-[12.5px] text-[#5E6B65]">
                  <FileVideo className="size-4 shrink-0" aria-hidden />
                  {item.brief?.rawVideoName ? <span className="truncate font-medium text-[#14201B]">{item.brief.rawVideoName}</span> : tr(locale, "No raw file name yet", "还没有原片文件名")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EEF1EF] pt-4">
                  <form action={queueItem}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitButton size="sm">{tr(locale, "Add to the queue", "放进队列")}</SubmitButton>
                  </form>
                  <Link href={`/studio/pipeline/${item.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[13.5px] font-medium hover:bg-[#F1F3F2]">{tr(locale, "Open brief", "查看剪辑单")}</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {handedOff.length ? (
        <Panel title={tr(locale, "Handed to Schedule", "已交给排期")} action={<Link href="/studio/schedule" className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0F6B4F] hover:text-[#0A4F3A]"><CalendarClock className="size-4" aria-hidden />{tr(locale, "Open schedule", "查看排期")}</Link>}>
          <ul className="divide-y divide-[#EEF1EF]">
            {handedOff.map((item) => (
              <li key={item.id}>
                <Link href={`/studio/pipeline/${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FAFBFA]">
                  <span className="font-cjk min-w-0 truncate text-[14px]">{item.title}</span>
                  <StatusBadge locale={locale} status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
