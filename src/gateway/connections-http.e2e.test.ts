import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getFreePort, installGatewayTestHooks, startGatewayServer } from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

describe("gateway connections HTTP", () => {
  let server: Awaited<ReturnType<typeof startGatewayServer>>;
  let port = 0;
  let previousBootstrapToken: string | undefined;
  let previousSafeMode: string | undefined;
  let previousAllowInternet: string | undefined;
  const bootstrapToken = "desktop-bootstrap-connections-test";

  beforeAll(async () => {
    previousBootstrapToken = process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN;
    previousSafeMode = process.env.OPENCLAW_SAFE_MODE;
    previousAllowInternet = process.env.OPENCLAW_ALLOW_INTERNET;
    process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN = bootstrapToken;
    process.env.OPENCLAW_SAFE_MODE = "1";
    process.env.OPENCLAW_ALLOW_INTERNET = "0";
    port = await getFreePort();
    server = await startGatewayServer(port, { controlUiEnabled: false });
  });

  afterAll(async () => {
    await server.close();
    if (previousBootstrapToken === undefined) {
      delete process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN;
    } else {
      process.env.OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN = previousBootstrapToken;
    }
    if (previousSafeMode === undefined) {
      delete process.env.OPENCLAW_SAFE_MODE;
    } else {
      process.env.OPENCLAW_SAFE_MODE = previousSafeMode;
    }
    if (previousAllowInternet === undefined) {
      delete process.env.OPENCLAW_ALLOW_INTERNET;
    } else {
      process.env.OPENCLAW_ALLOW_INTERNET = previousAllowInternet;
    }
  });

  async function bootstrapCookie(): Promise<string> {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/local-auth/bootstrap?token=${bootstrapToken}&next=/`,
      {
        redirect: "manual",
      },
    );
    expect(response.status).toBe(302);
    const cookieRaw = response.headers.get("set-cookie") ?? "";
    const cookie = cookieRaw.split(";")[0] ?? "";
    expect(cookie).toContain("openclaw_local_session=");
    return cookie;
  }

  test("requires local-session cookie and returns runtime schema", async () => {
    const unauthorized = await fetch(`http://127.0.0.1:${port}/api/v1/connections/schema`);
    expect(unauthorized.status).toBe(401);

    const cookie = await bootstrapCookie();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/connections/schema`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      version?: string;
      safe_mode?: boolean;
      channels?: Array<{
        id?: string;
        schema?: { fields?: Array<{ key?: string; type?: string; storage?: string }> };
      }>;
      providers?: Array<{ id?: string }>;
    };
    expect(payload.version).toBe("v1");
    expect(payload.safe_mode).toBe(true);
    expect(Array.isArray(payload.channels)).toBe(true);
    expect(Array.isArray(payload.providers)).toBe(true);

    const telegram = payload.channels?.find((entry) => entry.id === "telegram");
    expect(telegram).toBeTruthy();
    expect(telegram?.schema?.fields?.some((field) => field.key === "bot_token")).toBe(true);
    expect(
      telegram?.schema?.fields?.some(
        (field) => field.key === "bot_token" && field.type === "secret" && field.storage === "keychain",
      ),
    ).toBe(true);
  });

  test("configure persists keychain references and status surfaces policy-blocked tests", async () => {
    const cookie = await bootstrapCookie();

    const configureResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/connections/provider/openai/configure`,
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          values: {
            base_url: "https://api.openai.com/v1",
            model: "gpt-4.1-mini",
          },
          secret_refs: {
            api_key: "connections.provider.openai.api_key",
          },
        }),
      },
    );
    expect(configureResponse.status).toBe(200);
    const configurePayload = (await configureResponse.json()) as {
      ok?: boolean;
      configured?: boolean;
      status?: { configured?: boolean };
    };
    expect(configurePayload.ok).toBe(true);
    expect(configurePayload.configured).toBe(true);
    expect(configurePayload.status?.configured).toBe(true);

    const configPath = process.env.OPENCLAW_CONFIG_PATH;
    expect(typeof configPath).toBe("string");
    const configRaw = await fs.readFile(String(configPath), "utf8");
    expect(configRaw).toContain("keychain://connections.provider.openai.api_key");
    expect(configRaw).not.toContain("sk-");

    const testResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/connections/provider/openai/test`,
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          values: {
            api_key: "sk-test-not-used-when-policy-blocked",
            base_url: "https://api.openai.com/v1",
            model: "gpt-4.1-mini",
          },
        }),
      },
    );
    expect(testResponse.status).toBe(200);
    const testPayload = (await testResponse.json()) as {
      ok?: boolean;
      message?: string;
    };
    expect(testPayload.ok).toBe(false);
    expect(testPayload.message ?? "").toContain("blocked by Safe Mode policy");

    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/v1/connections/status`, {
      headers: { cookie },
    });
    expect(statusResponse.status).toBe(200);
    const statusPayload = (await statusResponse.json()) as {
      providers?: Array<{
        id?: string;
        configured?: boolean;
        healthy?: boolean;
        errors?: string[];
      }>;
    };
    const openai = statusPayload.providers?.find((entry) => entry.id === "openai");
    expect(openai).toBeTruthy();
    expect(openai?.configured).toBe(true);
    expect(openai?.healthy).toBe(false);
    expect((openai?.errors ?? []).join(" ")).toContain("blocked by Safe Mode policy");
  });
});
