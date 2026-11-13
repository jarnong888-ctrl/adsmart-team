export type LlmMode = "mock" | "live";

export type LlmStatus = {
  mode: LlmMode;
  provider: string;
  model: string;
  baseUrl: string;
  reason: string;
};

export function llmStatus(): LlmStatus {
  const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "";
  const forced = process.env.LLM_MODE;
  const provider = process.env.LLM_PROVIDER || "openai";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  if (forced === "live" && !key) {
    return {
      mode: "mock",
      provider,
      model,
      baseUrl,
      reason: "LLM_MODE=live but no API key is set, so the app is using mock mode.",
    };
  }
  if (forced === "mock" || !key) {
    return {
      mode: "mock",
      provider: "mock",
      model,
      baseUrl,
      reason: forced === "mock" ? "LLM_MODE=mock" : "No API key is set.",
    };
  }
  return { mode: "live", provider, model, baseUrl, reason: "API key present." };
}

export async function generateObject<T>(options: {
  system: string;
  user: string;
  mock: () => T;
  parse: (raw: unknown) => T;
}): Promise<{ data: T; mode: LlmMode; provider: string }> {
  const status = llmStatus();
  if (status.mode === "mock") {
    return { data: options.mock(), mode: "mock", provider: "mock" };
  }

  const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "";
  const response = await fetch(`${status.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: status.model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 280)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned an empty response.");
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("The model did not return JSON.");
  }
  return { data: options.parse(raw), mode: "live", provider: status.provider };
}
