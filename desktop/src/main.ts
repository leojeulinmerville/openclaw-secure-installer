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
  status: string;
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

type HealthCheckResult = {
  healthy: boolean;
  statusCode: number | null;
  body: string;
  error: string | null;
};

type BuildResult = {
  success: boolean;
  imageTag: string;
  logs: string;
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

  // Step 3 – Docker Smoke Test
  btnSmokeTest: document.getElementById("btn-smoke-test") as HTMLButtonElement,
  smokeStatus: document.getElementById("smoke-status") as HTMLSpanElement,
  smokeDiagnosticsBox: document.getElementById("smoke-diagnostics-box") as HTMLDivElement,

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
  btnCheckHealth: document.getElementById("btn-check-health") as HTMLButtonElement,
  healthStatus: document.getElementById("health-status") as HTMLSpanElement,
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

    if (currentState.gateway_image && els.inputImageName) {
      els.inputImageName.value = currentState.gateway_image;
    }

    // Pre-fill local build context to the gateway/ dir in the repo
    // (resolve relative to where the app was launched from, which is the repo root)
    if (els.inputBuildContext && !els.inputBuildContext.value) {
      // Try to detect the gateway dir path from state
      // Users can always override this
    }

    // Strict init sync: check if gateway is truly running
    const result = await invoke<GatewayStartResult>("is_gateway_running");
    if (result.gatewayActive) {
      transitionToStep4(result);
      return;
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
      return "openclaw-gateway:dev";
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
  const registry = els.inputRegistryUrl.value.trim() || "ghcr.io";
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
  if (!contextPath) { alert("Enter the path to the gateway/ directory."); return; }

  els.btnBuildLocal.disabled = true;
  els.buildStatus.textContent = "Building...";
  els.buildStatus.className = "pill neutral";
  els.buildLogsBox.classList.remove("hidden");
  els.buildLogsBox.textContent = `Building openclaw-gateway:dev from ${contextPath}...\n`;

  try {
    const result = await invoke<BuildResult>("build_local_image", { contextPath });
    els.buildLogsBox.textContent += result.logs + "\n";

    if (result.success) {
      // Update compose file with the built image
      await invoke("update_compose_image", { image: result.imageTag });
      els.buildLogsBox.textContent += `\n✅ Image built: ${result.imageTag}\n`;
      els.buildLogsBox.textContent += "Compose file updated.\n";
      els.buildStatus.textContent = "Ready ✓";
      els.buildStatus.className = "pill ok";
    } else {
      els.buildStatus.textContent = "Failed ✗";
      els.buildStatus.className = "pill bad";
    }
  } catch (err) {
    els.buildLogsBox.textContent += "\nError: " + err;
    els.buildStatus.textContent = "Error";
    els.buildStatus.className = "pill bad";
  } finally {
    els.btnBuildLocal.disabled = false;
  }
}

// ── Step 3: Docker Smoke Test ───────────────────────────────────────

async function runSmokeTest() {
  els.btnSmokeTest.disabled = true;
  els.smokeStatus.textContent = "Running...";
  els.smokeStatus.className = "pill neutral";
  els.smokeDiagnosticsBox.classList.add("hidden");

  try {
    const result = await invoke<PullTestResult>("docker_smoke_test");
    if (result.accessible) {
      els.smokeStatus.textContent = "Docker OK ✓";
      els.smokeStatus.className = "pill ok";
    } else {
      els.smokeStatus.textContent = "Failed ✗";
      els.smokeStatus.className = "pill bad";
    }
    els.smokeDiagnosticsBox.textContent = result.diagnostics;
    els.smokeDiagnosticsBox.classList.remove("hidden");
  } catch (err) {
    els.smokeStatus.textContent = "Error";
    els.smokeStatus.className = "pill bad";
    els.smokeDiagnosticsBox.textContent = String(err);
    els.smokeDiagnosticsBox.classList.remove("hidden");
  } finally {
    els.btnSmokeTest.disabled = false;
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
  // STRICT: only if gatewayActive is true
  if (!result.gatewayActive) {
    showStep(2);
    showGatewayError(result);
    return;
  }

  showStep(3); // Step 4 (0-indexed)

  if (els.composePathDisplay) {
    els.composePathDisplay.textContent = `Compose: ${result.composeFilePath}`;
  }

  if (result.status === "already_running") {
    els.gatewayActiveStatus.textContent = "✅ OpenClaw Gateway is already running.";
  } else {
    els.gatewayActiveStatus.textContent = "✅ OpenClaw Gateway started successfully.";
  }

  if (result.warning) {
    els.gatewayWarning.classList.remove("hidden");
    els.gatewayWarningText.textContent = result.warning;
  } else {
    els.gatewayWarning.classList.add("hidden");
  }
}

async function startGateway() {
  const image = getSelectedImage();
  if (!image) { alert("Please select or enter a gateway-compatible image."); return; }

  els.btnStartGateway.disabled = true;
  els.installLogs.textContent = "Updating compose with selected image...\n";
  hideGatewayError();

  try {
    await invoke("update_compose_image", { image });
    els.installLogs.textContent += `Image: ${image}\n`;
    els.installLogs.textContent += "Starting Gateway (docker compose up -d)...\n";
    els.installLogs.textContent += "Verifying container stability (~3s)...\n";
    els.installLogs.textContent += "Probing /health endpoint...\n";

    const result = await invoke<GatewayStartResult>("start_gateway");

    if (result.gatewayActive) {
      els.installLogs.textContent += `✅ ${result.userFriendlyTitle}\n`;
      if (result.warning) {
        els.installLogs.textContent += `⚠️ ${result.warning}\n`;
      }
      setTimeout(() => transitionToStep4(result), 800);
    } else {
      els.installLogs.textContent += `❌ ${result.userFriendlyTitle}\n`;
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
    showStep(2); // Back to Step 3
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

async function checkHealth() {
  if (!els.healthStatus) return;
  els.healthStatus.textContent = "Checking...";
  els.healthStatus.className = "pill neutral";

  try {
    const result = await invoke<HealthCheckResult>("check_gateway_health");
    if (result.healthy) {
      els.healthStatus.textContent = "Healthy ✓";
      els.healthStatus.className = "pill ok";
    } else {
      els.healthStatus.textContent = `Unhealthy (${result.error || "no response"})`;
      els.healthStatus.className = "pill bad";
    }
  } catch (err) {
    els.healthStatus.textContent = "Error";
    els.healthStatus.className = "pill bad";
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
els.btnCheckHealth?.addEventListener("click", checkHealth);

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

// Docker smoke test
els.btnSmokeTest?.addEventListener("click", runSmokeTest);

// ── Initialize ──────────────────────────────────────────────────────

init();
showStep(0);
