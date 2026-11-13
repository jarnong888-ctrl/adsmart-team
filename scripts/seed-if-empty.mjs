// Staging start helper: seed the demo workspaces only on a fresh database,
// so restarts and redeploys keep whatever was changed while testing.
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`[staging] database has ${users} users, skipping seed`);
  } else {
    console.log("[staging] empty database, seeding demo workspaces");
    const result = spawnSync("npx", ["--yes", "tsx", "prisma/seed.ts"], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} finally {
  await prisma.$disconnect();
}
