import type { IncomingMessage } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { GatewayAuthConfig, GatewayTailscaleMode } from "../config/config.js";
import { readTailscaleWhoisIdentity, type TailscaleWhoisIdentity } from "../infra/tailscale.js";
import { isTrustedProxyAddress, parseForwardedForClientIp, resolveGatewayClientIp, isPrivateIpAddress } from "./net.js";
export type ResolvedGatewayAuthMode = "token" | "password";

export const LOCAL_SESSION_COOKIE_NAME = "openclaw_local_session";
const LOCAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOCAL_SESSION_MAX_FUTURE_SKEW_MS = 60 * 1000;
const DESKTOP_BOOTSTRAP_TOKEN_ENV = "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN";

export type ResolvedGatewayAuth = {
  mode: ResolvedGatewayAuthMode;
  token?: string;
  password?: string;
  allowTailscale: boolean;
};

export type GatewayAuthResult = {
  ok: boolean;
  method?: "token" | "password" | "tailscale" | "device-token" | "local-session";
  user?: string;
  reason?: string;
};

type ConnectAuth = {
  token?: string;
  password?: string;
};

type TailscaleUser = {
  login: string;
  name: string;
  profilePic?: string;
};

type TailscaleWhoisLookup = (ip: string) => Promise<TailscaleWhoisIdentity | null>;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getDesktopBootstrapToken(env?: NodeJS.ProcessEnv): string | undefined {
  const value = env?.[DESKTOP_BOOTSTRAP_TOKEN_ENV];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function isLocalSessionAuthEnabled(env?: NodeJS.ProcessEnv): boolean {
  return Boolean(getDesktopBootstrapToken(env ?? process.env));
}

export function buildLocalSessionCookieValue(params?: {
  bootstrapToken?: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
}): string | undefined {
  const secret = params?.bootstrapToken ?? getDesktopBootstrapToken(params?.env ?? process.env);
  if (!secret) {
    return undefined;
  }
  const issuedAtMs = Math.max(0, Math.floor(params?.nowMs ?? Date.now()));
  const nonce = randomUUID().replace(/-/g, "");
  const payload = `${issuedAtMs}.${nonce}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyDesktopBootstrapToken(params: {
  token?: string | null;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const expected = getDesktopBootstrapToken(params.env ?? process.env);
  const provided = params.token?.trim() ?? "";
  if (!expected || !provided) {
    return false;
  }
  return safeEqual(provided, expected);
}

function parseCookieHeader(header: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) {
    return map;
  }
  for (const entry of header.split(";")) {
    const part = entry.trim();
    if (!part) {
      continue;
    }
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key || !value) {
      continue;
    }
    map.set(key, value);
  }
  return map;
}

function getCookie(req: IncomingMessage | undefined, key: string): string | undefined {
  if (!req) {
    return undefined;
  }
  const raw = headerValue(req.headers?.cookie);
  if (!raw) {
    return undefined;
  }
  return parseCookieHeader(raw).get(key);
}

function verifyLocalSessionCookieValue(params: {
  cookieValue?: string;
  bootstrapToken?: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
}): boolean {
  const secret = params.bootstrapToken ?? getDesktopBootstrapToken(params.env ?? process.env);
  const value = params.cookieValue?.trim() ?? "";
  if (!secret || !value) {
    return false;
  }

  const parts = value.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [issuedAtRaw, nonce, signature] = parts;
  if (!issuedAtRaw || !nonce || !signature) {
    return false;
  }
  if (!/^\d+$/.test(issuedAtRaw) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  if (!/^[a-z0-9]+$/i.test(nonce)) {
    return false;
  }
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }
  const nowMs = params.nowMs ?? Date.now();
  if (issuedAt > nowMs + LOCAL_SESSION_MAX_FUTURE_SKEW_MS) {
    return false;
  }
  if (nowMs - issuedAt > LOCAL_SESSION_TTL_MS) {
    return false;
  }

  const payload = `${issuedAtRaw}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return safeEqual(signature, expected);
}

export function isValidLocalSessionRequest(params: {
  req?: IncomingMessage;
  trustedProxies?: string[];
  env?: NodeJS.ProcessEnv;
}): boolean {
  if (!isLocalDirectRequest(params.req, params.trustedProxies)) {
    return false;
  }
  const cookieValue = getCookie(params.req, LOCAL_SESSION_COOKIE_NAME);
  return verifyLocalSessionCookieValue({
    cookieValue,
    env: params.env ?? process.env,
  });
}

export function buildLocalSessionSetCookieHeader(cookieValue: string): string {
  const maxAgeSeconds = Math.floor(LOCAL_SESSION_TTL_MS / 1000);
  return `${LOCAL_SESSION_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) {
    return false;
  }
  if (ip === "127.0.0.1") {
    return true;
  }
  if (ip.startsWith("127.")) {
    return true;
  }
  if (ip === "::1") {
    return true;
  }
  if (ip.startsWith("::ffff:127.")) {
    return true;
  }
  return false;
}

function getHostName(hostHeader?: string): string {
  const host = (hostHeader ?? "").trim().toLowerCase();
  if (!host) {
    return "";
  }
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end !== -1) {
      return host.slice(1, end);
    }
  }
  const [name] = host.split(":");
  return name ?? "";
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveTailscaleClientIp(req?: IncomingMessage): string | undefined {
  if (!req) {
    return undefined;
  }
  const forwardedFor = headerValue(req.headers?.["x-forwarded-for"]);
  return forwardedFor ? parseForwardedForClientIp(forwardedFor) : undefined;
}

function resolveRequestClientIp(
  req?: IncomingMessage,
  trustedProxies?: string[],
): string | undefined {
  if (!req) {
    return undefined;
  }
  return resolveGatewayClientIp({
    remoteAddr: req.socket?.remoteAddress ?? "",
    forwardedFor: headerValue(req.headers?.["x-forwarded-for"]),
    realIp: headerValue(req.headers?.["x-real-ip"]),
    trustedProxies,
  });
}

export function isLocalDirectRequest(req?: IncomingMessage, trustedProxies?: string[]): boolean {
  if (!req) {
    return false;
  }
  const clientIp = resolveRequestClientIp(req, trustedProxies) ?? "";
  
  const host = getHostName(req.headers?.host);
  const hostIsLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const hostIsTailscaleServe = host.endsWith(".ts.net");

  const hasForwarded = Boolean(
    req.headers?.["x-forwarded-for"] ||
    req.headers?.["x-real-ip"] ||
    req.headers?.["x-forwarded-host"],
  );

  const remoteIsTrustedProxy = isTrustedProxyAddress(req.socket?.remoteAddress, trustedProxies);

  let clientIsLocal = isLoopbackAddress(clientIp);

  // If the Gateway is running in Docker, the client IP might be the Docker bridge's private IP.
  // We allow Private IPs if the Host header is explicitly localhost/127.0.0.1 (meaning it was port-forwarded locally)
  // and no external proxy headers are present.
  if (!clientIsLocal && hostIsLocal && !hasForwarded && isPrivateIpAddress(clientIp)) {
    clientIsLocal = true;
  }

  if (!clientIsLocal) {
    return false;
  }

  return (hostIsLocal || hostIsTailscaleServe) && (!hasForwarded || remoteIsTrustedProxy);
}

function getTailscaleUser(req?: IncomingMessage): TailscaleUser | null {
  if (!req) {
    return null;
  }
  const login = req.headers["tailscale-user-login"];
  if (typeof login !== "string" || !login.trim()) {
    return null;
  }
  const nameRaw = req.headers["tailscale-user-name"];
  const profilePic = req.headers["tailscale-user-profile-pic"];
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : login.trim();
  return {
    login: login.trim(),
    name,
    profilePic: typeof profilePic === "string" && profilePic.trim() ? profilePic.trim() : undefined,
  };
}

function hasTailscaleProxyHeaders(req?: IncomingMessage): boolean {
  if (!req) {
    return false;
  }
  return Boolean(
    req.headers["x-forwarded-for"] &&
    req.headers["x-forwarded-proto"] &&
    req.headers["x-forwarded-host"],
  );
}

function isTailscaleProxyRequest(req?: IncomingMessage): boolean {
  if (!req) {
    return false;
  }
  return isLoopbackAddress(req.socket?.remoteAddress) && hasTailscaleProxyHeaders(req);
}

async function resolveVerifiedTailscaleUser(params: {
  req?: IncomingMessage;
  tailscaleWhois: TailscaleWhoisLookup;
}): Promise<{ ok: true; user: TailscaleUser } | { ok: false; reason: string }> {
  const { req, tailscaleWhois } = params;
  const tailscaleUser = getTailscaleUser(req);
  if (!tailscaleUser) {
    return { ok: false, reason: "tailscale_user_missing" };
  }
  if (!isTailscaleProxyRequest(req)) {
    return { ok: false, reason: "tailscale_proxy_missing" };
  }
  const clientIp = resolveTailscaleClientIp(req);
  if (!clientIp) {
    return { ok: false, reason: "tailscale_whois_failed" };
  }
  const whois = await tailscaleWhois(clientIp);
  if (!whois?.login) {
    return { ok: false, reason: "tailscale_whois_failed" };
  }
  if (normalizeLogin(whois.login) !== normalizeLogin(tailscaleUser.login)) {
    return { ok: false, reason: "tailscale_user_mismatch" };
  }
  return {
    ok: true,
    user: {
      login: whois.login,
      name: whois.name ?? tailscaleUser.name,
      profilePic: tailscaleUser.profilePic,
    },
  };
}

export function resolveGatewayAuth(params: {
  authConfig?: GatewayAuthConfig | null;
  env?: NodeJS.ProcessEnv;
  tailscaleMode?: GatewayTailscaleMode;
}): ResolvedGatewayAuth {
  const authConfig = params.authConfig ?? {};
  const env = params.env ?? process.env;
  const token =
    authConfig.token ?? env.OPENCLAW_GATEWAY_TOKEN ?? env.CLAWDBOT_GATEWAY_TOKEN ?? undefined;
  const password =
    authConfig.password ??
    env.OPENCLAW_GATEWAY_PASSWORD ??
    env.CLAWDBOT_GATEWAY_PASSWORD ??
    undefined;
  const mode: ResolvedGatewayAuth["mode"] = authConfig.mode ?? (password ? "password" : "token");
  const allowTailscale =
    authConfig.allowTailscale ?? (params.tailscaleMode === "serve" && mode !== "password");
  return {
    mode,
    token,
    password,
    allowTailscale,
  };
}

export function assertGatewayAuthConfigured(auth: ResolvedGatewayAuth): void {
  if (auth.mode === "token" && !auth.token) {
    if (auth.allowTailscale) {
      return;
    }
    throw new Error(
      "gateway auth mode is token, but no token was configured (set gateway.auth.token or OPENCLAW_GATEWAY_TOKEN)",
    );
  }
  if (auth.mode === "password" && !auth.password) {
    throw new Error("gateway auth mode is password, but no password was configured");
  }
}

export async function authorizeGatewayConnect(params: {
  auth: ResolvedGatewayAuth;
  connectAuth?: ConnectAuth | null;
  req?: IncomingMessage;
  trustedProxies?: string[];
  env?: NodeJS.ProcessEnv;
  tailscaleWhois?: TailscaleWhoisLookup;
}): Promise<GatewayAuthResult> {
  const { auth, connectAuth, req, trustedProxies } = params;
  const tailscaleWhois = params.tailscaleWhois ?? readTailscaleWhoisIdentity;
  const localDirect = isLocalDirectRequest(req, trustedProxies);
  const env = params.env ?? process.env;

  if (
    isValidLocalSessionRequest({
      req,
      trustedProxies,
      env,
    })
  ) {
    return {
      ok: true,
      method: "local-session",
      user: "local",
    };
  }

  if (auth.allowTailscale && !localDirect) {
    const tailscaleCheck = await resolveVerifiedTailscaleUser({
      req,
      tailscaleWhois,
    });
    if (tailscaleCheck.ok) {
      return {
        ok: true,
        method: "tailscale",
        user: tailscaleCheck.user.login,
      };
    }
  }

  if (auth.mode === "token") {
    if (!auth.token) {
      return { ok: false, reason: "token_missing_config" };
    }
    if (!connectAuth?.token) {
      return { ok: false, reason: "token_missing" };
    }
    if (!safeEqual(connectAuth.token, auth.token)) {
      return { ok: false, reason: "token_mismatch" };
    }
    return { ok: true, method: "token" };
  }

  if (auth.mode === "password") {
    const password = connectAuth?.password;
    if (!auth.password) {
      return { ok: false, reason: "password_missing_config" };
    }
    if (!password) {
      return { ok: false, reason: "password_missing" };
    }
    if (!safeEqual(password, auth.password)) {
      return { ok: false, reason: "password_mismatch" };
    }
    return { ok: true, method: "password" };
  }

  return { ok: false, reason: "unauthorized" };
}
