"use server";

import { revalidatePath } from "next/cache";
import { ApprovalRequiredError, assertItemStatus, assertPlanApproved, deriveItemStatusFromSchedule, FactCheckAcknowledgementRequired, PipelineError, type ScheduleStatus } from "@/lib/pipeline";
import { parsePlatforms } from "@/lib/platforms";
import { planByCode } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { addDays, mondayOf, mytDateTime } from "@/lib/dates";
import { InsufficientCreditsError } from "@/lib/credits";
import { generateObject } from "@/lib/llm";
import { PROMPTS } from "@/lib/prompts";
import { publisherForPlatform } from "@/lib/publishers";
import { ApprovalForbiddenError, TenantIsolationError, assertCanAccessWorkspace, assertClientCanApprove } from "@/lib/access";
import { slugify } from "@/lib/tokens";
import {
  buildBrief,
  buildRepurpose,
  buildScript,
  buildWeek,
  strategyFromWorkspace,
  type CalendarItemDraft,
  type Language,
  type StrategyInput,
  type WeekDraft,
} from "@/lib/team";
import { recordPlanApproval, recordPostApproval, recordScriptApproval, rejectPendingPlatforms, releaseDuePosts, unschedulePosts } from "@/server/approvals";
import { logActivity, track } from "@/server/audit";
import { assertSufficient, purchasePackage, refundCredits, spendCredits, ensureWallet } from "@/server/credits";
import { PaymentNotConfigured } from "@/lib/payments";
import { memberIdsFor, requireUser, resolveWorkspaces } from "@/server/guard";
import { go, goBack, rethrowRedirect, safeNext } from "@/server/nav";

function refresh() {
  revalidatePath("/studio", "layout");
  revalidatePath("/admin", "layout");
}

function intField(formData: FormData, key: string, fallback: number) {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

async function ownedWorkspace() {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const { current } = await resolveWorkspaces(user.id);
  if (!current) go("/studio/workspace", { error: "missing" });
  try {
    assertCanAccessWorkspace(user, current.id, ids);
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio", { error: "forbidden" });
    throw error;
  }
  return { user, workspace: current };
}

async function ownedItem(itemId: string) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    include: { plan: true, script: true, repurpose: true, brief: true, schedule: true, workspace: true },
  });
  if (!item) go("/studio/pipeline", { error: "missing" });
  try {
    assertCanAccessWorkspace(user, item.workspaceId, ids);
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio", { error: "forbidden" });
    throw error;
  }
  return { user, item };
}

function strategyOf(workspace: Awaited<ReturnType<typeof ownedWorkspace>>["workspace"], weekStart: string, formData?: FormData): StrategyInput {
  const languageRaw = formData?.get("language");
  const language = languageRaw === "en" || languageRaw === "ms" || languageRaw === "zh" ? languageRaw : undefined;
  return strategyFromWorkspace(
    workspace,
    weekStart,
    formData
      ? {
          language,
          capacity: intField(formData, "capacity", workspace.postingCapacity),
          mixMindset: intField(formData, "mixMindset", workspace.mixMindset),
          mixPractical: intField(formData, "mixPractical", workspace.mixPractical),
          mixTrends: intField(formData, "mixTrends", workspace.mixTrends),
          softSellRatio: intField(formData, "softSellRatio", workspace.softSellRatio),
        }
      : { language },
  );
}

function asScript(script: {
  language: string;
  hook: string;
  body: string;
  commentKeyword: string;
  sources: string;
  flags: string;
  durationSec: number;
}) {
  const language: Language = script.language === "en" || script.language === "ms" ? script.language : "zh";
  return { ...script, language };
}

async function runMetered<T>(options: {
  workspaceId: string;
  userId: string;
  action: string;
  back: string;
  run: () => Promise<T>;
}): Promise<T> {
  let spent = 0;
  try {
    spent = (await spendCredits(options.workspaceId, options.userId, options.action)).spent;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) go(options.back, { error: "credits" });
    throw error;
  }
  try {
    return await options.run();
  } catch (error) {
    if (spent > 0) await refundCredits(options.workspaceId, options.userId, options.action, spent);
    throw error;
  }
}

