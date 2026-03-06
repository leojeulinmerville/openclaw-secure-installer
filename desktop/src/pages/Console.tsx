import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, Loader2, Monitor, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useDesktop } from '../contexts/DesktopContext';
import { getConsoleInfo, getRuntimeCapabilities, openConsoleWindow as openConsoleWindowCommand } from '../lib/tauri';
import type { ConsoleInfo, RuntimeCapabilities } from '../types';

const EMPTY_CAPABILITIES: RuntimeCapabilities = {
  version: 'v1',
  generated_at: '',
  safe_mode: true,
  control_ui: { base_path: '', auth_required: true, auth_mode: 'token', insecure_fallback: true },
  channels: [],
  tools: [],
  orchestrators: [],
};

export function Console() {
  const { isGatewayReady, gatewayStatus, startGateway } = useDesktop();
  const [loading, setLoading] = useState(true);
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null);
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities>(EMPTY_CAPABILITIES);
  const [error, setError] = useState<string | null>(null);
  const [autoOpenedForUrl, setAutoOpenedForUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextConsoleInfo, nextCapabilities] = await Promise.all([
        getConsoleInfo(),
        getRuntimeCapabilities(),
      ]);
      setConsoleInfo(nextConsoleInfo);
      setCapabilities(nextCapabilities);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCapabilities(EMPTY_CAPABILITIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [gatewayStatus?.containerStable, gatewayStatus?.healthOk]);

  const openConsoleWindow = useCallback(async () => {
    if (!consoleInfo?.url) {
      return false;
    }
    try {
      await openConsoleWindowCommand();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [consoleInfo?.url]);

  useEffect(() => {
    if (
      !isGatewayReady ||
      !consoleInfo?.url ||
      !consoleInfo.ui_available ||
      autoOpenedForUrl === consoleInfo.url
    ) {
      return;
    }
    void openConsoleWindow().then((opened) => {
      if (opened) {
        setAutoOpenedForUrl(consoleInfo.url);
      }
    });
  }, [isGatewayReady, consoleInfo?.url, autoOpenedForUrl, openConsoleWindow]);

  const toolsWithPolicy = useMemo(
    () =>
      capabilities.tools.map((tool) => ({
        ...tool,
        blockedByPolicy: tool.blocked_by_policy,
      })),
    [capabilities.tools],
  );
  const apiDocLinks = useMemo(() => {
    if (!consoleInfo?.port) {
      return [];
    }
    const base = `http://127.0.0.1:${consoleInfo.port}`;
    return [
      { label: 'Capabilities API', url: `${base}/api/v1/capabilities` },
      { label: 'Docs (/docs)', url: `${base}/docs` },
      { label: 'OpenAPI (/openapi.json)', url: `${base}/openapi.json` },
    ];
  }, [consoleInfo?.port]);
  const canOpenInAppWindow = Boolean(consoleInfo?.url && consoleInfo?.ui_available);

  if (!isGatewayReady) {
    return (
      <div className="h-full p-6 space-y-5">
        <div className="glass-panel p-6 space-y-3">
          <h2 className="text-xl font-bold text-white">OpenClaw Console</h2>
          <p className="text-sm text-white/60">
            Start the gateway first, then the Console opens in a dedicated in-app window.
          </p>
          <button
            onClick={() => void startGateway().then(load)}
            className="glass-button-accent inline-flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Start Gateway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-5 space-y-4">
      <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white">OpenClaw Console</h2>
          <p className="text-xs text-white/50 truncate">
            {consoleInfo?.url ?? 'Resolving console URL...'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load()} className="glass-button text-sm">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => void openConsoleWindow()}
            disabled={!canOpenInAppWindow}
            className={`text-sm ${canOpenInAppWindow ? 'glass-button-accent' : 'glass-button opacity-60 cursor-not-allowed'}`}
          >
            <Monitor className="w-4 h-4" />
            Open In-App Window
          </button>
          {consoleInfo?.url && (
            <a
              href={consoleInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-button text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {consoleInfo?.ui_available ? 'Open Browser' : 'Open Browser (Root)'}
            </a>
          )}
        </div>
      </div>

      {capabilities.safe_mode && (
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-100 text-xs rounded-xl px-3 py-2 inline-flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Safe Mode is active. Internet/network tools may be blocked by policy.
        </div>
      )}

      {/* MVP Clarification Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-sm text-blue-100/90 space-y-2">
        <p className="font-bold flex items-center gap-2"><Monitor className="w-4 h-4"/> Mission Control vs Console</p>
        <p className="text-xs text-blue-100/70 leading-relaxed">
          You are currently using <b>Mission Control</b> (the desktop app) to manage OpenClaw. The <b>Web Console</b> is designed for headless server deployments on a browser. In this MVP release, the Gateway exposes a simple placeholder. 
          <br/><br/>
          <b>You do not need the Web Console to use agents!</b> Head over to the Agents page to get started. 🚀
        </p>
      </div>

      {loading ? (
        <div className="glass-panel p-8 flex items-center justify-center text-white/60">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading Console metadata...
        </div>
      ) : consoleInfo?.ui_available ? (
        <div className="glass-panel p-4 text-sm text-white/70">
          Console opens in a dedicated Tauri window by default for reliability on Windows.
        </div>
      ) : (
        <div className="glass-panel p-4 text-sm text-amber-100 border border-amber-500/30 bg-amber-500/10">
          Console route metadata loaded, but no HTML Control UI route was discovered.
        </div>
      )}

      {!loading && consoleInfo && !consoleInfo.ui_available && (
        <div className="glass-panel p-4 border border-blue-500/20 bg-blue-500/5 space-y-3">
          <div className="flex items-start gap-3">
            <Monitor className="w-5 h-5 text-blue-300 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-blue-200">
                Gateway APIs are Online
              </h3>
              <p className="text-xs text-blue-100/70">
                The gateway is routing API requests normally, but this container image does not bundle the HTML Control UI.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {consoleInfo.url && (
              <a
                href={consoleInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-button text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Open Gateway Root
              </a>
            )}
            {apiDocLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-button text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="glass-panel p-4 text-sm text-red-200 border border-red-500/30 bg-red-500/10">
          Console error: {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-3">
        <CapabilityCard
          title={`Channels (${capabilities.channels.length})`}
          rows={capabilities.channels.map((channel) => (
            <div key={channel.id} className="text-xs text-white/70 flex items-center justify-between gap-2">
              <span>{channel.display_name}</span>
              <span className="text-white/40">{channel.status}</span>
            </div>
          ))}
        />
        <CapabilityCard
          title={`Tools (${capabilities.tools.length})`}
          rows={toolsWithPolicy.map((tool) => (
            <div key={tool.id} className="text-xs text-white/70 flex items-center justify-between gap-2">
              <span>{tool.display_name}</span>
              <span className={tool.blockedByPolicy ? 'text-amber-300' : 'text-white/40'}>
                {tool.blockedByPolicy ? 'blocked by policy' : tool.scope}
              </span>
            </div>
          ))}
        />
        <CapabilityCard
          title={`Orchestrators (${capabilities.orchestrators.length})`}
          rows={capabilities.orchestrators.map((orchestrator) => (
            <div key={orchestrator.id} className="text-xs text-white/70 flex items-center justify-between gap-2">
              <span>{orchestrator.display_name}</span>
              <span className="text-white/40">{orchestrator.id}</span>
            </div>
          ))}
        />
      </div>
    </div>
  );
}

function CapabilityCard(props: { title: string; rows: ReactNode[] }) {
  return (
    <div className="glass-panel p-3 space-y-2 min-h-[180px]">
      <h3 className="text-xs font-semibold text-white/80">{props.title}</h3>
      <div className="space-y-1 max-h-[220px] overflow-auto custom-scroll">
        {props.rows.length > 0 ? props.rows : <p className="text-xs text-white/40">No data.</p>}
      </div>
    </div>
  );
}
