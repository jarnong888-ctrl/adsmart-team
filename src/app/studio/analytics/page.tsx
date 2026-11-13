import Link from "next/link";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { kualaLumpurDate } from "@/lib/dates";
import { ensureDemoAnalytics } from "@/lib/ensure-analytics";
import { tr } from "@/lib/i18n";
import { llmStatus } from "@/lib/llm";
import { reportForWorkspaces } from "@/lib/analytics-report";
import { saveSnapshot } from "@/server/studio-actions";
import { markDesk } from "@/server/audit";
import { studioContext } from "@/server/context";

const control = "mt-1 h-10 w-full rounded-[6px] border border-[#DCE1DE] bg-white px-3 text-[14px]";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; range?: string }>;
}) {
  const { user, locale, workspace } = await studioContext();
  const sp = await searchParams;
  await markDesk(workspace.id, "analytics", user.id);
  if (llmStatus().mode === "mock") await ensureDemoAnalytics(prisma);
  const report = await reportForWorkspaces(prisma, [workspace.id], sp.range);
  const links = await prisma.integration.findMany({ where: { workspaceId: workspace.id, status: "connected" }, select: { provider: true } });
  const linked = new Set(links.map((row) => row.provider));
  const missingSocial = [
    ["tiktok", "TikTok"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["youtube", "YouTube"],
  ].filter(([id]) => !linked.has(id));
  const today = kualaLumpurDate(new Date());

  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <AnalyticsDashboard
        locale={locale}
        report={report}
        hrefBase="/studio/analytics"
        title={tr(locale, "Analytics", "数据")}
        lede={tr(
          locale,
          "Mock series in demo mode. The same fields are what a live connector would write later.",
          "演示模式用的是模拟序列。以后接真实数据，写的也是同样这些字段。",
        )}
      />
      {missingSocial.length ? (
        <p className="mt-3 text-[13px] text-[#5E6B65]">
          {tr(locale, "Mock series.", "模拟序列。")}{" "}
          <Link href="/studio/connections" className="font-medium text-[#14201B] underline">{tr(locale, "Connect accounts", "连接账号")}</Link>
        </p>
      ) : null}
      <details className="mt-6 rounded-[8px] border border-[#E4E8E5] bg-white p-4">
        <summary className="cursor-pointer text-[14px] font-medium">{tr(locale, "Add a manual count", "手填一笔数据")}</summary>
        <form action={saveSnapshot} className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
          <label className="text-[13px]">
            {tr(locale, "Platform", "平台")}
            <select className={control} name="platform" defaultValue={workspace.goalPlatform}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label className="text-[13px]">
            {tr(locale, "Date", "日期")}
            <input className={control} type="date" name="recordedOn" defaultValue={today} required />
          </label>
          <label className="text-[13px]">
            {tr(locale, "Followers", "粉丝")}
            <input className={`${control} nums`} type="number" name="followers" min={0} defaultValue={report.followers} />
          </label>
          <label className="text-[13px]">
            {tr(locale, "Views", "播放")}
            <input className={`${control} nums`} type="number" name="views" min={0} defaultValue={0} />
          </label>
          <label className="text-[13px] sm:col-span-2">
            {tr(locale, "Note", "备注")}
            <input className={control} name="note" placeholder={tr(locale, "Where this number came from", "这个数字从哪来")} />
          </label>
          <div>
            <SubmitButton>{tr(locale, "Save snapshot", "保存这笔数据")}</SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}
