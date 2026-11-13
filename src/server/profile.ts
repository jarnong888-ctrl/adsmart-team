import "server-only";
import { prisma } from "@/lib/db";
import { buildUsageProfile } from "@/lib/usage";

export async function loadUsageProfile(workspaceId: string, now = new Date()) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const [events, snapshots, items, pendingPosts, pendingPlans] = await Promise.all([
    prisma.usageEvent.findMany({ where: { workspaceId } }),
    prisma.analyticsSnapshot.findMany({ where: { workspaceId } }),
    prisma.contentItem.findMany({
      where: { workspaceId },
      select: { pillar: true, performanceViews: true },
    }),
    prisma.scheduleEntry.count({ where: { workspaceId, status: "pending_approval" } }),
    prisma.contentPlan.count({ where: { workspaceId, status: { in: ["pending_approval", "changes_requested"] } } }),
  ]);
  return {
    workspace,
    profile: buildUsageProfile({
      now,
      workspace,
      events,
      snapshots,
      items,
      pendingApprovals: pendingPosts + pendingPlans,
    }),
    pendingPosts,
    pendingPlans,
  };
}
