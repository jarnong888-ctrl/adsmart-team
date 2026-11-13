import fs from "fs";
import { PrismaClient, type Workspace } from "@prisma/client";
import { hashSync } from "bcryptjs";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}
import { addDays, kualaLumpurDate, mondayOf, mytDateTime } from "../src/lib/dates";
import { draftRecord, recommend } from "../src/lib/recommendations";
import { publisherForPlatform } from "../src/lib/publishers";
import { buildBrief, buildRepurpose, buildScript, buildWeek, strategyFromWorkspace, type CalendarItemDraft } from "../src/lib/team";
import { DEFAULT_COSTS, DEFAULT_PACKAGES } from "../src/lib/credit-catalog";
import { ensureDemoAnalytics } from "../src/lib/ensure-analytics";
import { buildUsageProfile, type UsageEventInput } from "../src/lib/usage";

const prisma = new PrismaClient();
const now = new Date();
const today = kualaLumpurDate(now);
const weekStart = mondayOf(today);

const demoEmails = [
  "demo@adsmart.my",
  "owner@kedairasa.example",
  "hello@batikandco.example",
  "admin@adsmart.my",
];

function atDaysAgo(days: number) {
  return new Date(`${addDays(today, -days)}T02:30:00.000Z`);
}

async function resetDemoUsers() {
  const users = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    include: { memberships: true },
  });
  const workspaceIds = users.flatMap((user) => user.memberships.map((member) => member.workspaceId));
  if (workspaceIds.length) {
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  }
  if (users.length) {
    await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
  }
}

async function main() {
  await resetDemoUsers();
  const clientPassword = hashSync("studio-demo", 10);
  const adminPassword = hashSync("studio-admin", 10);

  const jarnoUser = await prisma.user.create({
    data: {
      email: "demo@adsmart.my",
      name: "Jarno Ng",
      passwordHash: clientPassword,
      platformRole: "client",
      locale: "zh",
      analyticsConsent: true,
    },
  });
  const kedaiUser = await prisma.user.create({
    data: {
      email: "owner@kedairasa.example",
      name: "Aina Rahman",
      passwordHash: clientPassword,
      platformRole: "client",
      locale: "zh",
      analyticsConsent: true,
      createdAt: atDaysAgo(32),
    },
  });
  const batikUser = await prisma.user.create({
    data: {
      email: "hello@batikandco.example",
      name: "Hafiz Tan",
      passwordHash: clientPassword,
      platformRole: "client",
      locale: "en",
      analyticsConsent: true,
      createdAt: atDaysAgo(55),
    },
  });
  await prisma.user.create({
    data: {
      email: "admin@adsmart.my",
      name: "Adsmart Staff",
      passwordHash: adminPassword,
      platformRole: "admin",
      locale: "en",
      analyticsConsent: true,
    },
  });

  const jarno = await makeWorkspace(jarnoUser.id, {
    name: "Jarno Ng",
    slug: "jarnong",
    industry: "帮马来西亚中小企业用上 AI",
    audience: "讲华语的中小企业老板",
    offers:
      "RM29.90 三小时线上课，接着 RM399 一日课，然后是咨询和项目。Adsmart 插件给有自己网店的商家。",
    tone: "直接、能照做、稍微有一点劲",
    primaryLanguage: "zh",
    handle: "@jarnong",
    platforms: JSON.stringify(["tiktok", "instagram", "facebook"]),
    goalFollowers: 10000,
    goalPlatform: "tiktok",
    goalHorizonDays: 182,
    baselineFollowers: 78,
    baselineOn: addDays(today, -7),
    postingCapacity: 12,
    mixMindset: 40,
    mixPractical: 40,
    mixTrends: 20,
    softSellRatio: 30,
    planCode: "growth",
    analyticsConsent: true,
    createdAt: atDaysAgo(45),
  });

  const kedai = await makeWorkspace(kedaiUser.id, {
    name: "Kedai Rasa",
    slug: "kedai-rasa",
    industry: "莎阿南的面包店和咖啡馆",
    audience: "莎阿南一带的家庭和公司团购",
    offers: "周末蛋糕预订和到会。还没有上课。",
    tone: "暖和、具体",
    primaryLanguage: "zh",
    handle: "@kedairasa.demo",
    platforms: JSON.stringify(["facebook", "instagram"]),
    goalFollowers: 2000,
    goalPlatform: "facebook",
    goalHorizonDays: 180,
    baselineFollowers: 400,
    baselineOn: addDays(today, -20),
    postingCapacity: 4,
    mixMindset: 20,
    mixPractical: 60,
    mixTrends: 20,
    softSellRatio: 40,
    planCode: "starter",
    analyticsConsent: true,
    createdAt: atDaysAgo(32),
  });

  const batik = await makeWorkspace(batikUser.id, {
    name: "Batik & Co",
    slug: "batik-and-co",
    industry: "Retail fashion, Shopify store, Klang Valley",
    audience: "Women in Klang Valley buying ready-to-wear batik",
    offers: "Ready-to-wear batik, RM89 to RM220, shipped from Shah Alam.",
    tone: "Concrete, product-first",
    primaryLanguage: "en",
    handle: "@batikandco.demo",
    platforms: JSON.stringify(["instagram", "tiktok"]),
    goalFollowers: 5000,
    goalPlatform: "instagram",
    goalHorizonDays: 180,
    baselineFollowers: 1200,
    baselineOn: addDays(today, -40),
    postingCapacity: 8,
    mixMindset: 20,
    mixPractical: 60,
    mixTrends: 20,
    softSellRatio: 50,
    planCode: "starter",
    analyticsConsent: true,
    createdAt: atDaysAgo(55),
  });

  const jarnoEvents = await seedJarnoWeek(jarno, jarnoUser.id);
  const kedaiEvents = await seedQuietWeek(kedai);
  const batikEvents = await seedRetailWeek(batik, batikUser.id);

  await seedRecommendations(jarno, jarnoEvents, {
    pace_behind: "sent",
    upgrade_studio: "draft",
    pillar_shift: "draft",
  });
  await seedRecommendations(kedai, kedaiEvents, {});
  await seedRecommendations(batik, batikEvents, { upgrade_growth: "sent" });
  await seedCredits(jarnoUser.id, [jarno, kedai, batik]);
  await ensureDemoAnalytics(prisma);

  console.log("Seeded Adsmart Team demo.");
  console.log("Client  demo@adsmart.my              / studio-demo");
  console.log("Quiet   owner@kedairasa.example      / studio-demo");
  console.log("Retail  hello@batikandco.example     / studio-demo");
  console.log("Staff   admin@adsmart.my             / studio-admin");
}

