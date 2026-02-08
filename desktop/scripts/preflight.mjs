import { spawnSync } from "node:child_process";
import path from "node:path";

const MIN_NODE = {
  major22: 12,
  major20: 19,
};

function parseNodeVersion(version) {
  const [majorRaw, minorRaw] = version.split(".");
  return {
    major: Number.parseInt(majorRaw || "0", 10),
    minor: Number.parseInt(minorRaw || "0", 10),
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

function checkNode() {
  const version = process.versions.node;
  if (!isNodeSupported(version)) {
    fail(
      `Node 22.12+ or 20.19+ is required. Current: ${version}. Please upgrade Node.`,
    );
  }
}

function runCheck(env, cmd, args) {
  const result = spawnSync(cmd, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const notFound = Boolean(result.error && result.error.code === "ENOENT");
  return {
    ok: result.status === 0,
    notFound,
  };
}

function addCargoPaths(env) {
  const candidates = [];
  if (env.USERPROFILE) {
    candidates.push(path.join(env.USERPROFILE, ".cargo", "bin"));
  }
  if (env.CARGO_HOME) {
    candidates.push(path.join(env.CARGO_HOME, "bin"));
  }
  if (candidates.length === 0) {
    return;
  }
  const existing = (env.PATH || "").split(path.delimiter).filter(Boolean);
  env.PATH = [...candidates, ...existing].join(path.delimiter);
}

function ensureCargo(env) {
  let cargo = runCheck(env, "cargo", ["-V"]);
  if (!cargo.ok && cargo.notFound && process.platform === "win32") {
    addCargoPaths(env);
    cargo = runCheck(env, "cargo", ["-V"]);
  }

  if (!cargo.ok) {
    fail(
      "cargo not found. Install Rust via rustup and ensure Visual Studio Build Tools (Desktop C++) are installed.",
    );
  }

  let rustc = runCheck(env, "rustc", ["-V"]);
  if (!rustc.ok && rustc.notFound && process.platform === "win32") {
    addCargoPaths(env);
    rustc = runCheck(env, "rustc", ["-V"]);
  }
  if (!rustc.ok) {
    fail(
      "rustc not found. Install Rust via rustup and reopen your terminal after updating PATH.",
    );
  }
}

function parseMode(argv) {
  const [mode, ...extra] = argv;
  if (mode !== "dev" && mode !== "build") {
    console.error("Usage: node scripts/preflight.mjs <dev|build>");
    process.exit(1);
  }
  return { mode, extra };
}

function quoteCmdArg(arg) {
  if (!/[\s\"]/u.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '""')}"`;
}

function runTauri(env, mode, extraArgs) {
  if (process.platform === "win32") {
    const args = ["pnpm", "exec", "tauri", mode, ...extraArgs];
    const commandLine = args.map(quoteCmdArg).join(" ");
    const result = spawnSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
      env,
      stdio: "inherit",
    });
    if (result.error) {
      fail(`Failed to run pnpm exec tauri ${mode}: ${result.error.message}`);
    }
    process.exit(result.status ?? 1);
  }

  const result = spawnSync("pnpm", ["exec", "tauri", mode, ...extraArgs], {
    env,
    stdio: "inherit",
  });
  if (result.error) {
    fail(`Failed to run pnpm exec tauri ${mode}: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

const env = { ...process.env };
checkNode();
ensureCargo(env);
const { mode, extra } = parseMode(process.argv.slice(2));
runTauri(env, mode, extra);
