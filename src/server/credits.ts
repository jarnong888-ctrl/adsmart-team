import { assertAdmin, TenantIsolationError, type Actor } from "@/lib/access";
import { DEFAULT_COSTS, DEFAULT_PACKAGES, type CreditAction } from "@/lib/credit-catalog";
import { InsufficientCreditsError } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { PaymentNotConfigured, paymentProvider } from "@/lib/payments";
import { logActivity } from "@/server/audit";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function ensureCatalog() {
  for (const row of DEFAULT_PACKAGES) {
    await prisma.creditPackage.upsert({
      where: { code: row.code },
      create: row,
      update: {},
    });
  }
  for (const row of DEFAULT_COSTS) {
    await prisma.creditCost.upsert({
      where: { action: row.action },
      create: row,
      update: {},
    });
  }
}

export async function costOf(action: string, units = 1) {
  await ensureCatalog();
  const row = await prisma.creditCost.findUnique({ where: { action } });
  if (!row) throw new Error(`Unknown credit action: ${action}`);
  return row.credits * units;
}

async function applyDelta(
  workspaceId: string,
  delta: number,
  entry: {
    kind: string;
    action?: string;
    packageCode?: string;
    note?: string;
    actorUserId?: string;
    paymentId?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (delta >= 0) {
      await tx.creditWallet.update({
        where: { workspaceId },
        data: { balance: { increment: delta } },
      });
    } else {
      const updated = await tx.creditWallet.updateMany({
        where: { workspaceId, balance: { gte: -delta } },
        data: { balance: { increment: delta } },
      });
      if (updated.count !== 1) {
        const current = await tx.creditWallet.findUnique({ where: { workspaceId } });
        throw new InsufficientCreditsError(-delta, current?.balance ?? 0, entry.action || entry.kind);
      }
    }
    const wallet = await tx.creditWallet.findUniqueOrThrow({ where: { workspaceId } });
    if (wallet.balance < 0) {
      throw new InsufficientCreditsError(Math.abs(delta), wallet.balance, entry.action || entry.kind);
    }
    const ledger = await tx.creditLedger.create({
      data: {
        workspaceId,
        delta,
        balanceAfter: wallet.balance,
        kind: entry.kind,
        action: entry.action ?? "",
        packageCode: entry.packageCode ?? "",
        note: entry.note ?? "",
        actorUserId: entry.actorUserId ?? "",
        paymentId: entry.paymentId ?? "",
      },
    });
    return { balance: wallet.balance, ledger };
  });
}

export async function ensureWallet(workspaceId: string) {
  await ensureCatalog();
  const existing = await prisma.creditWallet.findUnique({ where: { workspaceId } });
  if (!existing) {
    await prisma.creditWallet.create({ data: { workspaceId, balance: 0 } });
  }
  const free = await prisma.creditPackage.findUnique({ where: { code: "free" } });
  if (free?.active && free.credits > 0) {
    const latest = await prisma.creditLedger.findFirst({
      where: { workspaceId, kind: "grant", packageCode: "free" },
      orderBy: { createdAt: "desc" },
    });
    const monthlyDue = free.cadence === "monthly" && (!latest || Date.now() - latest.createdAt.getTime() >= MONTH_MS);
    const onceDue = free.cadence === "once" && !latest;
    if (monthlyDue || onceDue) {
      await applyDelta(workspaceId, free.credits, {
        kind: "grant",
        packageCode: "free",
        action: "allowance",
        note: free.cadence,
      });
    }
  }
  return prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId } });
}

export async function assertSufficient(workspaceId: string, action: CreditAction | string, units = 1) {
  const wallet = await ensureWallet(workspaceId);
  const required = await costOf(action, units);
  if (required > 0 && wallet.balance < required) {
    throw new InsufficientCreditsError(required, wallet.balance, action);
  }
  return required;
}

export async function spendCredits(workspaceId: string, actorUserId: string, action: CreditAction | string, units = 1) {
  const required = await assertSufficient(workspaceId, action, units);
  if (required === 0) {
    const wallet = await ensureWallet(workspaceId);
    return { balance: wallet.balance, spent: 0 };
  }
  const result = await applyDelta(workspaceId, -required, { kind: "spend", action, actorUserId, note: units > 1 ? String(units) : "" });
  return { balance: result.balance, spent: required };
}

export async function refundCredits(workspaceId: string, actorUserId: string, action: string, amount: number) {
  if (amount <= 0) return;
  await ensureWallet(workspaceId);
  await applyDelta(workspaceId, amount, { kind: "refund", action, actorUserId, note: "model failed" });
}

function assertBuyer(actor: Actor, workspaceId: string, membershipWorkspaceIds: readonly string[]) {
  if (actor.platformRole === "admin" || !membershipWorkspaceIds.includes(workspaceId)) {
    throw new TenantIsolationError("Only a member of this workspace can buy credits.");
  }
}

