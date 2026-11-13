import { afterAll, describe, expect, it } from "vitest";
import { hashSync } from "bcryptjs";
import { TenantIsolationError } from "@/lib/access";
import { InsufficientCreditsError } from "@/lib/credits";
import { prisma } from "@/lib/db";
import { adjustCredits, ensureWallet, purchasePackage, spendCredits } from "@/server/credits";

const stamp = `credits-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function workspaceFor(email: string, role: "client" | "admin") {
  const user = await prisma.user.create({
    data: { email, name: email, passwordHash: hashSync("test-password", 4), platformRole: role },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: email,
      slug: email.replace(/[^a-z0-9]+/gi, "-"),
      members: role === "client" ? { create: { userId: user.id, role: "owner" } } : undefined,
    },
  });
  return { user, workspace };
}

describe("credit wallet", () => {
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) await prisma.workspace.deleteMany({ where: { id: { in: created } } });
    await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  });

  it("deducts the configured cost and keeps another workspace untouched", async () => {
    const a = await workspaceFor(`a-${stamp}@test.local`, "client");
    const b = await workspaceFor(`b-${stamp}@test.local`, "client");
    created.push(a.workspace.id, b.workspace.id);
    const startA = await ensureWallet(a.workspace.id);
    const startB = await ensureWallet(b.workspace.id);
    const after = await spendCredits(a.workspace.id, a.user.id, "write_script");
    expect(after.spent).toBe(4);
    expect(after.balance).toBe(startA.balance - 4);
    const ledger = await prisma.creditLedger.findFirst({
      where: { workspaceId: a.workspace.id, kind: "spend" },
      orderBy: { createdAt: "desc" },
    });
    expect(ledger?.balanceAfter).toBe(after.balance);
    expect(ledger?.delta).toBe(-4);
    const untouched = await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: b.workspace.id } });
    expect(untouched.balance).toBe(startB.balance);
  });

  it("blocks a spend that would go negative and leaves the balance unchanged", async () => {
    const a = await workspaceFor(`low-${stamp}@test.local`, "client");
    created.push(a.workspace.id);
    await ensureWallet(a.workspace.id);
    await prisma.creditWallet.update({ where: { workspaceId: a.workspace.id }, data: { balance: 3 } });
    await expect(spendCredits(a.workspace.id, a.user.id, "generate_week")).rejects.toBeInstanceOf(InsufficientCreditsError);
    const wallet = await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: a.workspace.id } });
    expect(wallet.balance).toBe(3);
    expect(wallet.balance).toBeGreaterThanOrEqual(0);
  });

  it("rejects a purchase from another workspace and from staff", async () => {
    const a = await workspaceFor(`buy-a-${stamp}@test.local`, "client");
    const b = await workspaceFor(`buy-b-${stamp}@test.local`, "client");
    const staff = await workspaceFor(`staff-${stamp}@test.local`, "admin");
    created.push(a.workspace.id, b.workspace.id, staff.workspace.id);
    await ensureWallet(a.workspace.id);
    const before = (await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: a.workspace.id } })).balance;
    await expect(purchasePackage(b.user, a.workspace.id, [b.workspace.id], "intermediate")).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(purchasePackage(staff.user, a.workspace.id, [a.workspace.id], "intermediate")).rejects.toBeInstanceOf(TenantIsolationError);
    const after = await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: a.workspace.id } });
    expect(after.balance).toBe(before);
    expect(await prisma.payment.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });

  it("adds credits through the mock provider and records the buyer", async () => {
    const a = await workspaceFor(`paid-${stamp}@test.local`, "client");
    created.push(a.workspace.id);
    const before = (await ensureWallet(a.workspace.id)).balance;
    const bought = await purchasePackage(a.user, a.workspace.id, [a.workspace.id], "intermediate");
    expect(bought.balance).toBe(before + 200);
    expect(bought.payment.status).toBe("paid");
    expect(bought.payment.provider).toBe("mock");
    expect(bought.payment.amountMyrCents).toBe(4900);
    const row = await prisma.creditLedger.findFirst({ where: { paymentId: bought.payment.id } });
    expect(row?.actorUserId).toBe(a.user.id);
    expect(row?.balanceAfter).toBe(bought.balance);
  });

  it("lets staff adjust credits and refuses an adjustment below zero", async () => {
    const staff = await workspaceFor(`adjust-staff-${stamp}@test.local`, "admin");
    const client = await workspaceFor(`adjust-client-${stamp}@test.local`, "client");
    created.push(staff.workspace.id, client.workspace.id);
    await ensureWallet(client.workspace.id);
    await prisma.creditWallet.update({ where: { workspaceId: client.workspace.id }, data: { balance: 8 } });
    await expect(adjustCredits(client.user, client.workspace.id, 10, "client trying")).rejects.toBeInstanceOf(TenantIsolationError);
    const added = await adjustCredits(staff.user, client.workspace.id, 15, "goodwill for a demo");
    expect(added.balance).toBe(23);
    expect(added.ledger.actorUserId).toBe(staff.user.id);
    expect(added.ledger.kind).toBe("adjustment");
    await expect(adjustCredits(staff.user, client.workspace.id, -100, "too much")).rejects.toBeInstanceOf(InsufficientCreditsError);
    const wallet = await prisma.creditWallet.findUniqueOrThrow({ where: { workspaceId: client.workspace.id } });
    expect(wallet.balance).toBe(23);
  });
});
