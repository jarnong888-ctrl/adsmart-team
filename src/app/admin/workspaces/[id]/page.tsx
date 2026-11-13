import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { healthLabel, statusLabel, tr } from "@/lib/i18n";
import { recommendationCopy } from "@/lib/access";
import { assessHealth } from "@/lib/recommendations";
import { FEATURES } from "@/lib/plans";
import {
  adjustWorkspaceCredits,
  dismissRecommendation,
  polishRecommendation,
  refreshWorkspaceRecommendations,
  saveRecommendation,
  sendRecommendation,
} from "@/server/admin-actions";
import { ensureWallet } from "@/server/credits";
import { getLocale } from "@/server/guard";
import { loadUsageProfile } from "@/server/profile";

const control = "mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm";

export default async function AdminWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const locale = await getLocale();
  const { id } = await params;
  const sp = await searchParams;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: { members: { include: { user: true } } },
  });
  if (!workspace) notFound();
  const loaded = await loadUsageProfile(workspace.id);
  const health = assessHealth(loaded.profile);
  const recommendations = await prisma.recommendation.findMany({
    where: { workspaceId: workspace.id, status: { not: "dismissed" } },
    orderBy: { createdAt: "desc" },
  });
  const owner = workspace.members.find((member) => member.role === "owner")?.user;
  const wallet = await ensureWallet(workspace.id);
  const ledger = await prisma.creditLedger.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 8 });

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <Link href="/admin" className="text-sm text-muted-foreground underline">{tr(locale, "All workspaces", "全部工作区")}</Link>
      <PageHeader
        eyebrow={owner ? `${owner.name} · ${owner.email}` : workspace.planCode}
        title={workspace.name}
        lede={workspace.industry}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={health.health === "churn_risk" ? "destructive" : "outline"}>{healthLabel(locale, health.health)}</Badge>
        <span className="text-sm text-muted-foreground">{health.signals.join(" · ") || tr(locale, "No signals", "没有信号")}</span>
      </div>
      <section className="mb-6 rounded-[8px] border border-[#D5E3DD] bg-white p-4">
        <h2 className="text-[14px] font-semibold">{tr(locale, "Credits", "点数")}</h2>
        <p className="mt-1 text-[22px] font-semibold tabular-nums">{wallet.balance}</p>
        <form action={adjustWorkspaceCredits} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <label className="text-[13px]">
            {tr(locale, "Adjust by", "调整")}
            <input name="delta" type="number" required className="mt-1 block h-10 w-28 rounded-[6px] border border-[#C5D9D1] px-3" placeholder="+20" />
          </label>
          <label className="min-w-0 flex-1 text-[13px]">
            {tr(locale, "Note for the audit log", "写进审计记录的原因")}
            <input name="note" required minLength={3} className="mt-1 block h-10 w-full rounded-[6px] border border-[#C5D9D1] px-3" />
          </label>
          <SubmitButton>{tr(locale, "Apply", "确认")}</SubmitButton>
        </form>
        <ul className="mt-3 space-y-1 text-[13px] text-[#3D5C54]">
          {ledger.map((row) => (
            <li key={row.id}>{row.delta > 0 ? "+" : ""}{row.delta} · {row.kind} · {row.note || row.action}</li>
          ))}
        </ul>
      </section>
      <dl className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label={tr(locale, "Videos this week", "本周视频")} value={`${loaded.profile.videosThisWeek} / ${loaded.profile.videosPerWeekLimit}`} />
        <Stat label={tr(locale, "Last 30 days", "近 30 天")} value={String(loaded.profile.videosLast30)} />
        <Stat label={tr(locale, "Followers", "粉丝")} value={`${loaded.profile.followerLatest.toLocaleString()} / ${loaded.profile.goalFollowers.toLocaleString()}`} />
        <Stat label={tr(locale, "Pace / day", "每天速度")} value={`${loaded.profile.actualDaily.toFixed(1)} vs ${loaded.profile.requiredDaily.toFixed(0)}`} />
      </dl>
      <section className="mb-8">
        <h2 className="mb-2 text-xl">{tr(locale, "Desks in the last 30 days", "近 30 天用过的角色")}</h2>
        <ul className="flex flex-wrap gap-2">
          {FEATURES.map((feature) => {
            const included = loaded.profile.planFeatures.includes(feature);
            const used = loaded.profile.featuresUsed30.includes(feature);
            return (
              <li key={feature} className={`rounded-[4px] border px-2 py-1 text-[13px] font-medium ${used ? "border-[#C5E0D4] bg-[#E6F2ED] text-[#0B624C]" : included ? "border-[#EED6A3] bg-[#FDF6E7] text-[#B45309]" : "border-[#D5E3DD] text-[#3D5C54]"}`}>
                {feature} {included ? "" : tr(locale, "(not in plan)", "（方案不含）")} {used ? "" : included ? tr(locale, "unused", "未用") : ""}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {tr(locale, "Platforms touched", "用过的平台")}: {loaded.profile.platformsUsed.join(", ") || "—"}
          {" · "}
          {tr(locale, "Analytics consent", "分析同意")}: {workspace.analyticsConsent ? tr(locale, "yes", "有") : tr(locale, "no", "没有")}
        </p>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{tr(locale, "Recommendations", "建议")}</h2>
        <form action={refreshWorkspaceRecommendations}>
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <SubmitButton variant="outline">{tr(locale, "Refresh from rules", "按规则刷新")}</SubmitButton>
        </form>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tr(locale, "Rules decide the next step. Polish rewrites the words through the same model module and does not change the code. The client sees a card only after you send it.", "规则决定下一步。润色只改文字，走同一个模型模块，不改建议类型。你发出去之后，客户才看得到。")}
      </p>
      <div className="space-y-6">
        {recommendations.map((recommendation) => {
          const copy = recommendationCopy(recommendation, locale);
          return (
            <article key={recommendation.id} className="rounded-[8px] border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{recommendation.code}</Badge>
                <Badge variant="secondary">{statusLabel(locale, recommendation.status)}</Badge>
                <span className="text-xs text-muted-foreground">{recommendation.source} · {recommendation.severity}</span>
              </div>
              <h3 className="mt-2 text-lg">{copy.title}</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{copy.body}</p>
              <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">{recommendation.rationale}</p>
              <form action={saveRecommendation} className="mt-4 grid gap-3">
                <input type="hidden" name="id" value={recommendation.id} />
                <label className="text-sm">
                  {tr(locale, "Edited title", "修改后的标题")}
                  <input className={control} name="editedTitle" defaultValue={recommendation.editedTitle || recommendation.title} />
                </label>
                <label className="text-sm">
                  {tr(locale, "Edited body", "修改后的正文")}
                  <textarea className={`${control} min-h-28`} name="editedBody" defaultValue={recommendation.editedBody || recommendation.body} />
                </label>
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">{tr(locale, "Other language", "另一种语言")}</summary>
                  <div className="mt-3 grid gap-3">
                    <input className={control} name="editedTitleAlt" defaultValue={recommendation.editedTitleAlt || recommendation.titleAlt} />
                    <textarea className={`${control} min-h-24`} name="editedBodyAlt" defaultValue={recommendation.editedBodyAlt || recommendation.bodyAlt} />
                  </div>
                </details>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton variant="outline">{tr(locale, "Save edits", "保存修改")}</SubmitButton>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={polishRecommendation}>
                  <input type="hidden" name="id" value={recommendation.id} />
                  <SubmitButton variant="secondary">{tr(locale, "Polish with AI", "用 AI 润色")}</SubmitButton>
                </form>
                {recommendation.status !== "sent" ? (
                  <form action={sendRecommendation}>
                    <input type="hidden" name="id" value={recommendation.id} />
                    <SubmitButton>{tr(locale, "Send to client", "发给客户")}</SubmitButton>
                  </form>
                ) : null}
                <form action={dismissRecommendation}>
                  <input type="hidden" name="id" value={recommendation.id} />
                  <SubmitButton variant="ghost">{tr(locale, "Dismiss", "搁置")}</SubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
    </div>
  );
}
