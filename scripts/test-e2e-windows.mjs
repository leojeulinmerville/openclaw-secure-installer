import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = process.cwd();
const tmpDir = process.env.OPENCLAW_TEST_TMP?.trim() || path.join(workspaceRoot, ".tmp-vitest");
fs.mkdirSync(tmpDir, { recursive: true });

const vitestCli = path.join(workspaceRoot, "node_modules", "vitest", "vitest.mjs");
const patchModule = path.join(workspaceRoot, "scripts", "vitest-win-node-patch.mjs");
const nodeImportFlag = `--import=${pathToFileURL(patchModule).href}`;
const extraArgs = process.argv.slice(2);
const commandArgs = [
  vitestCli,
  "run",
  "--config",
  "vitest.e2e.config.ts",
  "--configLoader",
  "runner",
  ...extraArgs,
];

const result = spawnSync(process.execPath, commandArgs, {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    TMP: tmpDir,
    TEMP: tmpDir,
    OPENCLAW_E2E_POOL: process.env.OPENCLAW_E2E_POOL ?? "threads",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, nodeImportFlag].filter(Boolean).join(" "),
  },
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
