import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashSync } from "bcryptjs";
import { ApprovalForbiddenError, TenantIsolationError } from "@/lib/access";
import { prisma } from "@/lib/db";
import { recordPlanApproval, recordPostApproval, recordScriptApproval, releaseDuePosts, unschedulePosts } from "@/server/approvals";
import { FactCheckAcknowledgementRequired } from "@/lib/pipeline";
import { getWorkspaceForActor, listWorkspaceIdsFor, visibleRecommendations } from "@/server/tenant";

const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emailA = `tenant-a-${stamp}@test.local`;
const emailB = `tenant-b-${stamp}@test.local`;
const emailAdmin = `tenant-admin-${stamp}@test.local`;

let userA: { id: string; platformRole: string };
let userB: { id: string; platformRole: string };
let admin: { id: string; platformRole: string };
let workspaceA: string;
let workspaceB: string;

beforeAll(async () => {
  const passwordHash = hashSync("test-password", 4);
  const createdA = await prisma.user.create({
    data: { email: emailA, name: "Tenant A", passwordHash, platformRole: "client" },
  });
  const createdB = await prisma.user.create({
    data: { email: emailB, name: "Tenant B", passwordHash, platformRole: "client" },
  });
  const createdAdmin = await prisma.user.create({
    data: { email: emailAdmin, name: "Staff", passwordHash, platformRole: "admin" },
  });
  const wsA = await prisma.workspace.create({
    data: {
      name: "Workspace A",
      slug: `ws-a-${stamp}`,
      analyticsConsent: true,
      members: { create: { userId: createdA.id, role: "owner" } },
    },
  });
  const wsB = await prisma.workspace.create({
    data: {
      name: "Workspace B",
      slug: `ws-b-${stamp}`,
      analyticsConsent: true,
      members: { create: { userId: createdB.id, role: "owner" } },
    },
  });
  await prisma.recommendation.createMany({
    data: [
      {
        workspaceId: wsA.id,
        status: "draft",
        category: "content_strategy",
        code: "pace_behind",
        title: "A draft",
        body: "Only staff should see this.",
        rationale: "rule",
      },
      {
        workspaceId: wsA.id,
        status: "sent",
        category: "plan_change",
        code: "upgrade_studio",
        title: "Sent to A",
        body: "Client A can see this.",
        rationale: "rule",
      },
      {
        workspaceId: wsB.id,
        status: "sent",
        category: "adsmart_offer",
        code: "offer_plugin",
        title: "Sent to B",
        body: "Client A must not see this.",
        rationale: "rule",
      },
    ],
  });
  userA = createdA;
  userB = createdB;
  admin = createdAdmin;
  workspaceA = wsA.id;
  workspaceB = wsB.id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceA, workspaceB] } } });
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB, emailAdmin] } } });
  await prisma.$disconnect();
});

