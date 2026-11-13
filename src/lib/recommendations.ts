import { PLANS, type PlanCode } from "@/lib/plans";
import type { UsageProfile } from "@/lib/usage";

export type RecommendationCategory = "plan_change" | "content_strategy" | "adsmart_offer";
export type RecommendationSeverity = "info" | "attention" | "risk";

export type RecommendationDraft = {
  category: RecommendationCategory;
  code: string;
  severity: RecommendationSeverity;
  titleEn: string;
  titleZh: string;
  bodyEn: string;
  bodyZh: string;
  rationaleEn: string;
  rationaleZh: string;
};

export type Health = "healthy" | "low_engagement" | "churn_risk" | "expansion" | "no_consent";

export type HealthReport = {
  health: Health;
  signals: string[];
};

const PLAN_ORDER: PlanCode[] = ["starter", "growth", "studio"];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function detectExistingOffers(text: string) {
  const lower = text.toLowerCase();
  return {
    class29: /29\.90|3-hour|3 hour|三小时|三小時/.test(lower),
    class399: /399|1-day|one-day|一日课|一日課/.test(lower),
    consulting: /consult|咨询|諮詢|project/.test(lower),
    plugin: /plugin|插件|adsmart/.test(lower),
  };
}

export function assessHealth(profile: UsageProfile): HealthReport {
  if (!profile.analyticsConsent) {
    return { health: "no_consent", signals: ["no_consent"] };
  }

  const signals: string[] = [];
  const ratio = profile.videosPerWeekLimit > 0 ? profile.videosThisWeek / profile.videosPerWeekLimit : 0;
  if (ratio >= 1) signals.push("content_limit");
  else if (ratio >= 0.9) signals.push("near_limit");
  if (profile.elapsedDays >= 7 && profile.requiredDaily > 0 && profile.actualDaily < profile.requiredDaily * 0.6) {
    signals.push("behind_goal");
  }
  if (profile.elapsedDays >= 7 && profile.requiredDaily > 0 && profile.actualDaily > profile.requiredDaily * 1.2) {
    signals.push("ahead_of_goal");
  }
  const unused = profile.planFeatures.filter(
    (feature) => feature !== "cmo" && !profile.featuresUsed30.includes(feature),
  );
  if (unused.length > 0) signals.push(`unused:${unused.join(",")}`);
  if (profile.pendingApprovals > 0) signals.push("pending_approvals");
  if (profile.platformsUsed.length >= 2) signals.push("multi_platform");

  const quiet =
    profile.daysSinceLastActivity === null || profile.daysSinceLastActivity >= 14;
  if (profile.ageDays >= 14 && quiet) {
    return { health: "churn_risk", signals };
  }
  if (signals.includes("content_limit") || signals.includes("near_limit")) {
    return { health: "expansion", signals };
  }
  const low =
    (profile.daysSinceLastActivity !== null && profile.daysSinceLastActivity >= 7) ||
    (profile.ageDays >= 14 && profile.videosLast30 <= 2);
  if (low) return { health: "low_engagement", signals };
  return { health: "healthy", signals };
}

