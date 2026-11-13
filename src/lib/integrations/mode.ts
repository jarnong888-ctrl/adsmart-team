import type { ProviderId } from "@/lib/integrations/catalog";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function googleRedirectUri(env: NodeJS.ProcessEnv = process.env) {
  return env.GOOGLE_REDIRECT_URI || "http://127.0.0.1:43123/api/integrations/google/callback";
}

const LIVE_KEYS: Record<ProviderId, string[]> = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  instagram: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
  facebook: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
  youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
};

export function providerMode(provider: ProviderId, env: Partial<NodeJS.ProcessEnv> = process.env): "mock" | "live" {
  if ((env.INTEGRATIONS_MODE || "mock") !== "live") return "mock";
  const keys = LIVE_KEYS[provider];
  if (!keys.every((key) => env[key])) return "mock";
  if (!env.INTEGRATIONS_ENCRYPTION_KEY) return "mock";
  return "live";
}

export function googleAuthUrl(state: string, env: NodeJS.ProcessEnv = process.env) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", googleRedirectUri(env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export const MOCK_FOLDERS = [
  { id: "folder_deliverables", name: "Adsmart deliverables" },
  { id: "folder_week", name: "Week files" },
  { id: "folder_reports", name: "Client reports" },
];

export const MOCK_SHEETS = [
  { id: "", name: "None" },
  { id: "sheet_calendar", name: "Content calendar" },
  { id: "sheet_report", name: "Weekly report" },
];
