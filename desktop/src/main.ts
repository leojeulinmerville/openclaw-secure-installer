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
  gateway_image: string;
};

type GatewayStartResult = {
  gatewayActive: boolean;
  status: string; // "started" | "already_running" | "failed" | "not_configured" | "stopped"
  userFriendlyTitle: string;
  userFriendlyMessage: string;
  rawDiagnostics: string;
  remediationSteps: string[];
  composeFilePath: string;
  warning: string | null;
};

type PullTestResult = {
  accessible: boolean;
  image: string;
  diagnostics: string;
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

  // Step 3 – Image Source
  modeTabs: document.querySelectorAll(".mode-tab") as NodeListOf<HTMLButtonElement>,
  modePublic: document.getElementById("mode-public") as HTMLDivElement,
  modePrivate: document.getElementById("mode-private") as HTMLDivElement,
  modeLocal: document.getElementById("mode-local") as HTMLDivElement,
  inputImageName: document.getElementById("image-name") as HTMLInputElement,
  btnTestPull: document.getElementById("btn-test-pull") as HTMLButtonElement,
  pullStatus: document.getElementById("pull-status") as HTMLSpanElement,
  pullDiagnosticsBox: document.getElementById("pull-diagnostics-box") as HTMLDivElement,
  inputRegistryUrl: document.getElementById("registry-url") as HTMLInputElement,
  inputPrivateImageName: document.getElementById("private-image-name") as HTMLInputElement,
  btnCopyLogin: document.getElementById("btn-copy-login") as HTMLButtonElement,
  copyLoginStatus: document.getElementById("copy-login-status") as HTMLSpanElement,
  inputBuildContext: document.getElementById("build-context") as HTMLInputElement,
  btnBuildLocal: document.getElementById("btn-build-local") as HTMLButtonElement,
  buildStatus: document.getElementById("build-status") as HTMLSpanElement,
  buildLogsBox: document.getElementById("build-logs-box") as HTMLDivElement,

  // Step 3 – Install
  btnStartGateway: document.getElementById("start-gateway") as HTMLButtonElement,
  btnOpenAppData: document.getElementById("btn-open-appdata") as HTMLButtonElement,
  installLogs: document.getElementById("install-logs") as HTMLDivElement,
  gatewayError: document.getElementById("gateway-error") as HTMLDivElement,
  gatewayErrorTitle: document.getElementById("gateway-error-title") as HTMLHeadingElement,
  gatewayErrorMessage: document.getElementById("gateway-error-message") as HTMLParagraphElement,
  gatewayRemediation: document.getElementById("gateway-remediation") as HTMLDivElement,
  gatewayRemediationSteps: document.getElementById("gateway-remediation-steps") as HTMLOListElement,
  gatewayErrorDiagnostics: document.getElementById("gateway-error-diagnostics") as HTMLPreElement,

  // Step 4
  btnStopGateway: document.getElementById("stop-gateway") as HTMLButtonElement,
  btnViewLogs: document.getElementById("view-logs") as HTMLButtonElement,
  btnOpenAppDataRun: document.getElementById("btn-open-appdata-run") as HTMLButtonElement,
  gatewayWarning: document.getElementById("gateway-warning") as HTMLDivElement,
  gatewayWarningText: document.getElementById("gateway-warning-text") as HTMLSpanElement,
  gatewayActiveStatus: document.getElementById("gateway-active-status") as HTMLParagraphElement,
  runtimeLogs: document.getElementById("runtime-logs") as HTMLDivElement,
  installId: document.getElementById("install-id") as HTMLParagraphElement,
  composePathDisplay: document.getElementById("compose-path-display") as HTMLParagraphElement,
};

let currentState: InstallerState | null = null;
let currentImageMode: "public" | "private" | "local" = "public";

// ── Navigation ──────────────────────────────────────────────────────

function showStep(stepIndex: number) {
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

    // Pre-fill image from saved state
    if (currentState.gateway_image && els.inputImageName) {
      els.inputImageName.value = currentState.gateway_image;
    }

    // Check if gateway is already running → sync UI
    const result = await invoke<GatewayStartResult>("is_gateway_running");
    if (result.gatewayActive) {
      transitionToStep4(result);
      return; // Skip to Step 4
    }
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
    await invoke("configure_installation", {
      httpPort,
      httpsPort,
      gatewayImage: getSelectedImage(),
    });
    showStep(2); // Go to Step 3
  } catch (err) {
    alert("Configuration failed: " + err);
  }
}

// ── Step 3: Image Source ────────────────────────────────────────────

function getSelectedImage(): string {
  switch (currentImageMode) {
    case "public":
      return els.inputImageName.value.trim() || "ghcr.io/openclaw-ai/openclaw-gateway:stable";
    case "private": {
      const registry = els.inputRegistryUrl.value.trim();
      const img = els.inputPrivateImageName.value.trim();
      return registry && img ? `${registry}/${img}` : "";
    }
    case "local":
      return "openclaw:dev";
  }
}

function switchMode(mode: "public" | "private" | "local") {
  currentImageMode = mode;
  els.modeTabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  els.modePublic.classList.toggle("hidden", mode !== "public");
  els.modePrivate.classList.toggle("hidden", mode !== "private");
  els.modeLocal.classList.toggle("hidden", mode !== "local");
}

