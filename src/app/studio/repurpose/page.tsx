import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { repurposeItem } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

export default async function RepurposePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "repurposer", user.id);
  const items = await prisma.contentItem.findMany({
    where: { workspaceId: workspace.id, status: { in: ["script_ready", "repurposed", "brief_ready", "queued", "schedule_approved", "published"] } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Repurposer", "改写")}
        title={tr(locale, "One script, four shapes", "一条脚本，四种样子")}
        lede={tr(locale, "Instagram caption, carousel outline, Facebook post, and notes for 9:16, 1:1, 4:5, and 16:9.", "Instagram 文案、轮播提纲、Facebook 帖子，以及 9:16、1:1、4:5、16:9 的尺寸说明。")}
      />
      <ul className="divide-y divide-border rounded-[8px] border border-border bg-card">
        {items.length === 0 ? <li className="px-4 py-6 text-sm text-muted-foreground">{tr(locale, "No scripts yet.", "还没有脚本。")}</li> : null}
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link className="text-sm underline" href={`/studio/pipeline/${item.id}`}>{item.title}</Link>
              <div className="mt-1"><StatusBadge locale={locale} status={item.status} /></div>
            </div>
            {item.status === "script_ready" ? (
              <form action={repurposeItem}>
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton>{tr(locale, "Repurpose", "改写")}</SubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