function asDraft(item: {
  dayIndex: number;
  slot: number;
  pillar: string;
  title: string;
  angle: string;
  hook: string;
  cta: string;
  commentKeyword: string;
  softSell: boolean;
  language: string;
}): CalendarItemDraft {
  const language: Language = item.language === "en" || item.language === "ms" ? item.language : "zh";
  const pillar = item.pillar === "practical" || item.pillar === "trends" ? item.pillar : "mindset";
  return { ...item, language, pillar };
}

export async function generateWeek(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const requested = String(formData.get("weekStart") ?? "");
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? mondayOf(requested) : mondayOf(new Date().toISOString().slice(0, 10));
  const input = strategyOf(workspace, weekStart, formData);
  if (input.mixMindset + input.mixPractical + input.mixTrends !== 100) {
    go("/studio/strategist", { error: "mix" });
  }
  const existing = await prisma.contentPlan.findUnique({
    where: { workspaceId_weekStart: { workspaceId: workspace.id, weekStart } },
  });
  if (existing) go("/studio/strategist", { error: "week_exists" });

  let draft: WeekDraft;
  try {
    draft = await runMetered({
      workspaceId: workspace.id,
      userId: user.id,
      action: "generate_week",
      back: "/studio/strategist",
      run: async () => {
        const result = await generateObject({
          system: PROMPTS.week.system,
          user: JSON.stringify(input),
          mock: () => buildWeek(input),
          parse: (raw) => {
            const value = raw as WeekDraft;
            if (!value?.title || !Array.isArray(value.items) || value.items.length < 1) {
              throw new Error("Unexpected week shape.");
            }
            return value;
          },
        });
        return result.data;
      },
    });
  } catch (error) {
    rethrowRedirect(error);
    console.error(error);
    go("/studio/strategist", { error: "llm" });
  }

  const platforms = JSON.stringify(parsePlatforms(workspace.platforms));
  await prisma.contentPlan.create({
    data: {
      workspaceId: workspace.id,
      weekStart,
      title: draft.title,
      rationale: draft.rationale,
      status: "pending_approval",
      capacity: draft.items.length,
      mixMindset: input.mixMindset,
      mixPractical: input.mixPractical,
      mixTrends: input.mixTrends,
      softSellRatio: input.softSellRatio,
      items: {
        create: draft.items.map((item) => ({
          workspaceId: workspace.id,
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
          status: "planned",
        })),
      },
    },
  });
  await track({
    workspaceId: workspace.id,
    actorUserId: user.id,
    kind: "content_generated",
    feature: "strategist",
    quantity: draft.items.length,
    platform: parsePlatforms(workspace.platforms)[0] ?? "",
  });
  await logActivity({ workspaceId: workspace.id, role: "strategist", code: "plan_generated", detail: draft.title });
  refresh();
  go("/studio/strategist", { notice: "generated" });
}

export async function decidePlan(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const ids = await memberIdsFor(user.id);
  const planId = String(formData.get("planId") ?? "");
  const decision = formData.get("decision") === "changes" ? "changes" : "approve";
  const plan = await prisma.contentPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.workspaceId !== workspace.id) go("/studio/strategist", { error: "missing" });
  try {
    assertClientCanApprove(user, plan.workspaceId, ids);
  } catch (error) {
    if (error instanceof ApprovalForbiddenError) go("/studio/strategist", { error: "not_approver" });
    throw error;
  }
  if (decision === "changes") {
    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: { status: "changes_requested", approvedAt: null, approvedById: "" },
    });
    await logActivity({ workspaceId: workspace.id, role: "client", code: "plan_changes_requested", detail: plan.title });
    refresh();
    go("/studio/strategist", { notice: "changes" });
  }
  try {
    await recordPlanApproval(user, plan.id, ids);
  } catch (error) {
    if (error instanceof ApprovalForbiddenError) go("/studio/strategist", { error: "not_approver" });
    if (error instanceof PipelineError) go("/studio/strategist", { error: "pipeline" });
    throw error;
  }
  await prisma.contentItem.updateMany({ where: { planId: plan.id, status: "planned" }, data: { status: "plan_approved" } });
  await track({ workspaceId: workspace.id, actorUserId: user.id, kind: "plan_approved", feature: "strategist" });
  await logActivity({ workspaceId: workspace.id, role: "client", code: "plan_approved", detail: plan.title });
  refresh();
  go("/studio/strategist", { notice: "approved" });
}

