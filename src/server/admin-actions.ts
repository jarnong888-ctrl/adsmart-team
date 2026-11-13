"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, TenantIsolationError } from "@/lib/access";
import { InsufficientCreditsError } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { polishDraft } from "@/lib/polish";
import { draftRecord, recommend, shouldRefresh, type RecommendationDraft } from "@/lib/recommendations";
import { requireUser } from "@/server/guard";
import { loadUsageProfile } from "@/server/profile";
import { logActivity } from "@/server/audit";
import { adjustCredits, refundCredits, spendCredits } from "@/server/credits";
import { go, rethrowRedirect } from "@/server/nav";

function refresh() {
  revalidatePath("/studio", "layout");
  revalidatePath("/admin", "layout");
}

async function staff() {
  const user = await requireUser();
  try {
    assertAdmin(user);
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio", { error: "forbidden" });
    throw error;
  }
  return user;
}

export async function refreshWorkspaceRecommendations(formData: FormData) {
  await staff();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) go("/admin", { error: "missing" });
  const { profile } = await loadUsageProfile(workspace.id);
  const drafts = recommend(profile);
  const existing = await prisma.recommendation.findMany({ where: { workspaceId: workspace.id } });
  const now = new Date();
  for (const draft of drafts) {
    const action = shouldRefresh(
      existing
        .filter((row) => row.code === draft.code)
        .map((row) => ({ code: row.code, status: row.status, createdAt: row.createdAt })),
      draft.code,
      now,
    );
    if (action === "skip") continue;
    const data = draftRecord(draft, workspace.primaryLanguage);
    if (action === "update") {
      const current = existing.find((row) => row.code === draft.code && row.status === "draft");
      if (current) {
        await prisma.recommendation.update({ where: { id: current.id }, data });
      }
    } else {
      await prisma.recommendation.create({
        data: { ...data, workspaceId: workspace.id, status: "draft" },
      });
    }
  }
  refresh();
  go(`/admin/workspaces/${workspace.id}`, { notice: "refreshed" });
}

export async function saveRecommendation(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.recommendation.findUnique({ where: { id } });
  if (!row) go("/admin", { error: "missing" });
  await prisma.recommendation.update({
    where: { id },
    data: {
      editedTitle: String(formData.get("editedTitle") ?? "").slice(0, 180),
      editedBody: String(formData.get("editedBody") ?? "").slice(0, 2000),
      editedTitleAlt: String(formData.get("editedTitleAlt") ?? "").slice(0, 180),
      editedBodyAlt: String(formData.get("editedBodyAlt") ?? "").slice(0, 2000),
    },
  });
  refresh();
  go(`/admin/workspaces/${row.workspaceId}`, { notice: "saved" });
}

export async function polishRecommendation(formData: FormData) {
  const user = await staff();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.recommendation.findUnique({ where: { id }, include: { workspace: true } });
  if (!row) go("/admin", { error: "missing" });
  const draft: RecommendationDraft = {
    category: row.category as RecommendationDraft["category"],
    code: row.code,
    severity: row.severity as RecommendationDraft["severity"],
    titleEn: row.primaryLocale === "en" ? row.title : row.titleAlt,
    titleZh: row.primaryLocale === "zh" ? row.title : row.titleAlt,
    bodyEn: row.primaryLocale === "en" ? row.body : row.bodyAlt,
    bodyZh: row.primaryLocale === "zh" ? row.body : row.bodyAlt,
    rationaleEn: row.rationale,
    rationaleZh: row.rationale,
  };
  let spent = 0;
  try {
    spent = (await spendCredits(row.workspaceId, user.id, "polish_recommendation")).spent;
    const [en, zh] = await Promise.all([polishDraft(draft, "en"), polishDraft(draft, "zh")]);
    const primaryZh = row.primaryLocale !== "en";
    await prisma.recommendation.update({
      where: { id },
      data: {
        editedTitle: primaryZh ? zh.data.title : en.data.title,
        editedBody: primaryZh ? zh.data.body : en.data.body,
        editedTitleAlt: primaryZh ? en.data.title : zh.data.title,
        editedBodyAlt: primaryZh ? en.data.body : zh.data.body,
        source: en.mode === "live" ? "live" : "mock",
      },
    });
  } catch (error) {
    rethrowRedirect(error);
    if (spent > 0) await refundCredits(row.workspaceId, user.id, "polish_recommendation", spent);
    if (error instanceof InsufficientCreditsError) go(`/admin/workspaces/${row.workspaceId}`, { error: "credits" });
    console.error(error);
    go(`/admin/workspaces/${row.workspaceId}`, { error: "llm" });
  }
  refresh();
  go(`/admin/workspaces/${row.workspaceId}`, { notice: "polished" });
}

export async function sendRecommendation(formData: FormData) {
  const user = await staff();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.recommendation.findUnique({ where: { id } });
  if (!row) go("/admin", { error: "missing" });
  await prisma.recommendation.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), reviewedById: user.id },
  });
  await logActivity({
    workspaceId: row.workspaceId,
    role: "cmo",
    code: "recommendation_sent",
    detail: row.code,
  });
  refresh();
  go(`/admin/workspaces/${row.workspaceId}`, { notice: "sent" });
}

export async function saveCreditSettings(formData: FormData) {
  await staff();
  const action = String(formData.get("action") ?? "");
  const credits = Number(formData.get("credits"));
  if (!action || !Number.isInteger(credits) || credits < 0) go("/admin/billing", { error: "invalid" });
  await prisma.creditCost.update({ where: { action }, data: { credits } });
  refresh();
  go("/admin/billing", { notice: "costs_saved" });
}

export async function saveCreditPackage(formData: FormData) {
  await staff();
  const code = String(formData.get("code") ?? "");
  const priceMyr = Number(formData.get("priceMyr"));
  const credits = Number(formData.get("credits"));
  const cadence = String(formData.get("cadence") ?? "pack");
  if (!code || !Number.isFinite(priceMyr) || priceMyr < 0 || !Number.isInteger(credits) || credits < 0) {
    go("/admin/billing", { error: "invalid" });
  }
  if (cadence !== "once" && cadence !== "monthly" && cadence !== "pack") go("/admin/billing", { error: "invalid" });
  await prisma.creditPackage.update({
    where: { code },
    data: { priceMyrCents: Math.round(priceMyr * 100), credits, cadence, active: formData.get("active") === "on" },
  });
  refresh();
  go("/admin/billing", { notice: "costs_saved" });
}

export async function adjustWorkspaceCredits(formData: FormData) {
  const user = await staff();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") ?? "");
  try {
    await adjustCredits(user, workspaceId, delta, note);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) go(`/admin/workspaces/${workspaceId}`, { error: "credits" });
    go(`/admin/workspaces/${workspaceId}`, { error: "invalid" });
  }
  refresh();
  go(`/admin/workspaces/${workspaceId}`, { notice: "adjusted" });
}

export async function dismissRecommendation(formData: FormData) {
  await staff();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.recommendation.findUnique({ where: { id } });
  if (!row) go("/admin", { error: "missing" });
  await prisma.recommendation.update({ where: { id }, data: { status: "dismissed" } });
  refresh();
  go(`/admin/workspaces/${row.workspaceId}`, { notice: "dismissed" });
}
