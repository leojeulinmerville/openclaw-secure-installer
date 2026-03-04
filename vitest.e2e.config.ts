import os from "node:os";
import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const cpuCount = os.cpus().length;
const e2eWorkers = isCI ? 2 : Math.min(4, Math.max(1, Math.floor(cpuCount * 0.25)));
const configuredPool = process.env.OPENCLAW_E2E_POOL;
const e2ePool =
  configuredPool === "forks" || configuredPool === "threads" ? configuredPool : "threads";

export default defineConfig({
  test: {
    pool: e2ePool,
    maxWorkers: e2eWorkers,
    include: ["test/**/*.e2e.test.ts", "src/**/*.e2e.test.ts"],
    setupFiles: ["test/setup.ts"],
    exclude: [
      "dist/**",
      "apps/macos/**",
      "apps/macos/.build/**",
      "**/vendor/**",
      "dist/OpenClaw.app/**",
    ],
  },
});