export async function purchasePackage(
  actor: Actor,
  workspaceId: string,
  membershipWorkspaceIds: readonly string[],
  packageCode: string,
) {
  assertBuyer(actor, workspaceId, membershipWorkspaceIds);
  await ensureWallet(workspaceId);
  const pack = await prisma.creditPackage.findUnique({ where: { code: packageCode } });
  if (!pack || !pack.active || pack.cadence !== "pack") {
    throw new Error("That pack cannot be purchased.");
  }
  const buyer = await prisma.user.findUnique({ where: { id: actor.id } });
  let receipt;
  try {
    receipt = await paymentProvider().charge({
      workspaceId,
      packageCode: pack.code,
      amountMyrCents: pack.priceMyrCents,
      credits: pack.credits,
      buyerEmail: buyer?.email ?? "",
    });
  } catch (error) {
    if (error instanceof PaymentNotConfigured) {
      await prisma.payment.create({
        data: {
          workspaceId,
          provider: paymentProvider().key,
          status: "failed",
          amountMyrCents: pack.priceMyrCents,
          credits: pack.credits,
          packageCode: pack.code,
          detail: error.message,
        },
      });
    }
    throw error;
  }
  if (receipt.status !== "paid") {
    await prisma.payment.create({
      data: {
        workspaceId,
        provider: receipt.provider,
        status: receipt.status,
        amountMyrCents: pack.priceMyrCents,
        credits: pack.credits,
        packageCode: pack.code,
        externalId: receipt.externalId,
        detail: receipt.detail,
      },
    });
    throw new Error("Payment was not completed. No credits were added.");
  }
  const payment = await prisma.payment.create({
    data: {
      workspaceId,
      provider: receipt.provider,
      status: "paid",
      amountMyrCents: pack.priceMyrCents,
      credits: pack.credits,
      packageCode: pack.code,
      externalId: receipt.externalId,
      detail: receipt.detail,
    },
  });
  const result = await applyDelta(workspaceId, pack.credits, {
    kind: "purchase",
    packageCode: pack.code,
    action: "purchase",
    actorUserId: actor.id,
    paymentId: payment.id,
    note: receipt.externalId,
  });
  await logActivity({
    workspaceId,
    role: "client",
    code: "credits_purchased",
    detail: `${pack.code} · ${pack.credits} · ${receipt.provider}`,
  });
  return { balance: result.balance, payment };
}

export async function adjustCredits(actor: Actor, workspaceId: string, delta: number, note: string) {
  assertAdmin(actor);
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Enter a whole number of credits, other than zero.");
  if (note.trim().length < 3) throw new Error("An adjustment needs a short note.");
  await ensureWallet(workspaceId);
  const result = await applyDelta(workspaceId, delta, {
    kind: "adjustment",
    action: "adjustment",
    actorUserId: actor.id,
    note: note.trim().slice(0, 280),
  });
  await logActivity({
    workspaceId,
    role: "cmo",
    code: "credit_adjusted",
    detail: `${delta > 0 ? "+" : ""}${delta} · ${note.trim().slice(0, 180)} · ${actor.id}`,
  });
  return result;
}

export async function usageByAction(workspaceId: string) {
  const rows = await prisma.creditLedger.groupBy({
    by: ["action"],
    where: { workspaceId, kind: "spend" },
    _sum: { delta: true },
    _count: { _all: true },
  });
  return rows
    .map((row) => ({
      action: row.action,
      credits: Math.abs(row._sum.delta ?? 0),
      count: row._count._all,
    }))
    .sort((a, b) => b.credits - a.credits);
}

export async function creditReports() {
  const paid = await prisma.payment.findMany({ where: { status: "paid" } });
  const revenueCents = paid.reduce((sum, row) => sum + row.amountMyrCents, 0);
  const byPackage = new Map<string, { credits: number; cents: number; count: number }>();
  for (const row of paid) {
    const current = byPackage.get(row.packageCode) ?? { credits: 0, cents: 0, count: 0 };
    current.credits += row.credits;
    current.cents += row.amountMyrCents;
    current.count += 1;
    byPackage.set(row.packageCode, current);
  }
  const burned = await prisma.creditLedger.groupBy({
    by: ["action"],
    where: { kind: "spend" },
    _sum: { delta: true },
    _count: { _all: true },
  });
  return {
    revenueCents,
    purchases: paid.length,
    byPackage: [...byPackage.entries()].map(([code, value]) => ({ code, ...value })),
    burn: burned
      .map((row) => ({ action: row.action, credits: Math.abs(row._sum.delta ?? 0), count: row._count._all }))
      .sort((a, b) => b.credits - a.credits),
  };
}
