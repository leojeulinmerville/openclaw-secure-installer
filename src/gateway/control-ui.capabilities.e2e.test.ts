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
  let previousBootstrapToken: string | undefined;
  const bootstrapToken = "desktop-bootstrap-test-token";

  beforeAll(async () => {
    previousBootstrapToken = process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN;
    process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN = bootstrapToken;
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
    if (previousBootstrapToken === undefined) {
      delete process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN;
    } else {
      process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN = previousBootstrapToken;
    }
    if (uiRoot) {
      await fs.rm(uiRoot, { recursive: true, force: true });
    }
  });

  test("serves /openclaw/ html and supports cookie-authenticated capabilities requests", async () => {
    const uiRes = await fetch(`http://127.0.0.1:${port}/openclaw/`);
    expect(uiRes.status).toBe(200);
    expect(uiRes.headers.get("content-type") ?? "").toContain("text/html");

    const unauthCapabilitiesRes = await fetch(`http://127.0.0.1:${port}/api/v1/capabilities`);
    expect(unauthCapabilitiesRes.status).toBe(401);

    const bootstrapRes = await fetch(
      `http://127.0.0.1:${port}/api/v1/local-auth/bootstrap?token=${bootstrapToken}&next=/openclaw/`,
      {
        redirect: "manual",
      },
    );
    expect(bootstrapRes.status).toBe(302);
    const cookieRaw = bootstrapRes.headers.get("set-cookie") ?? "";
    expect(cookieRaw).toContain("openclaw_local_session=");
    const cookie = cookieRaw.split(";")[0] ?? "";
    expect(cookie).toContain("openclaw_local_session=");

    const capabilitiesRes = await fetch(`http://127.0.0.1:${port}/api/v1/capabilities`, {
      headers: { cookie },
    });
    expect(capabilitiesRes.status).toBe(200);
    const capabilities = (await capabilitiesRes.json()) as {
      control_ui?: {
        base_path?: string;
        auth_mode?: string;
        insecure_fallback?: boolean;
      };
    };
    expect(capabilities.control_ui?.base_path).toBe("/openclaw");
    expect(capabilities.control_ui?.auth_mode).toBe("cookie");
    expect(capabilities.control_ui?.insecure_fallback).toBe(false);
  });
});