function planChange(profile: UsageProfile): RecommendationDraft | null {
  const ratio = profile.videosPerWeekLimit > 0 ? profile.videosThisWeek / profile.videosPerWeekLimit : 0;
  const index = PLAN_ORDER.indexOf(profile.planCode);
  if (ratio >= 0.9 && index < PLAN_ORDER.length - 1) {
    const next = PLAN_ORDER[index + 1];
    const nextPlan = PLANS[next];
    const severity: RecommendationSeverity = ratio >= 1 ? "attention" : "info";
    return {
      category: "plan_change",
      code: next === "growth" ? "upgrade_growth" : "upgrade_studio",
      severity,
      titleEn: `Move this workspace to ${nextPlan.code[0].toUpperCase()}${nextPlan.code.slice(1)}`,
      titleZh: next === "growth" ? "把这个工作区升到 Growth" : "把这个工作区升到 Studio",
      bodyEn: `This week used ${profile.videosThisWeek} of ${profile.videosPerWeekLimit} videos on the ${profile.planCode} production cap. ${nextPlan.code[0].toUpperCase()}${nextPlan.code.slice(1)} allows ${nextPlan.videosPerWeek} videos a week. Billing is pay-as-you-go credits, not a monthly subscription.`,
      bodyZh: `本周已用 ${profile.videosThisWeek} / ${profile.videosPerWeekLimit} 条视频（${profile.planCode} 的产量上限）。${next === "growth" ? "Growth" : "Studio"} 每周可排 ${nextPlan.videosPerWeek} 条。收费已改为按点数，不是月费订阅。`,
      rationaleEn: "Rule: weekly videos reached at least 90% of the plan cap.",
      rationaleZh: "规则：本周视频数达到方案上限的 90% 或以上。",
    };
  }

  const monthly = profile.videosPerWeekLimit * 4;
  const recentlyActive = profile.daysSinceLastActivity !== null && profile.daysSinceLastActivity < 14;
  if (
    profile.ageDays >= 21 &&
    recentlyActive &&
    profile.planCode !== "starter" &&
    profile.videosLast30 < monthly * 0.25
  ) {
    const averageWeekly = profile.videosLast30 / 4;
    const target: PlanCode = averageWeekly <= PLANS.starter.videosPerWeek ? "starter" : "growth";
    if (PLAN_ORDER.indexOf(target) < index) {
      const targetPlan = PLANS[target];
      return {
        category: "plan_change",
        code: target === "starter" ? "downgrade_starter" : "downgrade_growth",
        severity: "info",
        titleEn: `A smaller plan would cover the last 30 days`,
        titleZh: "按近 30 天的用量，较小的方案就够",
        bodyEn: `${profile.videosLast30} videos in 30 days is under a quarter of the ${profile.planCode} production cap. ${targetPlan.code[0].toUpperCase()}${targetPlan.code.slice(1)} (${targetPlan.videosPerWeek}/week) still covers that pace. Credits are separate from this cap.`,
        bodyZh: `30 天内 ${profile.videosLast30} 条，不到 ${profile.planCode} 产量上限的四分之一。${target === "starter" ? "Starter" : "Growth"}（每周 ${targetPlan.videosPerWeek} 条）仍然够用。点数和这个上限是分开的。`,
        rationaleEn: "Rule: trailing 30-day volume is below 25% of monthly capacity, and the account is still active.",
        rationaleZh: "规则：近 30 天产量低于月额度的 25%，而且账号仍有活动。",
      };
    }
  }
  return null;
}

function bestPillar(profile: UsageProfile): "mindset" | "practical" | "trends" | null {
  const rows = (["mindset", "practical", "trends"] as const)
    .map((pillar) => {
      const stats = profile.pillarViews[pillar];
      return { pillar, posts: stats.posts, avg: stats.posts > 0 ? stats.views / stats.posts : 0 };
    })
    .filter((row) => row.posts > 0);
  if (rows.length < 2) return null;
  rows.sort((a, b) => b.avg - a.avg);
  const rest = rows.slice(1).reduce((sum, row) => sum + row.avg, 0) / (rows.length - 1);
  if (rest <= 0) return rows[0].avg > 0 ? rows[0].pillar : null;
  if (rows[0].avg >= rest * 1.8) return rows[0].pillar;
  return null;
}

const PILLAR_LABEL = {
  mindset: { en: "mindset", zh: "心态" },
  practical: { en: "practical", zh: "实操" },
  trends: { en: "trends", zh: "趋势" },
} as const;

