import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/i18n";
import { generateScript, generateScriptsForPlan } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "scriptwriter", user.id);
  const plans = await prisma.contentPlan.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { weekStart: "desc" },
    include: { items: { orderBy: [{ dayIndex: "asc" }, { slot: "asc" }] } },
  });

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <PageHeader
        eyebrow={tr(locale, "Scriptwriter", "编剧")}
        title={tr(locale, "Short scripts, after the week is approved", "周计划批准之后，才写短脚本")}
        lede={tr(
          locale,
          "Thirty seconds, timecoded, with a hook, a comment keyword, sources, and flags for demo, fact-check, or a commercial disclosure. Mandarin, English, or Malay.",
          "三十秒，带时间码、钩子、评论关键词、来源，以及演示、待核实或商业披露的标记。中文、英文或马来文。",
        )}
      />
      <div className="space-y-8">
        {plans.map((plan) => {
          const waiting = plan.items.filter((item) => item.status === "plan_approved");
          return (
            <section key={plan.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold">{plan.title}</h2>
                {plan.status === "approved" && waiting.length > 0 ? (
                  <form action={generateScriptsForPlan}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <SubmitButton>{tr(locale, `Write ${waiting.length} scripts`, `写 ${waiting.length} 条脚本`)}</SubmitButton>
                  </form>
                ) : null}
              </div>
              <ul className="mt-3 divide-y divide-border rounded-[8px] border border-border bg-card">
                {plan.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <Link href={`/studio/pipeline/${item.id}`} className="text-sm underline">{item.title}</Link>
                      <div className="mt-1"><StatusBadge locale={locale} status={item.status} /></div>
                    </div>
                    {item.status === "plan_approved" ? (
                      <form action={generateScript} className="flex items-center gap-2">
                        <input type="hidden" name="itemId" value={item.id} />
                        <select name="language" defaultValue={item.language} className="h-9 rounded-lg border border-input bg-card px-2 text-sm">
                          <option value="zh">中文</option>
                          <option value="en">English</option>
                          <option value="ms">Bahasa Melayu</option>
                        </select>
                        <SubmitButton>{tr(locale, "Write", "写")}</SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
