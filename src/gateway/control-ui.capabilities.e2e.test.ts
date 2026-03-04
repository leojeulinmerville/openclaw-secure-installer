import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getFreePort, installGatewayTestHooks, startGatewayServer } from "./test-helpers.js";
import { testState } from "./test-helpers.mocks.js";

installGatewayTestHooks({ scope: "suite" });

describe("gateway control ui HTTP + capabilities", () => {
  let server: Awaited<ReturnType<typeof startGatewayServer>>;
  let port = 0;
  let uiRoot = "";

  beforeAll(async () => {
    uiRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-control-ui-"));
    await fs.writeFile(
      path.join(uiRoot, "index.html"),
      "<!doctype html><html><head><title>OpenClaw UI</title></head><body>ok</body></html>\n",
      "utf8",
    );
    testState.gatewayControlUi = { basePath: "/openclaw", root: uiRoot };
    port = await getFreePort();
    server = await startGatewayServer(port, { controlUiEnabled: true });
  });

  afterAll(async () => {
    await server.close();
    if (uiRoot) {
      await fs.rm(uiRoot, { recursive: true, force: true });
    }
  });

  test("serves /openclaw/ html and advertises /openclaw in capabilities", async () => {
    const uiRes = await fetch(`http://127.0.0.1:${port}/openclaw/`);
    expect(uiRes.status).toBe(200);
    expect(uiRes.headers.get("content-type") ?? "").toContain("text/html");

    const capabilitiesRes = await fetch(`http://127.0.0.1:${port}/api/v1/capabilities`);
    expect(capabilitiesRes.status).toBe(200);
    const capabilities = (await capabilitiesRes.json()) as {
      control_ui?: {
        base_path?: string;
      };
    };
    expect(capabilities.control_ui?.base_path).toBe("/openclaw");
  });
});
