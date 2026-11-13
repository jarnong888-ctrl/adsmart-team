import { PrismaClient } from "@prisma/client";
import { ensureDemoAnalytics } from "../src/lib/ensure-analytics";

async function main() {
  const db = new PrismaClient();
  const inserted = await ensureDemoAnalytics(db);
  console.log("inserted", inserted);
  await db.$disconnect();
}

main();
