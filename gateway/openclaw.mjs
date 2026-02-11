// OpenClaw Gateway – MVP Server
// Serves HTTP REST API for the desktop Mission Control cockpit.

import { createServer } from "node:http";

const PORT = parseInt(
  process.env.OPENCLAW_CONTAINER_PORT || process.env.PORT || "8080",
  10
);
const SAFE_MODE = process.env.OPENCLAW_SAFE_MODE === "1";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const VERSION = "0.1.0-mvp";

const startTime = Date.now();

// ── In-memory stores (ephemeral, desktop is the source of truth) ───
let registeredAgents = [];
let events = [];
const MAX_EVENTS = 200;

function log(level, msg) {
  if (level === "debug" && LOG_LEVEL !== "debug") return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
}

function pushEvent(type, data) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    ...data,
  };
  events.push(event);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  return event;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  });
  res.end(payload);
}

// ── Route handling ─────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  // ── Health ──────────────────────────────────────────────────────
  if (path === "/health" || path === "/api/v1/health") {
    const uptimeMs = Date.now() - startTime;
    json(res, 200, {
      status: "healthy",
      uptime_ms: uptimeMs,
      safe_mode: SAFE_MODE,
      version: VERSION,
    });
    log("debug", `GET ${path} → 200 (uptime: ${uptimeMs}ms)`);
    return;
  }

  // ── Version ─────────────────────────────────────────────────────
  if (path === "/api/v1/version" && method === "GET") {
    json(res, 200, {
      version: VERSION,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    });
    return;
  }

  // ── Capabilities ────────────────────────────────────────────────
  if (path === "/api/v1/capabilities" && method === "GET") {
    json(res, 200, {
      safe_mode: SAFE_MODE,
      features: [
        "health",
        "agent_registry",
        "event_stream",
        "policy_read",
      ],
    });
    return;
  }

  // ── Agents ──────────────────────────────────────────────────────
  if (path === "/api/v1/agents") {
    if (method === "GET") {
      json(res, 200, { agents: registeredAgents });
      return;
    }
    if (method === "POST") {
      try {
        const body = await readBody(req);
        const agent = {
          name: body.name || `agent-${Date.now()}`,
          provider: body.provider || "unknown",
          model: body.model || "unknown",
          status: body.status || "registered",
          registered_at: new Date().toISOString(),
        };
        // Upsert by name
        const idx = registeredAgents.findIndex((a) => a.name === agent.name);
        if (idx >= 0) registeredAgents[idx] = agent;
        else registeredAgents.push(agent);
        pushEvent("agent_registered", { agent_name: agent.name });
        json(res, 201, agent);
        log("info", `Agent registered: ${agent.name}`);
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
      return;
    }
    if (method === "DELETE") {
      try {
        const body = await readBody(req);
        const name = body.name;
        registeredAgents = registeredAgents.filter((a) => a.name !== name);
        pushEvent("agent_removed", { agent_name: name });
        json(res, 200, { removed: name });
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
      return;
    }
  }

  // ── Events ──────────────────────────────────────────────────────
  if (path === "/api/v1/events") {
    if (method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const since = url.searchParams.get("since");
      let filtered = events;
      if (since) {
        const sinceTs = new Date(since).getTime();
        filtered = filtered.filter(
          (e) => new Date(e.timestamp).getTime() > sinceTs
        );
      }
      json(res, 200, { events: filtered.slice(-limit) });
      return;
    }
    if (method === "POST") {
      try {
        const body = await readBody(req);
        const event = pushEvent(body.type || "custom", body.data || {});
        json(res, 201, event);
        log("info", `Event pushed: ${event.type}`);
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
      return;
    }
  }

  // ── Policies (read-only, desktop is source of truth) ────────────
  if (path === "/api/v1/policies" && method === "GET") {
    json(res, 200, {
      safe_mode: SAFE_MODE,
      egress_allowlist: ["api.openai.com", "localhost"],
      cost_caps: { global_daily: null, per_agent_daily: null },
      note: "Policies are enforced by the desktop control plane.",
    });
    return;
  }

  // ── Root info ───────────────────────────────────────────────────
  if (path === "/" || path === "") {
    json(res, 200, {
      name: "openclaw-gateway",
      version: VERSION,
      safe_mode: SAFE_MODE,
      endpoints: [
        "/",
        "/health",
        "/api/v1/health",
        "/api/v1/version",
        "/api/v1/capabilities",
        "/api/v1/agents",
        "/api/v1/events",
        "/api/v1/policies",
      ],
    });
    log("info", `GET / → 200`);
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────
  json(res, 404, { error: "not_found", path: url.pathname });
  log("info", `${method} ${url.pathname} → 404`);
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", `OpenClaw Gateway listening on 0.0.0.0:${PORT}`);
  log("info", `Safe mode: ${SAFE_MODE ? "ENABLED" : "disabled"}`);
  log("info", `Log level: ${LOG_LEVEL}`);
  log("info", `Health: http://localhost:${PORT}/health`);
  log("info", `API: http://localhost:${PORT}/api/v1/`);
});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log("info", `Received ${sig}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
