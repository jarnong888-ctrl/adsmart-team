import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ensureDemoAnalytics } from "@/lib/ensure-analytics";

describe("ensureDemoAnalytics", () => {
  beforeAll(async () => {
    await prisma.workspace.deleteMany({ where: { slug: "jarnong" } });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { slug: "jarnong" } });
  });

  it("inserts the series once and does not duplicate it", async () => {
    const workspace = await prisma.workspace.create({
      data: { name: "Analytics", slug: "jarnong", baselineFollowers: 78, goalFollowers: 10000, goalHorizonDays: 182, baselineOn: "2026-11-03" },
    });
    const first = await ensureDemoAnalytics(prisma);
    const second = await ensureDemoAnalytics(prisma);
    const count = await prisma.analyticsSnapshot.count({ where: { workspaceId: workspace.id, source: "demo_series" } });
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    expect(count).toBe(90 * 4);
    await prisma.workspace.delete({ where: { id: workspace.id } });
  });
});