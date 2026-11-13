import { describe, expect, it } from "vitest";
import { paceReport } from "@/lib/analytics";
import { ApprovalForbiddenError, assertClientCanApprove, canSeeRecommendation, recommendationCopy } from "@/lib/access";
import { toCsv } from "@/lib/export-sheet";
import { toXlsx } from "@/lib/export-sheet";
import {
  ApprovalRequiredError,
  assertFactCheckAcknowledged,
  assertPlanApproved,
  assertTransition,
  deriveItemStatusFromSchedule,
  FactCheckAcknowledgementRequired,
  isDueForStubPublish,
  listFactFlags,
  pendingPlatformsForVideo,
  PipelineError,
  requiresFactCheckAck,
} from "@/lib/pipeline";
import { publishThroughGate, type Publisher } from "@/lib/publishers";
import { allocateMix, flagsFor, markSoftSell } from "@/lib/team";

describe("pipeline", () => {
  it("spreads a 40/40/20 mix across the week's capacity", () => {
    const mix = allocateMix(12, { mindset: 40, practical: 40, trends: 20 });
    expect(mix).toHaveLength(12);
    expect(mix.filter((pillar) => pillar === "mindset")).toHaveLength(5);
    expect(mix.filter((pillar) => pillar === "practical")).toHaveLength(5);
    expect(mix.filter((pillar) => pillar === "trends")).toHaveLength(2);
  });

  it("puts the soft-sell ratio on practical posts first", () => {
    const pillars = allocateMix(10, { mindset: 40, practical: 40, trends: 20 });
    const flags = markSoftSell(pillars, 30);
    expect(flags.filter(Boolean)).toHaveLength(3);
    flags.forEach((flag, index) => {
      if (flag) expect(pillars[index]).not.toBe("mindset");
    });
  });

  it("flags demo, fact-check, and commercial disclosure separately", () => {
    expect(flagsFor({ pillar: "practical", softSell: true })).toEqual([
      "DEMO",
      "COMMERCIAL_DISCLOSURE",
    ]);
    expect(flagsFor({ pillar: "trends", softSell: false })).toEqual(["NEEDS_FACT_CHECK"]);
    expect(flagsFor({ pillar: "mindset", softSell: false })).toEqual([]);
  });

  it("refuses scripts until the plan is approved", () => {
    expect(() => assertPlanApproved("pending_approval")).toThrow(ApprovalRequiredError);
    expect(() => assertPlanApproved("approved")).not.toThrow();
  });

  it("only allows the next production step", () => {
    expect(() => assertTransition("plan_approved", "script_ready")).not.toThrow();
    expect(() => assertTransition("planned", "script_ready")).toThrow(PipelineError);
    expect(() => assertTransition("script_ready", "queued")).toThrow(PipelineError);
  });

  it("derives the queue state from per-post decisions", () => {
    expect(deriveItemStatusFromSchedule([{ status: "pending_approval" }])).toBe("queued");
    expect(deriveItemStatusFromSchedule([{ status: "approved" }, { status: "rejected" }])).toBe(
      "schedule_approved",
    );
    expect(deriveItemStatusFromSchedule([{ status: "rejected" }])).toBe("brief_ready");
    expect(deriveItemStatusFromSchedule([{ status: "published" }, { status: "approved" }])).toBe(
      "schedule_approved",
    );
    expect(deriveItemStatusFromSchedule([{ status: "published" }, { status: "rejected" }])).toBe(
      "published",
    );
    expect(deriveItemStatusFromSchedule([])).toBe("brief_ready");
  });
});

describe("approval gate", () => {
  const job = {
    workspaceId: "ws",
    entryId: "entry1234",
    platform: "tiktok",
    caption: "hello",
    scheduledFor: "2026-11-11T04:30:00.000Z",
  };

  it("does not call the publisher unless the post is approved", async () => {
    let calls = 0;
    const publisher: Publisher = {
      key: "tiktok",
      async publish() {
        calls += 1;
        return { publisher: "tiktok", externalId: "should-not-happen", mode: "stub", detail: "" };
      },
    };
    await expect(publishThroughGate({ status: "pending_approval" }, job, publisher)).rejects.toBeInstanceOf(
      ApprovalRequiredError,
    );
    await expect(publishThroughGate({ status: "rejected" }, job, publisher)).rejects.toBeInstanceOf(
      ApprovalRequiredError,
    );
    expect(calls).toBe(0);
    const receipt = await publishThroughGate({ status: "approved" }, job, publisher);
    expect(calls).toBe(1);
    expect(receipt.mode).toBe("stub");
    expect(receipt.publisher).toBe("tiktok");
  });

  it("routes TikTok and the other networks through different stubs", async () => {
    const tiktok = await publishThroughGate({ status: "approved" }, job);
    const instagram = await publishThroughGate(
      { status: "approved" },
      { ...job, platform: "instagram", entryId: "ig123456" },
    );
    expect(tiktok.publisher).toBe("tiktok");
    expect(instagram.publisher).toBe("buffer");
    expect(tiktok.externalId.startsWith("tiktok_stub_")).toBe(true);
  });
});

describe("follower pace", () => {
  it("shows the daily pace from 78 to 10k over six months", () => {
    const report = paceReport({
      baseline: 78,
      latest: 96,
      goal: 10000,
      horizonDays: 182,
      elapsedDays: 7,
    });
    expect(Math.round(report.requiredDaily)).toBe(55);
    expect(report.actualDaily).toBeCloseTo(18 / 7);
    expect(report.status).toBe("far_behind");
    expect(report.remaining).toBe(9904);
  });
});