async function testPullAccess() {
  const image = getSelectedImage();
  if (!image) { alert("Please enter an image name."); return; }

  els.btnTestPull.disabled = true;
  els.pullStatus.textContent = "Testing...";
  els.pullStatus.className = "pill neutral";
  els.pullDiagnosticsBox.classList.add("hidden");

  try {
    const result = await invoke<PullTestResult>("test_pull_access", { image });
    if (result.accessible) {
      els.pullStatus.textContent = "Accessible ✓";
      els.pullStatus.className = "pill ok";
    } else {
      els.pullStatus.textContent = "Not accessible ✗";
      els.pullStatus.className = "pill bad";
      els.pullDiagnosticsBox.textContent = result.diagnostics;
      els.pullDiagnosticsBox.classList.remove("hidden");
    }
  } catch (err) {
    els.pullStatus.textContent = "Error";
    els.pullStatus.className = "pill bad";
    els.pullDiagnosticsBox.textContent = String(err);
    els.pullDiagnosticsBox.classList.remove("hidden");
  } finally {
    els.btnTestPull.disabled = false;
  }
}

async function copyLoginCommand() {
  const registry = els.inputRegistryUrl.value.trim();
  if (!registry) { alert("Please enter a registry URL."); return; }
  const cmd = `docker login ${registry}`;
  try {
    await navigator.clipboard.writeText(cmd);
    els.copyLoginStatus.textContent = `Copied: ${cmd}`;
  } catch {
    els.copyLoginStatus.textContent = `Copy failed. Run: ${cmd}`;
  }
}

async function buildLocally() {
  const contextPath = els.inputBuildContext.value.trim();
  if (!contextPath) { alert("Please enter a build context path."); return; }

  els.btnBuildLocal.disabled = true;
  els.buildStatus.textContent = "Building...";
  els.buildStatus.className = "pill neutral";
  els.buildLogsBox.classList.remove("hidden");
  els.buildLogsBox.textContent = "Running docker build -t openclaw:dev ...\n";

  // Update compose to use openclaw:dev
  try {
    await invoke("update_compose_image", { image: "openclaw:dev" });
    els.buildLogsBox.textContent += "Compose file updated to use openclaw:dev\n";
    els.buildStatus.textContent = "Ready ✓";
    els.buildStatus.className = "pill ok";
  } catch (err) {
    els.buildLogsBox.textContent += "Error: " + err;
    els.buildStatus.textContent = "Failed";
    els.buildStatus.className = "pill bad";
  } finally {
    els.btnBuildLocal.disabled = false;
  }
}

// ── Step 3: Start Gateway ───────────────────────────────────────────

function hideGatewayError() {
  els.gatewayError.classList.add("hidden");
  els.gatewayRemediation.classList.add("hidden");
}

function showGatewayError(result: GatewayStartResult) {
  els.gatewayError.classList.remove("hidden");
  els.gatewayErrorTitle.textContent = result.userFriendlyTitle;
  els.gatewayErrorMessage.textContent = result.userFriendlyMessage;
  els.gatewayErrorDiagnostics.textContent = result.rawDiagnostics || "(none)";

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

function transitionToStep4(result: GatewayStartResult) {
  // Show Step 4
  showStep(3);

  // Update compose path display
  if (els.composePathDisplay) {
    els.composePathDisplay.textContent = `Compose: ${result.composeFilePath}`;
  }

  // Update status text
  if (result.status === "already_running") {
    els.gatewayActiveStatus.textContent = "✅ OpenClaw Gateway is already running.";
  } else {
    els.gatewayActiveStatus.textContent = "✅ OpenClaw Gateway started successfully.";
  }

  // Warning banner (for "running but pull failed" case)
  if (result.warning) {
    els.gatewayWarning.classList.remove("hidden");
    els.gatewayWarningText.textContent = result.warning;
  } else {
    els.gatewayWarning.classList.add("hidden");
  }
}

async function startGateway() {
  // First, update the compose file with the selected image
  const image = getSelectedImage();
  if (!image) { alert("Please select or enter an image name."); return; }

  els.btnStartGateway.disabled = true;
  els.installLogs.textContent = "Updating compose file with selected image...\n";
  hideGatewayError();

  try {
    await invoke("update_compose_image", { image });
    els.installLogs.textContent += `Image set to: ${image}\n`;
    els.installLogs.textContent += "Starting Gateway (docker compose up -d)...\n";

    const result = await invoke<GatewayStartResult>("start_gateway");

    if (result.gatewayActive) {
      els.installLogs.textContent += `${result.userFriendlyTitle}\n`;
      setTimeout(() => transitionToStep4(result), 800);
    } else {
      // CRITICAL: do NOT transition to Step 4
      els.installLogs.textContent += `Failed: ${result.userFriendlyTitle}\n`;
      showGatewayError(result);
      els.btnStartGateway.disabled = false;
    }
  } catch (err) {
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
    showStep(2); // Go back to Step 3
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

async function openAppDataFolder() {
  try {
    await invoke("open_app_data_folder");
  } catch (err) {
    alert("Could not open folder: " + err);
  }
}

// ── Event Listeners ─────────────────────────────────────────────────

els.btnCheck?.addEventListener("click", runCheck);
els.btnStep1Next?.addEventListener("click", () => showStep(1));
els.btnStep2Next?.addEventListener("click", saveConfiguration);
els.btnStartGateway?.addEventListener("click", startGateway);
els.btnStopGateway?.addEventListener("click", stopGateway);
els.btnViewLogs?.addEventListener("click", viewLogs);
els.btnOpenAppData?.addEventListener("click", openAppDataFolder);
els.btnOpenAppDataRun?.addEventListener("click", openAppDataFolder);

// Mode tabs
els.modeTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode as "public" | "private" | "local";
    switchMode(mode);
  });
});

// Image source
els.btnTestPull?.addEventListener("click", testPullAccess);
els.btnCopyLogin?.addEventListener("click", copyLoginCommand);
els.btnBuildLocal?.addEventListener("click", buildLocally);

// ── Initialize ──────────────────────────────────────────────────────

init();
showStep(0);
