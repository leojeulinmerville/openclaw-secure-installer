#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const BOOTSTRAP_PATHS = ["/api/v1/auth/bootstrap", "/api/v1/local-auth/bootstrap"];

function normalizeBaseUrl(raw) {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  const withScheme =
    candidate && /^https?:\/\//i.test(candidate) ? candidate : candidate ? `http://${candidate}` : DEFAULT_BASE_URL;
  const url = new URL(withScheme);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function readBootstrapToken() {
  const direct = process.env.OPENCLAW_SMOKE_BOOTSTRAP_TOKEN?.trim();
  if (direct) {
    return direct;
  }
  const desktop = process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN?.trim();
  if (desktop) {
    return desktop;
  }
  return "";
}

function cookiePairFromHeader(setCookieHeader) {
  if (typeof setCookieHeader !== "string" || !setCookieHeader.trim()) {
    return "";
  }
  const first = setCookieHeader.split(";")[0]?.trim() ?? "";
  return first.includes("=") ? first : "";
}

function printCheck(ok, label, detail) {
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? `: ${detail}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

async function fetchOrFail(url, options, errorLabel) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error(`${errorLabel} request failed`);
  }
}

async function bootstrapCookie(baseUrl, token) {
  let lastResponse = null;
  let lastPath = "";

  for (const path of BOOTSTRAP_PATHS) {
    const url = new URL(path, `${baseUrl}/`);
    url.searchParams.set("token", token);
    url.searchParams.set("next", "/");
    const response = await fetchOrFail(url, { method: "GET", redirect: "manual" }, "Bootstrap");
    lastResponse = response;
    lastPath = path;
    if (response.status !== 404) {
      break;
    }
  }

  if (!lastResponse) {
    throw new Error("Bootstrap endpoint is unavailable");
  }

  if (!lastResponse.ok && (lastResponse.status < 300 || lastResponse.status >= 400)) {
    throw new Error(`bootstrap returned HTTP ${lastResponse.status}`);
  }

  const cookie = cookiePairFromHeader(lastResponse.headers.get("set-cookie"));
  if (!cookie) {
    throw new Error("bootstrap did not return a session cookie");
  }

  return { cookie, path: lastPath, status: lastResponse.status };
}

async function getJsonWithCookie(baseUrl, path, cookie, label) {
  const url = new URL(path, `${baseUrl}/`);
  const response = await fetchOrFail(
    url,
    {
      method: "GET",
      headers: {
        cookie,
        accept: "application/json",
      },
    },
    label,
  );

  if (response.status !== 200) {
    throw new Error(`${label.toLowerCase()} returned HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${label.toLowerCase()} returned invalid JSON`);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.OPENCLAW_GATEWAY_BASE_URL ?? DEFAULT_BASE_URL);
  const bootstrapToken = readBootstrapToken();
  const results = [];

  try {
    const healthUrl = new URL("/health", `${baseUrl}/`);
    const healthResponse = await fetchOrFail(healthUrl, { method: "GET" }, "Health");
    if (healthResponse.status !== 200) {
      throw new Error(`health returned HTTP ${healthResponse.status}`);
    }
    results.push({ ok: true, label: "health", detail: "HTTP 200" });
    printCheck(true, "health", "HTTP 200");
  } catch (error) {
    const message = error instanceof Error ? error.message : "health check failed";
    results.push({ ok: false, label: "health", detail: message });
    printCheck(false, "health", message);
    console.log(`Connections smoke: FAIL (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
    process.exit(1);
  }

  if (!bootstrapToken) {
    const message =
      "set OPENCLAW_SMOKE_BOOTSTRAP_TOKEN (or OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN) to run cookie-auth checks";
    results.push({ ok: false, label: "bootstrap", detail: message });
    printCheck(false, "bootstrap", message);
    console.log(`Connections smoke: FAIL (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
    process.exit(1);
  }

  let cookie = "";
  try {
    const bootstrap = await bootstrapCookie(baseUrl, bootstrapToken);
    cookie = bootstrap.cookie;
    const detail = `cookie acquired via ${bootstrap.path} (HTTP ${bootstrap.status})`;
    results.push({ ok: true, label: "bootstrap", detail });
    printCheck(true, "bootstrap", detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "bootstrap failed";
    results.push({ ok: false, label: "bootstrap", detail: message });
    printCheck(false, "bootstrap", message);
    console.log(`Connections smoke: FAIL (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
    process.exit(1);
  }

  try {
    const schema = await getJsonWithCookie(
      baseUrl,
      "/api/v1/connections/schema",
      cookie,
      "Connections schema",
    );
    if (!Array.isArray(schema.channels) || !Array.isArray(schema.providers)) {
      throw new Error("connections schema payload missing channels/providers arrays");
    }
    const detail = `channels=${schema.channels.length}, providers=${schema.providers.length}`;
    results.push({ ok: true, label: "schema", detail });
    printCheck(true, "connections schema", detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "schema check failed";
    results.push({ ok: false, label: "schema", detail: message });
    printCheck(false, "connections schema", message);
    console.log(`Connections smoke: FAIL (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
    process.exit(1);
  }

  try {
    const status = await getJsonWithCookie(
      baseUrl,
      "/api/v1/connections/status",
      cookie,
      "Connections status",
    );
    if (!Array.isArray(status.channels) || !Array.isArray(status.providers)) {
      throw new Error("connections status payload missing channels/providers arrays");
    }
    const detail = `channels=${status.channels.length}, providers=${status.providers.length}`;
    results.push({ ok: true, label: "status", detail });
    printCheck(true, "connections status", detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "status check failed";
    results.push({ ok: false, label: "status", detail: message });
    printCheck(false, "connections status", message);
    console.log(`Connections smoke: FAIL (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
    process.exit(1);
  }

  console.log(`Connections smoke: PASS (${results.filter((entry) => entry.ok).length}/${results.length} checks passed)`);
}

await main();