describe("approval rules", () => {
  it("refuses scripts until the week plan is approved", () => {
    expect(() => assertPlanApproved("pending_approval")).toThrow(ApprovalRequiredError);
    expect(() => assertPlanApproved("approved")).not.toThrow();
  });

  it("lists each flagged line for the acknowledgement dialog", () => {
    const body = "[00:03–00:12] 问题\n口播：数字用【待核实】占位。";
    expect(listFactFlags(body, "NEEDS_FACT_CHECK")).toEqual([
      { where: "口播 00:03–00:12", quote: "数字用【待核实】占位。" },
    ]);
  });

  it("requires an acknowledgement when a fact-check flag is open", () => {
    expect(requiresFactCheckAck("NEEDS_FACT_CHECK", "")).toBe(true);
    expect(requiresFactCheckAck("", "口播里有【待核实】")).toBe(true);
    expect(requiresFactCheckAck("DEMO", "plain")).toBe(false);
    expect(() => assertFactCheckAcknowledged("NEEDS_FACT_CHECK", "", false)).toThrow(FactCheckAcknowledgementRequired);
    expect(() => assertFactCheckAcknowledged("NEEDS_FACT_CHECK", "", true)).not.toThrow();
  });

  it("covers every pending platform of the same video", () => {
    const entries = [
      { id: "a", contentItemId: "video", platform: "tiktok", status: "pending_approval" },
      { id: "b", contentItemId: "video", platform: "instagram", status: "pending_approval" },
      { id: "c", contentItemId: "video", platform: "facebook", status: "rejected" },
      { id: "d", contentItemId: "other", platform: "tiktok", status: "pending_approval" },
    ];
    expect(pendingPlatformsForVideo(entries, "a").map((entry) => entry.platform)).toEqual(["tiktok", "instagram"]);
  });

  it("publishes an approved post only once its planned time has arrived", () => {
    const when = new Date("2026-11-12T04:30:00.000Z");
    expect(isDueForStubPublish({ status: "approved", scheduledFor: when }, new Date("2026-11-12T04:29:00.000Z"))).toBe(false);
    expect(isDueForStubPublish({ status: "approved", scheduledFor: when }, new Date("2026-11-12T04:30:00.000Z"))).toBe(true);
    expect(isDueForStubPublish({ status: "pending_approval", scheduledFor: when }, new Date("2026-11-13T00:00:00.000Z"))).toBe(false);
  });
});

describe("client approval gate", () => {
  const client = { id: "user-a", platformRole: "client" };
  const other = { id: "user-b", platformRole: "client" };
  const staff = { id: "staff", platformRole: "admin" };

  it("lets a workspace member approve and rejects staff and other clients", () => {
    expect(() => assertClientCanApprove(client, "ws-a", ["ws-a"])).not.toThrow();
    expect(() => assertClientCanApprove(staff, "ws-a", ["ws-a"])).toThrow(ApprovalForbiddenError);
    expect(() => assertClientCanApprove(staff, "ws-a", [])).toThrow(ApprovalForbiddenError);
    expect(() => assertClientCanApprove(other, "ws-a", ["ws-b"])).toThrow(ApprovalForbiddenError);
  });
});

describe("tenant visibility", () => {
  const client = { id: "user-a", platformRole: "client" };
  const admin = { id: "staff", platformRole: "admin" };

  it("hides other workspaces and unsent recommendations from a client", () => {
    expect(
      canSeeRecommendation(client, { workspaceId: "b", status: "sent" }, ["a"]),
    ).toBe(false);
    expect(
      canSeeRecommendation(client, { workspaceId: "a", status: "draft" }, ["a"]),
    ).toBe(false);
    expect(
      canSeeRecommendation(client, { workspaceId: "a", status: "sent" }, ["a"]),
    ).toBe(true);
    expect(
      canSeeRecommendation(admin, { workspaceId: "b", status: "draft" }, []),
    ).toBe(true);
  });

  it("shows the edited copy in the viewer's language", () => {
    const recommendation = {
      primaryLocale: "zh",
      title: "原标题",
      body: "原文",
      titleAlt: "Original",
      bodyAlt: "Original body",
      editedTitle: "改过的标题",
      editedBody: "改过的正文",
      editedTitleAlt: "",
      editedBodyAlt: "Edited English",
    };
    expect(recommendationCopy(recommendation, "zh").title).toBe("改过的标题");
    expect(recommendationCopy(recommendation, "en").body).toBe("Edited English");
  });
});

describe("export", () => {
  it("writes a CSV with a BOM and escaped quotes", () => {
    const csv = toCsv([
      {
        date: "2026-11-09",
        pillar: "practical",
        title: 'Say "hello"',
        language: "zh",
        hook: "hook",
        cta: "cta",
        commentKeyword: "流程",
        softSell: "yes",
        flags: "DEMO",
        sources: "line 1\nline 2",
        script: "script",
        status: "script_ready",
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Say ""hello"""');
    expect(csv).toContain('"line 1\nline 2"');
    expect(csv.split("\n")[0]).toContain("Comment keyword");
  });

  it("builds an xlsx workbook", async () => {
    const buffer = await toXlsx([]);
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