function strategies(profile: UsageProfile): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  const inactive =
    profile.ageDays >= 7 &&
    (profile.daysSinceLastActivity === null ||
      profile.daysSinceLastActivity >= 10 ||
      profile.videosLast30 === 0);

  if (inactive) {
    const quietFor = profile.daysSinceLastActivity ?? profile.ageDays;
    drafts.push({
      category: "content_strategy",
      code: "restart_cadence",
      severity: "attention",
      titleEn: "Restart with three practical videos",
      titleZh: "用三条实操视频把节奏捡回来",
      bodyEn: `Nothing meaningful has shipped for ${quietFor} days. Don't rebuild the whole calendar. Film three practical posts the owner can record this week, then approve them before anything is queued.`,
      bodyZh: `已经 ${quietFor} 天没有实质产出。先别重做整周日历。这周拍三条实操，老板自己出镜，批准之后再排期。`,
      rationaleEn: "Rule: the workspace has been quiet for 10+ days or produced nothing in 30 days.",
      rationaleZh: "规则：工作区已安静 10 天以上，或 30 天内没有产量。",
    });
  }

  const behind =
    profile.elapsedDays >= 7 &&
    profile.requiredDaily > 0 &&
    profile.actualDaily < profile.requiredDaily * 0.6 &&
    profile.followerLatest < profile.goalFollowers;
  if (behind) {
    drafts.push({
      category: "content_strategy",
      code: "pace_behind",
      severity: "attention",
      titleEn: "The follower goal needs a different pace conversation",
      titleZh: "粉丝目标和现在的速度对不上",
      bodyEn: `From ${profile.followerBaseline} to ${profile.goalFollowers} in ${profile.goalHorizonDays} days needs about ${Math.round(profile.requiredDaily)} followers a day. The recorded pace is ${round1(profile.actualDaily)} a day (${profile.followerLatest} now, day ${profile.elapsedDays}). More scripts alone will not close that gap. Confirm the goal, the horizon, or the offer the posts are actually selling.`,
      bodyZh: `从 ${profile.followerBaseline} 到 ${profile.goalFollowers}、用 ${profile.goalHorizonDays} 天，大约每天需要 ${Math.round(profile.requiredDaily)} 个粉丝。目前记录的速度是每天 ${round1(profile.actualDaily)}（现在 ${profile.followerLatest}，第 ${profile.elapsedDays} 天）。只加脚本补不上这个差距。先确认目标、期限，或这些片子到底在卖什么。`,
      rationaleEn: "Rule: actual daily follower pace is under 60% of the pace the goal requires, after at least 7 days.",
      rationaleZh: "规则：至少 7 天后，实际日增粉丝不到目标所需速度的 60%。",
    });
  }

  const pillar = bestPillar(profile);
  if (pillar && !inactive) {
    const label = PILLAR_LABEL[pillar];
    drafts.push({
      category: "content_strategy",
      code: "pillar_shift",
      severity: "info",
      titleEn: `Give more of the week to ${label.en} posts`,
      titleZh: `这周多给「${label.zh}」一些位置`,
      bodyEn: `${label.en[0].toUpperCase()}${label.en.slice(1)} posts have the highest recorded views per post. Shift about ten points of the mix toward that pillar next week, and keep the soft-sell ratio where it is until the pace changes.`,
      bodyZh: `按已记录的单条播放，「${label.zh}」最高。下周把内容配比往这个方向挪大约十个点。软性销售的比例先保持不变，直到速度有变化。`,
      rationaleEn: "Rule: one pillar averages at least 1.8× the views per post of the others.",
      rationaleZh: "规则：某一栏目的单条播放至少是其他栏目的 1.8 倍。",
    });
  }

  const unused = profile.planFeatures.filter(
    (feature) => feature !== "cmo" && feature !== "schedule" && !profile.featuresUsed30.includes(feature),
  );
  if (unused.length >= 2 && !inactive) {
    drafts.push({
      category: "content_strategy",
      code: "unused_desks",
      severity: "info",
      titleEn: "Two paid desks have not been used",
      titleZh: "有两个已付费的角色还没开工",
      bodyEn: `In the last 30 days these included desks had no use: ${unused.join(", ")}. Open the next one in the pipeline before adding more filming days.`,
      bodyZh: `近 30 天这些已包含的角色没有使用记录：${unused.join("、")}。先把流水线的下一步用起来，再增加拍摄天数。`,
      rationaleEn: "Rule: two or more plan features have no usage event in 30 days.",
      rationaleZh: "规则：方案内至少两个功能在 30 天内没有使用记录。",
    });
  }

  return drafts.slice(0, 2);
}

