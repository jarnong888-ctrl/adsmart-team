import { NextResponse } from "next/server";
import { TenantIsolationError, assertCanAccessWorkspace } from "@/lib/access";
import { prisma } from "@/lib/db";
import { memberIdsFor, requireUser } from "@/server/guard";
import { resolveWorkspaces } from "@/server/guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const { current } = await resolveWorkspaces(user.id);
  const workspaceId = url.searchParams.get("workspaceId") || current?.id;
  if (!workspaceId) return NextResponse.json({ error: "missing" }, { status: 400 });
  const ids = await memberIdsFor(user.id);
  try {
    assertCanAccessWorkspace(user, workspaceId, ids);
  } catch (error) {
    if (error instanceof TenantIsolationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw error;
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      plans: { include: { items: { include: { script: true, repurpose: true, brief: true, schedule: true } } } },
      snapshots: true,
      competitors: true,
      activities: true,
      usageEvents: true,
      recommendations: true,
    },
  });
  if (!workspace) return NextResponse.json({ error: "missing" }, { status: 404 });
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      note: "Personal data export for this workspace. Usage events are included only if they were stored. This file can contain client business information.",
      workspace,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="adsmart-${workspace.slug}-export.json"`,
    },
  });
}
