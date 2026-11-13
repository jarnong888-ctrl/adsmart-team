import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { assessHealth, recommend, shouldRefresh, type RecommendationDraft } from "@/lib/recommendations";
import { buildUsageProfile, type UsageProfile } from "@/lib/usage";
import { llmStatus, generateObject } from "@/lib/llm";

function profile(overrides: Partial<UsageProfile> = {}): UsageProfile {
  return {
    now: "2026-11-10",
    planCode: "growth",
    videosPerWeekLimit: 12,
    videosThisWeek: 12,
    videosLast30: 20,
    ageDays: 40,
    daysSinceLastActivity: 0,
    analyticsConsent: true,
    approvalsLast14: 3,
    postsQueuedLast14: 4,
    postsApprovedLast14: 2,
    platformsUsed: ["instagram", "tiktok"],
    featuresUsed30: PLANS.growth.features.filter((feature) => feature !== "competitors"),
    planFeatures: PLANS.growth.features,
    pendingApprovals: 2,
    offersText:
      "RM29.90 3-hour online class. RM399 1-day class. Consultation and projects. Adsmart plugin.",
    industry: "AI adoption consulting for Malaysian SMEs",
    followerBaseline: 78,
    followerLatest: 96,
    viewsLatest: 8400,
    goalFollowers: 10000,
    goalHorizonDays: 182,
    elapsedDays: 7,
    requiredDaily: (10000 - 78) / 182,
    actualDaily: (96 - 78) / 7,
    pillarViews: {
      mindset: { views: 1250, posts: 3 },
      practical: { views: 5100, posts: 3 },
      trends: { views: 1300, posts: 2 },
    },
    ...overrides,
  };
}

function codes(drafts: RecommendationDraft[]) {
  return drafts.map((draft) => draft.code);
}

describe("recommendation rules", () => {
  it("tells a full Growth workspace to move to Studio and fix the pace", () => {
    const drafts = recommend(profile());
    expect(codes(drafts)).toEqual(["upgrade_studio", "pace_behind", "pillar_shift"]);
    const pace = drafts.find((draft) => draft.code === "pace_behind");
    expect(pace?.bodyEn).toContain("55");
    expect(pace?.bodyEn).toContain("2.6");
    expect(codes(drafts).some((code) => code.startsWith("offer_"))).toBe(false);
  });

  it("treats a quiet bakery as churn and offers the RM29.90 class", () => {
    const drafts = recommend(
      profile({
        planCode: "starter",
        videosPerWeekLimit: 8,
        videosThisWeek: 0,
        videosLast30: 1,
        ageDays: 30,
        daysSinceLastActivity: 18,
        offersText: "Weekend cake preorders and catering.",
        industry: "Bakery and café, Shah Alam",
        planFeatures: PLANS.starter.features,
        featuresUsed30: [],
        platformsUsed: ["facebook"],
        elapsedDays: 20,
        requiredDaily: 10,
        actualDaily: 0.2,
        followerBaseline: 400,
        followerLatest: 410,
        goalFollowers: 2000,
        pillarViews: {
          mindset: { views: 0, posts: 0 },
          practical: { views: 0, posts: 0 },
          trends: { views: 0, posts: 0 },
        },
      }),
    );
    expect(codes(drafts)).toContain("restart_cadence");
    expect(codes(drafts)).toContain("offer_class_29");
    expect(codes(drafts)).not.toContain("upgrade_growth");
    expect(assessHealth(profile({
      planCode: "starter",
      videosPerWeekLimit: 8,
      videosThisWeek: 0,
      videosLast30: 1,
      ageDays: 30,
      daysSinceLastActivity: 18,
    })).health).toBe("churn_risk");
  });

  it("upsells a retail store that is hitting Starter and has no plugin", () => {
    const drafts = recommend(
      profile({
        planCode: "starter",
        videosPerWeekLimit: 8,
        videosThisWeek: 8,
        videosLast30: 16,
        planFeatures: PLANS.starter.features,
        featuresUsed30: ["strategist", "scriptwriter", "schedule"],
        industry: "Retail fashion, Shopify store",
        offersText: "Ready-to-wear batik, RM89 to RM220.",
        elapsedDays: 40,
        requiredDaily: 20,
        actualDaily: 8,
        followerBaseline: 1200,
        followerLatest: 1480,
        goalFollowers: 5000,
      }),
    );
    expect(codes(drafts)).toContain("upgrade_growth");
    expect(codes(drafts)).toContain("offer_plugin");
  });

  it("suggests a downgrade when a large plan is barely used", () => {
    const drafts = recommend(
      profile({
        planCode: "studio",
        videosPerWeekLimit: 20,
        videosThisWeek: 1,
        videosLast30: 4,
        ageDays: 60,
        daysSinceLastActivity: 3,
        elapsedDays: 3,
        requiredDaily: 0,
        actualDaily: 0,
        offersText: "General services.",
        industry: "Services",
        planFeatures: PLANS.studio.features,
        featuresUsed30: [...PLANS.studio.features],
        pillarViews: {
          mindset: { views: 0, posts: 0 },
          practical: { views: 0, posts: 0 },
          trends: { views: 0, posts: 0 },
        },
      }),
    );
    expect(codes(drafts)).toEqual(["downgrade_starter"]);
  });

  it("does not score or recommend a workspace that refused analytics consent", () => {
    const quiet = profile({ analyticsConsent: false, daysSinceLastActivity: null, ageDays: 40 });
    expect(assessHealth(quiet)).toEqual({ health: "no_consent", signals: ["no_consent"] });
    expect(recommend(quiet)).toEqual([]);
  });

  it("does not resend a recommendation that went out this week", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    expect(shouldRefresh([], "upgrade_studio", now)).toBe("create");
    expect(
      shouldRefresh(
        [{ code: "upgrade_studio", status: "draft", createdAt: new Date("2026-11-09T00:00:00Z") }],
        "upgrade_studio",
        now,
      ),
    ).toBe("update");
    expect(
      shouldRefresh(
        [{ code: "upgrade_studio", status: "sent", createdAt: new Date("2026-11-09T00:00:00Z") }],
        "upgrade_studio",
        now,
      ),
    ).toBe("skip");
    expect(
      shouldRefresh(
        [{ code: "upgrade_studio", status: "sent", createdAt: new Date("2026-11-01T00:00:00Z") }],
        "upgrade_studio",
        now,
      ),
    ).toBe("create");
    expect(
      shouldRefresh(
        [{ code: "upgrade_studio", status: "dismissed", createdAt: new Date("2026-11-09T00:00:00Z") }],
        "upgrade_studio",
        now,
      ),
    ).toBe("create");
  });
});