function offer(profile: UsageProfile): RecommendationDraft | null {
  const has = detectExistingOffers(profile.offersText);
  const blob = `${profile.industry} ${profile.offersText}`;
  const inactive =
    profile.ageDays >= 10 &&
    (profile.daysSinceLastActivity === null || profile.daysSinceLastActivity >= 10);
  const retail = /retail|fashion|shopify|woocommerce|wix|e-?comm|店|零售|服饰|服装/.test(blob.toLowerCase());
  const atOrOver = profile.videosThisWeek >= profile.videosPerWeekLimit * 0.9;
  const behind =
    profile.elapsedDays >= 7 &&
    profile.requiredDaily > 0 &&
    profile.actualDaily < profile.requiredDaily * 0.6;

  if (inactive && !has.class29) {
    return {
      category: "adsmart_offer",
      code: "offer_class_29",
      severity: "attention",
      titleEn: "Offer the RM29.90 class as the restart",
      titleZh: "用 RM29.90 的三小时课帮他们重新开始",
      bodyEn:
        "The workspace has gone quiet. The smallest Adsmart offer is the RM29.90 3-hour online class: one sitting, one workflow, no project commitment. Send it as a restart, not as a bigger retainer.",
      bodyZh:
        "这个工作区停了。Adsmart 阶梯里最小的一步是 RM29.90 的三小时线上课：一次坐下来，做一个流程，先不谈项目。把它当成重新开始，而不是更大的月费。",
      rationaleEn: "Rule: quiet account, and the saved offers do not already include the RM29.90 class.",
      rationaleZh: "规则：账号变安静，而且现有优惠里还没有 RM29.90 课程。",
    };
  }

  if (retail && !has.plugin) {
    return {
      category: "adsmart_offer",
      code: "offer_plugin",
      severity: "info",
      titleEn: "The Adsmart plugin fits this store",
      titleZh: "这家店适合装 Adsmart 插件",
      bodyEn:
        "This looks like a retail or own-store business. The Adsmart plugin (Shopify, WooCommerce, Wix) is the offer for stock, price, and promo timing. It is a different product from Adsmart Team. Mention it; don't bundle it into the content subscription.",
      bodyZh:
        "这看起来是零售或独立站。Adsmart 插件（Shopify、WooCommerce、Wix）负责备货、定价和促销时机。它和 Adsmart Team 是两个产品。可以介绍，但不要捆进内容订阅里。",
      rationaleEn: "Rule: retail or store platform language, and the offers do not already mention the plugin.",
      rationaleZh: "规则：行业或优惠里有零售/独立站，且还没有提到插件。",
    };
  }

  if ((behind || profile.planCode === "starter") && !has.class399 && profile.videosLast30 >= 4) {
    return {
      category: "adsmart_offer",
      code: "offer_class_399",
      severity: "info",
      titleEn: "The RM399 one-day class matches this pace",
      titleZh: "RM399 的一日课对得上现在的速度",
      bodyEn:
        "They are producing, but the goal pace is off or the plan is still Starter. The RM399 one-day class is the next rung: a full working day on the workflow, before a consulting project.",
      bodyZh:
        "他们有在产出，但目标速度跟不上，或者还在 Starter。下一阶是 RM399 的一日课：用一整天把流程跑通，先于咨询项目。",
      rationaleEn: "Rule: active production with a pace gap or Starter plan, and the RM399 class is not already an offer.",
      rationaleZh: "规则：有产出，但速度落后或仍是 Starter，且优惠里还没有 RM399 课程。",
    };
  }

  if (atOrOver && !has.consulting && profile.planCode !== "starter") {
    return {
      category: "adsmart_offer",
      code: "offer_consulting",
      severity: "info",
      titleEn: "A consulting project is the next rung",
      titleZh: "下一阶是咨询或项目",
      bodyEn:
        "They are at the content cap on a higher plan. The class ladder is already passed or not the fit. Offer a scoped consultation or project instead of another content tier.",
      bodyZh:
        "他们在较高方案上已经顶到内容额度。课程这一阶已经过了，或不合适。与其再推一档内容订阅，不如提出一个范围清楚的咨询或项目。",
      rationaleEn: "Rule: at the content cap on Growth or Studio, and consultation is not already in the offers.",
      rationaleZh: "规则：Growth 或 Studio 已到内容上限，且优惠里还没有咨询。",
    };
  }

  return null;
}

export function draftRecord(draft: RecommendationDraft, primaryLanguage: string) {
  const primaryZh = primaryLanguage === "zh";
  return {
    category: draft.category,
    code: draft.code,
    severity: draft.severity,
    title: primaryZh ? draft.titleZh : draft.titleEn,
    body: primaryZh ? draft.bodyZh : draft.bodyEn,
    titleAlt: primaryZh ? draft.titleEn : draft.titleZh,
    bodyAlt: primaryZh ? draft.bodyEn : draft.bodyZh,
    rationale: primaryZh ? `${draft.rationaleZh}\n${draft.rationaleEn}` : `${draft.rationaleEn}\n${draft.rationaleZh}`,
    primaryLocale: primaryZh ? "zh" : "en",
    source: "rules",
  };
}

export function recommend(profile: UsageProfile): RecommendationDraft[] {
  if (!profile.analyticsConsent) return [];
  const drafts = [planChange(profile), ...strategies(profile), offer(profile)].filter(
    (draft): draft is RecommendationDraft => draft !== null,
  );
  return drafts.slice(0, 4);
}

export function shouldRefresh(
  existing: { code: string; status: string; createdAt: Date }[],
  code: string,
  now: Date,
): "skip" | "update" | "create" {
  const related = existing.filter((row) => row.code === code && row.status !== "dismissed");
  const sentRecently = related.some(
    (row) => row.status === "sent" && now.getTime() - row.createdAt.getTime() < 7 * 86_400_000,
  );
  if (sentRecently) return "skip";
  if (related.some((row) => row.status === "draft")) return "update";
  return "create";
}
