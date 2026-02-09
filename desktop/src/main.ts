import { invoke } from "@tauri-apps/api/core";

// ── Types ───────────────────────────────────────────────────────────

type CheckDockerResult = {
  dockerCliFound: boolean;
  dockerCliVersion?: string | null;
  dockerDaemonReachable: boolean;
  dockerServerVersion?: string | null;
  composeV2Available: boolean;
  composeVersion?: string | null;
  diagnostics: string[];
  remediation?: string | null;
};

type InstallerState = {
  install_id: string;
  status: string;
  app_data_dir: string;
};

type GatewayStartResult = {
  gatewayActive: boolean;
  userFriendlyTitle: string;
  userFriendlyMessage: string;
  rawDiagnostics: string;
  remediationSteps: string[];
  composeFilePath: string;
};

// ── UI Elements ─────────────────────────────────────────────────────

const els = {
  steps: [1, 2, 3, 4].map(i => document.getElementById(`step-${i}`) as HTMLDivElement),
  indicators: [1, 2, 3, 4].map(i => document.getElementById(`step-${i}-indicator`) as HTMLDivElement),

  // Step 1
  btnCheck: document.getElementById("check-docker") as HTMLButtonElement,
  btnStep1Next: document.getElementById("step-1-next") as HTMLButtonElement,
  statusCli: document.getElementById("status-cli") as HTMLSpanElement,
  statusDaemon: document.getElementById("status-daemon") as HTMLSpanElement,
  statusCompose: document.getElementById("status-compose") as HTMLSpanElement,

  // Step 2
  btnStep2Next: document.getElementById("step-2-next") as HTMLButtonElement,
  inputHttp: document.getElementById("http-port") as HTMLInputElement,
  inputHttps: document.getElementById("https-port") as HTMLInputElement,
  pathDisplay: document.getElementById("app-data-path") as HTMLDivElement,

  // Step 3
  btnStartGateway: document.getElementById("start-gateway") as HTMLButtonElement,
  installLogs: document.getElementById("install-logs") as HTMLDivElement,
  gatewayError: document.getElementById("gateway-error") as HTMLDivElement,
  gatewayErrorTitle: document.getElementById("gateway-error-title") as HTMLHeadingElement,
  gatewayErrorMessage: document.getElementById("gateway-error-message") as HTMLParagraphElement,
  gatewayRemediation: document.getElementById("gateway-remediation") as HTMLDivElement,
  gatewayRemediationSteps: document.getElementById("gateway-remediation-steps") as HTMLOListElement,
  gatewayComposePath: document.getElementById("gateway-compose-path") as HTMLParagraphElement,
  gatewayErrorDiagnostics: document.getElementById("gateway-error-diagnostics") as HTMLPreElement,

  // Step 4
  btnStopGateway: document.getElementById("stop-gateway") as HTMLButtonElement,
  btnViewLogs: document.getElementById("view-logs") as HTMLButtonElement,
  runtimeLogs: document.getElementById("runtime-logs") as HTMLDivElement,
  installId: document.getElementById("install-id") as HTMLParagraphElement,
};

let currentState: InstallerState | null = null;

// ── Navigation ──────────────────────────────────────────────────────

