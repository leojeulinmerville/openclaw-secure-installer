import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { runExec } from "../process/exec.js";
import { discoverOpenClawPlugins } from "../plugins/discovery.js";
import { finalizeOnboardingWizard } from "../wizard/onboarding.finalize.js";
import { installCompletion } from "../cli/completion-cli.js";
import {
  checkShellCompletionStatus,
  ensureCompletionCacheExists,
} from "../commands/doctor-completion.js";
import { buildGatewayInstallPlan } from "../commands/daemon-install-helpers.js";
import { resolveGatewayService } from "../daemon/service.js";
import { ensureSystemdUserLingerInteractive } from "../commands/systemd-linger.js";

// Mock dependencies
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...actual,
    execFile: vi.fn((cmd, args, opts, cb) => {
      // Logic to simulate failure for non-allowed commands is inside exec.ts, 
      // but execFile is the underlying call.
      // If exec.ts throws before calling execFile, this mock won't be reached for blocked commands.
      if (cb) cb(null, "mock stdout", "mock stderr");
      return { stdout: "mock stdout", stderr: "mock stderr" };
    }),
    spawn: vi.fn(() => ({
      on: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn(),
      unref: vi.fn(),
    })),
  };
});

vi.mock("../cli/completion-cli.js", () => ({
  installCompletion: vi.fn(),
}));

vi.mock("../commands/doctor-completion.js", () => ({
  checkShellCompletionStatus: vi.fn(() => ({
    profileInstalled: false,
    shell: "bash",
    usesSlowPattern: false,
    cacheExists: false,
  })),
  ensureCompletionCacheExists: vi.fn(() => true),
}));

vi.mock("../commands/onboard-helpers.js", () => ({
  probeGatewayReachable: vi.fn(() => ({ ok: true })),
  resolveControlUiLinks: vi.fn(() => ({ httpUrl: "http://localhost", wsUrl: "ws://localhost" })),
  waitForGatewayReachable: vi.fn(),
  detectBrowserOpenSupport: vi.fn(() => ({ ok: true })),
  formatControlUiSshHint: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: vi.fn(() => ({
    isLoaded: vi.fn(() => false),
    install: vi.fn(),
    restart: vi.fn(),
    uninstall: vi.fn(),
  })),
}));

vi.mock("../commands/daemon-install-helpers.js", () => ({
  buildGatewayInstallPlan: vi.fn(async () => ({
    programArguments: [],
    workingDirectory: os.tmpdir(),
    environment: {},
  })),
  gatewayInstallErrorHint: vi.fn(() => "install hint"),
}));

vi.mock("../commands/systemd-linger.js", () => ({
  ensureSystemdUserLingerInteractive: vi.fn(),
}));

vi.mock("../infra/control-ui-assets.js", () => ({
  ensureControlUiAssetsBuilt: vi.fn(() => ({ ok: true })),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn(() => Promise.reject("no file")),
  },
}));

vi.mock("../tui/tui.js", () => ({
  runTui: vi.fn(),
}));

vi.mock("../terminal/restore.js", () => ({
  restoreTerminalState: vi.fn(),
}));


describe("Safe Mode", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Process Execution", () => {
    it("blocks disallowed commands in Safe Mode", async () => {
      process.env.OPENCLAW_SAFE_MODE = "1";
      await expect(runExec("not-allowed", ["--version"])).rejects.toThrow(
        /Safe Mode validation failed: Execution of 'not-allowed' is blocked/,
      );
    });

    it("allows approved commands in Safe Mode (node)", async () => {
      process.env.OPENCLAW_SAFE_MODE = "1";
      await expect(runExec("node", ["-v"])).resolves.toBeDefined();
    });

    it("allows process.execPath in Safe Mode", async () => {
      process.env.OPENCLAW_SAFE_MODE = "1";
      await expect(runExec(process.execPath, ["-v"])).resolves.toBeDefined();
    });

    it("allows all commands when Safe Mode is off", async () => {
      delete process.env.OPENCLAW_SAFE_MODE;
      await expect(
        runExec(process.execPath, ["-e", "process.stdout.write('ok')"]),
      ).resolves.toBeDefined();
    });
  });

  describe("Plugin Discovery", () => {
    it("does not discover external plugins in Safe Mode", () => {
      process.env.OPENCLAW_SAFE_MODE = "1";

      const extraPath = path.join(os.tmpdir(), "openclaw-safe-mode-plugin");
      const result = discoverOpenClawPlugins({ extraPaths: [extraPath], workspaceDir: extraPath });

      const hasNonBundled = result.candidates.some((candidate) => candidate.origin !== "bundled");
      expect(hasNonBundled).toBe(false);

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("External plugins discovery disabled"),
          }),
        ]),
      );
    });
  });

  describe("Onboarding Wizard", () => {
    it("skips host modifications in Safe Mode", async () => {
      process.env.OPENCLAW_SAFE_MODE = "1";

      const mockPrompter = {
        confirm: vi.fn(() => Promise.resolve(true)),
        note: vi.fn(() => Promise.resolve()),
        progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
        select: vi.fn(() => Promise.resolve("skip")),
        outro: vi.fn(),
      };

      await finalizeOnboardingWizard({
        flow: "manual",
        opts: { skipUi: true, skipHealth: true, installDaemon: true },
        baseConfig: {},
        nextConfig: {},
        settings: { port: 1234, bind: "localhost" } as any,
        prompter: mockPrompter,
        runtime: { error: vi.fn() } as any,
        workspaceDir: os.tmpdir(),
      });

      expect(installCompletion).not.toHaveBeenCalled();
      expect(checkShellCompletionStatus).not.toHaveBeenCalled();
      expect(ensureCompletionCacheExists).not.toHaveBeenCalled();
      expect(vi.mocked(resolveGatewayService)).not.toHaveBeenCalled();
      expect(vi.mocked(buildGatewayInstallPlan)).not.toHaveBeenCalled();
      expect(vi.mocked(ensureSystemdUserLingerInteractive)).not.toHaveBeenCalled();

      expect(mockPrompter.note).toHaveBeenCalledWith(
        expect.stringContaining("Safe Mode enabled: skipping shell completion install"),
        "Safe Mode",
      );
    });
  });
});
