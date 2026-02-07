const statusEl = document.querySelector<HTMLSpanElement>("#docker-status");
const button = document.querySelector<HTMLButtonElement>("#check-docker");

if (button && statusEl) {
  button.addEventListener("click", () => {
    statusEl.textContent = "Check pending";
  });
}
