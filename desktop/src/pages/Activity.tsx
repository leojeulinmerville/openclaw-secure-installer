import { useState, useEffect, useCallback } from 'react';
import { isGatewayRunning, startGateway, stopGateway, gatewayLogs, checkGatewayHealth } from '../lib/tauri';
import type { GatewayStartResult, HealthCheckResult } from '../types';
import { StatusPill } from '../components/StatusPill';
import {
  Play, Square, RotateCw, FileText,
  Loader2, Heart, RefreshCw
} from 'lucide-react';

export function Activity() {
  const [gateway, setGateway] = useState<GatewayStartResult | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [actionRunning, setActionRunning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const g = await isGatewayRunning();
      setGateway(g);
      if (g.gatewayActive) {
        const [h, l] = await Promise.all([checkGatewayHealth(), gatewayLogs()]);
        setHealth(h);
        setLogs(l);
      } else {
        setHealth(null);
        setLogs('');
      }
    } catch (e) {
      console.error('Activity refresh failed:', e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleStart = async () => {
    setActionRunning(true);
    try { await startGateway(); await refresh(); }
    catch (e) { console.error(e); }
    finally { setActionRunning(false); }
  };

  const handleStop = async () => {
    setActionRunning(true);
    try { await stopGateway(); await refresh(); }
    catch (e) { console.error(e); }
    finally { setActionRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Activity & Gateway</h2>
        <button onClick={refresh} className="glass-button text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Gateway Status Card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500/15 rounded-lg flex items-center justify-center">
              <Heart className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Gateway</h3>
              <p className="text-xs text-white/30">{gateway?.userFriendlyTitle || 'Checking...'}</p>
            </div>
          </div>
          <StatusPill
            status={gateway?.gatewayActive && health?.healthy ? 'ok' : gateway?.gatewayActive ? 'warn' : 'bad'}
            text={gateway?.gatewayActive && health?.healthy ? 'Healthy' : gateway?.gatewayActive ? 'Unhealthy' : 'Offline'}
          />
        </div>

        {/* Health details */}
        {health && (
          <div className="text-xs text-white/40 bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
            <span>HTTP {health.statusCode} — {health.body?.slice(0, 200)}</span>
          </div>
        )}

        {/* Gateway actions */}
        <div className="flex gap-2">
          {!gateway?.gatewayActive ? (
            <button
              onClick={handleStart}
              disabled={actionRunning}
              className="glass-button-success flex items-center gap-2 text-sm"
            >
              {actionRunning
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Play className="w-4 h-4" />}
              Start Gateway
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                disabled={actionRunning}
                className="glass-button-danger flex items-center gap-2 text-sm"
              >
                {actionRunning
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Square className="w-4 h-4" />}
                Stop
              </button>
              <button
                onClick={async () => { await handleStop(); await handleStart(); }}
                disabled={actionRunning}
                className="glass-button flex items-center gap-2 text-sm"
              >
                <RotateCw className="w-4 h-4" /> Restart
              </button>
            </>
          )}
        </div>

        {/* Diagnostics */}
        {gateway && !gateway.gatewayActive && gateway.rawDiagnostics && (
          <div className="text-xs text-white/40 bg-red-500/[0.03] p-3 rounded-lg border border-red-500/10">
            <p className="font-medium text-red-300/60 mb-1">Diagnostics:</p>
            <pre className="whitespace-pre-wrap">{gateway.rawDiagnostics}</pre>
            {gateway.remediationSteps.length > 0 && (
              <ul className="mt-2 space-y-1 text-white/30">
                {gateway.remediationSteps.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-white/30" />
          <h3 className="text-sm font-bold text-white">Gateway Logs</h3>
        </div>
        {logs ? (
          <pre className="bg-black/30 rounded-lg p-4 text-xs text-green-300/60 font-mono max-h-80 overflow-y-auto logs-scroll whitespace-pre-wrap border border-white/[0.04]">
            {logs}
          </pre>
        ) : (
          <div className="bg-black/20 rounded-lg p-6 text-center text-white/20 text-xs border border-white/[0.04]">
            {gateway?.gatewayActive ? 'Loading logs...' : 'Start the gateway to view logs.'}
          </div>
        )}
      </div>
    </div>
  );
}
