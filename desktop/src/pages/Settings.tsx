import { useState, useEffect } from 'react';
import { configureInstallation, openAppDataFolder } from '../lib/tauri';
import {
  FolderOpen, Network, HardDrive, Loader2, Info, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { useDesktop } from '../contexts/DesktopContext';

export function Settings() {
  const { config, startGateway, stopGateway, setInternet, allowInternet, refresh } = useDesktop();
  
  // Local form state
  const [httpPort, setHttpPort] = useState(8080);
  const [httpsPort, setHttpsPort] = useState(8443);
  const [gatewayImage, setGatewayImage] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [internetLoading, setInternetLoading] = useState(false);

  // Sync from context on load
  useEffect(() => {
    if (config) {
      setHttpPort(config.http_port);
      setHttpsPort(config.https_port);
      setGatewayImage(config.gateway_image);
    }
  }, [config]);

  const hasChanges = config && (
    httpPort !== config.http_port ||
    httpsPort !== config.https_port ||
    gatewayImage !== config.gateway_image
  );

  const handleSaveAndRestart = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // 1. Save config
      await configureInstallation(httpPort, httpsPort, gatewayImage || undefined);
      setMessage('Configuration saved. Restarting gateway...');
      
      // 2. Restart gateway to apply changes
      await stopGateway();
      await startGateway();
      
      // 3. Refresh context
      await refresh();
      setMessage('Settings applied and gateway restarted successfully.');
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInternetToggle = async () => {
    setInternetLoading(true);
    try {
      await setInternet(!allowInternet);
    } catch (e) {
      setMessage(`Error toggling internet: ${e}`);
    } finally {
      setInternetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Settings</h2>

      {/* Ports */}
      <section className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500/15 rounded-lg flex items-center justify-center">
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Gateway Ports</h3>
            <p className="text-xs text-white/30">Local ports the gateway listens on.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 block mb-1">HTTP Port</label>
            <input
              type="number"
              value={httpPort}
              onChange={e => setHttpPort(parseInt(e.target.value) || 8080)}
              className="glass-input"
              min={1024} max={65535}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">HTTPS Port</label>
            <input
              type="number"
              value={httpsPort}
              onChange={e => setHttpsPort(parseInt(e.target.value) || 8443)}
              className="glass-input"
              min={1024} max={65535}
            />
          </div>
        </div>

        {(httpPort < 1024 || httpsPort < 1024) && (
          <div className="flex items-start gap-2 text-xs text-amber-300/60 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Privileged ports (&lt;1024) may require admin rights. Recommended: 8080/8443.</span>
          </div>
        )}
      </section>

      {/* Allow Internet */}
      <section className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${allowInternet ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              {allowInternet ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Allow Internet</h3>
              <p className="text-xs text-white/30">Global toggle for outbound internet access.</p>
            </div>
          </div>
          <button
            onClick={handleInternetToggle}
            disabled={internetLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${allowInternet ? 'bg-emerald-500' : 'bg-white/10'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowInternet ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/30 bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            {allowInternet
              ? 'Internet is enabled. OpenAI chat and agent egress networking are available. Agents still need individual network toggle.'
              : 'Internet is disabled (safe default). Agents are fully isolated. Enable this to use OpenAI chat or connect agents to the internet.'}
          </span>
        </div>
      </section>

      {/* Gateway Image */}
      <section className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Gateway Image</h3>
            <p className="text-xs text-white/30">Docker image used for the gateway container.</p>
          </div>
        </div>

        <input
          type="text"
          value={gatewayImage}
          onChange={e => setGatewayImage(e.target.value)}
          className="glass-input font-mono text-sm"
          placeholder="ghcr.io/leojeulinmerville/openclaw-gateway:stable"
        />
      </section>

      {/* Data directory */}
      <section className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Data Directory</h3>
              <p className="text-xs text-white/30 font-mono">{config?.app_data_dir || '...'}</p>
            </div>
          </div>
          <button onClick={() => openAppDataFolder()} className="glass-button text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Open
          </button>
        </div>
      </section>

      {/* ── Install ID ──────────────────────────────────────────── */}
      {config && (
        <section className="glass-panel p-5 space-y-2">
          <p className="text-xs text-white/20">Install ID: <span className="font-mono">{config.install_id}</span></p>
          <p className="text-xs text-white/20">Status: <span className="font-mono">{config.status}</span></p>
        </section>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 min-h-[40px]">
        {hasChanges ? (
          <button onClick={handleSaveAndRestart} disabled={saving} className="glass-button-accent flex items-center gap-2 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/30">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Apply & Restart Gateway
          </button>
        ) : (
           <span className="text-xs text-white/20 italic">No unsaved changes</span>
        )}
        
        {message && (
          <span className={`text-xs ${message.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
