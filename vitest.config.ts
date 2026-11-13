import path from "path";
import { defineConfig } from "vitest/config";

process.env.DATABASE_URL = process.env.DATABASE_URL?.includes("test.db")
  ? process.env.DATABASE_URL
  : "file:./prisma/test.db";
process.env.LLM_MODE = process.env.LLM_MODE || "mock";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
