import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnyAgentTool } from "../agents/tools/common.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import { createOpenClawTools } from "../agents/openclaw-tools.js";
import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { loadConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import {
  resolveControlUiRootOverrideSync,
  resolveControlUiRootSync,
} from "../infra/control-ui-assets.js";
import { isSafeMode } from "../infra/safe-mode.js";
import { resolveControlUiBasePath } from "./control-ui-shared.js";
import {
  sendJson,
  sendMethodNotAllowed,
  sendUnauthorized,
} from "./http-common.js";
import { getBearerToken } from "./http-utils.js";
import {
  authorizeGatewayConnect,
  isLocalSessionAuthEnabled,
  type ResolvedGatewayAuth,
} from "./auth.js";
import { listGatewayMethods } from "./server-methods-list.js";

type ChannelCapability = {
  id: string;
  display_name: string;
  requires_pairing: boolean;
  requires_api_key: boolean;
  status: "available" | "configured" | "needs_setup" | "disabled" | "unknown";
};

type ToolCapability = {
  id: string;
  display_name: string;
  scope: string;
  blocked_by_policy: boolean;
};

type OrchestratorCapability = {
  id: string;
  display_name: string;
};

type CapabilitiesResponse = {
  version: "v1";
  generated_at: string;
  safe_mode: boolean;
  control_ui: {
    base_path: string;
    auth_required: boolean;
    auth_mode: "cookie" | "header-injection" | "token" | "password";
    insecure_fallback: boolean;
  };
  channels: ChannelCapability[];
  tools: ToolCapability[];
  orchestrators: OrchestratorCapability[];
};

function toDisplayLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isCredentialKey(key: string): boolean {
  return /(token|secret|password|api.?key|access.?key|webhook)/i.test(key);
}

function hasCredentialField(schema: unknown, visited = new Set<unknown>()): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }
  if (visited.has(schema)) {
    return false;
  }
  visited.add(schema);
  const record = schema as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (isCredentialKey(key)) {
      return true;
    }
    if (key === "properties" && value && typeof value === "object") {
      for (const nestedKey of Object.keys(value as Record<string, unknown>)) {
        if (isCredentialKey(nestedKey)) {
          return true;
        }
      }
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (hasCredentialField(entry, visited)) {
          return true;
        }
      }
      continue;
    }
    if (value && typeof value === "object" && hasCredentialField(value, visited)) {
      return true;
    }
  }
  return false;
}

async function resolveChannelStatus(plugin: ChannelPlugin): Promise<ChannelCapability["status"]> {
  try {
    const cfg = loadConfig();
    const accountIds = plugin.config.listAccountIds(cfg);
    const defaultAccountId = resolveChannelDefaultAccountId({
      plugin,
      cfg,
      accountIds,
    });
    const account = plugin.config.resolveAccount(cfg, defaultAccountId);
    const enabled = plugin.config.isEnabled
      ? plugin.config.isEnabled(account, cfg)
      : !account ||
        typeof account !== "object" ||
        (account as { enabled?: boolean }).enabled !== false;
    if (!enabled) {
      return "disabled";
    }
    if (!plugin.config.isConfigured) {
      return "available";
    }
    const configured = await plugin.config.isConfigured(account, cfg);
    return configured ? "configured" : "needs_setup";
  } catch {
    return "unknown";
  }
}

async function buildChannels(): Promise<ChannelCapability[]> {
  const plugins = listChannelPlugins();
  const channels: ChannelCapability[] = [];
  for (const plugin of plugins) {
    channels.push({
      id: plugin.id,
      display_name: plugin.meta.label,
      requires_pairing: Boolean(plugin.pairing),
      requires_api_key: hasCredentialField(plugin.configSchema?.schema),
      status: await resolveChannelStatus(plugin),
    });
  }
  return channels;
}

function inferToolScope(tool: AnyAgentTool): string {
  const haystack = `${tool.name} ${(tool.description ?? "").toLowerCase()}`;
  if (/(web|http|fetch|browser|search)/.test(haystack)) {
    return "network";
  }
  if (/(message|channel|send|reply|dm|group)/.test(haystack)) {
    return "channel";
  }
  if (/(agent|session|cron|node|gateway)/.test(haystack)) {
    return "orchestration";
  }
  return "local";
}

function buildTools(): ToolCapability[] {
  const cfg = loadConfig();
  const tools = createOpenClawTools({
    config: cfg,
    sandboxed: true,
    agentSessionKey: resolveMainSessionKey(cfg),
    includePluginTools: false,
  });
  return tools.map((tool) => ({
    id: tool.name,
    display_name: toDisplayLabel(tool.name),
    scope: inferToolScope(tool),
    blocked_by_policy: false,
  }));
}

function buildOrchestrators(): OrchestratorCapability[] {
  const orchestratorIds = new Set<string>();
  for (const method of listGatewayMethods()) {
    const [prefix] = method.split(".");
    if (prefix) {
      orchestratorIds.add(prefix);
    }
  }
  return Array.from(orchestratorIds)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({
      id,
      display_name: toDisplayLabel(id),
    }));
}

function resolveCapabilitiesControlUiBasePath(cfg: ReturnType<typeof loadConfig>): string {
  const controlUiEnabled = cfg.gateway?.controlUi?.enabled !== false;
  if (!controlUiEnabled) {
    return "";
  }

  const configuredBasePath = resolveControlUiBasePath(cfg.gateway?.controlUi?.basePath);
  const rootOverrideRaw = cfg.gateway?.controlUi?.root;
  const rootOverride =
    typeof rootOverrideRaw === "string" && rootOverrideRaw.trim().length > 0
      ? rootOverrideRaw.trim()
      : undefined;

  if (rootOverride) {
    return resolveControlUiRootOverrideSync(rootOverride) ? configuredBasePath : "";
  }

  const resolvedRoot = resolveControlUiRootSync({
    moduleUrl: import.meta.url,
    argv1: process.argv[1],
    cwd: process.cwd(),
  });
  return resolvedRoot ? configuredBasePath : "";
}

async function canReadCapabilities(params: {
  req: IncomingMessage;
  auth: ResolvedGatewayAuth;
  trustedProxies: string[] | undefined;
}) {
  const token = getBearerToken(params.req);
  const authResult = await authorizeGatewayConnect({
    auth: { ...params.auth, allowTailscale: false },
    connectAuth: token ? { token, password: token } : null,
    req: params.req,
    trustedProxies: params.trustedProxies,
  });
  return authResult.ok;
}

export async function handleGatewayCapabilitiesHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { auth: ResolvedGatewayAuth; trustedProxies?: string[] },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/v1/capabilities") {
    return false;
  }

  if (req.method !== "GET") {
    sendMethodNotAllowed(res, "GET");
    return true;
  }

  if (!(await canReadCapabilities({ req, auth: opts.auth, trustedProxies: opts.trustedProxies }))) {
    sendUnauthorized(res);
    return true;
  }

  const cfg = loadConfig();
  const payload: CapabilitiesResponse = {
    version: "v1",
    generated_at: new Date().toISOString(),
    safe_mode: isSafeMode(),
    control_ui: {
      base_path: resolveCapabilitiesControlUiBasePath(cfg),
      auth_required: true,
      auth_mode: isLocalSessionAuthEnabled(process.env) ? "cookie" : opts.auth.mode,
      insecure_fallback: !isLocalSessionAuthEnabled(process.env),
    },
    channels: await buildChannels(),
    tools: buildTools(),
    orchestrators: buildOrchestrators(),
  };
  sendJson(res, 200, payload);
  return true;
}
