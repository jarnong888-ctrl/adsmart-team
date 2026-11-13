export type PaymentProviderName = "mock" | "stripe_fpx" | "billplz" | "toyyibpay";

export type PaymentRequest = {
  workspaceId: string;
  packageCode: string;
  amountMyrCents: number;
  credits: number;
  buyerEmail: string;
};

export type PaymentReceipt = {
  provider: PaymentProviderName;
  status: "paid" | "pending" | "failed";
  externalId: string;
  detail: string;
};

export interface PaymentProvider {
  key: PaymentProviderName;
  charge(request: PaymentRequest): Promise<PaymentReceipt>;
}

export class PaymentNotConfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentNotConfigured";
  }
}

const mockProvider: PaymentProvider = {
  key: "mock",
  async charge(request) {
    return {
      provider: "mock",
      status: "paid",
      externalId: `mock_${request.workspaceId.slice(0, 6)}_${request.packageCode}_${Date.now()}`,
      detail: "Mock provider. No card was charged. Swap PAYMENT_PROVIDER for stripe_fpx, billplz, or toyyibpay when a gateway is connected.",
    };
  },
};

function unavailable(key: Exclude<PaymentProviderName, "mock">, missing: string): PaymentProvider {
  return {
    key,
    async charge() {
      throw new PaymentNotConfigured(
        `${key} is not connected (${missing} is unset). No charge was made.`,
      );
    },
  };
}

export function paymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const name = (env.PAYMENT_PROVIDER || "mock") as PaymentProviderName;
  if (name === "stripe_fpx") {
    if (!env.STRIPE_SECRET_KEY) return unavailable(name, "STRIPE_SECRET_KEY");
    return unavailable(name, "live Stripe calls");
  }
  if (name === "billplz") {
    if (!env.BILLPLZ_API_KEY) return unavailable(name, "BILLPLZ_API_KEY");
    return unavailable(name, "live Billplz calls");
  }
  if (name === "toyyibpay") {
    if (!env.TOYYIBPAY_SECRET_KEY) return unavailable(name, "TOYYIBPAY_SECRET_KEY");
    return unavailable(name, "live ToyyibPay calls");
  }
  return mockProvider;
}
