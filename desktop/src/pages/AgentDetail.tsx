import { useState, useEffect, useCallback } from 'react';
import {
  getAgentDetail, startAgent, stopAgent, restartAgent, removeAgent,
  agentLogs, agentStats, agentSetNetwork, quarantineAgent, unquarantineAgent,
  checkAgentCrashloop,
} from '../lib/tauri';
import type { AgentEntry, AgentStatsResult, Page } from '../types';
import { StatusPill } from '../components/StatusPill';

type Tab = 'overview' | 'logs' | 'metrics' | 'policies';

interface Props {
  agentId: string;
  onNavigate: (page: Page) => void;
}

export default function AgentDetail({ agentId, onNavigate }: Props) {
  const [agent, setAgent] = useState<AgentEntry | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [logs, setLogs] = useState('');
  const [stats, setStats] = useState<AgentStatsResult | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const a = await getAgentDetail(agentId);
      setAgent(a);
    } catch (e) {
      setError(String(e));
    }
  }, [agentId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh when on logs or metrics tab
  useEffect(() => {
    if (!agent) return;
    const interval = setInterval(async () => {
      if (tab === 'logs') {
        try { setLogs(await agentLogs(agentId, 200)); } catch { /* */ }
      }
      if (tab === 'metrics') {
        try { setStats(await agentStats(agentId)); } catch { /* */ }
      }
      // Always check crash loop for running agents
      if (agent.status === 'running') {
        try {
          const crashed = await checkAgentCrashloop(agentId);
          if (crashed) refresh();
        } catch { /* */ }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [agentId, agent, tab, refresh]);

  // Load tab data on switch
  useEffect(() => {
    if (!agent) return;
    if (tab === 'logs') {
      agentLogs(agentId, 200).then(setLogs).catch(() => setLogs('No logs available'));
    }
    if (tab === 'metrics') {
      agentStats(agentId).then(setStats).catch(() => setStats(null));
    }
  }, [tab, agent, agentId]);

  async function action(label: string, fn: () => Promise<unknown>) {
    setLoading(label);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading('');
    }
  }

  if (!agent) return <div className="page-container"><p className="text-muted">Loading...</p></div>;

  const statusColor =
    agent.status === 'running' ? 'ok' as const :
    agent.status === 'quarantined' ? 'bad' as const :
    agent.status === 'error' ? 'warn' as const :
    'neutral' as const;

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => onNavigate('agents')}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1>{agent.name}</h1>
          <StatusPill status={statusColor} text={agent.quarantined ? 'Quarantined' : agent.status} />
          {!agent.networkEnabled && (
            <span className="badge badge-muted">Network OFF</span>
          )}
        </div>
        <p className="text-muted">{agent.containerName} · {agent.provider} / {agent.model}</p>
      </div>

      {/* Action bar */}
      <div className="action-bar">
        {agent.status !== 'running' && !agent.quarantined && (
          <button className="btn btn-primary" disabled={!!loading}
            onClick={() => action('Starting...', () => startAgent(agentId))}>
            {loading === 'Starting...' ? 'Starting...' : '▶ Start'}
          </button>
        )}
        {agent.status === 'running' && (
          <>
            <button className="btn btn-ghost" disabled={!!loading}
              onClick={() => action('Stopping...', () => stopAgent(agentId))}>
              ⏹ Stop
            </button>
            <button className="btn btn-ghost" disabled={!!loading}
              onClick={() => action('Restarting...', () => restartAgent(agentId))}>
              🔄 Restart
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Network toggle */}
        <div className="toggle-row compact">
          <label className="toggle small">
            <input
              type="checkbox"
              checked={agent.networkEnabled}
              disabled={!!loading || agent.quarantined}
              onChange={async (e) => {
                await action(
                  e.target.checked ? 'Enabling network...' : 'Disabling network...',
                  () => agentSetNetwork(agentId, e.target.checked)
                );
              }}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="text-small">Network</span>
        </div>

        {/* Quarantine */}
        {!agent.quarantined ? (
          <button className="btn btn-danger-ghost" disabled={!!loading}
            onClick={() => action('Quarantining...', () => quarantineAgent(agentId))}>
            🛑 Quarantine
          </button>
        ) : (
          <button className="btn btn-ghost" disabled={!!loading}
            onClick={() => action('Unquarantining...', () => unquarantineAgent(agentId))}>
            ↩ Unquarantine
          </button>
        )}

        {/* Remove */}
        {!confirmRemove ? (
          <button className="btn btn-danger-ghost" onClick={() => setConfirmRemove(true)}>
            🗑 Remove
          </button>
        ) : (
          <div className="confirm-inline">
            <span className="text-danger text-small">Are you sure?</span>
            <button className="btn btn-danger btn-small" disabled={!!loading}
              onClick={async () => {
                await action('Removing...', () => removeAgent(agentId));
                onNavigate('agents');
              }}>
              Yes, Remove
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="error-box">{error}</div>}
      {agent.lastError && !error && (
        <div className="error-box">Last error: {agent.lastError}</div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {(['overview', 'logs', 'metrics', 'policies'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content glass-panel">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="detail-grid">
            <div className="detail-item">
              <label>Status</label>
              <span>{agent.status}</span>
            </div>
            <div className="detail-item">
              <label>Provider</label>
              <span>{agent.provider}</span>
            </div>
            <div className="detail-item">
              <label>Model</label>
              <span>{agent.model}</span>
            </div>
            <div className="detail-item">
              <label>Policy Preset</label>
              <span>{agent.policyPreset}</span>
            </div>
            <div className="detail-item">
              <label>Workspace</label>
              <span className="text-mono text-small">{agent.workspacePath}</span>
            </div>
            <div className="detail-item">
              <label>Network</label>
              <span style={{ color: agent.networkEnabled ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {agent.networkEnabled ? 'Enabled' : 'Disabled (secure)'}
              </span>
            </div>
            <div className="detail-item">
              <label>Quarantined</label>
              <span style={{ color: agent.quarantined ? 'var(--color-danger)' : 'inherit' }}>
                {agent.quarantined ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="detail-item">
              <label>Container</label>
              <span className="text-mono text-small">{agent.containerName}</span>
            </div>
            <div className="detail-item">
              <label>Created</label>
              <span>{new Date(agent.createdAt).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <label>Last Seen</label>
              <span>{new Date(agent.lastSeen).toLocaleString()}</span>
            </div>

            <div className="hardening-badges" style={{ gridColumn: '1 / -1', marginTop: 16 }}>
              <span className="badge badge-success">Non-root</span>
              <span className="badge badge-success">Read-only rootfs</span>
              <span className="badge badge-success">CAP_DROP ALL</span>
              <span className="badge badge-success">No Docker socket</span>
              <span className="badge badge-success">No host ports</span>
              {!agent.networkEnabled && <span className="badge badge-success">Network isolated</span>}
            </div>
          </div>
        )}

        {/* Logs tab */}
        {tab === 'logs' && (
          <div className="log-viewer">
            <div className="log-header">
              <span className="text-muted">Last 200 lines · auto-refreshes every 3s</span>
              <button className="btn btn-ghost btn-small"
                onClick={() => agentLogs(agentId, 200).then(setLogs).catch(() => {})}>
                Refresh
              </button>
            </div>
            <pre className="log-output">{logs || 'No logs available'}</pre>
          </div>
        )}

        {/* Metrics tab */}
        {tab === 'metrics' && (
          <div className="metrics-grid">
            <div className="metric-card">
              <label>CPU</label>
              <span className="metric-value">{stats ? `${stats.cpuPercent.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="metric-card">
              <label>Memory</label>
              <span className="metric-value">{stats ? `${stats.memoryMb.toFixed(1)} MB` : '—'}</span>
            </div>
            <div className="metric-card">
              <label>Net RX</label>
              <span className="metric-value">{stats?.netIoRx ?? '—'}</span>
            </div>
            <div className="metric-card">
              <label>Net TX</label>
              <span className="metric-value">{stats?.netIoTx ?? '—'}</span>
            </div>
            <div className="metric-card">
              <label>Status</label>
              <span className="metric-value">{stats?.running ? 'Running' : 'Stopped'}</span>
            </div>
            <p className="text-muted text-small" style={{ gridColumn: '1 / -1' }}>
              Auto-refreshes every 3 seconds when agent is running.
            </p>
          </div>
        )}

        {/* Policies tab */}
        {tab === 'policies' && (
          <div className="detail-grid">
            <div className="detail-item">
              <label>Policy Preset</label>
              <span>{agent.policyPreset}</span>
            </div>
            <div className="detail-item">
              <label>Network Access</label>
              <span>{agent.networkEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="info-box" style={{ gridColumn: '1 / -1' }}>
              <strong>Container Hardening (always enforced)</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Runs as non-root user (<code>node</code>)</li>
                <li>Read-only root filesystem</li>
                <li>All Linux capabilities dropped</li>
                <li>no-new-privileges security option</li>
                <li>Docker socket never mounted</li>
                <li>No ports exposed to host</li>
                <li>Only workspace directory is writable</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
