import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { loadConfig, writeConfigFile, type OpenClawConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";
import { loadModelCatalog } from "../agents/model-catalog.js";
import { isSafeMode } from "../infra/safe-mode.js";
import { parseBooleanValue } from "../utils/boolean.js";
import {
  authorizeGatewayConnect,
  isLocalDirectRequest,
  type ResolvedGatewayAuth,
} from "./auth.js";
import {
  readJsonBodyOrError,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
  sendUnauthorized,
} from "./http-common.js";

const CONNECTIONS_SCHEMA_PATH = "/api/v1/connections/schema";
const CONNECTIONS_STATUS_PATH = "/api/v1/connections/status";
const CONNECTIONS_ROUTE_RE =
  /^\/api\/v1\/connections\/(?<kind>channel|provider)\/(?<id>[a-z0-9._-]+)\/(?<action>configure|test)$/i;
const CONNECTIONS_STATE_FILE = "connections-state.json";
const CONNECTIONS_BODY_MAX_BYTES = 2 * 1024 * 1024;
const KEYCHAIN_REF_PREFIX = "keychain://";

type ConnectionKind = "channel" | "provider";

type ConnectionFieldType = "string" | "secret" | "enum" | "number" | "boolean";
type SecretStorage = "keychain" | "gateway_encrypted" | "memory";

type ConnectionSchemaField = {
  key: string;
  display_name: string;
  type: ConnectionFieldType;
  required: boolean;
  optional: boolean;
  regex?: string;
  enum?: string[];
  help_text?: string;
  storage?: SecretStorage;
};

type ConnectionSchema = {
  type: "object";
  fields: ConnectionSchemaField[];
};

type ConnectionTestCapabilities = {
  can_test: boolean;
  requires_network: boolean;
  blocked_by_policy: boolean;
  pairing_supported?: boolean;
};

type ChannelSetupDescriptor = {
  id: string;
  display_name: string;
  requires_pairing: boolean;
  schema: ConnectionSchema;
  test_capabilities: ConnectionTestCapabilities;
};

type ProviderSetupDescriptor = {
  id: string;
  display_name: string;
  schema: ConnectionSchema;
  test_capabilities: ConnectionTestCapabilities;
};

type ConnectionsSchemaResponse = {
  version: "v1";
  generated_at: string;
  safe_mode: boolean;
  channels: ChannelSetupDescriptor[];
  providers: ProviderSetupDescriptor[];
};

type ConnectionStatusRecord = {
  configured?: boolean;
  healthy?: boolean;
  last_test?: string | null;
  errors?: string[];
  values?: Record<string, string | number | boolean>;
  secret_refs?: Record<string, string>;
};

type ConnectionsState = {
  version: "v1";
  updated_at: string;
  connections: Record<string, ConnectionStatusRecord>;
};

type ConnectionStatusItem = {
  kind: ConnectionKind;
  id: string;
  display_name: string;
  configured: boolean;
  healthy: boolean;
  last_test: string | null;
  errors: string[];
  requires_pairing?: boolean;
  pair_supported?: boolean;
};

type ConnectionsStatusResponse = {
  version: "v1";
  generated_at: string;
  safe_mode: boolean;
  channels: ConnectionStatusItem[];
  providers: ConnectionStatusItem[];
};

type ConfigureRequestBody = {
  values?: Record<string, unknown>;
  secret_refs?: Record<string, unknown>;
};

type TestRequestBody = {
  values?: Record<string, unknown>;
};

type RouteMatch = {
  kind: ConnectionKind;
  id: string;
  action: "configure" | "test";
};

function toDisplayLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase();
}

