import { describe, expect, it } from "vitest";
import { buildAnalyticsReport, demoSeriesForSlug, parseAnalyticsRange } from "@/lib/demo-analytics";

describe("demo analytics", () => {
  it("builds a 90-day series for the seeded slugs, including YouTube", () => {
    const points = demoSeriesForSlug("jarnong", "2026-11-10");
    expect(points).toHaveLength(90 * 4);
    const todayTiktok = points.find((point) => point.date === "2026-11-10" && point.platform === "tiktok");
    const weekAgo = points.find((point) => point.date === "2026-11-03" && point.platform === "tiktok");
    expect(todayTiktok?.followers).toBe(96);
    expect(weekAgo?.followers).toBe(78);
    expect(points.some((point) => point.platform === "youtube")).toBe(true);
    expect(demoSeriesForSlug("unknown", "2026-11-10")).toEqual([]);
  });

  it("compares follower growth with the goal line inside the selected range", () => {
    const points = demoSeriesForSlug("jarnong", "2026-11-10");
    const report = buildAnalyticsReport({
      range: parseAnalyticsRange("7"),
      today: "2026-11-10",
      goalPlatform: "tiktok",
      baselineFollowers: 78,
      baselineOn: "2026-11-03",
      goalFollowers: 10000,
      goalHorizonDays: 182,
      points,
      posts: [{ id: "a", title: "A", pillar: "practical", views: 10 }],
      mix: [{ pillar: "practical", views: 10, posts: 1 }],
      creditsUsed: 4,
      creditsRemaining: 36,
    });
    expect(report.range).toBe(7);
    expect(report.followers).toBe(96);
    expect(report.followerGrowth).toBeGreaterThan(0);
    expect(report.expectedGrowth).toBeGreaterThan(report.followerGrowth);
    expect(report.platforms.map((row) => row.platform)).toEqual(["tiktok", "instagram", "facebook", "youtube"]);
    expect(report.trend.length).toBe(7);
    expect(report.creditsRemaining).toBe(36);
  });
});
