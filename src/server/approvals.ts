import "server-only";
import { assertClientCanApprove, type Actor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { assertFactCheckAcknowledged, isDueForStubPublish, listFactFlags, PipelineError } from "@/lib/pipeline";
import { publishThroughGate } from "@/lib/publishers";
import { logActivity } from "@/server/audit";

export async function recordPlanApproval(
  actor: Actor,
  planId: string,
  membershipWorkspaceIds: readonly string[],
) {
  const plan = await prisma.contentPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new PipelineError("Plan not found.");
  assertClientCanApprove(actor, plan.workspaceId, membershipWorkspaceIds);
  if (plan.status === "approved") throw new PipelineError("This week is already approved.");
  return prisma.contentPlan.update({
    where: { id: plan.id },
    data: { status: "approved", approvedAt: new Date(), approvedById: actor.id },
  });
}

export async function recordPostApproval(
  actor: Actor,
  entryId: string,
  membershipWorkspaceIds: readonly string[],
) {
  const entry = await prisma.scheduleEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new PipelineError("Post not found.");
  assertClientCanApprove(actor, entry.workspaceId, membershipWorkspaceIds);
  if (entry.status !== "pending_approval" && entry.status !== "unscheduled") {
    throw new PipelineError("This post is not waiting for approval.");
  }
  const siblings = await prisma.scheduleEntry.findMany({
    where: { contentItemId: entry.contentItemId, status: { in: ["pending_approval", "unscheduled"] } },
  });
  const approvedAt = new Date();
  await prisma.scheduleEntry.updateMany({
    where: { id: { in: siblings.map((row) => row.id) } },
    data: { status: "approved", approvedAt, approvedById: actor.id },
  });
  return prisma.scheduleEntry.findMany({ where: { id: { in: siblings.map((row) => row.id) } } });
}

export async function unschedulePosts(actor: Actor, entryId: string, membershipWorkspaceIds: readonly string[], now = new Date()) {
  const entry = await prisma.scheduleEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new PipelineError("Post not found.");
  assertClientCanApprove(actor, entry.workspaceId, membershipWorkspaceIds);
  const siblings = await prisma.scheduleEntry.findMany({
    where: { contentItemId: entry.contentItemId, status: "approved" },
  });
  const waiting = siblings.filter((row) => row.scheduledFor.getTime() > now.getTime());
  if (waiting.length === 0) throw new PipelineError("This post can no longer be unscheduled.");
  await prisma.scheduleEntry.updateMany({
    where: { id: { in: waiting.map((row) => row.id) } },
    data: { status: "unscheduled", approvedAt: null, approvedById: "" },
  });
  return waiting;
}

export async function rejectPendingPlatforms(actor: Actor, entryId: string, membershipWorkspaceIds: readonly string[]) {
  const entry = await prisma.scheduleEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new PipelineError("Post not found.");
  assertClientCanApprove(actor, entry.workspaceId, membershipWorkspaceIds);
  await prisma.scheduleEntry.updateMany({
    where: { contentItemId: entry.contentItemId, status: "pending_approval" },
    data: { status: "rejected", approvedAt: null, approvedById: "" },
  });
}

export async function recordScriptApproval(
  actor: Actor,
  itemId: string,
  membershipWorkspaceIds: readonly string[],
  acknowledged: boolean,
) {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId }, include: { script: true } });
  if (!item?.script) throw new PipelineError("Script not found.");
  assertClientCanApprove(actor, item.workspaceId, membershipWorkspaceIds);
  assertFactCheckAcknowledged(item.script.flags, item.script.body, acknowledged);
  const approvedAt = new Date();
  const needsAck = acknowledged && (item.script.flags.includes("NEEDS_FACT_CHECK") || item.script.body.includes("【待核实】"));
  const updated = await prisma.script.update({
    where: { id: item.script.id },
    data: {
      approvedAt,
      approvedById: actor.id,
      factCheckAcknowledgedAt: needsAck ? approvedAt : null,
    },
  });
  if (needsAck) {
    const listed = listFactFlags(item.script.body, item.script.flags)
      .map((flag) => `${flag.where}: ${flag.quote}`)
      .join(" | ");
    await logActivity({
      workspaceId: item.workspaceId,
      role: "client",
      code: "fact_check_acknowledged",
      detail: `${item.title} · ${actor.id} · ${listed}`,
    });
  }
  return updated;
}

export async function releaseDuePosts(workspaceId: string, now = new Date()) {
  const candidates = await prisma.scheduleEntry.findMany({
    where: { workspaceId, status: "approved", scheduledFor: { lte: now } },
  });
  const due = candidates.filter((entry) => isDueForStubPublish(entry, now));
  for (const entry of due) {
    const receipt = await publishThroughGate(
      { status: entry.status },
      {
        workspaceId: entry.workspaceId,
        entryId: entry.id,
        platform: entry.platform,
        caption: entry.caption,
        scheduledFor: entry.scheduledFor.toISOString(),
      },
    );
    await prisma.scheduleEntry.update({
      where: { id: entry.id },
      data: {
        status: "published",
        publisherKey: receipt.publisher,
        externalId: receipt.externalId,
        publishResult: receipt.detail,
      },
    });
  }
  return due.map((entry) => entry.id);
}