function showStep(stepIndex: number) { // 0-based
  els.steps.forEach((el, i) => {
    if (i === stepIndex) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
  els.indicators.forEach((el, i) => {
    if (i === stepIndex) el.classList.add("active");
    else el.classList.remove("active");
  });
}

// ── Init ────────────────────────────────────────────────────────────

async function init() {
  try {
    currentState = await invoke<InstallerState>("get_state");
    if (els.installId) els.installId.textContent = `ID: ${currentState.install_id}`;
    if (els.pathDisplay) els.pathDisplay.textContent = currentState.app_data_dir;
  } catch (err) {
    console.error("Failed to load state:", err);
  }
}

// ── Step 1: Docker Check ────────────────────────────────────────────

async function runCheck() {
  els.btnCheck.disabled = true;
  els.btnCheck.textContent = "Checking...";

  try {
    const result = await invoke<CheckDockerResult>("check_docker");

    updatePill(els.statusCli, result.dockerCliFound);
    updatePill(els.statusDaemon, result.dockerDaemonReachable);
    updatePill(els.statusCompose, result.composeV2Available);

    if (result.dockerCliFound && result.dockerDaemonReachable && result.composeV2Available) {
      els.btnStep1Next.classList.remove("hidden");
    } else {
      alert("Docker requirements not met. Check diagnostics.");
    }
  } catch (error) {
    console.error(error);
    alert("Check failed: " + error);
  } finally {
    els.btnCheck.disabled = false;
    els.btnCheck.textContent = "Check System";
  }
}

function updatePill(el: HTMLElement, ok: boolean) {
  el.textContent = ok ? "OK" : "KO";
  el.className = `pill ${ok ? "ok" : "bad"}`;
}

// ── Step 2: Configure ───────────────────────────────────────────────

async function saveConfiguration() {
  const httpPort = parseInt(els.inputHttp.value) || 80;
  const httpsPort = parseInt(els.inputHttps.value) || 443;

  try {
    await invoke("configure_installation", { httpPort, httpsPort });
    showStep(2); // Go to Step 3
  } catch (err) {
    alert("Configuration failed: " + err);
  }
}

// ── Step 3: Install/Start ───────────────────────────────────────────

function hideGatewayError() {
  els.gatewayError.classList.add("hidden");
  els.gatewayRemediation.classList.add("hidden");
}

function showGatewayError(result: GatewayStartResult) {
  els.gatewayError.classList.remove("hidden");

  els.gatewayErrorTitle.textContent = result.userFriendlyTitle;
  els.gatewayErrorMessage.textContent = result.userFriendlyMessage;
  els.gatewayErrorDiagnostics.textContent = result.rawDiagnostics || "(none)";
  els.gatewayComposePath.textContent = `Compose file: ${result.composeFilePath}`;

  if (result.remediationSteps.length > 0) {
    els.gatewayRemediation.classList.remove("hidden");
    els.gatewayRemediationSteps.innerHTML = "";
    for (const step of result.remediationSteps) {
      const li = document.createElement("li");
      li.textContent = step;
      els.gatewayRemediationSteps.appendChild(li);
    }
  }
}

async function startGateway() {
  els.btnStartGateway.disabled = true;
  els.installLogs.textContent = "Starting Gateway (docker compose up -d)...\n";
  hideGatewayError();

  try {
    const result = await invoke<GatewayStartResult>("start_gateway");

    if (result.gatewayActive) {
      els.installLogs.textContent += "Gateway started successfully.\n";
      setTimeout(() => showStep(3), 1000); // Go to Step 4
    } else {
      // CRITICAL: do NOT transition to Step 4
      els.installLogs.textContent += `Failed: ${result.userFriendlyTitle}\n`;
      showGatewayError(result);
      els.btnStartGateway.disabled = false;
    }
  } catch (err) {
    // Unexpected Tauri IPC error (should not happen with new structured result)
    els.installLogs.textContent += "\nUnexpected error: " + err;
    els.btnStartGateway.disabled = false;
  }
}

// ── Step 4: Manage ──────────────────────────────────────────────────

async function stopGateway() {
  if (!confirm("Stop Gateway?")) return;
  try {
    const msg = await invoke<string>("stop_gateway");
    alert(msg);
  } catch (err) {
    alert("Error: " + err);
  }
}

async function viewLogs() {
  els.runtimeLogs.classList.toggle("hidden");
  if (!els.runtimeLogs.classList.contains("hidden")) {
    const logs = await invoke<string>("gateway_logs");
    els.runtimeLogs.textContent = logs;
  }
}

// ── Event Listeners ─────────────────────────────────────────────────

els.btnCheck?.addEventListener("click", runCheck);
els.btnStep1Next?.addEventListener("click", () => showStep(1));
els.btnStep2Next?.addEventListener("click", saveConfiguration);
els.btnStartGateway?.addEventListener("click", startGateway);
els.btnStopGateway?.addEventListener("click", stopGateway);
els.btnViewLogs?.addEventListener("click", viewLogs);

// ── Initialize ──────────────────────────────────────────────────────

init();
showStep(0);
