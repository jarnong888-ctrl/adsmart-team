import { describe, expect, it } from "vitest";
import { InsufficientCreditsError, nextBalance } from "@/lib/credits";
import { paymentProvider, PaymentNotConfigured } from "@/lib/payments";
import { estimateTokenTable } from "@/lib/token-estimate";

describe("credit balance", () => {
  it("refuses a balance below zero", () => {
    expect(nextBalance(12, -4)).toBe(8);
    expect(() => nextBalance(3, -4)).toThrow(InsufficientCreditsError);
    expect(() => nextBalance(0, -1)).toThrow(InsufficientCreditsError);
  });
});

describe("payment provider", () => {
  it("uses the mock provider unless a gateway is selected", async () => {
    const receipt = await paymentProvider({ PAYMENT_PROVIDER: "mock" } as unknown as NodeJS.ProcessEnv).charge({
      workspaceId: "ws",
      packageCode: "intermediate",
      amountMyrCents: 4900,
      credits: 200,
      buyerEmail: "demo@adsmart.my",
    });
    expect(receipt.status).toBe("paid");
    expect(receipt.provider).toBe("mock");
    expect(receipt.detail).toContain("No card");
  });

  it("does not charge Stripe, Billplz, or ToyyibPay", async () => {
    for (const name of ["stripe_fpx", "billplz", "toyyibpay"] as const) {
      await expect(
        paymentProvider({ PAYMENT_PROVIDER: name, STRIPE_SECRET_KEY: "sk_test" } as unknown as NodeJS.ProcessEnv).charge({
          workspaceId: "ws",
          packageCode: "pro",
          amountMyrCents: 14900,
          credits: 800,
          buyerEmail: "demo@adsmart.my",
        }),
      ).rejects.toBeInstanceOf(PaymentNotConfigured);
    }
  });
});

describe("token estimate", () => {
  it("counts the prompts that the product actually sends", () => {
    const rows = estimateTokenTable();
    expect(rows.map((row) => row.calls)).toEqual([1, 1, 1, 1, 2]);
    for (const row of rows) {
      expect(row.promptTokens).toBeGreaterThan(40);
      expect(row.completionTokens).toBeGreaterThan(40);
    }
    const script = rows.find((row) => row.action === "write_script");
    expect(script?.completionTokens).toBeGreaterThan(200);
  });
});
