import type { PrismaClient } from "@prisma/client";
import { kualaLumpurDate } from "@/lib/dates";
import { demoSeriesForSlug } from "@/lib/demo-analytics";

const DEMO_SLUGS = ["jarnong", "kedai-rasa", "batik-and-co"] as const;

export async function ensureDemoAnalytics(db: PrismaClient) {
  const today = kualaLumpurDate(new Date());
  const workspaces = await db.workspace.findMany({ where: { slug: { in: [...DEMO_SLUGS] } } });
  let inserted = 0;
  for (const workspace of workspaces) {
    const planned = demoSeriesForSlug(workspace.slug, today);
    if (planned.length === 0) continue;
    const existing = await db.analyticsSnapshot.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, platform: true, recordedOn: true, likes: true, views: true },
    });
    const have = new Set(existing.map((row) => `${row.platform}|${row.recordedOn}`));
    const missing = planned.filter((point) => !have.has(`${point.platform}|${point.date}`));
    if (missing.length) {
      await db.analyticsSnapshot.createMany({
        data: missing.map((point) => ({
          workspaceId: workspace.id,
          platform: point.platform,
          recordedOn: point.date,
          followers: point.followers,
          views: point.views,
          likes: point.likes,
          comments: point.comments,
          shares: point.shares,
          publishedPosts: point.publishedPosts,
          source: "demo_series",
          note: "",
        })),
      });
      inserted += missing.length;
    }
    const blank = existing.filter((row) => row.likes === 0 && row.views > 0);
    for (const row of blank) {
      const match = planned.find((point) => point.platform === row.platform && point.date === row.recordedOn);
      if (!match) continue;
      await db.analyticsSnapshot.update({
        where: { id: row.id },
        data: { likes: match.likes, comments: match.comments, shares: match.shares },
      });
    }
  }
  return inserted;
}
