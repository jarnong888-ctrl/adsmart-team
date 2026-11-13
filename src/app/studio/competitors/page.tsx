import { Eye, Trash2, UserPlus } from "lucide-react";
import { EmptyPanel, Panel, Tag } from "@/components/kit";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PlatformMark } from "@/components/visual";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/dates";
import { PLATFORM_NAME } from "@/lib/display";
import { tr } from "@/lib/i18n";
import { deleteCompetitor, saveCompetitor } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const field = "mt-1.5 h-10 w-full rounded-[10px] border border-[#DCE1DE] bg-white px-3 text-[14px] outline-none focus:border-[#1E9A6E] focus:ring-3 focus:ring-[#1E9A6E]/15";
const labelCls = "block text-[13px] font-medium text-[#3F4C46]";

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; platform?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "competitors", user.id);
  const rows = await prisma.competitor.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
  const platforms = Array.from(new Set<string>(rows.map((row) => String(row.platform))));
  const filter = sp.platform && platforms.includes(sp.platform) ? sp.platform : null;
  const shown = filter ? rows.filter((row) => row.platform === filter) : rows;

  return (
    <div className="space-y-6">
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        title={tr(locale, "Insights", "观察")}
        lede={tr(locale, "A watchlist of accounts worth learning from, with your notes. Watch only: nothing here likes, comments, follows or messages.", "值得学习的账号和你的笔记。只观察：这里不会点赞、评论、关注或发消息。")}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={tr(locale, "Filter by platform", "按平台筛选")} className="flex flex-wrap gap-1.5">
              {[null, ...platforms].map((platform) => {
                const active = platform === filter;
                const count = platform ? rows.filter((row) => row.platform === platform).length : rows.length;
                return (
                  <a
                    key={platform ?? "all"}
                    href={platform ? `/studio/competitors?platform=${platform}` : "/studio/competitors"}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium ${active ? "border-[#14201B] bg-[#14201B] text-white" : "border-[#E4E8E5] bg-white hover:border-[#C9D0CC]"}`}
                  >
                    {platform ? PLATFORM_NAME[platform] ?? platform : tr(locale, "All", "全部")}
                    <span className={`nums rounded-full px-1.5 text-[11.5px] ${active ? "bg-white/20" : "bg-[#EEF1EF] text-[#3F4C46]"}`}>{count}</span>
                  </a>
                );
              })}
            </nav>
            <Tag><Eye className="size-3.5" aria-hidden />{tr(locale, "Watch only", "只观察")}</Tag>
          </div>

          {shown.length === 0 ? (
            <Panel>
              <EmptyPanel icon={Eye} title={tr(locale, "Your watchlist is empty", "观察名单是空的")} body={tr(locale, "Add accounts you want to learn from: competitors, creators in your niche, or brands you admire.", "加入想学习的账号：竞争对手、同领域的创作者或你欣赏的品牌。")} />
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {shown.map((row) => (
                <article key={row.id} className="flex flex-col rounded-[16px] border border-[#E4E8E5] bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#F1F5F2] text-[15px] font-semibold text-[#0B5A42]">
                      {row.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-cjk truncate text-[15.5px] font-semibold">{row.displayName}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#5E6B65]">
                        <PlatformMark platform={row.platform} />
                        <span className="truncate">{row.handle}</span>
                      </p>
                    </div>
                    <form action={deleteCompetitor}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" aria-label={tr(locale, `Remove ${row.displayName}`, `移除 ${row.displayName}`)} className="grid size-9 place-items-center rounded-[10px] text-[#7A8781] hover:bg-[#FEECEC] hover:text-[#9F1F15]">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </form>
                  </div>
                  {row.notes ? (
                    <p className="font-cjk mt-4 rounded-[10px] bg-[#F6F7F5] px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#3F4C46]">{row.notes}</p>
                  ) : (
                    <p className="mt-4 text-[13px] text-[#7A8781]">{tr(locale, "No notes yet.", "还没有笔记。")}</p>
                  )}
                  <p className="mt-3 text-[11.5px] text-[#7A8781]">{tr(locale, "Added", "加入于")} {formatWhen(row.createdAt, locale)}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-20">
          <Panel title={tr(locale, "Add an account", "添加账号")} subtitle={tr(locale, "Only you and your team see this list.", "只有你和团队能看到这份名单。")}>
            <form action={saveCompetitor} className="space-y-4 p-5">
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
                <label className={labelCls}>
                  {tr(locale, "Platform", "平台")}
                  <select className={field} name="platform" defaultValue="tiktok">
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </label>
                <label className={labelCls}>
                  {tr(locale, "Handle", "账号")}
                  <input className={field} name="handle" placeholder="@name" required />
                </label>
              </div>
              <label className={labelCls}>
                {tr(locale, "Name", "名称")}
                <input className={field} name="displayName" required />
              </label>
              <label className={labelCls}>
                {tr(locale, "Notes", "笔记")}
                <textarea className={`${field} h-auto min-h-28 py-2.5 leading-relaxed`} name="notes" placeholder={tr(locale, "What do they do well? Hooks, formats, posting times…", "他们哪里做得好？钩子、格式、发布时间…")} />
              </label>
              <SubmitButton className="w-full">
                <UserPlus className="size-4" aria-hidden />
                {tr(locale, "Add to watchlist", "加入观察名单")}
              </SubmitButton>
            </form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
