import { afterAll, describe, expect, it } from "vitest";
import { hashSync } from "bcryptjs";
import { TenantIsolationError } from "@/lib/access";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/crypto";
import { createOauthState } from "@/lib/integrations/state";
import { connectMockAccount, disconnectIntegration } from "@/server/integrations";

const stamp = `int-${Date.now()}`;

describe("workspace connections", () => {
  const ids: string[] = [];

  afterAll(async () => {
    if (ids.length) await prisma.workspace.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  });

  it("stores an encrypted Google connection for the member and refuses another workspace", async () => {
    const user = await prisma.user.create({ data: { email: `a-${stamp}@test.local`, name: "A", passwordHash: hashSync("pw", 4), platformRole: "client" } });
    const other = await prisma.user.create({ data: { email: `b-${stamp}@test.local`, name: "B", passwordHash: hashSync("pw", 4), platformRole: "client" } });
    const workspace = await prisma.workspace.create({
      data: { name: "A", slug: `a-${stamp}`, members: { create: { userId: user.id, role: "owner" } } },
    });
    const elsewhere = await prisma.workspace.create({
      data: { name: "B", slug: `b-${stamp}`, members: { create: { userId: other.id, role: "owner" } } },
    });
    ids.push(workspace.id, elsewhere.id);
    const { nonce, state } = createOauthState(workspace.id, "google");
    process.env.INTEGRATIONS_MODE = "mock";
    await connectMockAccount({ id: user.id, platformRole: "client" }, [workspace.id], "google", state, nonce);
    const row = await prisma.integration.findUniqueOrThrow({ where: { workspaceId_provider: { workspaceId: workspace.id, provider: "google" } } });
    expect(row.status).toBe("connected");
    expect(row.accountLabel).toContain("@");
    expect(decryptSecret(row.tokenCipher)).toContain("mock_google");
    expect(JSON.parse(row.scopes).join(" ")).toContain("drive.file");
    expect(JSON.parse(row.scopes).join(" ")).toContain("spreadsheets");
    await expect(disconnectIntegration({ id: other.id, platformRole: "client" }, [elsewhere.id], workspace.id, "google")).rejects.toBeInstanceOf(TenantIsolationError);
    expect(await prisma.integration.count({ where: { workspaceId: workspace.id } })).toBe(1);
    await disconnectIntegration({ id: user.id, platformRole: "client" }, [workspace.id], workspace.id, "google");
    expect(await prisma.integration.count({ where: { workspaceId: workspace.id } })).toBe(0);
  });
});
