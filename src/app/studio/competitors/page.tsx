import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { deleteCompetitor, saveCompetitor } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const control = "mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "competitors", user.id);
  const rows = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Marketing analyst", "市场分析")}
        title={tr(locale, "Watch only", "只观察")}
        lede={tr(
          locale,
          "This desk never likes, comments, follows, or messages. It is a list of accounts and your notes.",
          "这个角色不会点赞、评论、关注或发消息。它只是一份账号和你的笔记。",
        )}
      />
      <form action={saveCompetitor} className="mb-8 grid max-w-3xl gap-3 rounded-[8px] border border-border bg-card p-4 sm:grid-cols-2">
        <label className="text-sm">
          {tr(locale, "Platform", "平台")}
          <select className={control} name="platform" defaultValue="tiktok">
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
        </label>
        <label className="text-sm">
          {tr(locale, "Handle", "账号")}
          <input className={control} name="handle" placeholder="@name" required />
        </label>
        <label className="text-sm sm:col-span-2">
          {tr(locale, "Name", "名称")}
          <input className={control} name="displayName" required />
        </label>
        <label className="text-sm sm:col-span-2">
          {tr(locale, "Notes", "笔记")}
          <textarea className="mt-1 min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" name="notes" />
        </label>
        <div>
          <SubmitButton>{tr(locale, "Add to the watchlist", "加入观察名单")}</SubmitButton>
        </div>
      </form>
      <div className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr(locale, "The list is empty.", "名单是空的。")}</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="rounded-[8px] border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{row.platform} · {tr(locale, "watch only", "只观察")}</p>
                <h2 className="text-lg">{row.displayName}</h2>
                <p className="text-sm">{row.handle}</p>
              </div>
              <form action={deleteCompetitor}>
                <input type="hidden" name="id" value={row.id} />
                <SubmitButton variant="ghost">{tr(locale, "Remove", "移除")}</SubmitButton>
              </form>
            </div>
            {row.notes ? <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{row.notes}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