async function makeWorkspace(userId: string, data: Omit<Parameters<typeof prisma.workspace.create>[0]["data"], "members" | "slug"> & { slug: string }) {
  return prisma.workspace.create({
    data: {
      ...data,
      members: { create: { userId, role: "owner" } },
    },
  });
}

const pastScript = ["script_ready", "repurposed", "brief_ready", "queued", "schedule_approved", "published"];
const pastRepurpose = ["repurposed", "brief_ready", "queued", "schedule_approved", "published"];
const pastBrief = ["brief_ready", "queued", "schedule_approved", "published"];

async function seedJarnoWeek(workspace: Workspace, approverId: string) {
  const input = strategyFromWorkspace(workspace, weekStart);
  const week = buildWeek(input);
  const stages = [
    "plan_approved",
    "plan_approved",
    "script_ready",
    "script_ready",
    "repurposed",
    "repurposed",
    "brief_ready",
    "brief_ready",
    "queued",
    "queued",
    "schedule_approved",
    "published",
  ];
  const plan = await prisma.contentPlan.create({
    data: {
      workspaceId: workspace.id,
      weekStart,
      title: week.title,
      rationale: week.rationale,
      status: "approved",
      approvedAt: atDaysAgo(1),
      approvedById: approverId,
      capacity: week.items.length,
      mixMindset: input.mixMindset,
      mixPractical: input.mixPractical,
      mixTrends: input.mixTrends,
      softSellRatio: input.softSellRatio,
    },
  });
  const viewCycle: Record<string, number[]> = {
    practical: [1800, 2400, 1100, 900],
    mindset: [420, 360, 510, 280],
    trends: [640, 710, 300],
  };
  const used: Record<string, number> = { practical: 0, mindset: 0, trends: 0 };

  for (let index = 0; index < week.items.length; index += 1) {
    const item = week.items[index];
    const status = stages[index] ?? "plan_approved";
    const views = viewCycle[item.pillar][used[item.pillar] % viewCycle[item.pillar].length];
    used[item.pillar] += 1;
    const created = await prisma.contentItem.create({
      data: {
        workspaceId: workspace.id,
        planId: plan.id,
        ...itemFields(item, workspace.platforms),
        status,
        performanceViews: views,
      },
    });
    const script = pastScript.includes(status) ? buildScript(item, input) : null;
    if (script) {
      await prisma.script.create({ data: { contentItemId: created.id, ...script } });
    }
    if (script && pastRepurpose.includes(status)) {
      await prisma.repurposePack.create({ data: { contentItemId: created.id, ...buildRepurpose(item, script) } });
    }
    if (script && pastBrief.includes(status)) {
      await prisma.editBrief.create({
        data: {
          contentItemId: created.id,
          ...buildBrief(item, script),
          rawVideoName: status === "published" ? "jarnong-week-raw-12.mp4" : "",
        },
      });
    }
    if (status === "queued" || status === "schedule_approved" || status === "published") {
      await queueSeed(workspace.id, created.id, item, status, approverId);
    }
  }

  const events: UsageEventInput[] = [
    { kind: "content_generated", feature: "strategist", platform: "tiktok", quantity: 12, createdAt: now },
    { kind: "plan_approved", feature: "strategist", platform: "tiktok", quantity: 1, createdAt: atDaysAgo(1) },
    { kind: "script_generated", feature: "scriptwriter", platform: "tiktok", quantity: 10, createdAt: now },
    { kind: "repurposed", feature: "repurposer", platform: "instagram", quantity: 8, createdAt: now },
    { kind: "brief_created", feature: "editor", platform: "tiktok", quantity: 6, createdAt: now },
    { kind: "post_queued", feature: "schedule", platform: "tiktok", quantity: 4, createdAt: now },
    { kind: "post_approved", feature: "schedule", platform: "tiktok", quantity: 2, createdAt: now },
    { kind: "post_published", feature: "schedule", platform: "tiktok", quantity: 1, createdAt: now },
    { kind: "analytics_entered", feature: "analytics", platform: "tiktok", quantity: 1, createdAt: now },
    { kind: "feature_used", feature: "export", platform: "", quantity: 1, createdAt: atDaysAgo(2) },
    { kind: "feature_used", feature: "cmo", platform: "", quantity: 1, createdAt: now },
    { kind: "feature_used", feature: "competitors", platform: "tiktok", quantity: 1, createdAt: atDaysAgo(40) },
  ];
  await prisma.usageEvent.createMany({
    data: events.map((event) => ({ ...event, workspaceId: workspace.id, actorUserId: "", feature: event.feature ?? "", platform: event.platform ?? "" })),
  });
  await prisma.analyticsSnapshot.createMany({
    data: [
      { workspaceId: workspace.id, platform: "tiktok", followers: 78, views: 1200, recordedOn: addDays(today, -7), note: "Baseline, the day the 10k goal started.", source: "manual" },
      { workspaceId: workspace.id, platform: "tiktok", followers: 96, views: 8400, recordedOn: today, note: "Still early. Views are moving faster than follows.", source: "manual" },
      { workspaceId: workspace.id, platform: "instagram", followers: 40, views: 900, recordedOn: today, note: "", source: "manual" },
      { workspaceId: workspace.id, platform: "facebook", followers: 120, views: 600, recordedOn: today, note: "", source: "manual" },
    ],
  });
  await prisma.competitor.createMany({
    data: [
      {
        workspaceId: workspace.id,
        platform: "tiktok",
        handle: "@contoh.sme.my",
        displayName: "Contoh SME",
        notes: "Demo watchlist entry. Replace with a real account before anyone relies on it. Watch only — this desk never likes, comments, or messages.",
        watchOnly: true,
      },
      {
        workspaceId: workspace.id,
        platform: "instagram",
        handle: "@kelas.demo.my",
        displayName: "Kelas demo",
        notes: "Illustrative neighbouring educator. Note what they teach in the first three seconds. Do not engage.",
        watchOnly: true,
      },
    ],
  });
  await prisma.activity.createMany({
    data: [
      { workspaceId: workspace.id, role: "strategist", code: "plan_generated", detail: week.title },
      { workspaceId: workspace.id, role: "client", code: "plan_approved", detail: week.title },
      { workspaceId: workspace.id, role: "scriptwriter", code: "script_written", detail: "10 条" },
      { workspaceId: workspace.id, role: "repurposer", code: "repurposed", detail: "8 份" },
      { workspaceId: workspace.id, role: "editor", code: "brief_ready", detail: "6 份" },
      { workspaceId: workspace.id, role: "social", code: "post_queued", detail: "4 条待批" },
      { workspaceId: workspace.id, role: "client", code: "post_approved", detail: "tiktok" },
      { workspaceId: workspace.id, role: "social", code: "post_published", detail: "tiktok 模拟" },
      { workspaceId: workspace.id, role: "analytics", code: "analytics_saved", detail: "tiktok 96" },
      { workspaceId: workspace.id, role: "cmo", code: "recommendation_sent", detail: "pace_behind" },
    ],
  });
  return events;
}

