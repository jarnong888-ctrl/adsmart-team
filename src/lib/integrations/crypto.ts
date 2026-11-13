import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export class IntegrationsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationsKeyError";
  }
}

export function encryptionKey(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const raw = env.INTEGRATIONS_ENCRYPTION_KEY || "";
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  if (raw) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
    throw new IntegrationsKeyError("INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or base64.");
  }
  if ((env.INTEGRATIONS_MODE || "mock") === "mock") {
    return createHash("sha256").update("adsmart-mock-integrations-key").digest();
  }
  throw new IntegrationsKeyError("Set INTEGRATIONS_ENCRYPTION_KEY before storing live tokens.");
}

export function encryptSecret(plain: string, env: Partial<NodeJS.ProcessEnv> = process.env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64");
}

export function decryptSecret(payload: string, env: Partial<NodeJS.ProcessEnv> = process.env) {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(env), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
