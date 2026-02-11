import { useState, useEffect } from 'react';
import { listAgents, agentInspectHealth } from '../lib/tauri';
import type { AgentListItem, Page } from '../types';
import { StatusPill } from '../components/StatusPill';
import { relativeTime } from '../lib/format';
import { useDesktop } from '../contexts/DesktopContext';
import { AlertTriangle } from 'lucide-react';

interface Props {
  onNavigate: (page: Page, agentId?: string) => void;
}

export default function AgentsList({ onNavigate }: Props) {
  const { isGatewayReady, startGateway } = useDesktop();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Poll agents list only when gateway is ready
  useEffect(() => {
    if (!isGatewayReady) {
      setLoading(false);
      return;
    }
    
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isGatewayReady]);

  async function refresh() {
    try {
      const list = await listAgents();
      // Refresh health for running agents (optimization: parallelize or trust list if rich enough)
      // For now, keep the detailed health check pattern but maybe debounce it later
      const updated = await Promise.all(
        list.map(async (a) => {
          if (a.status === 'running') {
            try {
              const health = await agentInspectHealth(a.id);
              return { ...a, status: health.healthy ? 'running' as const : 'error' as const };
            } catch {
              return a;
            }
          }
          return a;
        })
      );
      setAgents(updated);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Gating view
  if (!isGatewayReady) {
    return (
      <div className="page-container custom-scroll flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Gateway Required</h2>
          <p className="text-white/60 mb-8">
            The OpenClaw Gateway must be running to manage agents. 
            Start the gateway to view and control your agents.
          </p>
          <button 
            onClick={() => startGateway()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold transition-all"
          >
            Start Gateway
          </button>
        </div>
      </div>
    );
  }

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.provider.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (a: AgentListItem) =>
    a.quarantined ? 'bad' as const :
    a.status === 'running' ? 'ok' as const :
    a.status === 'error' ? 'warn' as const :
    'neutral' as const;

  const statusLabel = (a: AgentListItem) =>
    a.quarantined ? 'Quarantined' : a.status;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Agents</h1>
        <p className="text-muted">Manage your sandboxed AI agents.</p>
      </div>

      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => onNavigate('create-agent')}>
          + Create Agent
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading agents...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-icon">🤖</div>
          <h2>No agents yet</h2>
          <p>Create your first sandboxed AI agent to get started.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('create-agent')}>
            + Create Agent
          </button>
        </div>
      ) : (
        <div className="agent-grid">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="glass-panel agent-card clickable"
              onClick={() => onNavigate('agent-detail', a.id)}
            >
              <div className="agent-card-header">
                <strong>{a.name}</strong>
                <StatusPill status={statusColor(a)} text={statusLabel(a)} />
              </div>
              <div className="agent-card-meta">
                <span>{a.provider} / {a.model}</span>
                <span className="text-muted">{a.policyPreset}</span>
              </div>
              <div className="agent-card-badges">
                {!a.networkEnabled && <span className="badge badge-muted">Net OFF</span>}
                {a.quarantined && <span className="badge badge-danger">Quarantined</span>}
              </div>
              <div className="agent-card-footer text-muted text-small">
                {a.lastSeen ? relativeTime(a.lastSeen) : 'Never active'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
