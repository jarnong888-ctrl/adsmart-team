import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OauthState = {
  workspaceId: string;
  provider: string;
  nonce: string;
  exp: number;
};

function secret(env: NodeJS.ProcessEnv = process.env) {
  return env.INTEGRATIONS_ENCRYPTION_KEY || "adsmart-mock-integrations-key";
}

export function createOauthState(workspaceId: string, provider: string, now = Date.now()) {
  const nonce = randomBytes(16).toString("hex");
  const payload: OauthState = { workspaceId, provider, nonce, exp: now + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return { nonce, state: `${body}.${mac}` };
}

export function readOauthState(state: string, expectedNonce: string, now = Date.now()): OauthState {
  const [body, mac] = state.split(".");
  if (!body || !mac) throw new Error("Missing OAuth state.");
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("OAuth state signature does not match.");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OauthState;
  if (payload.nonce !== expectedNonce) throw new Error("OAuth state does not match this browser.");
  if (payload.exp < now) throw new Error("OAuth state expired.");
  return payload;
}