async function seedQuietWeek(workspace: Workspace) {
  const input = strategyFromWorkspace(workspace, mondayOf(addDays(today, -18)));
  const week = buildWeek({ ...input, capacity: 1, mixMindset: 0, mixPractical: 100, mixTrends: 0, softSellRatio: 0 });
  const plan = await prisma.contentPlan.create({
    data: {
      workspaceId: workspace.id,
      weekStart: input.weekStart,
      title: week.title,
      rationale: week.rationale,
      status: "pending_approval",
      capacity: 1,
      mixMindset: 0,
      mixPractical: 100,
      mixTrends: 0,
      softSellRatio: 0,
      createdAt: atDaysAgo(18),
    },
  });
  await prisma.contentItem.create({
    data: {
      workspaceId: workspace.id,
      planId: plan.id,
      ...itemFields(week.items[0], workspace.platforms),
      status: "planned",
      createdAt: atDaysAgo(18),
    },
  });
  const events: UsageEventInput[] = [
    { kind: "content_generated", feature: "strategist", platform: "facebook", quantity: 1, createdAt: atDaysAgo(18) },
  ];
  await prisma.usageEvent.createMany({
    data: events.map((event) => ({ ...event, workspaceId: workspace.id, feature: event.feature ?? "", platform: event.platform ?? "" })),
  });
  await prisma.analyticsSnapshot.create({
    data: {
      workspaceId: workspace.id,
      platform: "facebook",
      followers: 410,
      views: 300,
      recordedOn: addDays(today, -18),
      note: "Last number anyone typed in.",
      source: "manual",
    },
  });
  return events;
}

