export const CREDIT_ACTIONS = [
  "generate_week",
  "write_script",
  "repurpose",
  "edit_brief",
  "polish_recommendation",
] as const;

export type CreditAction = (typeof CREDIT_ACTIONS)[number];

export type PackageCode = "free" | "intermediate" | "pro";

export type PackageSeed = {
  code: PackageCode;
  nameEn: string;
  nameZh: string;
  blurbEn: string;
  blurbZh: string;
  priceMyrCents: number;
  credits: number;
  cadence: "once" | "monthly" | "pack";
  active: boolean;
  sort: number;
};

export type CostSeed = {
  action: CreditAction;
  credits: number;
  labelEn: string;
  labelZh: string;
};

export const DEFAULT_PACKAGES: PackageSeed[] = [
  {
    code: "free",
    nameEn: "Free",
    nameZh: "免费",
    blurbEn: "Placeholder starter allowance. Not a subscription.",
    blurbZh: "占位的起步额度，不是订阅。",
    priceMyrCents: 0,
    credits: 40,
    cadence: "monthly",
    active: true,
    sort: 0,
  },
  {
    code: "intermediate",
    nameEn: "Intermediate",
    nameZh: "进阶",
    blurbEn: "Placeholder pack. Price is not decided.",
    blurbZh: "占位套餐。价格还没定。",
    priceMyrCents: 4900,
    credits: 200,
    cadence: "pack",
    active: true,
    sort: 1,
  },
  {
    code: "pro",
    nameEn: "Pro",
    nameZh: "专业",
    blurbEn: "Placeholder pack for a busier week. Price is not decided.",
    blurbZh: "给更忙的一周用的占位套餐。价格还没定。",
    priceMyrCents: 14900,
    credits: 800,
    cadence: "pack",
    active: true,
    sort: 2,
  },
];

export const DEFAULT_COSTS: CostSeed[] = [
  { action: "generate_week", credits: 10, labelEn: "Generate a weekly plan", labelZh: "生成一周计划" },
  { action: "write_script", credits: 4, labelEn: "Write a script", labelZh: "写一条脚本" },
  { action: "repurpose", credits: 3, labelEn: "Repurpose a script", labelZh: "改写一条脚本" },
  { action: "edit_brief", credits: 3, labelEn: "Write an edit brief", labelZh: "写剪辑单" },
  { action: "polish_recommendation", credits: 2, labelEn: "AI polish on a recommendation", labelZh: "用 AI 润色一条建议" },
];

export function formatMyr(cents: number) {
  if (cents % 100 === 0) return `RM${cents / 100}`;
  return `RM${(cents / 100).toFixed(2)}`;
}
