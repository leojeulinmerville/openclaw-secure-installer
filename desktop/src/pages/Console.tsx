import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ExternalLink, Loader2, Monitor, RefreshCcw, ShieldAlert } from 'lucide-react';
import { useDesktop } from '../contexts/DesktopContext';
import { getConsoleInfo, getRuntimeCapabilities } from '../lib/tauri';
import type { ConsoleInfo, RuntimeCapabilities } from '../types';

const EMPTY_CAPABILITIES: RuntimeCapabilities = {
  version: 'v1',
  generated_at: '',
  safe_mode: true,
  control_ui: { base_path: '/openclaw' },
  channels: [],
  tools: [],
  orchestrators: [],
};

export function Console() {
  const { isGatewayReady, gatewayStatus, allowInternet, startGateway } = useDesktop();
  const [loading, setLoading] = useState(true);
  const [consoleInfo, setConsoleInfo] = useState<ConsoleInfo | null>(null);
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities>(EMPTY_CAPABILITIES);
  const [error, setError] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameStuck, setFrameStuck] = useState(false);

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
      setFrameLoaded(false);
      setFrameStuck(false);
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

  useEffect(() => {
    if (frameLoaded) {
      return;
    }
    const timer = setTimeout(() => {
      setFrameStuck(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [frameLoaded, consoleInfo?.url]);

  const canUseEmbeddedFrame = Boolean(consoleInfo?.url) && !frameStuck;
  const toolsWithInternetState = useMemo(
    () =>
      capabilities.tools.map((tool) => ({
        ...tool,
        blockedByInternetPolicy:
          tool.scope === 'network_blocked' || (!allowInternet && tool.scope.startsWith('network')),
      })),
    [capabilities.tools, allowInternet],
  );

  const openConsoleWindow = async () => {
    if (!consoleInfo?.url) {
      return;
    }
    const existing = await WebviewWindow.getByLabel('openclaw-console');
    if (existing) {
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow('openclaw-console', {
      title: 'OpenClaw Console',
      url: consoleInfo.url,
      width: 1400,
      height: 920,
      center: true,
    });
    await win.setFocus();
  };

  if (!isGatewayReady) {
    return (
      <div className="h-full p-6 space-y-5">
        <div className="glass-panel p-6 space-y-3">
          <h2 className="text-xl font-bold text-white">OpenClaw Console</h2>
          <p className="text-sm text-white/60">
            Start the gateway first, then this page will load the upstream OpenClaw control UI.
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
          <button onClick={() => void openConsoleWindow()} className="glass-button text-sm">
            <Monitor className="w-4 h-4" />
            Open In-App Window
          </button>
          {consoleInfo?.url && (
            <button
              onClick={() => void openExternal(consoleInfo.url)}
              className="glass-button-accent text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open Browser
            </button>
          )}
        </div>
      </div>

      {!allowInternet && (
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-100 text-xs rounded-xl px-3 py-2 inline-flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Safe Mode Internet guard is active (`allow_internet=false`).
        </div>
      )}

      {loading ? (
        <div className="h-[58vh] glass-panel p-8 flex items-center justify-center text-white/60">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading Console...
        </div>
      ) : error ? (
        <div className="glass-panel p-4 text-sm text-red-200 border border-red-500/30 bg-red-500/10">
          Failed to load Console metadata: {error}
        </div>
      ) : canUseEmbeddedFrame && consoleInfo?.url ? (
        <div className="h-[58vh] rounded-xl overflow-hidden border border-white/10 bg-black/30">
          <iframe
            title="OpenClaw Console"
            src={consoleInfo.url}
            className="w-full h-full border-0"
            onLoad={() => setFrameLoaded(true)}
          />
        </div>
      ) : (
        <div className="glass-panel p-4 text-sm text-white/70">
          Embedded frame is unavailable. Use <strong>Open In-App Window</strong>.
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
          rows={toolsWithInternetState.map((tool) => (
            <div key={tool.id} className="text-xs text-white/70 flex items-center justify-between gap-2">
              <span>{tool.display_name}</span>
              <span className={tool.blockedByInternetPolicy ? 'text-amber-300' : 'text-white/40'}>
                {tool.blockedByInternetPolicy ? 'blocked (internet off)' : tool.scope}
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
