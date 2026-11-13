export const PLAN_CODES = ["starter", "growth", "studio"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURES = [
  "strategist",
  "scriptwriter",
  "repurposer",
  "editor",
  "schedule",
  "analytics",
  "competitors",
  "export",
  "cmo",
] as const;

export type Feature = (typeof FEATURES)[number];

export type PlanDefinition = {
  code: PlanCode;
  priceMyr: number;
  videosPerWeek: number;
  workspaces: number;
  features: Feature[];
};

export const PLANS: Record<PlanCode, PlanDefinition> = {
  starter: {
    code: "starter",
    priceMyr: 199,
    videosPerWeek: 8,
    workspaces: 1,
    features: ["strategist", "scriptwriter", "schedule", "cmo"],
  },
  growth: {
    code: "growth",
    priceMyr: 599,
    videosPerWeek: 12,
    workspaces: 3,
    features: [
      "strategist",
      "scriptwriter",
      "repurposer",
      "editor",
      "schedule",
      "analytics",
      "competitors",
      "export",
      "cmo",
    ],
  },
  studio: {
    code: "studio",
    priceMyr: 1490,
    videosPerWeek: 20,
    workspaces: 10,
    features: [...FEATURES],
  },
};

export function asPlanCode(value: string): PlanCode {
  if (value === "growth" || value === "studio" || value === "starter") return value;
  return "starter";
}

export function planByCode(value: string): PlanDefinition {
  return PLANS[asPlanCode(value)];
}
