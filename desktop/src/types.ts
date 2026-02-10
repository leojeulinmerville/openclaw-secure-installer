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

export interface InstallerState {
  install_id: string;
  status: string;
  app_data_dir: string;
  gateway_image: string;
}

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
