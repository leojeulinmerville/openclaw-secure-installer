// ── Type definitions for My OpenClaw Mission Control ────────────────

// ── Docker Check ────────────────────────────────────────────────────
export interface CheckDockerResult {
  dockerCliFound: boolean;
  dockerCliVersion?: string | null;
  dockerDaemonReachable: boolean;
  dockerServerVersion?: string | null;
  composeV2Available: boolean;
  composeVersion?: string | null;
  diagnostics: string[];
  remediation?: string | null;
}

// ── Installer / App State ───────────────────────────────────────────
export interface InstallerState {
  install_id: string;
  status: string;
  app_data_dir: string;
  gateway_image: string;
  http_port: number;
  https_port: number;
  advanced_ports: boolean;
}

// ── Gateway ─────────────────────────────────────────────────────────
export interface GatewayStartResult {
  gatewayActive: boolean;
  status: string;
  userFriendlyTitle: string;
  userFriendlyMessage: string;
  rawDiagnostics: string;
  remediationSteps: string[];
  composeFilePath: string;
  warning: string | null;
}

export interface PullTestResult {
  accessible: boolean;
  image: string;
  diagnostics: string;
  warning?: string | null;
}

export interface HealthCheckResult {
  healthy: boolean;
  statusCode: number | null;
  body: string;
  error: string | null;
}

export interface BuildResult {
  success: boolean;
  imageTag: string;
  logs: string;
}

export interface GatewayError {
  code: string;
  title: string;
  message: string;
  diagnostics: string;
}

export interface GatewayStatusResult {
  containerStable: boolean;
  healthOk: boolean;
  version: string | null;
  lastError: GatewayError | null;
}

// ── Gateway API Responses ───────────────────────────────────────────
export interface GatewayHealth {
  status: string;
  uptime_ms: number;
  safe_mode: boolean;
  version: string;
}

export interface GatewayVersion {
  version: string;
  node_version: string;
  platform: string;
  arch: string;
}

export interface GatewayCapabilities {
  safe_mode: boolean;
  features: string[];
}

export interface GatewayAgent {
  name: string;
  provider: string;
  model: string;
  status: string;
  registered_at: string;
}

export interface GatewayEvent {
  id: string;
  timestamp: string;
  type: string;
  [key: string]: unknown;
}

export interface GatewayPolicies {
  safe_mode: boolean;
  egress_allowlist: string[];
  cost_caps: {
    global_daily: number | null;
    per_agent_daily: number | null;
  };
}

// ── Agent (desktop-managed) ─────────────────────────────────────────

export type AgentStatusValue =
  | 'stopped'
  | 'running'
  | 'quarantined'
  | 'error'
  | 'creating';

export interface AgentEntry {
  id: string;
  name: string;
  provider: string;
  model: string;
  createdAt: string;
  lastSeen: string;
  status: AgentStatusValue;
  workspacePath: string;
  policyPreset: string;
  runtimeImage: string;
  containerName: string;
  lastError: string;
  quarantined: boolean;
  networkEnabled: boolean;
  gatewayAgentId: string | null;
}

export interface AgentListItem {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: AgentStatusValue;
  quarantined: boolean;
  networkEnabled: boolean;
  lastError: string;
  workspacePath: string;
  policyPreset: string;
  containerName: string;
  createdAt: string;
  lastSeen: string;
}

export interface AgentStatsResult {
  agentId: string;
  cpuPercent: number;
  memoryMb: number;
  netIoRx: string;
  netIoTx: string;
  running: boolean;
}

export interface AgentInspectResult {
  agentId: string;
  status: string;
  restarting: boolean;
  exitCode: number;
  healthy: boolean;
  raw: string;
}

// ── Alerts ──────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  agent_name: string | null;
  title: string;
  message: string;
  acknowledged: boolean;
}

// ── Navigation ──────────────────────────────────────────────────────
export type Page =
  | 'overview'
  | 'providers'
  | 'agents'
  | 'agent-detail'
  | 'create-agent'
  | 'policies'
  | 'activity'
  | 'settings'
  | 'chat';

// ── Chat ────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
  ollamaEndpoint?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  provider: string;
  model: string;
  usage: ChatUsage | null;
  error: string | null;
}

export interface ChatUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}