async function seedRetailWeek(workspace: Workspace, approverId: string) {
  const input = strategyFromWorkspace(workspace, weekStart);
  const week = buildWeek({ ...input, capacity: 8 });
  const plan = await prisma.contentPlan.create({
    data: {
      workspaceId: workspace.id,
      weekStart,
      title: week.title,
      rationale: week.rationale,
      status: "approved",
      approvedAt: atDaysAgo(1),
      approvedById: approverId,
      capacity: 8,
      mixMindset: input.mixMindset,
      mixPractical: input.mixPractical,
      mixTrends: input.mixTrends,
      softSellRatio: input.softSellRatio,
    },
  });
  for (const item of week.items) {
    const views = item.pillar === "practical" ? 2200 : item.pillar === "trends" ? 700 : 400;
    await prisma.contentItem.create({
      data: {
        workspaceId: workspace.id,
        planId: plan.id,
        ...itemFields(item, workspace.platforms),
        status: "script_ready",
        performanceViews: views,
      },
    });
  }
  const items = await prisma.contentItem.findMany({ where: { planId: plan.id } });
  for (const item of items) {
    const draft: CalendarItemDraft = {
      dayIndex: item.dayIndex,
      slot: item.slot,
      pillar: item.pillar === "practical" || item.pillar === "trends" ? item.pillar : "mindset",
      title: item.title,
      angle: item.angle,
      hook: item.hook,
      cta: item.cta,
      commentKeyword: item.commentKeyword,
      softSell: item.softSell,
      language: "en",
    };
    await prisma.script.create({ data: { contentItemId: item.id, ...buildScript(draft, input) } });
  }
  const events: UsageEventInput[] = [
    { kind: "content_generated", feature: "strategist", platform: "instagram", quantity: 8, createdAt: now },
    { kind: "plan_approved", feature: "strategist", platform: "instagram", quantity: 1, createdAt: atDaysAgo(1) },
    { kind: "script_generated", feature: "scriptwriter", platform: "instagram", quantity: 8, createdAt: now },
    { kind: "feature_used", feature: "schedule", platform: "instagram", quantity: 1, createdAt: atDaysAgo(3) },
  ];
  await prisma.usageEvent.createMany({
    data: events.map((event) => ({ ...event, workspaceId: workspace.id, feature: event.feature ?? "", platform: event.platform ?? "" })),
  });
  await prisma.analyticsSnapshot.createMany({
    data: [
      { workspaceId: workspace.id, platform: "instagram", followers: 1200, views: 4000, recordedOn: addDays(today, -40), note: "Baseline", source: "manual" },
      { workspaceId: workspace.id, platform: "instagram", followers: 1480, views: 22000, recordedOn: today, note: "Product videos are doing the work.", source: "manual" },
    ],
  });
  return events;
}

