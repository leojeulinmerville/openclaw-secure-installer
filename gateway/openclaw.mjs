// OpenClaw Gateway – Minimal MVP Server
// This is the entrypoint for the gateway container.
// It serves HTTP on port 80 with a /health endpoint.

import { createServer } from "node:http";

const PORT = process.env.PORT || 80;
const SAFE_MODE = process.env.OPENCLAW_SAFE_MODE === "1";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const startTime = Date.now();

function log(level, msg) {
  if (level === "debug" && LOG_LEVEL !== "debug") return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check endpoint
  if (url.pathname === "/health" || url.pathname === "/health/") {
    const uptimeMs = Date.now() - startTime;
    const body = JSON.stringify({
      status: "healthy",
      uptime_ms: uptimeMs,
      safe_mode: SAFE_MODE,
      version: "0.1.0-mvp",
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    res.end(body);
    log("debug", `GET /health → 200 (uptime: ${uptimeMs}ms)`);
    return;
  }

  // Root / info
  if (url.pathname === "/" || url.pathname === "") {
    const body = JSON.stringify({
      name: "openclaw-gateway",
      version: "0.1.0-mvp",
      safe_mode: SAFE_MODE,
      endpoints: ["/", "/health"],
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
    log("info", `GET / → 200`);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
  log("info", `${req.method} ${url.pathname} → 404`);
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", `OpenClaw Gateway listening on 0.0.0.0:${PORT}`);
  log("info", `Safe mode: ${SAFE_MODE ? "ENABLED" : "disabled"}`);
  log("info", `Log level: ${LOG_LEVEL}`);
  log("info", `Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log("info", `Received ${sig}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
