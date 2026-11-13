import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { briefItem, queueItem } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

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
  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Video editor", "剪辑")}
        title={tr(locale, "A brief, not a render", "这里出剪辑单，不出成片")}
        lede={tr(locale, "Cuts, captions, and the four aspect ratios. Uploading the raw file is a placeholder: only the filename is kept.", "剪点、字幕，和四种画幅。上传原片在这个 MVP 里是占位：只保留文件名。")}
      />
      <ul className="divide-y divide-border rounded-[8px] border border-border bg-card">
        {items.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">{tr(locale, "Nothing is ready for an edit brief.", "还没有可以写剪辑单的内容。")}</li> : null}
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link className="text-sm underline" href={`/studio/pipeline/${item.id}`}>{item.title}</Link>
              <div className="mt-1 flex gap-2"><StatusBadge locale={locale} status={item.status} /></div>
              {item.brief?.rawVideoName ? <p className="mt-1 text-xs text-muted-foreground">{item.brief.rawVideoName}</p> : null}
            </div>
            {item.status === "repurposed" ? (
              <form action={briefItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton>{tr(locale, "Write brief", "写剪辑单")}</SubmitButton>
              </form>
            ) : null}
            {item.status === "brief_ready" ? (
              <form action={queueItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton variant="outline">{tr(locale, "Queue", "排队")}</SubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
