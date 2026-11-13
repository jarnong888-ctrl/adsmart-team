import { getEncoding, type Tiktoken } from "js-tiktoken";
import { PROMPTS } from "@/lib/prompts";
import { buildBrief, buildRepurpose, buildScript, buildWeek, type StrategyInput } from "@/lib/team";

export type TokenRow = {
  action: string;
  label: string;
  promptTokens: number;
  completionTokens: number;
  calls: number;
};

const jarno: StrategyInput = {
  businessName: "Jarno Ng",
  industry: "帮马来西亚中小企业用上 AI",
  audience: "讲华语的中小企业老板",
  offers: "RM29.90 三小时线上课，接着 RM399 一日课，然后是咨询和项目。Adsmart 插件给有自己网店的商家。",
  tone: "直接、能照做、稍微有一点劲",
  language: "zh",
  capacity: 12,
  mixMindset: 40,
  mixPractical: 40,
  mixTrends: 20,
  softSellRatio: 30,
  weekStart: "2026-11-09",
};

let encoder: Tiktoken | null = null;

function encoding() {
  encoder ??= getEncoding("o200k_base");
  return encoder;
}

function tokens(text: string) {
  return encoding().encode(text).length;
}

function mean(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function estimateTokenTable(): TokenRow[] {
  const week = buildWeek(jarno);
  const weekUser = JSON.stringify(jarno);
  const weekCompletion = JSON.stringify(week);
  const scripts = week.items.map((item) => buildScript(item, jarno));
  const scriptPrompts = week.items.map((item) =>
    tokens(PROMPTS.script.system) + tokens(JSON.stringify({ item, business: jarno.businessName, tone: jarno.tone })),
  );
  const scriptCompletions = scripts.map((script) => tokens(JSON.stringify(script)));
  const repurposePrompts = week.items.map((item, index) =>
    tokens(PROMPTS.repurpose.system) + tokens(JSON.stringify({ item, script: scripts[index].body })),
  );
  const repurposeCompletions = week.items.map((item, index) => tokens(JSON.stringify(buildRepurpose(item, scripts[index]))));
  const briefPrompts = week.items.map((item, index) =>
    tokens(PROMPTS.brief.system) + tokens(JSON.stringify({ item, script: scripts[index].body })),
  );
  const briefCompletions = week.items.map((item, index) => tokens(JSON.stringify(buildBrief(item, scripts[index]))));

  const polishZh = {
    locale: "zh",
    title: "把这个工作区升到 Studio",
    body: "本周已用 12 / 12 条视频额度。粉丝从 78 到 10000，按 182 天算，大约每天需要 55 个。目前每天 2.6。",
    code: "upgrade_studio",
  };
  const polishEn = {
    locale: "en",
    title: "Move this workspace to Studio",
    body: "This week used 12 of 12 videos. From 78 to 10000 followers in 182 days needs about 55 a day. Recorded pace is 2.6.",
    code: "upgrade_studio",
  };
  const polishMock = (body: string, locale: string) =>
    JSON.stringify({
      title: locale === "zh" ? polishZh.title : polishEn.title,
      body: body + (locale === "zh" ? "\n\n教练备注：这周只做这一件最小的下一步。" : "\n\nCoach note: do the smallest next step this week, and nothing else."),
    });

  return [
    {
      action: "generate_week",
      label: "Weekly plan",
      promptTokens: tokens(PROMPTS.week.system) + tokens(weekUser),
      completionTokens: tokens(weekCompletion),
      calls: 1,
    },
    {
      action: "write_script",
      label: "Script (mean of 12 Mandarin scripts)",
      promptTokens: mean(scriptPrompts),
      completionTokens: mean(scriptCompletions),
      calls: 1,
    },
    {
      action: "repurpose",
      label: "Repurpose (mean of the same 12)",
      promptTokens: mean(repurposePrompts),
      completionTokens: mean(repurposeCompletions),
      calls: 1,
    },
    {
      action: "edit_brief",
      label: "Edit brief (mean of the same 12)",
      promptTokens: mean(briefPrompts),
      completionTokens: mean(briefCompletions),
      calls: 1,
    },
    {
      action: "polish_recommendation",
      label: "AI polish (中文 call + English call)",
      promptTokens:
        tokens(PROMPTS.polish.system) +
        tokens(JSON.stringify(polishZh)) +
        tokens(PROMPTS.polish.system) +
        tokens(JSON.stringify(polishEn)),
      completionTokens: tokens(polishMock(polishZh.body, "zh")) + tokens(polishMock(polishEn.body, "en")),
      calls: 2,
    },
  ];
}

export function weekRollup(rows: TokenRow[], videos = 12) {
  return rows.reduce(
    (sum, row) => {
      const times = row.action === "generate_week" || row.action === "polish_recommendation" ? 1 : videos;
      return {
        promptTokens: sum.promptTokens + row.promptTokens * times,
        completionTokens: sum.completionTokens + row.completionTokens * times,
        calls: sum.calls + row.calls * times,
      };
    },
    { promptTokens: 0, completionTokens: 0, calls: 0 },
  );
}
