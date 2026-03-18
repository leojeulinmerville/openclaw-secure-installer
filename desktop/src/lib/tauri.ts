// Typed wrappers around Tauri invoke calls.
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { formatDistanceToNow } from 'date-fns';
import type {
  CheckDockerResult,
  InstallerState,
  GatewayStartResult,
  GatewayStatusResult,
  HealthCheckResult,
  PullTestResult,
  BuildResult,
  AgentEntry,
  AgentListItem,
  AgentStatsResult,
  AgentInspectResult,
  ChatRequest,
  ChatResponse,
  ConsoleInfo,
  RuntimeCapabilities,
  ConnectionsSchemaResponse,
  ConnectionsStatusResponse,
  ConnectionKind,
  ConnectionOperationResult,
  ChatSession,
  WhatsAppLoginStartResult,
  WhatsAppLoginWaitResult,
  Contract,
  MissionArtifact,
  RunLinkage,
  DecisionRecord,
  ValidationRecord,
} from '../types';

// ── Docker ──────────────────────────────────────────────────────────
export const checkDocker = () => invoke<CheckDockerResult>('check_docker');

// ── State ───────────────────────────────────────────────────────────
export const getState = () => invoke<InstallerState>('get_state');
export const saveState = (state: InstallerState) => invoke<void>('save_state', { state });
export const configureInstallation = (
  httpPort: number,
  httpsPort: number,
  gatewayImage?: string,
  exposeGatewayToLan?: boolean,
) =>
  invoke<void>('configure_installation', { httpPort, httpsPort, gatewayImage, exposeGatewayToLan });
export const saveGatewayImage = (image: string) => invoke<void>('save_gateway_image', { image });

// ── Gateway lifecycle ───────────────────────────────────────────────
export const startGateway = () => invoke<GatewayStartResult>('start_gateway');
export const stopGateway = () => invoke<void>('stop_gateway');
export const isGatewayRunning = () => invoke<GatewayStartResult>('is_gateway_running');
export const gatewayLogs = () => invoke<string>('gateway_logs');
export const checkGatewayHealth = () => invoke<HealthCheckResult>('check_gateway_health');
export const testPullAccess = (image: string) => invoke<PullTestResult>('test_pull_access', { image });
export const updateComposeImage = (image: string) => invoke<void>('update_compose_image', { image });
export const openAppDataFolder = () => invoke<void>('open_app_data_folder');
export const dockerSmokeTest = () => invoke<GatewayStartResult>('docker_smoke_test');
export const buildLocalImage = () => invoke<BuildResult>('build_local_image');
export const getGatewayStatus = () => invoke<GatewayStatusResult>('get_gateway_status');
export const getConsoleInfo = () => invoke<ConsoleInfo>('get_console_info');
export const openConsoleWindow = () => invoke<void>('open_console_window');
export const getRuntimeCapabilities = () => invoke<RuntimeCapabilities>('get_runtime_capabilities');
export const connectionsGetSchema = () => invoke<ConnectionsSchemaResponse>('connections_get_schema');
export const connectionsGetStatus = () => invoke<ConnectionsStatusResponse>('connections_get_status');
export const connectionsConfigure = (
  kind: ConnectionKind,
  id: string,
  values: Record<string, unknown>,
) => invoke<ConnectionOperationResult>('connections_configure', { kind, id, values });
export const connectionsTest = (
  kind: ConnectionKind,
  id: string,
  values: Record<string, unknown>,
) => invoke<ConnectionOperationResult>('connections_test', { kind, id, values });

// ── Internet toggle ─────────────────────────────────────────────────
export const getAllowInternet = () => invoke<boolean>('get_allow_internet');
export const setAllowInternet = (enabled: boolean) => invoke<void>('set_allow_internet', { enabled });

// ── Secrets ─────────────────────────────────────────────────────────
export const setSecret = (key: string, value: string) => invoke<void>('set_secret', { key, value });
export const hasSecret = (key: string) => invoke<boolean>('has_secret', { key });
export const deleteSecret = (key: string) => invoke<void>('delete_secret', { key });

// ── Agent lifecycle ─────────────────────────────────────────────────
export const createAgent = (
  name: string,
  provider: string,
  model: string,
  workspacePath: string,
  policyPreset: string,
) => invoke<AgentEntry>('create_agent', { name, provider, model, workspacePath, policyPreset });

export const listAgents = () => invoke<AgentListItem[]>('list_agents');

export const startAgent = (agentId: string) =>
  invoke<AgentInspectResult>('start_agent', { agentId });

export const stopAgent = (agentId: string) =>
  invoke<void>('stop_agent', { agentId });

export const restartAgent = (agentId: string) =>
  invoke<AgentInspectResult>('restart_agent', { agentId });

export const removeAgent = (agentId: string) =>
  invoke<void>('remove_agent', { agentId });

export const agentLogs = (agentId: string, lines?: number) =>
  invoke<string>('agent_logs', { agentId, lines });

export const agentStats = (agentId: string) =>
  invoke<AgentStatsResult>('agent_stats', { agentId });

export const agentInspectHealth = (agentId: string) =>
  invoke<AgentInspectResult>('agent_inspect_health', { agentId });

