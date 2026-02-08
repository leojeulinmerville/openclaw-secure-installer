import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MIN_NODE = {
  major22: 12,
  major20: 19,
};

const COMMAND_HINTS = {
  node: "Node 22.12+ or 20.19+ is required.",
  cargo: "Install Rust (rustup) and Visual Studio Build Tools (Desktop C++).",
};

function parseNodeVersion(version) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
  };
}

function isNodeSupported(version) {
  const parsed = parseNodeVersion(version);
  if (parsed.major > 22) {
    return true;
  }
  if (parsed.major === 22 && parsed.minor >= MIN_NODE.major22) {
    return true;
  }
  if (parsed.major === 20 && parsed.minor >= MIN_NODE.major20) {
    return true;
  }
  return false;
}

function runCmd(cmd, args, env) {
  const result = spawnSync(cmd, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error,
  };
}

function checkCargo(env) {
  const result = runCmd("cargo", ["-V"], env);
  const notFound = Boolean(result.error && result.error.code === "ENOENT");
  return {
    ok: result.status === 0,
    notFound,
    result,
  };
}

function checkRustc(env) {
  const result = runCmd("rustc", ["-V"], env);
  const notFound = Boolean(result.error && result.error.code === "ENOENT");
  return {
    ok: result.status === 0,
    notFound,
  };
}

function candidateCargoPaths() {
  const candidates = [];
  if (process.env.USERPROFILE) {
    candidates.push(path.join(process.env.USERPROFILE, ".cargo", "bin"));
  }
  if (process.env.CARGO_HOME) {
    candidates.push(path.join(process.env.CARGO_HOME, "bin"));
  }
  return candidates;
}

function extendPath(env, additions) {
  const existing = (env.PATH || "").split(path.delimiter).filter(Boolean);
  const seen = new Set(existing.map((entry) => entry.toLowerCase()));
  const extra = [];
  for (const entry of additions) {
    const normalized = entry.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    extra.push(entry);
    seen.add(normalized);
  }
  if (extra.length === 0) {
    return env.PATH || "";
  }
  return [...extra, ...existing].join(path.delimiter);
}

function ensureCargoOnWindows(env, diagnostics) {
  if (process.platform !== "win32") {
    return env;
  }
  const candidates = candidateCargoPaths().filter((candidate) => fs.existsSync(candidate));
  if (candidates.length === 0) {
    diagnostics.push("cargo not found in default locations.");
    return env;
  }
  const updated = { ...env };
  updated.PATH = extendPath(updated, candidates);
  diagnostics.push("Added default cargo bin entries to PATH for this run.");
  return updated;
}

function printDiagnostics(items) {
  if (items.length === 0) {
    return;
  }
  console.warn("Diagnostics:");
  for (const item of items) {
    console.warn(`- ${item}`);
  }
}

function fail(message, diagnostics) {
  console.error(message);
  printDiagnostics(diagnostics);
  process.exit(1);
}

function runPreflight() {
  const diagnostics = [];
  const nodeVersion = process.versions.node;
  if (!isNodeSupported(nodeVersion)) {
    fail(
      `${COMMAND_HINTS.node} Current: ${nodeVersion}.`,
      diagnostics,
    );
  }

  let env = { ...process.env };
  let cargo = checkCargo(env);
  if (!cargo.ok && cargo.notFound) {
    env = ensureCargoOnWindows(env, diagnostics);
    cargo = checkCargo(env);
  }

  if (!cargo.ok) {
    diagnostics.push("cargo is not available in PATH.");
    fail(`cargo not found. ${COMMAND_HINTS.cargo}`, diagnostics);
  }

  const rustc = checkRustc(env);
  if (!rustc.ok) {
    diagnostics.push("rustc not found (required by Rust toolchain).");
  }

  if (diagnostics.length > 0) {
    printDiagnostics(diagnostics);
  }

  return env;
}

function runTauri(env, argv) {
  if (argv.length === 0) {
    console.error("No tauri command provided. Use: dev | build");
    process.exit(1);
  }
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(pnpmCmd, ["exec", "tauri", ...argv], {
    env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Failed to launch pnpm exec tauri: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

const env = runPreflight();
const argv = process.argv.slice(2);
runTauri(env, argv);
