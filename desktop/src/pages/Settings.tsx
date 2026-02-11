import { useState, useEffect } from 'react';
import { getState, configureInstallation, openAppDataFolder, getAllowInternet, setAllowInternet } from '../lib/tauri';
import type { InstallerState } from '../types';
import {
  FolderOpen, Save, Network, HardDrive, Loader2, Info, Wifi, WifiOff,
} from 'lucide-react';

export function Settings() {
  const [state, setState] = useState<InstallerState | null>(null);
  const [httpPort, setHttpPort] = useState(8080);
  const [httpsPort, setHttpsPort] = useState(8443);
  const [gatewayImage, setGatewayImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [allowInternet, setAllowInternetLocal] = useState(false);
  const [internetLoading, setInternetLoading] = useState(false);

  useEffect(() => {
    getState().then(s => {
      setState(s);
      setHttpPort(s.http_port);
      setHttpsPort(s.https_port);
      setGatewayImage(s.gateway_image);
    }).catch(console.error);
    getAllowInternet().then(setAllowInternetLocal).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await configureInstallation(httpPort, httpsPort, gatewayImage || undefined);
      setMessage('Settings saved. Restart gateway for port changes to take effect.');
    } catch (e) {
      setMessage(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInternetToggle = async () => {
    setInternetLoading(true);
    try {
      const next = !allowInternet;
      await setAllowInternet(next);
      setAllowInternetLocal(next);
    } catch (e) {
      setMessage(`Error: ${e}`);
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
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allowInternet ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
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
            className={`toggle-switch ${allowInternet ? 'toggle-on' : 'toggle-off'}`}
          >
            <span className="toggle-knob" />
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
              <p className="text-xs text-white/30 font-mono">{state?.app_data_dir || '...'}</p>
            </div>
          </div>
          <button onClick={() => openAppDataFolder()} className="glass-button text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> Open
          </button>
        </div>
      </section>

      {/* ── Install ID ──────────────────────────────────────────── */}
      {state && (
        <section className="glass-panel p-5 space-y-2">
          <p className="text-xs text-white/20">Install ID: <span className="font-mono">{state.install_id}</span></p>
          <p className="text-xs text-white/20">Status: <span className="font-mono">{state.status}</span></p>
        </section>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="glass-button-accent flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        {message && (
          <span className="text-xs text-white/40">{message}</span>
        )}
      </div>
    </div>
  );
}
