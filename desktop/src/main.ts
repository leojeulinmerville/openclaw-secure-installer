import { invoke } from "@tauri-apps/api/core";

// Types
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

// UI Elements
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

  // Step 4
  btnStopGateway: document.getElementById("stop-gateway") as HTMLButtonElement,
  btnViewLogs: document.getElementById("view-logs") as HTMLButtonElement,
  runtimeLogs: document.getElementById("runtime-logs") as HTMLDivElement,
  installId: document.getElementById("install-id") as HTMLParagraphElement,
};

let currentState: InstallerState | null = null;

// Navigation
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

// Logic
async function init() {
  try {
    currentState = await invoke<InstallerState>("get_state");
    if (els.installId) els.installId.textContent = `ID: ${currentState.install_id}`;
    if (els.pathDisplay) els.pathDisplay.textContent = currentState.app_data_dir;
    
    // Resume state logic could go here (if status == "running", jump to step 4)
  } catch (err) {
    console.error("Failed to load state:", err);
  }
}

// Step 1: Docker Check
async function runCheck() {
  els.btnCheck.disabled = true;
  els.btnCheck.textContent = "Checking...";
  
  try {
    const result = await invoke<CheckDockerResult>("check_docker");
    
    // Update pills
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

// Step 2: Configure
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

// Step 3: Install/Start
async function startGateway() {
  els.btnStartGateway.disabled = true;
  els.installLogs.textContent = "Starting Gateway (docker compose up -d)...\n";
  
  try {
    const msg = await invoke<string>("start_gateway");
    els.installLogs.textContent += msg + "\nDone.";
    setTimeout(() => showStep(3), 1000); // Go to Step 4
  } catch (err) {
    els.installLogs.textContent += "\nError: " + err;
    els.btnStartGateway.disabled = false;
  }
}

// Step 4: Manage
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

// Event Listeners
els.btnCheck?.addEventListener("click", runCheck);
els.btnStep1Next?.addEventListener("click", () => showStep(1));
els.btnStep2Next?.addEventListener("click", saveConfiguration);
els.btnStartGateway?.addEventListener("click", startGateway);
els.btnStopGateway?.addEventListener("click", stopGateway);
els.btnViewLogs?.addEventListener("click", viewLogs);

// Initialize
init();
showStep(0);