function itemFields(item: CalendarItemDraft, platforms: string) {
  return {
    dayIndex: item.dayIndex,
    slot: item.slot,
    pillar: item.pillar,
    title: item.title,
    angle: item.angle,
    hook: item.hook,
    cta: item.cta,
    commentKeyword: item.commentKeyword,
    softSell: item.softSell,
    language: item.language,
    platforms,
  };
}

async function queueSeed(workspaceId: string, itemId: string, item: CalendarItemDraft, status: string, approverId: string) {
  const platforms = status === "published" ? ["tiktok"] : ["tiktok", "instagram"];
  const day = addDays(weekStart, item.dayIndex);
  for (let index = 0; index < platforms.length; index += 1) {
    const platform = platforms[index];
    const entryStatus = status === "queued" ? "pending_approval" : status === "published" ? "published" : "approved";
    await prisma.scheduleEntry.create({
      data: {
        workspaceId,
        contentItemId: itemId,
        platform,
        scheduledFor: mytDateTime(day, index === 0 ? 12 : 19, 30),
        caption: `${item.hook}\n\n${item.cta}`,
        status: entryStatus,
        approvedAt: entryStatus === "pending_approval" ? null : atDaysAgo(0),
        approvedById: entryStatus === "pending_approval" ? "" : approverId,
        publisherKey: publisherForPlatform(platform).key,
        externalId: entryStatus === "published" ? `tiktok_stub_${itemId.slice(0, 8)}` : "",
        publishResult: entryStatus === "published" ? "演示数据：已批准后的模拟发布。" : "",
      },
    });
  }
}

async function seedCredits(actorUserId: string, workspaces: Workspace[]) {
  for (const row of DEFAULT_PACKAGES) {
    await prisma.creditPackage.upsert({ where: { code: row.code }, create: row, update: {} });
  }
  for (const row of DEFAULT_COSTS) {
    await prisma.creditCost.upsert({ where: { action: row.action }, create: row, update: {} });
  }
  for (const workspace of workspaces) {
    await prisma.creditWallet.create({ data: { workspaceId: workspace.id, balance: 40 } });
    await prisma.creditLedger.create({
      data: {
        workspaceId: workspace.id,
        delta: 40,
        balanceAfter: 40,
        kind: "grant",
        packageCode: "free",
        action: "allowance",
        note: "monthly",
      },
    });
  }
  const jarno = workspaces.find((workspace) => workspace.slug === "jarnong");
  if (!jarno) return;
  const payment = await prisma.payment.create({
    data: {
      workspaceId: jarno.id,
      provider: "mock",
      status: "paid",
      amountMyrCents: 4900,
      credits: 200,
      packageCode: "intermediate",
      externalId: "mock_seed_intermediate",
      detail: "Seeded placeholder purchase. No card was charged.",
    },
  });
  const spends = [
    { action: "generate_week", credits: 10 },
    { action: "write_script", credits: 4 },
    { action: "write_script", credits: 4 },
    { action: "write_script", credits: 4 },
    { action: "repurpose", credits: 3 },
  ];
  let balance = 240;
  await prisma.creditLedger.create({
    data: {
      workspaceId: jarno.id,
      delta: 200,
      balanceAfter: balance,
      kind: "purchase",
      packageCode: "intermediate",
      action: "purchase",
      actorUserId,
      paymentId: payment.id,
      note: payment.externalId,
    },
  });
  for (const spend of spends) {
    balance -= spend.credits;
    await prisma.creditLedger.create({
      data: {
        workspaceId: jarno.id,
        delta: -spend.credits,
        balanceAfter: balance,
        kind: "spend",
        action: spend.action,
        actorUserId,
      },
    });
  }
  await prisma.creditWallet.update({ where: { workspaceId: jarno.id }, data: { balance } });
}

async function seedRecommendations(
  workspace: Workspace,
  events: UsageEventInput[],
  sent: Record<string, "sent" | "draft">,
) {
  const snapshots = await prisma.analyticsSnapshot.findMany({ where: { workspaceId: workspace.id } });
  const items = await prisma.contentItem.findMany({
    where: { workspaceId: workspace.id },
    select: { pillar: true, performanceViews: true },
  });
  const profile = buildUsageProfile({
    now,
    workspace,
    events,
    snapshots,
    items,
    pendingApprovals: 0,
  });
  const drafts = recommend(profile);
  if (!drafts.length) return;
  await prisma.recommendation.createMany({
    data: drafts.map((draft) => {
      const record = draftRecord(draft, workspace.primaryLanguage);
      const status = sent[draft.code] ?? "draft";
      return {
        ...record,
        workspaceId: workspace.id,
        status,
        sentAt: status === "sent" ? now : null,
        reviewedById: status === "sent" ? "seed" : "",
      };
    }),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
