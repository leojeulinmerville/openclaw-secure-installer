import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildLocalSessionCookieValue,
  buildLocalSessionSetCookieHeader,
  isLocalDirectRequest,
  LOCAL_SESSION_COOKIE_NAME,
  verifyDesktopBootstrapToken,
} from "./auth.js";
import { sendJson, sendMethodNotAllowed, sendUnauthorized } from "./http-common.js";

const BOOTSTRAP_PATH = "/api/v1/local-auth/bootstrap";
const LOGOUT_PATH = "/api/v1/local-auth/logout";

function resolveNextPath(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return "/";
  }
  if (value.includes("://") || value.startsWith("//")) {
    return "/";
  }
  const normalized = value.replace(/\\/g, "/");
  const withPrefix = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (withPrefix.includes("..")) {
    return "/";
  }
  return withPrefix || "/";
}

function sendNoStoreRedirect(res: ServerResponse, nextPath: string) {
  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", nextPath);
  res.end();
}

export async function handleLocalSessionAuthHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { trustedProxies?: string[] },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  if (pathname !== BOOTSTRAP_PATH && pathname !== LOGOUT_PATH) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    sendMethodNotAllowed(res, "GET, POST");
    return true;
  }

  if (!isLocalDirectRequest(req, opts.trustedProxies)) {
    sendUnauthorized(res);
    return true;
  }

  const nextPath = resolveNextPath(url.searchParams.get("next"));

  if (pathname === LOGOUT_PATH) {
    res.setHeader(
      "Set-Cookie",
      `${LOCAL_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    sendNoStoreRedirect(res, nextPath);
    return true;
  }

  const token = url.searchParams.get("token");
  if (!verifyDesktopBootstrapToken({ token })) {
    sendJson(res, 401, {
      error: {
        type: "unauthorized",
        message: "Invalid bootstrap token",
      },
    });
    return true;
  }

  const cookieValue = buildLocalSessionCookieValue();
  if (!cookieValue) {
    sendJson(res, 503, {
      error: {
        type: "local_auth_unavailable",
        message: "Local session bootstrap is not configured",
      },
    });
    return true;
  }
  res.setHeader("Set-Cookie", buildLocalSessionSetCookieHeader(cookieValue));
  sendNoStoreRedirect(res, nextPath);
  return true;
}

