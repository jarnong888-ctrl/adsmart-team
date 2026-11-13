import type { PrismaClient } from "@prisma/client";
import { buildAnalyticsReport, parseAnalyticsRange, type AnalyticsReport } from "@/lib/demo-analytics";
import { kualaLumpurDate, addDays } from "@/lib/dates";

export async function reportForWorkspaces(
  db: PrismaClient,
  workspaceIds: string[],
  rangeValue: string | undefined,
): Promise<AnalyticsReport> {
  const range = parseAnalyticsRange(rangeValue);
  const today = kualaLumpurDate(new Date());
  const start = addDays(today, -(range - 1));
  const workspaces = await db.workspace.findMany({ where: { id: { in: workspaceIds } } });
  const points = await db.analyticsSnapshot.findMany({
    where: { workspaceId: { in: workspaceIds }, recordedOn: { gte: addDays(today, -89), lte: today } },
  });
  const items = await db.contentItem.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: { id: true, title: true, pillar: true, performanceViews: true, workspaceId: true },
  });
  const names = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  const spends = await db.creditLedger.aggregate({
    where: { workspaceId: { in: workspaceIds }, kind: "spend", createdAt: { gte: new Date(`${start}T00:00:00.000Z`) } },
    _sum: { delta: true },
  });
  const wallets = await db.creditWallet.aggregate({
    where: { workspaceId: { in: workspaceIds } },
    _sum: { balance: true },
  });
  const primary = workspaces[0];
  const summed = new Map<string, { date: string; platform: string; followers: number; views: number; likes: number; comments: number; shares: number; publishedPosts: number }>();
  for (const point of points) {
    const key = `${point.recordedOn}|${point.platform}`;
    const current = summed.get(key) ?? {
      date: point.recordedOn,
      platform: point.platform,
      followers: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      publishedPosts: 0,
    };
    current.followers += point.followers;
    current.views += point.views;
    current.likes += point.likes;
    current.comments += point.comments;
    current.shares += point.shares;
    current.publishedPosts += point.publishedPosts;
    summed.set(key, current);
  }
  const mixMap = new Map<string, { views: number; posts: number }>();
  for (const item of items) {
    const current = mixMap.get(item.pillar) ?? { views: 0, posts: 0 };
    current.views += item.performanceViews;
    current.posts += 1;
    mixMap.set(item.pillar, current);
  }
  return buildAnalyticsReport({
    range,
    today,
    goalPlatform: primary?.goalPlatform ?? "tiktok",
    baselineFollowers: workspaces.reduce((sum, workspace) => sum + workspace.baselineFollowers, 0),
    baselineOn: primary?.baselineOn ?? "",
    goalFollowers: workspaces.reduce((sum, workspace) => sum + workspace.goalFollowers, 0),
    goalHorizonDays: primary?.goalHorizonDays ?? 182,
    points: [...summed.values()],
    posts: items
      .map((item) => ({
        id: item.id,
        title: item.title,
        pillar: item.pillar,
        views: item.performanceViews,
        workspaceName: workspaceIds.length > 1 ? names.get(item.workspaceId) : undefined,
      }))
      .sort((a, b) => b.views - a.views),
    mix: [...mixMap.entries()].map(([pillar, value]) => ({ pillar, ...value })),
    creditsUsed: Math.abs(spends._sum.delta ?? 0),
    creditsRemaining: wallets._sum.balance ?? 0,
  });
}
