import { NextResponse } from "next/server";
import { TenantIsolationError, assertCanAccessWorkspace } from "@/lib/access";
import { addDays } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { toCsv, toXlsx, type ScriptExportRow } from "@/lib/export-sheet";
import { track } from "@/server/audit";
import { memberIdsFor, requireUser } from "@/server/guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const planId = url.searchParams.get("planId") ?? "";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const plan = await prisma.contentPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        orderBy: [{ dayIndex: "asc" }, { slot: "asc" }],
        include: { script: true },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "missing" }, { status: 404 });
  const ids = await memberIdsFor(user.id);
  try {
    assertCanAccessWorkspace(user, plan.workspaceId, ids);
  } catch (error) {
    if (error instanceof TenantIsolationError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw error;
  }
  const rows: ScriptExportRow[] = plan.items.map((item) => ({
    date: addDays(plan.weekStart, item.dayIndex),
    pillar: item.pillar,
    title: item.title,
    language: item.language,
    hook: item.hook,
    cta: item.cta,
    commentKeyword: item.commentKeyword,
    softSell: item.softSell ? "yes" : "no",
    flags: item.script?.flags ?? "",
    sources: item.script?.sources ?? "",
    script: item.script?.body ?? "",
    status: item.status,
  }));
  await track({
    workspaceId: plan.workspaceId,
    actorUserId: user.id,
    kind: "feature_used",
    feature: "export",
  });
  if (format === "xlsx") {
    const buffer = await toXlsx(rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="adsmart-week-${plan.weekStart}.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adsmart-week-${plan.weekStart}.csv"`,
    },
  });
}