async function writeScript(itemId: string, language: Language | undefined, userId: string) {
  const loaded = await ownedItem(itemId);
  const { item } = loaded;
  try {
    assertPlanApproved(item.plan.status);
    assertItemStatus(item.status, "plan_approved", "write a script");
  } catch (error) {
    if (error instanceof ApprovalRequiredError) go(`/studio/pipeline/${item.id}`, { error: "plan_not_approved" });
    if (error instanceof PipelineError) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
    throw error;
  }
  const draftItem = asDraft({ ...item, language: language ?? item.language });
  let script;
  try {
    script = await runMetered({
      workspaceId: item.workspaceId,
      userId,
      action: "write_script",
      back: `/studio/pipeline/${item.id}`,
      run: async () => {
        const result = await generateObject({
          system: PROMPTS.script.system,
          user: JSON.stringify({ item: draftItem, business: item.workspace.name, tone: item.workspace.tone }),
          mock: () => buildScript(draftItem, { businessName: item.workspace.name, audience: item.workspace.audience, tone: item.workspace.tone }),
          parse: (raw) => {
            const value = raw as { body?: string; hook?: string };
            if (!value?.body || !value.hook) throw new Error("Unexpected script shape.");
            return raw as ReturnType<typeof buildScript>;
          },
        });
        return result.data;
      },
    });
  } catch (error) {
    rethrowRedirect(error);
    console.error(error);
    go(`/studio/pipeline/${item.id}`, { error: "llm" });
  }
  await prisma.$transaction([
    prisma.script.create({
      data: {
        contentItemId: item.id,
        language: script.language,
        hook: script.hook,
        body: script.body,
        commentKeyword: script.commentKeyword,
        sources: script.sources,
        flags: script.flags,
        durationSec: script.durationSec,
      },
    }),
    prisma.contentItem.update({ where: { id: item.id }, data: { status: "script_ready", language: script.language } }),
  ]);
  await track({ workspaceId: item.workspaceId, actorUserId: userId, kind: "script_generated", feature: "scriptwriter" });
  await logActivity({ workspaceId: item.workspaceId, role: "scriptwriter", code: "script_written", detail: item.title });
  return item.id;
}

export async function saveScript(formData: FormData) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.contentItem.findUnique({ where: { id: itemId }, include: { script: true } });
  if (!item?.script) go("/studio/pipeline", { error: "missing" });
  if (user.platformRole === "admin" || !ids.includes(item.workspaceId)) {
    go(`/studio/pipeline/${item.id}`, { error: "forbidden" });
  }
  const body = String(formData.get("body") ?? "");
  if (!body.trim()) go(`/studio/pipeline/${item.id}`, { error: "invalid" });
  await prisma.script.update({ where: { id: item.script.id }, data: { body } });
  await logActivity({ workspaceId: item.workspaceId, role: "scriptwriter", code: "script_written", detail: item.title });
  refresh();
  goBack(formData, `/studio/pipeline/${item.id}`, { notice: "saved" });
}

export async function generateScript(formData: FormData) {
  const { user } = await ownedWorkspace();
  const languageRaw = formData.get("language");
  const language = languageRaw === "en" || languageRaw === "ms" || languageRaw === "zh" ? languageRaw : undefined;
  const itemId = await writeScript(String(formData.get("itemId") ?? ""), language, user.id);
  refresh();
  goBack(formData, `/studio/pipeline/${itemId}`, { notice: "scripts" });
}

export async function generateScriptsForPlan(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.contentPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan || plan.workspaceId !== workspace.id) go("/studio/scripts", { error: "missing" });
  try {
    assertPlanApproved(plan.status);
  } catch (error) {
    if (error instanceof ApprovalRequiredError) go("/studio/scripts", { error: "plan_not_approved" });
    throw error;
  }
  const waiting = plan.items.filter((item) => item.status === "plan_approved");
  try {
    await assertSufficient(workspace.id, "write_script", waiting.length);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) go("/studio/scripts", { error: "credits" });
    throw error;
  }
  for (const item of waiting) {
    await writeScript(item.id, undefined, user.id);
  }
  refresh();
  go("/studio/scripts", { notice: "scripts" });
}

