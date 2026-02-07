# Safe Mode

OpenClaw allows enabling a **Safe Mode** to harden the runtime environment, particularly when running in restricted contexts like Docker containers or shared environments.

## Activation

To enable Safe Mode, set the environment variable to a truthy value (`1`, `true`, `yes`, `on`).

```bash
export OPENCLAW_SAFE_MODE=1
```

## Restrictions

When Safe Mode is enabled, the following restrictions apply:

### 1. Process Execution
Only allowlisted binaries can be spawned by the OpenClaw agent.
*   **Allowed**: `node`, `bun`, `openclaw`, and the absolute path currently running the agent.
*   **Blocked**: Any other system command (e.g., `ls`, `cat`, `curl`, `bash`, `python`).
*   **Logging**: Attempts to run blocked commands will throw a specific "Safe Mode validation failed" error.

### 2. Plugin Loading
External plugins are strictly disabled.
*   **Disabled**: Plugins from `workspaceDir`, command-line arguments, or extra load paths.
*   **Allowed**: Only internal "bundled" plugins.
*   **Logging**: A warning `[safe-mode] External plugins discovery disabled` is logged at startup.

### 3. Shell Profile Protection
The onboarding wizard prevents any modification to user shell profiles.
*   **Skipped**: Shell completion installation (`installCompletion`).
*   **Skipped**: Systemd user service setup (`ensureSystemdUserLinger`).
*   **Skipped**: Gateway service installation/management/restarts.
*   **Logging**: Each skipped action logs a clear `[safe-mode] Skipping ...` warning.

## Use Case

Safe Mode is designed for the **Secure Installer MVP** and Docker deployments where:
*   The agent should operate in a confined manner.
*   Host system modifications are strictly forbidden.
*   Arbitrary sub-process execution is a security risk.
