import "server-only";
import { cookies } from "next/headers";
import { assertCanAccessWorkspace, type Actor } from "@/lib/access";
import { prisma } from "@/lib/db";
import { isProviderId, type ProviderId } from "@/lib/integrations/catalog";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { GOOGLE_SCOPES, googleAuthUrl, googleRedirectUri, providerMode } from "@/lib/integrations/mode";
import { createOauthState, readOauthState } from "@/lib/integrations/state";

const STATE_COOKIE = "adsmart_oauth_state";

const SCOPES: Record<ProviderId, string[]> = {
  google: GOOGLE_SCOPES,
  tiktok: ["user.info.basic", "video.list", "video.publish"],
  instagram: ["instagram_business_basic", "instagram_business_content_publish"],
  facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  youtube: ["youtube.readonly", "youtube.upload"],
};

const MOCK_ACCOUNTS: Record<ProviderId, string> = {
  google: "jarno@gmail.com",
  tiktok: "@jarnong",
  instagram: "@jarnong",
  facebook: "Jarno Ng Page",
  youtube: "Jarno Ng",
};

export function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function beginConnect(actor: Actor, workspaceId: string, membershipIds: readonly string[], provider: string) {
  if (!isProviderId(provider)) throw new Error("Unknown provider.");
  assertCanAccessWorkspace(actor, workspaceId, membershipIds);
  if (actor.platformRole === "admin" && !membershipIds.includes(workspaceId)) {
    throw new Error("Staff configure Buffer and Canva for the platform. Clients connect their own accounts.");
  }
  const { nonce, state } = createOauthState(workspaceId, provider);
  const jar = await cookies();
  jar.set(STATE_COOKIE, nonce, { ...cookieBase(), maxAge: 600 });
  if (providerMode(provider) === "live" && provider === "google") {
    return { kind: "redirect" as const, url: googleAuthUrl(state) };
  }
  return { kind: "mock" as const, url: `/studio/connections/consent?provider=${provider}&state=${encodeURIComponent(state)}` };
}

async function expectedNonce() {
  return (await cookies()).get(STATE_COOKIE)?.value || "";
}

export async function connectMockAccount(actor: Actor, membershipIds: readonly string[], provider: string, state: string, nonce: string) {
  if (!isProviderId(provider)) throw new Error("Unknown provider.");
  const parsed = readOauthState(state, nonce);
  assertCanAccessWorkspace(actor, parsed.workspaceId, membershipIds);
  if (parsed.provider !== provider) throw new Error("Provider mismatch.");
  await storeConnection(parsed.workspaceId, provider, MOCK_ACCOUNTS[provider], { accessToken: `mock_${provider}`, refreshToken: `mock_refresh_${provider}` });
  return parsed.workspaceId;
}

export async function finishMockConnect(actor: Actor, membershipIds: readonly string[], provider: string, state: string) {
  const workspaceId = await connectMockAccount(actor, membershipIds, provider, state, await expectedNonce());
  const jar = await cookies();
  jar.delete(STATE_COOKIE);
  return workspaceId;
}

export async function finishGoogleCallback(actor: Actor, membershipIds: readonly string[], code: string, state: string) {
  const parsed = readOauthState(state, await expectedNonce());
  assertCanAccessWorkspace(actor, parsed.workspaceId, membershipIds);
  if (parsed.provider !== "google") throw new Error("Provider mismatch.");
  if (providerMode("google") !== "live") throw new Error("Google live mode is not configured.");
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) {
    await markError(parsed.workspaceId, "google", "Google token exchange failed.");
    throw new Error("Google token exchange failed.");
  }
  const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token || ""}` },
  });
  const email = profile.ok ? ((await profile.json()) as { email?: string }).email || "Google account" : "Google account";
  await storeConnection(parsed.workspaceId, "google", email, {
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || "",
  }, tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null);
  const jar = await cookies();
  jar.delete(STATE_COOKIE);
  return parsed.workspaceId;
}

async function storeConnection(
  workspaceId: string,
  provider: ProviderId,
  accountLabel: string,
  tokens: { accessToken: string; refreshToken: string },
  expiresAt: Date | null = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
) {
  const tokenCipher = encryptSecret(JSON.stringify(tokens));
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: {
      workspaceId,
      provider,
      status: "connected",
      accountLabel,
      scopes: JSON.stringify(SCOPES[provider]),
      tokenCipher,
      expiresAt,
      lastSyncAt: new Date(),
      settings: "{}",
      lastError: "",
    },
    update: {
      status: "connected",
      accountLabel,
      scopes: JSON.stringify(SCOPES[provider]),
      tokenCipher,
      expiresAt,
      lastSyncAt: new Date(),
      lastError: "",
    },
  });
}

async function markError(workspaceId: string, provider: string, message: string) {
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: { workspaceId, provider, status: "error", lastError: message },
    update: { status: "error", lastError: message },
  });
}

export async function disconnectIntegration(actor: Actor, membershipIds: readonly string[], workspaceId: string, provider: string) {
  assertCanAccessWorkspace(actor, workspaceId, membershipIds);
  if (!isProviderId(provider)) throw new Error("Unknown provider.");
  await prisma.integration.deleteMany({ where: { workspaceId, provider } });
}

export async function saveGoogleSettings(
  actor: Actor,
  membershipIds: readonly string[],
  workspaceId: string,
  driveFolderId: string,
  sheetId: string,
) {
  assertCanAccessWorkspace(actor, workspaceId, membershipIds);
  const row = await prisma.integration.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "google" } } });
  if (!row || row.status !== "connected") throw new Error("Connect Google first.");
  const settings = { driveFolderId, sheetId };
  await prisma.integration.update({
    where: { id: row.id },
    data: { settings: JSON.stringify(settings), lastSyncAt: new Date() },
  });
}

export function connectionView(row: { status: string; accountLabel: string; expiresAt: Date | null; lastSyncAt: Date | null; lastError: string; scopes: string; settings: string } | undefined) {
  if (!row) return { status: "not_connected" as const, accountLabel: "", lastSyncAt: null as Date | null, scopes: [] as string[], settings: {} as Record<string, string> };
  const expired = row.expiresAt ? row.expiresAt.getTime() < Date.now() : false;
  const status = row.status === "error" ? "error" : expired ? "needs_reconnect" : row.status === "connected" ? "connected" : "not_connected";
  let settings: Record<string, string> = {};
  try {
    settings = JSON.parse(row.settings || "{}") as Record<string, string>;
  } catch {
    settings = {};
  }
  return { status, accountLabel: row.accountLabel, lastSyncAt: row.lastSyncAt, scopes: JSON.parse(row.scopes || "[]") as string[], settings };
}

export function readStoredTokens(tokenCipher: string) {
  if (!tokenCipher) return null;
  return JSON.parse(decryptSecret(tokenCipher)) as { accessToken: string; refreshToken: string };
}