export async function repurposeItem(formData: FormData) {
  const { user, item } = await ownedItem(String(formData.get("itemId") ?? ""));
  try {
    assertItemStatus(item.status, "script_ready", "repurpose");
  } catch (error) {
    if (error instanceof PipelineError) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
    throw error;
  }
  if (!item.script) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
  const draftItem = asDraft(item);
  let pack;
  try {
    pack = await runMetered({
      workspaceId: item.workspaceId,
      userId: user.id,
      action: "repurpose",
      back: `/studio/pipeline/${item.id}`,
      run: async () => {
        const result = await generateObject({
      system: PROMPTS.repurpose.system,
      user: JSON.stringify({ item: draftItem, script: item.script!.body }),
      mock: () => buildRepurpose(draftItem, asScript(item.script!)),
      parse: (raw) => {
        const value = raw as { igCaption?: string; carouselOutline?: string; facebookPost?: string; sizeNotes?: string };
        if (!value?.igCaption || !value.carouselOutline || !value.facebookPost || !value.sizeNotes) {
          throw new Error("Unexpected repurpose shape.");
        }
        return {
          igCaption: value.igCaption,
          carouselOutline: value.carouselOutline,
          facebookPost: value.facebookPost,
          sizeNotes: value.sizeNotes,
        };
      },
    });
        return result.data;
      },
    });
  } catch (error) {
    rethrowRedirect(error);
    console.error(error);
    go(`/studio/pipeline/${item.id}`, { error: "llm" });
  }
  await prisma.$transaction([
    prisma.repurposePack.create({ data: { contentItemId: item.id, ...pack } }),
    prisma.contentItem.update({ where: { id: item.id }, data: { status: "repurposed" } }),
  ]);
  await track({ workspaceId: item.workspaceId, actorUserId: user.id, kind: "repurposed", feature: "repurposer" });
  await logActivity({ workspaceId: item.workspaceId, role: "repurposer", code: "repurposed", detail: item.title });
  refresh();
  goBack(formData, `/studio/pipeline/${item.id}`, { notice: "repurposed" });
}

export async function briefItem(formData: FormData) {
  const { user, item } = await ownedItem(String(formData.get("itemId") ?? ""));
  try {
    assertItemStatus(item.status, "repurposed", "write an edit brief");
  } catch (error) {
    if (error instanceof PipelineError) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
    throw error;
  }
  if (!item.script) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
  const draftItem = asDraft(item);
  let brief;
  try {
    brief = await runMetered({
      workspaceId: item.workspaceId,
      userId: user.id,
      action: "edit_brief",
      back: `/studio/pipeline/${item.id}`,
      run: async () => {
        const result = await generateObject({
      system: PROMPTS.brief.system,
      user: JSON.stringify({ item: draftItem, script: item.script!.body }),
      mock: () => buildBrief(draftItem, asScript(item.script!)),
      parse: (raw) => {
        const value = raw as { cuts?: string; captions?: string; aspectRatios?: string; musicNote?: string };
        if (!value?.cuts || !value.captions || !value.aspectRatios || !value.musicNote) {
          throw new Error("Unexpected brief shape.");
        }
        return {
          cuts: value.cuts,
          captions: value.captions,
          aspectRatios: value.aspectRatios,
          musicNote: value.musicNote,
        };
      },
    });
        return result.data;
      },
    });
  } catch (error) {
    rethrowRedirect(error);
    console.error(error);
    go(`/studio/pipeline/${item.id}`, { error: "llm" });
  }
  await prisma.$transaction([
    prisma.editBrief.create({ data: { contentItemId: item.id, ...brief } }),
    prisma.contentItem.update({ where: { id: item.id }, data: { status: "brief_ready" } }),
  ]);
  await track({ workspaceId: item.workspaceId, actorUserId: user.id, kind: "brief_created", feature: "editor" });
  await logActivity({ workspaceId: item.workspaceId, role: "editor", code: "brief_ready", detail: item.title });
  refresh();
  goBack(formData, `/studio/pipeline/${item.id}`, { notice: "brief" });
}

