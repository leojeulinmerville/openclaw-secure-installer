import { invoke } from "@tauri-apps/api/core";

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

type UiState = "idle" | "running" | "success" | "error";

const button = document.querySelector<HTMLButtonElement>("#check-docker");
const stateTag = document.querySelector<HTMLSpanElement>("#check-state");
const statusCli = document.querySelector<HTMLSpanElement>("#status-cli");
const statusDaemon = document.querySelector<HTMLSpanElement>("#status-daemon");
const statusCompose = document.querySelector<HTMLSpanElement>("#status-compose");
const versionCli = document.querySelector<HTMLSpanElement>("#version-cli");
const versionServer = document.querySelector<HTMLSpanElement>("#version-server");
const versionCompose = document.querySelector<HTMLSpanElement>("#version-compose");
const remediation = document.querySelector<HTMLDivElement>("#remediation");
const diagnosticsPanel = document.querySelector<HTMLDetailsElement>("#diagnostics-panel");
const diagnosticsList = document.querySelector<HTMLUListElement>("#diagnostics");
const lastCheck = document.querySelector<HTMLParagraphElement>("#last-check");

function setState(state: UiState) {
  if (!stateTag || !button) {
    return;
  }
  const label = state === "idle" ? "Idle" : state === "running" ? "Running" : state;
  stateTag.textContent = label;
  stateTag.className = `state-tag ${state}`;
  button.disabled = state === "running";
  button.textContent = state === "running" ? "Checking..." : "Check Docker";
}

function setPill(el: HTMLSpanElement | null, state: "ok" | "bad" | "neutral", text: string) {
  if (!el) {
    return;
  }
  el.textContent = text;
  el.className = `pill ${state}`;
}

function setVersion(el: HTMLSpanElement | null, version: string | null | undefined) {
  if (!el) {
    return;
  }
  el.textContent = version ? `Version: ${version}` : "";
}

function setRemediation(message: string | null | undefined) {
  if (!remediation) {
    return;
  }
  if (!message) {
    remediation.textContent = "";
    remediation.classList.add("hidden");
    return;
  }
  remediation.textContent = message;
  remediation.classList.remove("hidden");
}

function setDiagnostics(items: string[]) {
  if (!diagnosticsPanel || !diagnosticsList) {
    return;
  }
  diagnosticsList.innerHTML = "";
  if (items.length === 0) {
    diagnosticsPanel.classList.add("hidden");
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    diagnosticsList.appendChild(li);
  }
  diagnosticsPanel.classList.remove("hidden");
}

function renderResult(result: CheckDockerResult) {
  const cliOk = result.dockerCliFound;
  const daemonOk = result.dockerDaemonReachable;
  const composeOk = result.composeV2Available;

  setPill(statusCli, cliOk ? "ok" : "bad", cliOk ? "OK" : "KO");
  setPill(
    statusDaemon,
    cliOk ? (daemonOk ? "ok" : "bad") : "neutral",
    cliOk ? (daemonOk ? "OK" : "KO") : "N/A",
  );
  setPill(
    statusCompose,
    cliOk ? (composeOk ? "ok" : "bad") : "neutral",
    cliOk ? (composeOk ? "OK" : "KO") : "N/A",
  );

  setVersion(versionCli, result.dockerCliVersion);
  setVersion(versionServer, result.dockerServerVersion);
  setVersion(versionCompose, result.composeVersion);
  setRemediation(result.remediation);
  setDiagnostics(result.diagnostics || []);
  if (lastCheck) {
    lastCheck.textContent = `Derniere verification: ${new Date().toLocaleTimeString()}`;
  }
}

async function runCheck() {
  setState("running");
  setRemediation(null);
  setDiagnostics([]);

  try {
    const result = await invoke<CheckDockerResult>("check_docker");
    renderResult(result);
    if (!result.dockerCliFound) {
      setState("error");
    } else {
      setState("success");
    }
  } catch {
    setState("error");
    setRemediation("Echec de la verification. Reessayez.");
  }
}

if (button) {
  button.addEventListener("click", () => {
    void runCheck();
  });
}
