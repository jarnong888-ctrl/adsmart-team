import { describe, expect, it } from "vitest";
import { INTEGRATION_CARDS, clientConnectsProvider } from "@/lib/integrations/catalog";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { providerMode } from "@/lib/integrations/mode";
import { platformServices } from "@/lib/integrations/platform-services";
import { createOauthState, readOauthState } from "@/lib/integrations/state";

describe("client connections", () => {
  it("does not ask clients to connect Buffer or Canva", () => {
    const ids = INTEGRATION_CARDS.map((card) => card.provider);
    expect(ids).not.toContain("buffer");
    expect(ids).not.toContain("canva");
    expect(clientConnectsProvider("buffer")).toBe(false);
    expect(INTEGRATION_CARDS.filter((card) => !card.comingSoon).map((card) => card.provider)).toEqual([
      "google",
      "google",
      "tiktok",
      "instagram",
      "facebook",
      "youtube",
    ]);
  });

  it("treats Buffer and Canva as Adsmart platform services", () => {
    expect(platformServices({ INTEGRATIONS_MODE: "mock" }).map((service) => service.status)).toEqual(["mock", "mock"]);
    expect(platformServices({ INTEGRATIONS_MODE: "live", BUFFER_API_KEY: "key" }).find((service) => service.id === "buffer")?.status).toBe("configured");
    expect(platformServices({ INTEGRATIONS_MODE: "live" }).find((service) => service.id === "canva")?.status).toBe("missing");
  });

  it("keeps every provider on mock until live mode and that provider's keys exist", () => {
    expect(providerMode("google", { INTEGRATIONS_MODE: "mock", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", GOOGLE_REDIRECT_URI: "https://example/callback", INTEGRATIONS_ENCRYPTION_KEY: "ab".repeat(32) })).toBe("mock");
    expect(providerMode("tiktok", { INTEGRATIONS_MODE: "live", INTEGRATIONS_ENCRYPTION_KEY: "ab".repeat(32) })).toBe("mock");
    expect(providerMode("google", { INTEGRATIONS_MODE: "live", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", GOOGLE_REDIRECT_URI: "https://example/callback", INTEGRATIONS_ENCRYPTION_KEY: "ab".repeat(32) })).toBe("live");
  });
});

describe("integration tokens", () => {
  const env = { INTEGRATIONS_MODE: "mock" };

  it("encrypts tokens so the stored value is not the access token", () => {
    const cipher = encryptSecret(JSON.stringify({ accessToken: "secret-token" }), env);
    expect(cipher).not.toContain("secret-token");
    expect(decryptSecret(cipher, env)).toContain("secret-token");
  });

  it("rejects an OAuth state that was not issued to this browser", () => {
    const { state } = createOauthState("ws", "google", 1_700_000_000_000);
    expect(() => readOauthState(state, "other-nonce", 1_700_000_000_000)).toThrow(/browser/);
  });
});
