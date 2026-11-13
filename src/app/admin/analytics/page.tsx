import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Flash } from "@/components/flash";
import { prisma } from "@/lib/db";
import { ensureDemoAnalytics } from "@/lib/ensure-analytics";
import { tr } from "@/lib/i18n";
import { llmStatus } from "@/lib/llm";
import { reportForWorkspaces } from "@/lib/analytics-report";
import { getLocale } from "@/server/guard";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; range?: string }>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  if (llmStatus().mode === "mock") await ensureDemoAnalytics(prisma);
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  const report = await reportForWorkspaces(prisma, workspaces.map((workspace) => workspace.id), sp.range);
  return (
    <div>
      <Flash locale={locale} error={sp.error} notice={sp.notice} />
      <AnalyticsDashboard
        locale={locale}
        report={report}
        hrefBase="/admin/analytics"
        title={tr(locale, "All workspaces", "全部工作区")}
        lede={tr(
          locale,
          "Followers, views, and credits added across every workspace. Demo series fill in only for the seeded slugs.",
          "把每个工作区的粉丝、播放和点数加在一起。模拟序列只补已种下的那几个工作区。",
        )}
      />
    </div>
  );
}
