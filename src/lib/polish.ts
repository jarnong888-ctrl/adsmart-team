import { generateObject } from "@/lib/llm";
import { PROMPTS } from "@/lib/prompts";
import type { RecommendationDraft } from "@/lib/recommendations";

export async function polishDraft(draft: RecommendationDraft, locale: "en" | "zh") {
  const title = locale === "zh" ? draft.titleZh : draft.titleEn;
  const body = locale === "zh" ? draft.bodyZh : draft.bodyEn;
  return generateObject({
    system: PROMPTS.polish.system,
    user: JSON.stringify({ locale, title, body, code: draft.code }),
    mock: () => ({
      title,
      body:
        body +
        (locale === "zh"
          ? "\n\n教练备注：这周只做这一件最小的下一步。"
          : "\n\nCoach note: do the smallest next step this week, and nothing else."),
    }),
    parse: (raw) => {
      const value = raw as { title?: unknown; body?: unknown };
      if (typeof value?.title !== "string" || typeof value.body !== "string") {
        throw new Error("The model returned an unexpected shape.");
      }
      return { title: value.title, body: value.body };
    },
  });
}
