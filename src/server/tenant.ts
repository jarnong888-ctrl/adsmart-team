import "server-only";
import { assertCanAccessWorkspace, canSeeRecommendation, type Actor, TenantIsolationError } from "@/lib/access";
import { prisma } from "@/lib/db";

async function memberIds(userId: string) {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return rows.map((row) => row.workspaceId);
}

export async function listWorkspaceIdsFor(actor: Actor) {
  if (actor.platformRole === "admin") {
    const rows = await prisma.workspace.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }
  return memberIds(actor.id);
}

export async function getWorkspaceForActor(actor: Actor, workspaceId: string) {
  const ids = actor.platformRole === "admin" ? [] : await memberIds(actor.id);
  assertCanAccessWorkspace(actor, workspaceId, ids);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new TenantIsolationError("Workspace not found.");
  return workspace;
}

export async function visibleRecommendations(actor: Actor) {
  const memberships = actor.platformRole === "admin" ? [] : await memberIds(actor.id);
  const rows = await prisma.recommendation.findMany({
    where:
      actor.platformRole === "admin"
        ? {}
        : { workspaceId: { in: memberships }, status: "sent" },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((row) => canSeeRecommendation(actor, row, memberships));
}
