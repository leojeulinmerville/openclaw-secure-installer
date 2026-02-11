import { useState, useEffect, useCallback } from 'react';
import { checkDocker, isGatewayRunning, checkGatewayHealth } from '../lib/tauri';
import { formatCost } from '../lib/format';
import type { CheckDockerResult, GatewayStartResult, HealthCheckResult, Alert } from '../types';
import { StatusPill } from '../components/StatusPill';
import {
  ShieldCheck, Server, Wifi,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Clock
} from 'lucide-react';

// Mock data for alerts until M4 wires real data
const MOCK_ALERTS: Alert[] = [];

export function Overview() {
  const [docker, setDocker] = useState<CheckDockerResult | null>(null);
  const [gateway, setGateway] = useState<GatewayStartResult | null>(null);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([checkDocker(), isGatewayRunning()]);
      setDocker(d);
      setGateway(g);
      if (g.gatewayActive) {
        const h = await checkGatewayHealth();
        setHealth(h);
      }
    } catch (e) {
      console.error('Overview refresh failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Clock className="w-5 h-5 animate-spin mr-2" /> Loading system status...
      </div>
    );
  }

  const dockerOk = docker?.dockerCliFound && docker?.dockerDaemonReachable && docker?.composeV2Available;
  const gatewayOk = gateway?.gatewayActive && health?.healthy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Overview</h2>
        <button onClick={refresh} className="glass-button text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── System Posture ──────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">System Posture</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm font-medium text-white">Docker</p>
                <p className="text-xs text-white/30">{docker?.dockerCliVersion || 'Unknown'}</p>
              </div>
            </div>
            <StatusPill status={dockerOk ? 'ok' : 'bad'} text={dockerOk ? 'Ready' : 'Issue'} />
          </div>

          <div className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm font-medium text-white">Gateway</p>
                <p className="text-xs text-white/30">{gateway?.gatewayActive ? 'Running' : 'Stopped'}</p>
              </div>
            </div>
            <StatusPill
              status={gatewayOk ? 'ok' : gateway?.gatewayActive ? 'warn' : 'bad'}
              text={gatewayOk ? 'Healthy' : gateway?.gatewayActive ? 'Unhealthy' : 'Offline'}
            />
          </div>

          <div className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm font-medium text-white">Tailscale</p>
                <p className="text-xs text-white/30">Not configured</p>
              </div>
            </div>
            <StatusPill status="neutral" text="Optional" />
          </div>
        </div>
      </section>

      {/* ── Security Posture ────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Security Posture</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="metric-card">
            <span className="metric-label">Safe Mode</span>
            <span className="metric-value text-lg text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Enabled
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Egress Allowlist</span>
            <span className="metric-value text-lg">Active</span>
            <span className="metric-sub">Default deny policy</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Capabilities</span>
            <span className="metric-value text-lg">Dropped</span>
            <span className="metric-sub">All caps removed</span>
          </div>
        </div>
      </section>

      {/* ── Costs Summary ──────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Costs (Today)</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="metric-card">
            <span className="metric-label">Total Today</span>
            <span className="metric-value">{formatCost(0)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Last Hour</span>
            <span className="metric-value">{formatCost(0)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Top Agent</span>
            <span className="metric-value text-lg text-white/30">—</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Active Agents</span>
            <span className="metric-value">0</span>
          </div>
        </div>
      </section>

      {/* ── Alerts Summary ─────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Recent Alerts</h3>
        {MOCK_ALERTS.length === 0 ? (
          <div className="glass-panel p-6 text-center text-white/20 text-sm">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
            No alerts. All systems nominal.
          </div>
        ) : (
          <div className="space-y-2">
            {MOCK_ALERTS.slice(0, 5).map(a => (
              <div key={a.id} className="glass-panel p-3 flex items-center gap-3">
                {a.severity === 'critical' && <XCircle className="w-4 h-4 text-red-400" />}
                {a.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {a.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                <div className="flex-1">
                  <p className="text-sm text-white">{a.title}</p>
                  <p className="text-xs text-white/30">{a.message}</p>
                </div>
                <span className="text-xs text-white/20">{a.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