export async function attachRaw(formData: FormData) {
  const { user, item } = await ownedItem(String(formData.get("itemId") ?? ""));
  if (!item.brief) go(`/studio/pipeline/${item.id}`, { error: "pipeline" });
  const rawVideoName = String(formData.get("rawVideoName") ?? "").slice(0, 180);
  await prisma.editBrief.update({ where: { id: item.brief.id }, data: { rawVideoName } });
  await track({ workspaceId: item.workspaceId, actorUserId: user.id, kind: "feature_used", feature: "editor" });
  await logActivity({ workspaceId: item.workspaceId, role: "editor", code: "raw_attached", detail: rawVideoName || item.title });
  refresh();
  go(`/studio/pipeline/${item.id}`, { notice: "file" });
}

export async function queueItem(formData: FormData) {
  const { user, item } = await ownedItem(String(formData.get("itemId") ?? ""));
  try {
    assertItemStatus(item.status, "brief_ready", "queue");
  } catch (error) {
    if (error instanceof PipelineError) go(`/studio/schedule`, { error: "pipeline" });
    throw error;
  }
  const platforms = parsePlatforms(item.platforms);
  const chosen = platforms.length > 0 ? platforms : ["tiktok"];
  const day = addDays(item.plan.weekStart, item.dayIndex);
  await prisma.scheduleEntry.createMany({
    data: chosen.map((platform, index) => {
      const date = addDays(day, Math.floor(index / 2));
      const hour = index % 2 === 0 ? 12 : 19;
      const caption = platform === "instagram"
        ? item.repurpose?.igCaption ?? `${item.hook}\n\n${item.cta}`
        : platform === "facebook"
          ? item.repurpose?.facebookPost ?? `${item.title}\n\n${item.cta}`
          : `${item.hook}\n\n${item.cta}`;
      return {
        workspaceId: item.workspaceId,
        contentItemId: item.id,
        platform,
        scheduledFor: mytDateTime(date, hour, 30),
        caption,
        status: "pending_approval",
        publisherKey: publisherForPlatform(platform).key,
      };
    }),
  });
  await prisma.contentItem.update({ where: { id: item.id }, data: { status: "queued" } });
  await track({
    workspaceId: item.workspaceId,
    actorUserId: user.id,
    kind: "post_queued",
    feature: "schedule",
    quantity: chosen.length,
    platform: chosen.join(","),
  });
  await logActivity({ workspaceId: item.workspaceId, role: "social", code: "post_queued", detail: item.title });
  refresh();
  go("/studio/schedule", { notice: "queued" });
}

async function syncSchedule(itemId: string) {
  const entries = await prisma.scheduleEntry.findMany({ where: { contentItemId: itemId } });
  const status = deriveItemStatusFromSchedule(entries.map((entry) => ({ status: entry.status as ScheduleStatus })));
  await prisma.contentItem.update({ where: { id: itemId }, data: { status } });
}

export async function decidePost(formData: FormData) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const entry = await prisma.scheduleEntry.findUnique({ where: { id: String(formData.get("entryId") ?? "") } });
  if (!entry) go("/studio/schedule", { error: "missing" });
  const decision = String(formData.get("decision") ?? "approve");
  const approve = decision === "approve";
  let platforms = entry.platform;
  try {
    assertClientCanApprove(user, entry.workspaceId, ids);
    if (approve) {
      const approved = await recordPostApproval(user, entry.id, ids);
      platforms = approved.map((row) => row.platform).join(", ");
      await releaseDuePosts(entry.workspaceId);
    } else if (decision === "unschedule") {
      const cleared = await unschedulePosts(user, entry.id, ids);
      platforms = cleared.map((row) => row.platform).join(", ");
    } else {
      await rejectPendingPlatforms(user, entry.id, ids);
    }
  } catch (error) {
    if (error instanceof ApprovalForbiddenError) go("/studio/schedule", { error: "not_approver" });
    if (error instanceof PipelineError) go("/studio/schedule", { error: "pipeline" });
    throw error;
  }
  await syncSchedule(entry.contentItemId);
  await track({
    workspaceId: entry.workspaceId,
    actorUserId: user.id,
    kind: approve ? "post_approved" : decision === "unschedule" ? "post_rejected" : "post_rejected",
    feature: "schedule",
    platform: entry.platform,
  });
  const note = String(formData.get("note") ?? "").trim().slice(0, 280);
  await logActivity({
    workspaceId: entry.workspaceId,
    role: "client",
    code: approve ? "post_approved" : decision === "unschedule" ? "post_unscheduled" : "post_rejected",
    detail: note ? `${platforms || entry.platform} · ${note}` : platforms || entry.platform,
  });
  refresh();
  go(safeNext(formData.get("next"), "/studio/schedule"), {
    notice: approve ? "post_approved" : decision === "unschedule" ? "unscheduled" : "post_rejected",
  });
}

