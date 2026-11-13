"use server";

import { revalidatePath } from "next/cache";
import { TenantIsolationError } from "@/lib/access";
import { prisma } from "@/lib/db";
import { disconnectIntegration, finishMockConnect, saveGoogleSettings } from "@/server/integrations";
import { logActivity } from "@/server/audit";
import { memberIdsFor, requireUser } from "@/server/guard";
import { go } from "@/server/nav";
import { studioContext } from "@/server/context";

export async function allowMockConnection(formData: FormData) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  try {
    await finishMockConnect(user, ids, String(formData.get("provider") ?? ""), String(formData.get("state") ?? ""));
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio/connections", { error: "forbidden" });
    go("/studio/connections", { error: "integration" });
  }
  revalidatePath("/studio/connections");
  go("/studio/connections", { notice: "connected" });
}

export async function disconnectConnection(formData: FormData) {
  const { user, workspace } = await studioContext();
  const ids = await memberIdsFor(user.id);
  try {
    await disconnectIntegration(user, ids, workspace.id, String(formData.get("provider") ?? ""));
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio/connections", { error: "forbidden" });
    throw error;
  }
  revalidatePath("/studio/connections");
  go("/studio/connections", { notice: "disconnected" });
}

export async function saveConnectionTargets(formData: FormData) {
  const { user, workspace } = await studioContext();
  const ids = await memberIdsFor(user.id);
  try {
    await saveGoogleSettings(user, ids, workspace.id, String(formData.get("driveFolderId") ?? ""), String(formData.get("sheetId") ?? ""));
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio/connections", { error: "forbidden" });
    go("/studio/connections", { error: "integration" });
  }
  revalidatePath("/studio/connections");
  go("/studio/connections", { notice: "saved" });
}

export async function saveToDrive(formData: FormData) {
  const { workspace } = await studioContext();
  const itemId = String(formData.get("itemId") ?? "");
  const row = await prisma.integration.findUnique({ where: { workspaceId_provider: { workspaceId: workspace.id, provider: "google" } } });
  if (!row || row.status !== "connected") go(`/studio/pipeline/${itemId}`, { error: "integration" });
  const settings = JSON.parse(row.settings || "{}") as { driveFolderId?: string };
  const folder = settings.driveFolderId || "folder_deliverables";
  await logActivity({
    workspaceId: workspace.id,
    role: "editor",
    code: "saved_to_drive",
    detail: `${itemId} · ${folder} · mock`,
  });
  revalidatePath(`/studio/pipeline/${itemId}`);
  go(`/studio/pipeline/${itemId}`, { notice: "saved_drive" });
}
