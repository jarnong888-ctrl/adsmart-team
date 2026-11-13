export const ITEM_STATUSES = [
  "planned",
  "plan_approved",
  "script_ready",
  "repurposed",
  "brief_ready",
  "queued",
  "schedule_approved",
  "published",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type ScheduleStatus = "pending_approval" | "approved" | "unscheduled" | "rejected" | "published";

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

const NEXT_STATUS: Record<ItemStatus, ItemStatus | null> = {
  planned: "plan_approved",
  plan_approved: "script_ready",
  script_ready: "repurposed",
  repurposed: "brief_ready",
  brief_ready: "queued",
  queued: "schedule_approved",
  schedule_approved: "published",
  published: null,
};

export function assertTransition(from: ItemStatus, to: ItemStatus) {
  if (NEXT_STATUS[from] !== to) {
    throw new PipelineError(`Cannot move an item from ${from} to ${to}.`);
  }
}

export function assertItemStatus(actual: string, expected: ItemStatus, action: string) {
  if (actual !== expected) {
    throw new PipelineError(`Cannot ${action} while the item is ${actual}. Expected ${expected}.`);
  }
}

export function assertPlanApproved(status: string) {
  if (status !== "approved") {
    throw new ApprovalRequiredError("Approve the content plan before writing scripts.");
  }
}

export class FactCheckAcknowledgementRequired extends Error {
  constructor(message = "Acknowledge the open fact-check before approving this script.") {
    super(message);
    this.name = "FactCheckAcknowledgementRequired";
  }
}

export function requiresFactCheckAck(flags: string, body = "") {
  const named = flags.split(",").map((flag) => flag.trim());
  return named.includes("NEEDS_FACT_CHECK") || body.includes("【待核实】");
}

export function assertFactCheckAcknowledged(flags: string, body: string, acknowledged: boolean) {
  if (requiresFactCheckAck(flags, body) && !acknowledged) {
    throw new FactCheckAcknowledgementRequired();
  }
}

export function pendingPlatformsForVideo<T extends { id: string; contentItemId: string; platform: string; status: string }>(
  entries: T[],
  entryId: string,
) {
  const current = entries.find((entry) => entry.id === entryId);
  if (!current) return [];
  return entries.filter(
    (entry) =>
      entry.contentItemId === current.contentItemId &&
      (entry.status === "pending_approval" || entry.status === "unscheduled"),
  );
}

export type FactFlag = { where: string; quote: string };

export function listFactFlags(body: string, flags: string): FactFlag[] {
  const beats = body.split(/\n(?=\[)/);
  const found: FactFlag[] = [];
  for (const beat of beats) {
    if (!beat.includes("【待核实】") && !beat.includes("[Fact-check]") && !beat.includes("[Semak fakta]")) continue;
    const time = beat.match(/\[(\d{2}:\d{2}[–-]\d{2}:\d{2})\]/)?.[1] ?? "";
    const line = beat
      .split("\n")
      .find(
        (row) =>
          /^(口播|Spoken|Tutur)/.test(row) &&
          (row.includes("【待核实】") || row.includes("[Fact-check]") || row.includes("[Semak fakta]")),
      );
    if (!line) continue;
    found.push({
      where: time ? `口播 ${time}` : "脚本",
      quote: line.replace(/^(口播|Spoken|Tutur)[:：]\s*/, "").trim(),
    });
  }
  if (found.length === 0 && (flags.includes("NEEDS_FACT_CHECK") || body.includes("【待核实】"))) {
    found.push({ where: "脚本", quote: "【待核实】" });
  }
  return found;
}

export function isDueForStubPublish(entry: { status: string; scheduledFor: Date }, now: Date) {
  return entry.status === "approved" && entry.scheduledFor.getTime() <= now.getTime();
}

export function authorizePublish(entry: { status: string }) {
  if (entry.status !== "approved") {
    throw new ApprovalRequiredError(
      "Nothing is published without an explicit human approval on this post.",
    );
  }
}

export function deriveItemStatusFromSchedule(
  entries: { status: ScheduleStatus }[],
): "brief_ready" | "queued" | "schedule_approved" | "published" {
  if (entries.length === 0) return "brief_ready";
  if (entries.some((entry) => entry.status === "pending_approval" || entry.status === "unscheduled")) return "queued";
  const live = entries.filter((entry) => entry.status !== "rejected" && entry.status !== "unscheduled");
  if (live.length === 0) return "brief_ready";
  if (live.every((entry) => entry.status === "published")) return "published";
  return "schedule_approved";
}
