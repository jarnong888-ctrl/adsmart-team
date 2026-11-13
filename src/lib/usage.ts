import { paceReport } from "@/lib/analytics";
import { daysBetween, kualaLumpurDate, mondayOf } from "@/lib/dates";
import { asPlanCode, planByCode, type Feature, type PlanCode } from "@/lib/plans";

export type UsageEventInput = {
  kind: string;
  feature?: string | null;
  platform?: string | null;
  quantity: number;
  createdAt: Date;
};

export type PillarViews = {
  views: number;
  posts: number;
};

export type UsageProfile = {
  now: string;
  planCode: PlanCode;
  videosPerWeekLimit: number;
  videosThisWeek: number;
  videosLast30: number;
  ageDays: number;
  daysSinceLastActivity: number | null;
  analyticsConsent: boolean;
  approvalsLast14: number;
  postsQueuedLast14: number;
  postsApprovedLast14: number;
  platformsUsed: string[];
  featuresUsed30: string[];
  planFeatures: Feature[];
  pendingApprovals: number;
  offersText: string;
  industry: string;
  followerBaseline: number;
  followerLatest: number;
  viewsLatest: number;
  goalFollowers: number;
  goalHorizonDays: number;
  elapsedDays: number;
  requiredDaily: number;
  actualDaily: number;
  pillarViews: Record<"mindset" | "practical" | "trends", PillarViews>;
};

function withinDays(eventDay: string, today: string, days: number) {
  const gap = daysBetween(eventDay, today);
  return gap >= 0 && gap < days;
}

export function buildUsageProfile(input: {
  now: Date;
  workspace: {
    planCode: string;
    createdAt: Date;
    goalFollowers: number;
    goalPlatform: string;
    goalHorizonDays: number;
    baselineFollowers: number;
    baselineOn: string;
    offers: string;
    industry: string;
    analyticsConsent: boolean;
  };
  events: UsageEventInput[];
  snapshots: { platform: string; followers: number; views: number; recordedOn: string }[];
  items: { pillar: string; performanceViews: number }[];
  pendingApprovals: number;
}): UsageProfile {
  const today = kualaLumpurDate(input.now);
  const weekStart = mondayOf(today);
  const createdOn = kualaLumpurDate(input.workspace.createdAt);
  const plan = planByCode(input.workspace.planCode);
  const eventDays = input.events.map((event) => kualaLumpurDate(event.createdAt));
  const lastEvent = eventDays.sort().at(-1) ?? null;

  let videosThisWeek = 0;
  let videosLast30 = 0;
  let approvalsLast14 = 0;
  let postsQueuedLast14 = 0;
  let postsApprovedLast14 = 0;
  const platforms = new Set<string>();
  const features = new Set<string>();

  input.events.forEach((event) => {
    const day = kualaLumpurDate(event.createdAt);
    if (event.kind === "content_generated") {
      if (day >= weekStart && day <= today) videosThisWeek += event.quantity;
      if (withinDays(day, today, 30)) videosLast30 += event.quantity;
    }
    if (withinDays(day, today, 14)) {
      if (event.kind === "plan_approved" || event.kind === "post_approved") approvalsLast14 += event.quantity;
      if (event.kind === "post_queued") postsQueuedLast14 += event.quantity;
      if (event.kind === "post_approved") postsApprovedLast14 += event.quantity;
    }
    if (withinDays(day, today, 30)) {
      if (event.platform) platforms.add(event.platform);
      if (event.feature) features.add(event.feature);
    }
  });

  const platformSnapshots = input.snapshots
    .filter((snapshot) => snapshot.platform === input.workspace.goalPlatform)
    .slice()
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const latest = platformSnapshots.at(-1);
  const baselineOn = input.workspace.baselineOn || createdOn;
  const elapsedDays = Math.max(0, daysBetween(baselineOn, today));
  const pace = paceReport({
    baseline: input.workspace.baselineFollowers,
    latest: latest?.followers ?? input.workspace.baselineFollowers,
    goal: input.workspace.goalFollowers,
    horizonDays: input.workspace.goalHorizonDays,
    elapsedDays,
  });

  const pillarViews: UsageProfile["pillarViews"] = {
    mindset: { views: 0, posts: 0 },
    practical: { views: 0, posts: 0 },
    trends: { views: 0, posts: 0 },
  };
  for (const item of input.items) {
    if (item.pillar === "mindset" || item.pillar === "practical" || item.pillar === "trends") {
      pillarViews[item.pillar].views += item.performanceViews;
      if (item.performanceViews > 0) pillarViews[item.pillar].posts += 1;
    }
  }

  return {
    now: today,
    planCode: asPlanCode(input.workspace.planCode),
    videosPerWeekLimit: plan.videosPerWeek,
    videosThisWeek,
    videosLast30,
    ageDays: Math.max(0, daysBetween(createdOn, today)),
    daysSinceLastActivity: lastEvent ? daysBetween(lastEvent, today) : null,
    analyticsConsent: input.workspace.analyticsConsent,
    approvalsLast14,
    postsQueuedLast14,
    postsApprovedLast14,
    platformsUsed: [...platforms].sort(),
    featuresUsed30: [...features].sort(),
    planFeatures: plan.features,
    pendingApprovals: input.pendingApprovals,
    offersText: input.workspace.offers,
    industry: input.workspace.industry,
    followerBaseline: input.workspace.baselineFollowers,
    followerLatest: latest?.followers ?? input.workspace.baselineFollowers,
    viewsLatest: latest?.views ?? 0,
    goalFollowers: input.workspace.goalFollowers,
    goalHorizonDays: input.workspace.goalHorizonDays,
    elapsedDays,
    requiredDaily: pace.requiredDaily,
    actualDaily: pace.actualDaily,
    pillarViews,
  };
}