describe("usage profile", () => {
  it("counts this week's videos in Kuala Lumpur time and ignores other platforms' followers", () => {
    const profileResult = buildUsageProfile({
      now: new Date("2026-11-10T02:00:00Z"),
      workspace: {
        planCode: "growth",
        createdAt: new Date("2026-10-01T00:00:00Z"),
        goalFollowers: 10000,
        goalPlatform: "tiktok",
        goalHorizonDays: 182,
        baselineFollowers: 78,
        baselineOn: "2026-11-03",
        offers: "",
        industry: "consulting",
        analyticsConsent: true,
      },
      events: [
        {
          kind: "content_generated",
          feature: "strategist",
          platform: "tiktok",
          quantity: 12,
          createdAt: new Date("2026-11-09T01:00:00Z"),
        },
        {
          kind: "content_generated",
          feature: "strategist",
          platform: "tiktok",
          quantity: 9,
          createdAt: new Date("2026-11-08T10:00:00Z"),
        },
        {
          kind: "content_generated",
          feature: "strategist",
          quantity: 4,
          platform: "",
          createdAt: new Date("2026-10-20T02:00:00Z"),
        },
      ],
      snapshots: [
        { platform: "facebook", followers: 5000, views: 10, recordedOn: "2026-11-10" },
        { platform: "tiktok", followers: 96, views: 8400, recordedOn: "2026-11-10" },
      ],
      items: [{ pillar: "practical", performanceViews: 100 }],
      pendingApprovals: 1,
    });
    expect(profileResult.videosThisWeek).toBe(12);
    expect(profileResult.videosLast30).toBe(25);
    expect(profileResult.followerLatest).toBe(96);
    expect(profileResult.elapsedDays).toBe(7);
    expect(profileResult.daysSinceLastActivity).toBe(1);
  });
});

describe("llm module", () => {
  it("stays on mock mode without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_API_KEY;
    process.env.LLM_MODE = "live";
    expect(llmStatus().mode).toBe("mock");
    process.env.LLM_MODE = "mock";
    const result = await generateObject({
      system: "test",
      user: "test",
      mock: () => ({ ok: true }),
      parse: (raw) => raw as { ok: boolean },
    });
    expect(result).toMatchObject({ mode: "mock", provider: "mock", data: { ok: true } });
  });
});
