// OpenClaw Gateway – MVP Server
// Serves HTTP REST API for the desktop Mission Control cockpit.

import { createServer } from "node:http";

const PORT = parseInt(
  process.env.OPENCLAW_CONTAINER_PORT || process.env.PORT || "8080",
  10
);
const SAFE_MODE = process.env.OPENCLAW_SAFE_MODE === "1";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const VERSION = "0.1.0-mvp-fixed-v2";

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

  log("debug", `${method} ${url.pathname} (normalized: ${path})`);

  // ── Route Chain ──────────────────────────────────────────────────
  
  if (path === "/health" || path === "/api/v1/health") {
    // ── Health ──
    const uptimeMs = Date.now() - startTime;
    json(res, 200, {
      status: "healthy",
      uptime_ms: uptimeMs,
      safe_mode: SAFE_MODE,
      version: VERSION,
    });
    log("debug", `GET ${path} → 200 (uptime: ${uptimeMs}ms)`);

  } else if (path === "/api/v1/version" && method === "GET") {
    // ── Version ──
    json(res, 200, {
      version: VERSION,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    });

  } else if (path === "/api/v1/capabilities" && method === "GET") {
    // ── Capabilities ──
    json(res, 200, {
      safe_mode: SAFE_MODE,
      features: [
        "health",
        "agent_registry",
        "event_stream",
        "policy_read",
      ],
      control_ui: { base_path: "/ui", auth_required: false, auth_mode: "none", insecure_fallback: true },
    });

  } else if (path === "/api/v1/agents") {
    // ── Agents ──
    if (method === "GET") {
      json(res, 200, { agents: registeredAgents });
    } else if (method === "POST") {
      try {
        const body = await readBody(req);
        const agent = {
          name: body.name || `agent-${Date.now()}`,
          provider: body.provider || "unknown",
          model: body.model || "unknown",
          status: body.status || "registered",
          registered_at: new Date().toISOString(),
        };
        const idx = registeredAgents.findIndex((a) => a.name === agent.name);
        if (idx >= 0) registeredAgents[idx] = agent;
        else registeredAgents.push(agent);
        pushEvent("agent_registered", { agent_name: agent.name });
        json(res, 201, agent);
        log("info", `Agent registered: ${agent.name}`);
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
    } else if (method === "DELETE") {
      try {
        const body = await readBody(req);
        const name = body.name;
        registeredAgents = registeredAgents.filter((a) => a.name !== name);
        pushEvent("agent_removed", { agent_name: name });
        json(res, 200, { removed: name });
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
    } else {
      json(res, 405, { error: "method_not_allowed" });
    }

  } else if (path === "/api/v1/local-auth/bootstrap" || path === "/api/v1/auth/bootstrap") {
    // ── Auth Bootstrap ──
    log("info", `!!! BOOTSTRAP HIT !!! path='${path}'`);
    const token = url.searchParams.get("token");
    const expectedToken = process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN;
    
    if (expectedToken && token !== expectedToken) {
      json(res, 401, { error: "unauthorized" });
      log("warn", `Auth bootstrap failed: invalid token`);
    } else {
      const nextPath = url.searchParams.get("next") || "/";
      const redirectUrl = nextPath.startsWith("/") ? nextPath : "/" + nextPath;
      
      res.writeHead(302, {
        "Set-Cookie": "openclaw_local_session=mvp-mock-session; Path=/; HttpOnly; SameSite=Strict",
        "Cache-Control": "no-store",
        "Location": redirectUrl
      });
      res.end();
      log("info", `Auth bootstrap success, redirecting to ${redirectUrl}`);
    }

  } else if (path === "/api/v1/web.login.start") {
    // ── WhatsApp Login Start ──
    json(res, 200, {
      qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      message: "MVP Mode: This is a placeholder QR code. Use the full orchestrator for real WhatsApp pairing."
    });

  } else if (path === "/api/v1/web.login.wait") {
    // ── WhatsApp Login Wait ──
    await new Promise(r => setTimeout(r, 2000));
    json(res, 200, { connected: true, message: "MVP Mode: Mock connection successful." });

  } else if (path === "/ui" || path.startsWith("/ui/") || path === "/console" || path.startsWith("/console/")) {
    // ── Control UI Placeholder ──
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OpenClaw MVP</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #334155; text-align: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          h1 { margin-top: 0; color: #38bdf8; margin-bottom: 0.5rem; }
          p { color: #94a3b8; line-height: 1.5; margin: 0; }
          .badge { display: inline-block; background: #064e3b; color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; margin-bottom: 1.5rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">API Online</div>
          <h1>OpenClaw Gateway</h1>
          <p>The minimal API gateway is running securely.</p>
          <p style="font-size: 0.875rem; margin-top: 1.5rem; opacity: 0.7;">Native desktop features are enabled via Mission Control.</p>
        </div>
      </body>
      </html>
    `);
    log("info", `Served UI placeholder for ${path}`);

  } else if (path === "/api/v1/events") {
    // ── Events ──
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
    } else if (method === "POST") {
      try {
        const body = await readBody(req);
        const event = pushEvent(body.type || "custom", body.data || {});
        json(res, 201, event);
        log("info", `Event pushed: ${event.type}`);
      } catch (e) {
        json(res, 400, { error: "invalid_body", message: e.message });
      }
    } else {
      json(res, 405, { error: "method_not_allowed" });
    }

  } else if (path === "/api/v1/policies" && method === "GET") {
    // ── Policies ──
    json(res, 200, {
      safe_mode: SAFE_MODE,
      egress_allowlist: ["api.openai.com", "localhost"],
      cost_caps: { global_daily: null, per_agent_daily: null },
      note: "Policies are enforced by the desktop control plane.",
    });

  } else if (path.startsWith("/api/v1/connections")) {
    // ── Connections ──
    if (path === "/api/v1/connections/schema" && method === "GET") {
      json(res, 200, {
        version: "v1",
        generated_at: new Date().toISOString(),
        safe_mode: SAFE_MODE,
        channels: [],
        providers: []
      });
    } else if (path === "/api/v1/connections/status" && method === "GET") {
      json(res, 200, {
        version: "v1",
        generated_at: new Date().toISOString(),
        safe_mode: SAFE_MODE,
        channels: [],
        providers: []
      });
    } else if (method === "POST") {
      json(res, 200, { ok: true, message: "Stub executed successfully in gateway" });
    } else {
      json(res, 405, { error: "method_not_allowed" });
    }

  } else if (path === "/" || path === "") {
    // ── Root ──
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
        "/api/v1/connections/schema",
        "/api/v1/connections/status",
      ],
    });
    log("info", `GET / → 200`);

  } else {
    // ── 404 Handler ──
    log("error", `!!! 404 DEAD END !!! method=${method} path='${path}' url='${url.pathname}' raw='${req.url}'`);
    json(res, 404, { error: "not_found", path, method, full_url: url.pathname });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", `OpenClaw Gateway MVP listening on 0.0.0.0:${PORT}`);
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