describe("tenant isolation against the database", () => {
  it("returns only the caller's workspaces", async () => {
    const visibleA = await listWorkspaceIdsFor(userA);
    expect(visibleA).toContain(workspaceA);
    expect(visibleA).not.toContain(workspaceB);
    const visibleAdmin = await listWorkspaceIdsFor(admin);
    expect(visibleAdmin).toEqual(expect.arrayContaining([workspaceA, workspaceB]));
  });

  it("refuses a client read of another workspace", async () => {
    await expect(getWorkspaceForActor(userA, workspaceB)).rejects.toBeInstanceOf(TenantIsolationError);
    const own = await getWorkspaceForActor(userA, workspaceA);
    expect(own.id).toBe(workspaceA);
    const asStaff = await getWorkspaceForActor(admin, workspaceB);
    expect(asStaff.id).toBe(workspaceB);
  });

  it("records a workspace member's approval and rejects staff and other clients", async () => {
    const plan = await prisma.contentPlan.create({
      data: {
        workspaceId: workspaceA,
        weekStart: `gate-${stamp}`,
        title: "Approval gate week",
        rationale: "test",
        status: "pending_approval",
        capacity: 1,
        mixMindset: 40,
        mixPractical: 40,
        mixTrends: 20,
        softSellRatio: 0,
      },
    });
    const item = await prisma.contentItem.create({
      data: {
        workspaceId: workspaceA,
        planId: plan.id,
        dayIndex: 0,
        slot: 0,
        pillar: "practical",
        title: "Gate item",
        angle: "angle",
        hook: "hook",
        cta: "cta",
        commentKeyword: "yes",
        language: "en",
        platforms: "[\"tiktok\"]",
        status: "queued",
      },
    });
    const entry = await prisma.scheduleEntry.create({
      data: {
        workspaceId: workspaceA,
        contentItemId: item.id,
        platform: "tiktok",
        scheduledFor: new Date("2026-12-01T04:30:00.000Z"),
        caption: "caption",
        status: "pending_approval",
      },
    });

    await expect(recordPlanApproval(admin, plan.id, [workspaceA])).rejects.toBeInstanceOf(ApprovalForbiddenError);
    await expect(recordPostApproval(admin, entry.id, [workspaceA])).rejects.toBeInstanceOf(ApprovalForbiddenError);
    await expect(recordPlanApproval(userB, plan.id, [workspaceB])).rejects.toBeInstanceOf(ApprovalForbiddenError);
    await expect(recordPostApproval(userB, entry.id, [workspaceB])).rejects.toBeInstanceOf(ApprovalForbiddenError);

    const approvedPlan = await recordPlanApproval(userA, plan.id, [workspaceA]);
    const approvedPosts = await recordPostApproval(userA, entry.id, [workspaceA]);
    expect(approvedPlan.approvedById).toBe(userA.id);
    expect(approvedPlan.approvedAt).toBeInstanceOf(Date);
    expect(approvedPlan.status).toBe("approved");
    expect(approvedPosts[0]?.approvedById).toBe(userA.id);
    expect(approvedPosts[0]?.approvedAt).toBeInstanceOf(Date);
    expect(approvedPosts.every((row) => row.status === "approved")).toBe(true);

    const storedPlan = await prisma.contentPlan.findUniqueOrThrow({ where: { id: plan.id } });
    const storedPost = await prisma.scheduleEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(storedPlan.approvedById).toBe(userA.id);
    expect(storedPost.approvedById).toBe(userA.id);
    expect(storedPlan.status).toBe("approved");
    const early = await releaseDuePosts(workspaceA, new Date("2026-11-01T00:00:00.000Z"));
    expect(early).toEqual([]);
    expect((await prisma.scheduleEntry.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe("approved");
  });

  it("approves every platform of one video, and the stub waits for the planned time", async () => {
    const plan = await prisma.contentPlan.create({
      data: {
        workspaceId: workspaceA,
        weekStart: `multi-${stamp}`,
        title: "Multi",
        rationale: "test",
        status: "approved",
        capacity: 1,
        mixMindset: 0,
        mixPractical: 100,
        mixTrends: 0,
        softSellRatio: 0,
      },
    });
    const item = await prisma.contentItem.create({
      data: {
        workspaceId: workspaceA,
        planId: plan.id,
        dayIndex: 0,
        slot: 0,
        pillar: "trends",
        title: "Fact video",
        angle: "a",
        hook: "h",
        cta: "c",
        commentKeyword: "k",
        language: "zh",
        platforms: "[\"tiktok\",\"instagram\"]",
        status: "queued",
        script: {
          create: {
            language: "zh",
            hook: "h",
            body: "【待核实】数字",
            commentKeyword: "k",
            sources: "none",
            flags: "NEEDS_FACT_CHECK",
            durationSec: 30,
          },
        },
      },
    });
    const when = new Date("2026-12-02T04:30:00.000Z");
    const tiktok = await prisma.scheduleEntry.create({
      data: { workspaceId: workspaceA, contentItemId: item.id, platform: "tiktok", scheduledFor: when, caption: "t", status: "pending_approval" },
    });
    await prisma.scheduleEntry.create({
      data: { workspaceId: workspaceA, contentItemId: item.id, platform: "instagram", scheduledFor: when, caption: "i", status: "pending_approval" },
    });
    await prisma.scheduleEntry.create({
      data: { workspaceId: workspaceA, contentItemId: item.id, platform: "facebook", scheduledFor: when, caption: "f", status: "pending_approval" },
    });
    await expect(recordScriptApproval(admin, item.id, [workspaceA], true)).rejects.toBeInstanceOf(ApprovalForbiddenError);
    await expect(recordScriptApproval(userB, item.id, [workspaceB], true)).rejects.toBeInstanceOf(ApprovalForbiddenError);
    await expect(recordScriptApproval(userA, item.id, [workspaceA], false)).rejects.toBeInstanceOf(FactCheckAcknowledgementRequired);
    const script = await recordScriptApproval(userA, item.id, [workspaceA], true);
    expect(script.factCheckAcknowledgedAt).toBeInstanceOf(Date);
    expect(script.approvedById).toBe(userA.id);
    const logged = await prisma.activity.findFirst({ where: { workspaceId: workspaceA, code: "fact_check_acknowledged" } });
    expect(logged?.detail).toContain(userA.id);
    expect(logged?.detail).toContain("待核实");

    const approved = await recordPostApproval(userA, tiktok.id, [workspaceA]);
    expect(approved.map((row) => row.platform).sort()).toEqual(["facebook", "instagram", "tiktok"]);
    await expect(unschedulePosts(admin, tiktok.id, [workspaceA], new Date("2026-12-01T00:00:00.000Z"))).rejects.toBeInstanceOf(ApprovalForbiddenError);
    const cleared = await unschedulePosts(userA, tiktok.id, [workspaceA], new Date("2026-12-01T00:00:00.000Z"));
    expect(cleared).toHaveLength(3);
    expect(await releaseDuePosts(workspaceA, new Date("2026-12-02T04:30:00.000Z"))).not.toContain(tiktok.id);
    await recordPostApproval(userA, tiktok.id, [workspaceA]);
    expect(await releaseDuePosts(workspaceA, new Date("2026-12-01T00:00:00.000Z"))).toEqual([]);
    const published = await releaseDuePosts(workspaceA, new Date("2026-12-02T04:30:00.000Z"));
    expect(published).toContain(tiktok.id);
    const rows = await prisma.scheduleEntry.findMany({ where: { contentItemId: item.id } });
    expect(rows.every((row) => row.status === "published")).toBe(true);
  });

  it("shows a client only sent recommendations from their own workspace", async () => {
    const forA = await visibleRecommendations(userA);
    expect(forA.map((row) => row.title)).toEqual(["Sent to A"]);
    const forB = await visibleRecommendations(userB);
    expect(forB.map((row) => row.workspaceId)).toEqual([workspaceB]);
    const forAdmin = await visibleRecommendations(admin);
    const titles = forAdmin.map((row) => row.title);
    expect(titles).toEqual(expect.arrayContaining(["A draft", "Sent to A", "Sent to B"]));
  });
});
