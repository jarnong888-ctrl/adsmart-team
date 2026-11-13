import "server-only";
import { prisma } from "@/lib/db";
import { kualaLumpurDate } from "@/lib/dates";

export async function track(input: {
  workspaceId: string;
  actorUserId?: string;
  kind: string;
  feature?: string;
  platform?: string;
  quantity?: number;
  meta?: string;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { analyticsConsent: true },
  });
  if (!workspace?.analyticsConsent) return;
  await prisma.usageEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? "",
      kind: input.kind,
      feature: input.feature ?? "",
      platform: input.platform ?? "",
      quantity: input.quantity ?? 1,
      meta: input.meta ?? "{}",
    },
  });
}

export async function markDesk(workspaceId: string, feature: string, actorUserId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { analyticsConsent: true },
  });
  if (!workspace?.analyticsConsent) return;
  const start = new Date(`${kualaLumpurDate(new Date())}T00:00:00+08:00`);
  const existing = await prisma.usageEvent.findFirst({
    where: { workspaceId, feature, kind: "feature_used", createdAt: { gte: start } },
  });
  if (existing) return;
  await prisma.usageEvent.create({
    data: { workspaceId, actorUserId, kind: "feature_used", feature, quantity: 1 },
  });
}

export async function logActivity(input: {
  workspaceId: string;
  role: string;
  code: string;
  detail?: string;
}) {
  await prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      role: input.role,
      code: input.code,
      detail: input.detail ?? "",
    },
  });
}