export const agentSetNetwork = (agentId: string, enabled: boolean) =>
  invoke<void>('agent_set_network', { agentId, enabled });

export const quarantineAgent = (agentId: string) =>
  invoke<void>('quarantine_agent', { agentId });

export const unquarantineAgent = (agentId: string) =>
  invoke<void>('unquarantine_agent', { agentId });

export const checkAgentCrashloop = (agentId: string) =>
  invoke<boolean>('check_agent_crashloop', { agentId });

export const getAgentDetail = (agentId: string) =>
  invoke<AgentEntry>('get_agent_detail', { agentId });

// ── Chat ────────────────────────────────────────────────────────────
export const chatSend = (request: ChatRequest) =>
  invoke<ChatResponse>('chat_send', { request });

export const listChats = () => invoke<ChatSession[]>('list_chats');
export const getChat = (id: string) => invoke<ChatSession>('get_chat', { id });
export const saveChat = (session: ChatSession) => invoke<void>('save_chat', { session });
export const deleteChat = (id: string) => invoke<void>('delete_chat', { id });

export const testOllamaConnection = (endpoint?: string) =>
  invoke<boolean>('test_ollama_connection', { endpoint });

export const testGatewayOllamaAccess = () =>
  invoke<boolean>('test_gateway_ollama_access');

export const ollamaListModels = (endpoint?: string) =>
  invoke<string[]>('ollama_list_models', { endpoint });

export const lmstudioListModels = (endpoint?: string) =>
  invoke<string[]>('lmstudio_list_models', { endpoint });

// ── Runs ────────────────────────────────────────────────────────────
import type { Run, RunEvent } from '../types';

export const createRun = (
  agentId: string,
  provider: string,
  model: string,
  title: string,
  userGoal: string,
  workspacePath: string,
  missionId?: string,
  contractId?: string
) => invoke<Run>('create_run', { 
  request: { 
    agentId, 
    provider, 
    model, 
    title, 
    userGoal, 
    workspacePath,
    mission_id: missionId,
    contract_id: contractId
  } 
});

export const startContractActivation = (
  missionId: string,
  contractId: string,
  agentId: string,
  provider: string,
  model: string,
  title: string,
  goal: string,
  workspacePath: string
) => invoke<Run>('start_contract_activation', {
  missionId,
  contractId,
  agentId,
  provider,
  model,
  title,
  goal,
  workspacePath
});

export const listModels = () => invoke<string[]>('list_models');

// ── Shared Helpers ──────────────────────────────────────────────────
export function safeFormatDistanceToNow(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown time';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown time';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return 'Unknown time';
  }
}

export function safeFormatTime(dateStr?: string | null): string {
  if (!dateStr) return '--:--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString();
  } catch (e) {
    return '--:--';
  }
}

export const listRuns = () => invoke<Run[]>('list_runs');

export const getRun = (runId: string) => invoke<Run>('get_run', { runId });

export const getRunEvents = (runId: string) => invoke<RunEvent[]>('get_run_events', { runId });

export const startRun = (runId: string) => invoke<Run>('start_run', { runId });

export const listMissionContracts = (missionId: string) =>
  invoke<Contract[]>('list_mission_contracts', { missionId });

export const listMissionArtifacts = (missionId: string) =>
  invoke<MissionArtifact[]>('list_mission_artifacts', { missionId });

export const listMissionRunLinkages = (missionId: string) =>
  invoke<RunLinkage[]>('list_mission_run_linkages', { missionId });

export const listMissionDecisions = (missionId: string, limit: number = 10) =>
  invoke<DecisionRecord[]>('list_mission_decisions', { missionId, limit });

export const addMissionIntervention = (missionId: string, interventionText: string) =>
  invoke<DecisionRecord>('add_mission_intervention', { missionId, interventionText });

export const listMissionValidations = (missionId: string, limit: number = 10) =>
  invoke<ValidationRecord[]>('list_mission_validations', { missionId, limit });

export const submitApproval = (runId: string, approvalId: string, decision: 'approved' | 'rejected') => 
    invoke<Run>('submit_approval', { runId, approvalId, decision });


export const readWorkspaceFile = (runId: string, relativePath: string) => 
    invoke<string>('read_workspace_file', { runId, relativePath });

export const deleteRun = (runId: string) =>
  invoke<void>('delete_run', { runId });

// ── Channels ────────────────────────────────────────────────────────
export const whatsappLoginStart = (opts: {
  accountId?: string;
  force: boolean;
  timeoutMs?: number;
  verbose: boolean;
}) => invoke<WhatsAppLoginStartResult>('whatsapp_login_start', { opts });

export const whatsappLoginWait = (opts: {
  accountId?: string;
  timeoutMs?: number;
}) => invoke<WhatsAppLoginWaitResult>('whatsapp_login_wait', { opts });

export const whatsappLogout = (accountId?: string) =>
  invoke<void>('whatsapp_logout', { accountId });

export const openExternal = (url: string) => open(url);

export const setStopAgentsOnGatewayStop = (enabled: boolean) => invoke<void>('set_stop_agents_on_gateway_stop', { enabled });

export { invoke };