export async function approveScript(formData: FormData) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const itemId = String(formData.get("itemId") ?? "");
  try {
    await recordScriptApproval(user, itemId, ids, formData.get("acknowledge") === "on");
  } catch (error) {
    if (error instanceof ApprovalForbiddenError) go(`/studio/pipeline/${itemId}`, { error: "not_approver" });
    if (error instanceof FactCheckAcknowledgementRequired) go(`/studio/pipeline/${itemId}`, { error: "fact_check_ack" });
    if (error instanceof PipelineError) go(`/studio/pipeline/${itemId}`, { error: "pipeline" });
    throw error;
  }
  refresh();
  goBack(formData, `/studio/pipeline/${itemId}`, { notice: "script_approved" });
}

export async function publishPost(formData: FormData) {
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const entry = await prisma.scheduleEntry.findUnique({
    where: { id: String(formData.get("entryId") ?? "") },
  });
  if (!entry) go("/studio/schedule", { error: "missing" });
  try {
    assertCanAccessWorkspace(user, entry.workspaceId, ids);
  } catch (error) {
    if (error instanceof TenantIsolationError) go("/studio", { error: "forbidden" });
    throw error;
  }
  await releaseDuePosts(entry.workspaceId);
  await syncSchedule(entry.contentItemId);
  refresh();
  go("/studio/schedule", { notice: "published" });
}

export async function saveSnapshot(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const platform = String(formData.get("platform") ?? "tiktok");
  const recordedOn = String(formData.get("recordedOn") ?? "");
  const followers = intField(formData, "followers", 0);
  const views = intField(formData, "views", 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)) go("/studio/analytics", { error: "invalid" });
  await prisma.analyticsSnapshot.create({
    data: {
      workspaceId: workspace.id,
      platform,
      followers,
      views,
      recordedOn,
      note: String(formData.get("note") ?? "").slice(0, 280),
      source: "manual",
    },
  });
  await track({
    workspaceId: workspace.id,
    actorUserId: user.id,
    kind: "analytics_entered",
    feature: "analytics",
    platform,
  });
  await logActivity({
    workspaceId: workspace.id,
    role: "analytics",
    code: "analytics_saved",
    detail: `${platform} ${followers}`,
  });
  refresh();
  go("/studio/analytics", { notice: "saved" });
}

export async function saveCompetitor(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  await prisma.competitor.create({
    data: {
      workspaceId: workspace.id,
      platform: String(formData.get("platform") ?? "tiktok"),
      handle: String(formData.get("handle") ?? "").slice(0, 80),
      displayName: String(formData.get("displayName") ?? "").slice(0, 80),
      notes: String(formData.get("notes") ?? "").slice(0, 1000),
      watchOnly: true,
    },
  });
  await track({ workspaceId: workspace.id, actorUserId: user.id, kind: "feature_used", feature: "competitors" });
  await logActivity({ workspaceId: workspace.id, role: "analyst", code: "competitor_saved", detail: String(formData.get("handle") ?? "") });
  refresh();
  go("/studio/competitors", { notice: "saved" });
}

export async function deleteCompetitor(formData: FormData) {
  const { workspace } = await ownedWorkspace();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.competitor.findUnique({ where: { id } });
  if (!row || row.workspaceId !== workspace.id) go("/studio/competitors", { error: "missing" });
  await prisma.competitor.delete({ where: { id } });
  refresh();
  go("/studio/competitors", { notice: "deleted" });
}

