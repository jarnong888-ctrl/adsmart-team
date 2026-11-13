import { addDays } from "@/lib/dates";

export const ANALYTICS_PLATFORMS = ["tiktok", "instagram", "facebook", "youtube"] as const;
export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number];
export type AnalyticsRange = 7 | 30 | 90;

export type AnalyticsPoint = {
  date: string;
  platform: string;
  followers: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  publishedPosts: number;
};

export type MixSlice = { pillar: string; views: number; posts: number };
export type TopPost = { id: string; title: string; pillar: string; views: number; workspaceName?: string };

type Curve = { start: number; mid: number; end: number };

const CURVES: Record<string, Record<AnalyticsPlatform, Curve>> = {
  jarnong: {
    tiktok: { start: 62, mid: 78, end: 96 },
    instagram: { start: 18, mid: 28, end: 40 },
    facebook: { start: 80, mid: 100, end: 120 },
    youtube: { start: 8, mid: 12, end: 18 },
  },
  "kedai-rasa": {
    tiktok: { start: 420, mid: 418, end: 410 },
    instagram: { start: 260, mid: 255, end: 248 },
    facebook: { start: 890, mid: 880, end: 860 },
    youtube: { start: 40, mid: 39, end: 36 },
  },
  "batik-and-co": {
    tiktok: { start: 640, mid: 980, end: 1480 },
    instagram: { start: 900, mid: 1200, end: 1640 },
    facebook: { start: 300, mid: 420, end: 510 },
    youtube: { start: 70, mid: 110, end: 160 },
  },
};

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function followersAt(curve: Curve, offset: number) {
  if (offset >= -7) return lerp(curve.mid, curve.end, (offset + 7) / 7);
  return lerp(curve.start, curve.mid, (offset + 90) / 83);
}

export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  if (value === "7" || value === "90") return Number(value) as AnalyticsRange;
  return 30;
}

export function demoSeriesForSlug(slug: string, today: string): AnalyticsPoint[] {
  const curves = CURVES[slug];
  if (!curves) return [];
  const points: AnalyticsPoint[] = [];
  for (let offset = -89; offset <= 0; offset += 1) {
    const date = addDays(today, offset);
    for (const platform of ANALYTICS_PLATFORMS) {
      const followers = followersAt(curves[platform], offset);
      const views = Math.max(0, Math.round(followers * (platform === "tiktok" ? 42 : platform === "youtube" ? 18 : 12) + (90 + offset) * 20));
      const likes = Math.round(views * 0.045);
      const comments = Math.round(views * 0.006);
      const shares = Math.round(views * 0.004);
      const publishedPosts = offset % 3 === 0 ? 1 : 0;
      points.push({ date, platform, followers, views, likes, comments, shares, publishedPosts });
    }
  }
  return points;
}

export type AnalyticsReport = {
  range: AnalyticsRange;
  followers: number;
  followerGrowth: number;
  expectedGrowth: number;
  views: number;
  engagementRate: number;
  postsPublished: number;
  creditsUsed: number;
  creditsRemaining: number;
  trend: { date: string; followers: number; goal: number }[];
  platforms: { platform: string; followers: number; views: number; engagementRate: number }[];
  topPosts: TopPost[];
  mix: MixSlice[];
};

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function rate(likes: number, comments: number, shares: number, views: number) {
  if (views <= 0) return 0;
  return (likes + comments + shares) / views;
}

export function buildAnalyticsReport(input: {
  range: AnalyticsRange;
  today: string;
  goalPlatform: string;
  baselineFollowers: number;
  baselineOn: string;
  goalFollowers: number;
  goalHorizonDays: number;
  points: AnalyticsPoint[];
  posts: TopPost[];
  mix: MixSlice[];
  creditsUsed: number;
  creditsRemaining: number;
}): AnalyticsReport {
  const start = addDays(input.today, -(input.range - 1));
  const window = input.points.filter((point) => inRange(point.date, start, input.today));
  const goalPoints = window.filter((point) => point.platform === input.goalPlatform).sort((a, b) => a.date.localeCompare(b.date));
  const latest = goalPoints.at(-1);
  const first = goalPoints[0];
  const followers = latest?.followers ?? input.baselineFollowers;
  const followerGrowth = latest && first ? latest.followers - first.followers : 0;
  const horizon = Math.max(1, input.goalHorizonDays);
  const goalOn = (date: string) => {
    if (!input.baselineOn) return input.baselineFollowers;
    const elapsed = Math.max(0, Math.round((Date.parse(date) - Date.parse(input.baselineOn)) / 86400000));
    const t = Math.min(1, elapsed / horizon);
    return Math.round(input.baselineFollowers + (input.goalFollowers - input.baselineFollowers) * t);
  };
  const expectedGrowth = goalPoints.length > 1 ? goalOn(goalPoints.at(-1)!.date) - goalOn(goalPoints[0]!.date) : 0;
  const byPlatform = new Map<string, AnalyticsPoint[]>();
  for (const point of window) {
    const list = byPlatform.get(point.platform) ?? [];
    list.push(point);
    byPlatform.set(point.platform, list);
  }
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let postsPublished = 0;
  const platforms = ANALYTICS_PLATFORMS.map((platform) => {
    const rows = (byPlatform.get(platform) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const end = rows.at(-1);
    const begin = rows[0];
    const viewDelta = end && begin ? Math.max(0, end.views - begin.views) : 0;
    const likeDelta = end && begin ? Math.max(0, end.likes - begin.likes) : 0;
    const commentDelta = end && begin ? Math.max(0, end.comments - begin.comments) : 0;
    const shareDelta = end && begin ? Math.max(0, end.shares - begin.shares) : 0;
    views += viewDelta;
    likes += likeDelta;
    comments += commentDelta;
    shares += shareDelta;
    const published = rows.reduce((sum, row) => sum + row.publishedPosts, 0);
    postsPublished += published;
    return {
      platform,
      followers: end?.followers ?? 0,
      views: viewDelta,
      engagementRate: rate(likeDelta, commentDelta, shareDelta, viewDelta),
    };
  });
  return {
    range: input.range,
    followers,
    followerGrowth,
    expectedGrowth,
    views,
    engagementRate: rate(likes, comments, shares, views),
    postsPublished,
    creditsUsed: input.creditsUsed,
    creditsRemaining: input.creditsRemaining,
    trend: goalPoints.map((point) => ({ date: point.date, followers: point.followers, goal: goalOn(point.date) })),
    platforms,
    topPosts: input.posts.slice(0, 5),
    mix: input.mix,
  };
}