function routeKey(kind: ConnectionKind, id: string): string {
  return `${kind}:${normalizeId(id)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultConnectionsState(): ConnectionsState {
  return {
    version: "v1",
    updated_at: nowIso(),
    connections: {},
  };
}

function resolveConnectionsStatePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), CONNECTIONS_STATE_FILE);
}

async function readConnectionsState(): Promise<ConnectionsState> {
  const statePath = resolveConnectionsStatePath();
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ConnectionsState>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.connections !== "object") {
      return defaultConnectionsState();
    }
    return {
      version: "v1",
      updated_at:
        typeof parsed.updated_at === "string" && parsed.updated_at.trim()
          ? parsed.updated_at
          : nowIso(),
      connections: parsed.connections,
    };
  } catch {
    return defaultConnectionsState();
  }
}

async function writeConnectionsState(state: ConnectionsState): Promise<void> {
  const statePath = resolveConnectionsStatePath();
  const dir = path.dirname(statePath);
  await fs.mkdir(dir, { recursive: true });
  const normalized: ConnectionsState = {
    version: "v1",
    updated_at: nowIso(),
    connections: state.connections ?? {},
  };
  await fs.writeFile(statePath, JSON.stringify(normalized, null, 2), "utf8");
}

function parseConnectionRoute(pathname: string): RouteMatch | null {
  const match = pathname.match(CONNECTIONS_ROUTE_RE);
  if (!match?.groups) {
    return null;
  }
  const kind = normalizeId(match.groups.kind) as ConnectionKind;
  const id = normalizeId(match.groups.id);
  const action = normalizeId(match.groups.action) as "configure" | "test";
  if ((kind !== "channel" && kind !== "provider") || !id) {
    return null;
  }
  if (action !== "configure" && action !== "test") {
    return null;
  }
  return { kind, id, action };
}

function isSecretKey(key: string): boolean {
  return /(token|secret|password|api.?key|access.?key|webhook)/i.test(key);
}

function buildSchemaFieldsFromJsonSchema(schema: unknown): ConnectionSchemaField[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }
  const record = schema as Record<string, unknown>;
  const propertiesRaw = record.properties;
  if (!propertiesRaw || typeof propertiesRaw !== "object") {
    return [];
  }
  const requiredSet = new Set(
    Array.isArray(record.required)
      ? record.required.map((entry) => String(entry))
      : [],
  );

  const fields: ConnectionSchemaField[] = [];
  for (const [key, value] of Object.entries(propertiesRaw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const definition = value as Record<string, unknown>;
    const enumRaw = Array.isArray(definition.enum)
      ? definition.enum.filter((entry) => typeof entry === "string").map((entry) => String(entry))
      : [];
    const typeRaw = definition.type;
    const required = requiredSet.has(key);
    const help =
      typeof definition.description === "string" && definition.description.trim()
        ? definition.description.trim()
        : undefined;
    const regex =
      typeof definition.pattern === "string" && definition.pattern.trim()
        ? definition.pattern.trim()
        : undefined;

    if (enumRaw.length > 0) {
      fields.push({
        key,
        display_name: toDisplayLabel(key),
        type: "enum",
        required,
        optional: !required,
        enum: enumRaw,
        help_text: help,
      });
      continue;
    }

    const normalizedType =
      typeof typeRaw === "string"
        ? typeRaw
        : Array.isArray(typeRaw)
          ? typeRaw.find((entry) => typeof entry === "string")
          : undefined;

    if (normalizedType === "string") {
      const secret = isSecretKey(key) || definition.writeOnly === true;
      fields.push({
        key,
        display_name: toDisplayLabel(key),
        type: secret ? "secret" : "string",
        required,
        optional: !required,
        regex,
        help_text: help,
        ...(secret ? { storage: "keychain" as const } : {}),
      });
      continue;
    }
    if (normalizedType === "number" || normalizedType === "integer") {
      fields.push({
        key,
        display_name: toDisplayLabel(key),
        type: "number",
        required,
        optional: !required,
        help_text: help,
      });
      continue;
    }
    if (normalizedType === "boolean") {
      fields.push({
        key,
        display_name: toDisplayLabel(key),
        type: "boolean",
        required,
        optional: !required,
        help_text: help,
      });
    }
  }

  return fields.slice(0, 20);
}

function buildTelegramSchema(): ConnectionSchema {
  return {
    type: "object",
    fields: [
      {
        key: "bot_token",
        display_name: "Bot Token",
        type: "secret",
        required: true,
        optional: false,
        storage: "keychain",
        help_text: "Telegram bot token from BotFather.",
      },
      {
        key: "default_chat_id",
        display_name: "Default Chat ID",
        type: "string",
        required: false,
        optional: true,
        regex: "^-?[0-9]+$",
        help_text: "Optional chat ID for ping-based connection tests.",
      },
    ],
  };
}

function buildProviderSchema(): ConnectionSchema {
  return {
    type: "object",
    fields: [
      {
        key: "api_key",
        display_name: "API Key",
        type: "secret",
        required: true,
        optional: false,
        storage: "keychain",
        help_text: "Provider API key.",
      },
      {
        key: "base_url",
        display_name: "Base URL",
        type: "string",
        required: false,
        optional: true,
        regex: "^https?://",
        help_text: "OpenAI-compatible API base URL.",
      },
      {
        key: "model",
        display_name: "Model",
        type: "string",
        required: false,
        optional: true,
        help_text: "Model ID used for test completions.",
      },
    ],
  };
}

function parseAllowInternet(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBooleanValue(env.OPENCLAW_ALLOW_INTERNET) === true;
}

function isNetworkTestBlockedByPolicy(env: NodeJS.ProcessEnv = process.env): boolean {
  return isSafeMode() && !parseAllowInternet(env);
}

function buildChannelSetupDescriptor(plugin: ChannelPlugin): ChannelSetupDescriptor {
  const blockedByPolicy = isNetworkTestBlockedByPolicy();
  if (plugin.id === "telegram") {
    return {
      id: plugin.id,
      display_name: plugin.meta.label,
      requires_pairing: Boolean(plugin.pairing),
      schema: buildTelegramSchema(),
      test_capabilities: {
        can_test: true,
        requires_network: true,
        blocked_by_policy: blockedByPolicy,
        pairing_supported: Boolean(plugin.pairing),
      },
    };
  }

  return {
    id: plugin.id,
    display_name: plugin.meta.label,
    requires_pairing: Boolean(plugin.pairing),
    schema: {
      type: "object",
      fields: buildSchemaFieldsFromJsonSchema(plugin.configSchema?.schema),
    },
    test_capabilities: {
      can_test: false,
      requires_network: false,
      blocked_by_policy: false,
      pairing_supported: Boolean(plugin.pairing),
    },
  };
}

async function discoverProviderIds(cfg: OpenClawConfig): Promise<string[]> {
  const ids = new Set<string>();
  const configuredProviders = cfg.models?.providers ?? {};
  for (const providerId of Object.keys(configuredProviders)) {
    const trimmed = providerId.trim();
    if (trimmed) {
      ids.add(trimmed.toLowerCase());
    }
  }

  try {
    const catalog = await loadModelCatalog({ config: cfg });
    for (const entry of catalog) {
      const provider = String(entry.provider ?? "").trim().toLowerCase();
      if (provider) {
        ids.add(provider);
      }
    }
  } catch {
    // Keep runtime discovery best-effort.
  }

  if (ids.size === 0) {
    ids.add("openai");
  }

  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}

async function buildConnectionsSchema(cfg: OpenClawConfig): Promise<ConnectionsSchemaResponse> {
  const channels = listChannelPlugins().map((plugin) => buildChannelSetupDescriptor(plugin));
  const providerIds = await discoverProviderIds(cfg);
  const blockedByPolicy = isNetworkTestBlockedByPolicy();
  const providers: ProviderSetupDescriptor[] = providerIds.map((id) => ({
    id,
    display_name: toDisplayLabel(id),
    schema: buildProviderSchema(),
    test_capabilities: {
      can_test: true,
      requires_network: true,
      blocked_by_policy: blockedByPolicy,
    },
  }));

  return {
    version: "v1",
    generated_at: nowIso(),
    safe_mode: isSafeMode(),
    channels,
    providers,
  };
}

async function authorizeConnectionsRequest(params: {
  req: IncomingMessage;
  auth: ResolvedGatewayAuth;
  trustedProxies?: string[];
}): Promise<boolean> {
  if (!isLocalDirectRequest(params.req, params.trustedProxies)) {
    return false;
  }
  const authResult = await authorizeGatewayConnect({
    auth: { ...params.auth, allowTailscale: false },
    connectAuth: null,
    req: params.req,
    trustedProxies: params.trustedProxies,
  });
  return authResult.ok && authResult.method === "local-session";
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readConfigureBody(value: unknown): ConfigureRequestBody {
  const body = readObject(value);
  return {
    values: readObject(body.values),
    secret_refs: readObject(body.secret_refs),
  };
}

function readTestBody(value: unknown): TestRequestBody {
  const body = readObject(value);
  return {
    values: readObject(body.values),
  };
}

function readOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readSecretRef(value: unknown): string | undefined {
  const candidate = readOptionalTrimmedString(value);
  if (!candidate) {
    return undefined;
  }
  if (!/^[a-z0-9._:-]{3,}$/i.test(candidate)) {
    return undefined;
  }
  return candidate;
}

function toKeychainPlaceholder(secretRef: string): string {
  return `${KEYCHAIN_REF_PREFIX}${secretRef}`;
}

function parseKeychainPlaceholder(value: unknown): string | undefined {
  const raw = readOptionalTrimmedString(value);
  if (!raw) {
    return undefined;
  }
  if (!raw.startsWith(KEYCHAIN_REF_PREFIX)) {
    return undefined;
  }
  return raw.slice(KEYCHAIN_REF_PREFIX.length).trim() || undefined;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }
  const withoutSlash = trimmed.replace(/\/+$/, "");
  return withoutSlash;
}

function defaultProviderBaseUrl(providerId: string): string {
  if (providerId === "openrouter") {
    return "https://openrouter.ai/api/v1";
  }
  return "https://api.openai.com/v1";
}

function resolveExistingConnectionRecord(
  state: ConnectionsState,
  kind: ConnectionKind,
  id: string,
): ConnectionStatusRecord {
  return state.connections[routeKey(kind, id)] ?? {};
}

function resolveTelegramConfigured(cfg: OpenClawConfig, record: ConnectionStatusRecord): boolean {
  if (typeof record.configured === "boolean") {
    return record.configured;
  }
  const token = cfg.channels?.telegram?.botToken;
  return typeof token === "string" && token.trim().length > 0;
}

function resolveProviderConfigured(
  cfg: OpenClawConfig,
  providerId: string,
  record: ConnectionStatusRecord,
): boolean {
  if (typeof record.configured === "boolean") {
    return record.configured;
  }
  const apiKey = cfg.models?.providers?.[providerId]?.apiKey;
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

async function buildConnectionsStatus(
  cfg: OpenClawConfig,
  schema: ConnectionsSchemaResponse,
  state: ConnectionsState,
): Promise<ConnectionsStatusResponse> {
  const channels: ConnectionStatusItem[] = [];
  for (const descriptor of schema.channels) {
    const record = resolveExistingConnectionRecord(state, "channel", descriptor.id);
    channels.push({
      kind: "channel",
      id: descriptor.id,
      display_name: descriptor.display_name,
      configured:
        descriptor.id === "telegram"
          ? resolveTelegramConfigured(cfg, record)
          : Boolean(record.configured),
      healthy: record.healthy === true,
      last_test:
        typeof record.last_test === "string" && record.last_test.trim()
          ? record.last_test
          : null,
      errors: Array.isArray(record.errors)
        ? record.errors.filter((entry) => typeof entry === "string").map((entry) => String(entry))
        : [],
      requires_pairing: descriptor.requires_pairing,
      pair_supported: descriptor.test_capabilities.pairing_supported === true,
    });
  }

  const providers: ConnectionStatusItem[] = [];
  for (const descriptor of schema.providers) {
    const record = resolveExistingConnectionRecord(state, "provider", descriptor.id);
    providers.push({
      kind: "provider",
      id: descriptor.id,
      display_name: descriptor.display_name,
      configured: resolveProviderConfigured(cfg, descriptor.id, record),
      healthy: record.healthy === true,
      last_test:
        typeof record.last_test === "string" && record.last_test.trim()
          ? record.last_test
          : null,
      errors: Array.isArray(record.errors)
        ? record.errors.filter((entry) => typeof entry === "string").map((entry) => String(entry))
        : [],
    });
  }

  return {
    version: "v1",
    generated_at: nowIso(),
    safe_mode: isSafeMode(),
    channels,
    providers,
  };
}

async function updateStateRecord(params: {
  kind: ConnectionKind;
  id: string;
  update: (record: ConnectionStatusRecord) => ConnectionStatusRecord;
}): Promise<ConnectionStatusRecord> {
  const state = await readConnectionsState();
  const key = routeKey(params.kind, params.id);
  const existing = state.connections[key] ?? {};
  const next = params.update(existing);
  state.connections[key] = next;
  await writeConnectionsState(state);
  return next;
}

function trimErrors(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();
  return trimmed.length > 300 ? `${trimmed.slice(0, 297)}...` : trimmed;
}

async function configureTelegramConnection(params: {
  id: string;
  cfg: OpenClawConfig;
  body: ConfigureRequestBody;
}): Promise<{ configured: boolean; message: string; record: ConnectionStatusRecord }> {
  if (params.id !== "telegram") {
    throw new Error(`Channel "${params.id}" setup is not implemented yet. Use OpenClaw Console.`);
  }

  const state = await readConnectionsState();
  const existingRecord = resolveExistingConnectionRecord(state, "channel", params.id);
  const values = params.body.values ?? {};
  const secretRefsRaw = params.body.secret_refs ?? {};

  const defaultChatId = readOptionalTrimmedString(values.default_chat_id);
  if (defaultChatId && !/^-?[0-9]+$/.test(defaultChatId)) {
    throw new Error("default_chat_id must be a numeric chat identifier.");
  }

  const incomingSecretRef = readSecretRef(secretRefsRaw.bot_token);
  const existingSecretRef =
    readOptionalTrimmedString(existingRecord.secret_refs?.bot_token) ??
    parseKeychainPlaceholder(params.cfg.channels?.telegram?.botToken);
  const secretRef = incomingSecretRef ?? existingSecretRef;
  if (!secretRef) {
    throw new Error("bot_token is required. Store it in desktop keychain and resend configure.");
  }

  const nextConfig: OpenClawConfig = {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      telegram: {
        ...params.cfg.channels?.telegram,
        enabled: true,
        botToken: toKeychainPlaceholder(secretRef),
      },
    },
  };

  await writeConfigFile(nextConfig);

  const updatedRecord = await updateStateRecord({
    kind: "channel",
    id: params.id,
    update: (record) => ({
      ...record,
      configured: true,
      values: {
        ...record.values,
        ...(defaultChatId ? { default_chat_id: defaultChatId } : {}),
      },
      secret_refs: {
        ...record.secret_refs,
        bot_token: secretRef,
      },
      errors: [],
    }),
  });

  return {
    configured: true,
    message: "Telegram connection saved.",
    record: updatedRecord,
  };
}

function readConfiguredProviderValue(
  record: ConnectionStatusRecord,
  key: "base_url" | "model",
): string | undefined {
  const value = record.values?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function configureProviderConnection(params: {
  id: string;
  cfg: OpenClawConfig;
  body: ConfigureRequestBody;
}): Promise<{ configured: boolean; message: string; record: ConnectionStatusRecord }> {
  const providerId = normalizeId(params.id);
  const state = await readConnectionsState();
  const existingRecord = resolveExistingConnectionRecord(state, "provider", providerId);
  const values = params.body.values ?? {};
  const secretRefsRaw = params.body.secret_refs ?? {};

  const incomingBaseUrl = readOptionalTrimmedString(values.base_url);
  const incomingModel = readOptionalTrimmedString(values.model);
  const incomingSecretRef = readSecretRef(secretRefsRaw.api_key);

  const existingProvider = params.cfg.models?.providers?.[providerId];
  const existingSecretRef =
    readOptionalTrimmedString(existingRecord.secret_refs?.api_key) ??
    parseKeychainPlaceholder(existingProvider?.apiKey);
  const secretRef = incomingSecretRef ?? existingSecretRef;
  if (!secretRef) {
    throw new Error("api_key is required. Store it in desktop keychain and resend configure.");
  }

  const baseUrl = normalizeBaseUrl(
    incomingBaseUrl ??
      existingProvider?.baseUrl ??
      readConfiguredProviderValue(existingRecord, "base_url") ??
      defaultProviderBaseUrl(providerId),
  );
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("base_url must start with http:// or https://");
  }

  const model =
    incomingModel ??
    readConfiguredProviderValue(existingRecord, "model") ??
    (Array.isArray(existingProvider?.models) && existingProvider?.models[0]?.id
      ? String(existingProvider.models[0].id)
      : undefined);

  const existingModels = Array.isArray(existingProvider?.models)
    ? [...existingProvider.models]
    : [];
  if (model && !existingModels.some((entry) => entry.id === model)) {
    existingModels.push({
      id: model,
      name: model,
      reasoning: false,
      input: ["text"],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 128_000,
      maxTokens: 4_096,
    });
  }

  const nextProvider = {
    ...existingProvider,
    baseUrl,
    apiKey: toKeychainPlaceholder(secretRef),
    models: existingModels,
  };

  const nextConfig: OpenClawConfig = {
    ...params.cfg,
    models: {
      ...params.cfg.models,
      providers: {
        ...params.cfg.models?.providers,
        [providerId]: nextProvider,
      },
    },
  };
  await writeConfigFile(nextConfig);

  const updatedRecord = await updateStateRecord({
    kind: "provider",
    id: providerId,
    update: (record) => ({
      ...record,
      configured: true,
      values: {
        ...record.values,
        base_url: baseUrl,
        ...(model ? { model } : {}),
      },
      secret_refs: {
        ...record.secret_refs,
        api_key: secretRef,
      },
      errors: [],
    }),
  });

  return {
    configured: true,
    message: `Provider "${providerId}" connection saved.`,
    record: updatedRecord,
  };
}

async function runTelegramConnectionTest(params: {
  token: string;
  defaultChatId?: string;
}): Promise<{ ok: boolean; message: string; details: Record<string, unknown> }> {
  const token = params.token.trim();
  if (!token) {
    return {
      ok: false,
      message: "bot_token is required for Telegram test.",
      details: {},
    };
  }

  if (isNetworkTestBlockedByPolicy()) {
    return {
      ok: false,
      message: "Network tests are blocked by Safe Mode policy (allow_internet=false).",
      details: { blocked_by_policy: true },
    };
  }

  const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
  try {
    const response = await fetch(getMeUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { id?: number; username?: string; first_name?: string };
    };
    if (!response.ok || payload.ok !== true || !payload.result) {
      return {
        ok: false,
        message: payload.description?.trim() || "Telegram token validation failed.",
        details: { status: response.status },
      };
    }

    const details: Record<string, unknown> = {
      bot_id: payload.result.id ?? null,
      bot_username: payload.result.username ?? null,
      bot_name: payload.result.first_name ?? null,
      token_valid: true,
    };

    const chatId = params.defaultChatId?.trim();
    if (!chatId) {
      return {
        ok: true,
        message: "Telegram token is valid.",
        details,
      };
    }

    const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const pingText = `OpenClaw connection test (${new Date().toISOString()})`;
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: pingText,
        disable_notification: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const sendPayload = (await sendResponse.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!sendResponse.ok || sendPayload.ok !== true) {
      return {
        ok: false,
        message:
          sendPayload.description?.trim() ||
          "Telegram ping failed. Check bot permissions for default_chat_id.",
        details: {
          ...details,
          default_chat_id: chatId,
          send_status: sendResponse.status,
        },
      };
    }
    return {
      ok: true,
      message: "Telegram token is valid and ping message was sent.",
      details: {
        ...details,
        default_chat_id: chatId,
        message_id: sendPayload.result?.message_id ?? null,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Telegram connectivity test failed due to a network timeout or request error.",
      details: {},
    };
  }
}

async function runProviderConnectionTest(params: {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<{ ok: boolean; message: string; details: Record<string, unknown> }> {
  if (isNetworkTestBlockedByPolicy()) {
    return {
      ok: false,
      message: "Network tests are blocked by Safe Mode policy (allow_internet=false).",
      details: { blocked_by_policy: true },
    };
  }

  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    return {
      ok: false,
      message: "api_key is required for provider test.",
      details: {},
    };
  }

  const baseUrl = normalizeBaseUrl(params.baseUrl);
  if (!/^https?:\/\//i.test(baseUrl)) {
    return {
      ok: false,
      message: "base_url must start with http:// or https://",
      details: {},
    };
  }

  const model = params.model.trim();
  if (!model) {
    return {
      ok: false,
      message: "model is required for provider test.",
      details: {},
    };
  }

  const completionUrl = `${baseUrl}/chat/completions`;
  try {
    const response = await fetch(completionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with OK." }],
        max_tokens: 16,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      model?: string;
    };
    if (!response.ok) {
      const errorMessage =
        payload.error?.message?.trim() || `Provider returned HTTP ${response.status}.`;
      return {
        ok: false,
        message: errorMessage,
        details: {
          status: response.status,
          provider: params.providerId,
        },
      };
    }

    const content = payload.choices?.[0]?.message?.content?.trim() || "";
    return {
      ok: true,
      message: "Provider completion test succeeded.",
      details: {
        provider: params.providerId,
        model: payload.model ?? model,
        preview: content.slice(0, 120),
      },
    };
  } catch {
    return {
      ok: false,
      message: "Provider connectivity test failed due to a network timeout or request error.",
      details: {
        provider: params.providerId,
      },
    };
  }
}

async function testTelegramConnection(params: {
  id: string;
  cfg: OpenClawConfig;
  body: TestRequestBody;
}): Promise<{ healthy: boolean; message: string; details: Record<string, unknown> }> {
  if (params.id !== "telegram") {
    throw new Error(`Channel "${params.id}" test is not implemented yet. Use OpenClaw Console.`);
  }

  const values = params.body.values ?? {};
  const token = readOptionalTrimmedString(values.bot_token);
  const defaultChatId = readOptionalTrimmedString(values.default_chat_id);

  if (!token) {
    throw new Error("bot_token is required for Telegram test.");
  }
  if (defaultChatId && !/^-?[0-9]+$/.test(defaultChatId)) {
    throw new Error("default_chat_id must be a numeric chat identifier.");
  }

  const result = await runTelegramConnectionTest({
    token,
    defaultChatId,
  });
  return {
    healthy: result.ok,
    message: result.message,
    details: result.details,
  };
}

async function testProviderConnection(params: {
  id: string;
  cfg: OpenClawConfig;
  body: TestRequestBody;
}): Promise<{ healthy: boolean; message: string; details: Record<string, unknown> }> {
  const providerId = normalizeId(params.id);
  const state = await readConnectionsState();
  const existingRecord = resolveExistingConnectionRecord(state, "provider", providerId);
  const values = params.body.values ?? {};

  const existingProvider = params.cfg.models?.providers?.[providerId];
  const apiKey =
    readOptionalTrimmedString(values.api_key) ??
    ((): string | undefined => {
      const configured = readOptionalTrimmedString(existingProvider?.apiKey);
      if (!configured) {
        return undefined;
      }
      return configured.startsWith(KEYCHAIN_REF_PREFIX) ? undefined : configured;
    })();
  if (!apiKey) {
    throw new Error("api_key is required for provider test.");
  }

  const baseUrl = normalizeBaseUrl(
    readOptionalTrimmedString(values.base_url) ??
      existingProvider?.baseUrl ??
      readConfiguredProviderValue(existingRecord, "base_url") ??
      defaultProviderBaseUrl(providerId),
  );
  const model =
    readOptionalTrimmedString(values.model) ??
    readConfiguredProviderValue(existingRecord, "model") ??
    (Array.isArray(existingProvider?.models) && existingProvider?.models[0]?.id
      ? String(existingProvider.models[0].id)
      : "gpt-4.1-mini");

  const result = await runProviderConnectionTest({
    providerId,
    apiKey,
    baseUrl,
    model,
  });
  return {
    healthy: result.ok,
    message: result.message,
    details: result.details,
  };
}

async function writeTestResult(params: {
  kind: ConnectionKind;
  id: string;
  healthy: boolean;
  message: string;
}): Promise<ConnectionStatusRecord> {
  return updateStateRecord({
    kind: params.kind,
    id: params.id,
    update: (record) => ({
      ...record,
      healthy: params.healthy,
      configured: true,
      last_test: nowIso(),
      errors: params.healthy ? [] : [params.message],
    }),
  });
}

function pickStatusFromList(
  status: ConnectionsStatusResponse,
  kind: ConnectionKind,
  id: string,
): ConnectionStatusItem | undefined {
  const list = kind === "channel" ? status.channels : status.providers;
  return list.find((entry) => entry.id === id);
}

export async function handleGatewayConnectionsHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { auth: ResolvedGatewayAuth; trustedProxies?: string[] },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const route = parseConnectionRoute(url.pathname);
  const isSchema = url.pathname === CONNECTIONS_SCHEMA_PATH;
  const isStatus = url.pathname === CONNECTIONS_STATUS_PATH;
  if (!route && !isSchema && !isStatus) {
    return false;
  }

  if (!(await authorizeConnectionsRequest({ req, auth: opts.auth, trustedProxies: opts.trustedProxies }))) {
    sendUnauthorized(res);
    return true;
  }

  const cfg = loadConfig();

  if (isSchema) {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const schema = await buildConnectionsSchema(cfg);
    sendJson(res, 200, schema);
    return true;
  }

  if (isStatus) {
    if (req.method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const schema = await buildConnectionsSchema(cfg);
    const state = await readConnectionsState();
    const status = await buildConnectionsStatus(cfg, schema, state);
    sendJson(res, 200, status);
    return true;
  }

  if (!route) {
    sendJson(res, 404, { error: { type: "not_found", message: "Not Found" } });
    return true;
  }

  if (route.action === "configure") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const payload = await readJsonBodyOrError(req, res, CONNECTIONS_BODY_MAX_BYTES);
    if (payload === undefined) {
      return true;
    }
    const body = readConfigureBody(payload);
    try {
      const result =
        route.kind === "channel"
          ? await configureTelegramConnection({
              id: route.id,
              cfg,
              body,
            })
          : await configureProviderConnection({
              id: route.id,
              cfg,
              body,
            });

      const nextCfg = loadConfig();
      const schema = await buildConnectionsSchema(nextCfg);
      const status = await buildConnectionsStatus(nextCfg, schema, await readConnectionsState());
      const statusEntry = pickStatusFromList(status, route.kind, route.id);
      sendJson(res, 200, {
        ok: true,
        kind: route.kind,
        id: route.id,
        configured: result.configured,
        message: result.message,
        status: statusEntry ?? null,
      });
      return true;
    } catch (error) {
      sendInvalidRequest(res, trimErrors(error));
      return true;
    }
  }

  if (route.action === "test") {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const payload = await readJsonBodyOrError(req, res, CONNECTIONS_BODY_MAX_BYTES);
    if (payload === undefined) {
      return true;
    }
    const body = readTestBody(payload);
    try {
      const result =
        route.kind === "channel"
          ? await testTelegramConnection({ id: route.id, cfg, body })
          : await testProviderConnection({ id: route.id, cfg, body });
      await writeTestResult({
        kind: route.kind,
        id: route.id,
        healthy: result.healthy,
        message: result.message,
      });
      const nextCfg = loadConfig();
      const schema = await buildConnectionsSchema(nextCfg);
      const status = await buildConnectionsStatus(nextCfg, schema, await readConnectionsState());
      const statusEntry = pickStatusFromList(status, route.kind, route.id);
      sendJson(res, 200, {
        ok: result.healthy,
        kind: route.kind,
        id: route.id,
        message: result.message,
        details: result.details,
        status: statusEntry ?? null,
      });
      return true;
    } catch (error) {
      const message = trimErrors(error);
      await writeTestResult({
        kind: route.kind,
        id: route.id,
        healthy: false,
        message,
      });
      sendJson(res, 400, {
        ok: false,
        kind: route.kind,
        id: route.id,
        message,
      });
      return true;
    }
  }

  sendJson(res, 404, { error: { type: "not_found", message: "Not Found" } });
  return true;
}