export async function saveWorkspace(formData: FormData) {
  const { workspace } = await ownedWorkspace();
  const mixMindset = intField(formData, "mixMindset", workspace.mixMindset);
  const mixPractical = intField(formData, "mixPractical", workspace.mixPractical);
  const mixTrends = intField(formData, "mixTrends", workspace.mixTrends);
  if (mixMindset + mixPractical + mixTrends !== 100) go("/studio/workspace", { error: "mix" });
  const platforms = ["tiktok", "instagram", "facebook"].filter((platform) => formData.get(`platform_${platform}`) === "on");
  const language = formData.get("primaryLanguage");
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      name: String(formData.get("name") ?? workspace.name).slice(0, 80),
      industry: String(formData.get("industry") ?? "").slice(0, 200),
      audience: String(formData.get("audience") ?? "").slice(0, 300),
      offers: String(formData.get("offers") ?? "").slice(0, 1000),
      tone: String(formData.get("tone") ?? "").slice(0, 200),
      handle: String(formData.get("handle") ?? "").slice(0, 80),
      primaryLanguage: language === "en" || language === "ms" || language === "zh" ? language : "zh",
      platforms: JSON.stringify(platforms),
      goalFollowers: Math.max(0, intField(formData, "goalFollowers", workspace.goalFollowers)),
      goalPlatform: String(formData.get("goalPlatform") ?? workspace.goalPlatform),
      goalHorizonDays: Math.max(1, intField(formData, "goalHorizonDays", workspace.goalHorizonDays)),
      baselineFollowers: Math.max(0, intField(formData, "baselineFollowers", workspace.baselineFollowers)),
      baselineOn: /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("baselineOn") ?? ""))
        ? String(formData.get("baselineOn"))
        : workspace.baselineOn,
      postingCapacity: Math.min(21, Math.max(1, intField(formData, "postingCapacity", workspace.postingCapacity))),
      mixMindset,
      mixPractical,
      mixTrends,
      softSellRatio: Math.min(100, Math.max(0, intField(formData, "softSellRatio", workspace.softSellRatio))),
    },
  });
  refresh();
  go("/studio/workspace", { notice: "saved" });
}

export async function createWorkspace(formData: FormData) {
  const user = await requireUser();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true },
  });
  const cap = memberships.reduce((max, member) => Math.max(max, planByCode(member.workspace.planCode).workspaces), 1);
  if (user.platformRole !== "admin" && memberships.length >= cap) {
    go("/studio/workspace", { error: "workspace_limit" });
  }
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) go("/studio/workspace", { error: "invalid" });
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: slugify(name),
      planCode: "starter",
      analyticsConsent: user.analyticsConsent,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  await ensureWallet(workspace.id);
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set("adsmart_workspace", workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  refresh();
  go("/studio/workspace", { notice: "saved" });
}

export async function buyCredits(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const ids = await memberIdsFor(user.id);
  try {
    await purchasePackage(user, workspace.id, ids, String(formData.get("packageCode") ?? ""));
  } catch (error) {
    rethrowRedirect(error);
    if (error instanceof TenantIsolationError || error instanceof PaymentNotConfigured) {
      go("/studio/credits", { error: error instanceof PaymentNotConfigured ? "payment" : "forbidden" });
    }
    go("/studio/credits", { error: "payment" });
  }
  refresh();
  go("/studio/credits", { notice: "purchased" });
}

export async function setConsent(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  const consent = formData.get("consent") === "on";
  await prisma.workspace.update({ where: { id: workspace.id }, data: { analyticsConsent: consent } });
  await prisma.user.update({ where: { id: user.id }, data: { analyticsConsent: consent } });
  refresh();
  go("/studio/privacy", { notice: "consent" });
}

export async function deleteWorkspace(formData: FormData) {
  const { user, workspace } = await ownedWorkspace();
  if (String(formData.get("confirm") ?? "") !== workspace.name) {
    go("/studio/privacy", { error: "confirm" });
  }
  await prisma.workspace.delete({ where: { id: workspace.id } });
  const next = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  if (next) jar.set("adsmart_workspace", next.workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });
  else jar.delete("adsmart_workspace");
  refresh();
  go(next ? "/studio" : "/studio/workspace", { notice: "deleted" });
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== user.email) {
    go("/studio/privacy", { error: "confirm" });
  }
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id } });
  for (const membership of memberships) {
    const count = await prisma.workspaceMember.count({ where: { workspaceId: membership.workspaceId } });
    if (count <= 1) await prisma.workspace.delete({ where: { id: membership.workspaceId } });
  }
  await prisma.user.delete({ where: { id: user.id } });
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.delete("adsmart_session");
  jar.delete("adsmart_workspace");
  go("/?notice=account_deleted");
}
