import { useState, useEffect } from 'react';
import { createAgent, startAgent, ollamaListModels, lmstudioListModels } from '../lib/tauri';
import type { Page } from '../types';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'ollama', label: 'Ollama (local)', models: ['llama3', 'mistral', 'codellama', 'phi3'] },
  { value: 'lmstudio', label: 'LM Studio (local)', models: [] },
];

const PRESETS = [
  { value: 'default', label: 'Default', desc: 'Balanced security and usability' },
  { value: 'strict', label: 'Strict', desc: 'Maximum restrictions, minimal capabilities' },
  { value: 'permissive', label: 'Permissive', desc: 'Fewer restrictions — use with caution' },
];

interface Props {
  onNavigate: (page: Page, agentId?: string) => void;
}

export default function CreateAgent({ onNavigate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [availableModels, setAvailableModels] = useState<string[]>(PROVIDERS[0].models);
  const [workspace, setWorkspace] = useState('');
  const [preset, setPreset] = useState('default');
  const [networkEnabled, setNetworkEnabled] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const selectedProvider = PROVIDERS.find((p) => p.value === provider);
  const canProceed =
    step === 0 ? name.trim().length > 0 && availableModels.length > 0 && availableModels[0] !== 'Connection failed' && availableModels[0] !== 'No models found' :
    step === 1 ? true :
    step === 2 ? true :
    true;

  useEffect(() => {
    let active = true;
    if (provider === 'openai') {
      const p = PROVIDERS.find(x => x.value === 'openai');
      setAvailableModels(p?.models || []);
      setModel(p?.models[0] || '');
    } else if (provider === 'ollama') {
      ollamaListModels('http://localhost:11434').then((res: any[]) => {
        if (!active) return;
        const names = res && res.length > 0 ? res.map(m => typeof m === 'string' ? m : m.name) : ['llama3', 'mistral'];
        setAvailableModels(names);
        setModel(names[0]);
      }).catch(() => {
        if (!active) return;
        setAvailableModels(['llama3', 'mistral']);
        setModel('llama3');
      });
    } else if (provider === 'lmstudio') {
      lmstudioListModels('http://localhost:1234/v1').then((res: any[]) => {
        if (!active) return;
        const names = res && res.length > 0 ? res.map(m => typeof m === 'string' ? m : m.name || m.id) : ['No models found'];
        setAvailableModels(names);
        setModel(names[0]);
      }).catch(() => {
        if (!active) return;
        setAvailableModels(['Connection failed']);
        setModel('Connection failed');
      });
    }
    return () => { active = false; };
  }, [provider]);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const agent = await createAgent(name.trim(), provider, model, workspace, preset);
      if (startNow) {
        await startAgent(agent.id);
      }
      onNavigate('agents');
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => onNavigate('agents')}>
          ← Back to Agents
        </button>
        <h1>Create Agent</h1>
        <p className="text-muted">Set up a new sandboxed AI agent in a few steps.</p>
      </div>

      {/* Step indicators */}
      <div className="wizard-steps">
        {['Identity', 'Workspace', 'Policy', 'Review'].map((label, i) => (
          <div key={i} className={`wizard-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <span className="wizard-step-num">{i < step ? '✓' : i + 1}</span>
            <span className="wizard-step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* STEP 0: Identity */}
        {step === 0 && (
          <div className="wizard-body">
            <h2>Agent Identity</h2>
            <div className="form-group">
              <label>Agent Name</label>
              <input
                className="input"
                placeholder="e.g. Research Assistant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={48}
              />
              <span className="form-hint">A friendly name for your agent. Unique per install.</span>
            </div>
            <div className="form-group">
              <label>Provider</label>
              <select className="input" value={provider} onChange={(e) => {
                setProvider(e.target.value);
              }}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <span className="form-hint">
                {provider === 'openai'
                  ? 'Uses your OpenAI API key stored in the OS keychain.'
                  : 'Connects to a local Ollama instance. No API key needed.'}
              </span>
            </div>
            <div className="form-group">
              <label>Model</label>
              <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* STEP 1: Workspace */}
        {step === 1 && (
          <div className="wizard-body">
            <h2>Workspace</h2>
            <div className="form-group">
              <label>Workspace Path</label>
              <input
                className="input"
                placeholder="Leave empty for auto (recommended)"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
              />
              <span className="form-hint">
                This folder is bind-mounted into the agent's container as its only writable directory.
                Leave empty and we'll create one automatically in your app data folder.
              </span>
            </div>
            <div className="info-box">
              <strong>🔒 Security note</strong>
              <p>The agent can only read/write files in this workspace. The rest of the filesystem is read-only. No access to host files outside this folder.</p>
            </div>
          </div>
        )}

        {/* STEP 2: Policy */}
        {step === 2 && (
          <div className="wizard-body">
            <h2>Security Policy</h2>
            <div className="form-group">
              <label>Policy Preset</label>
              <div className="preset-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    className={`preset-card ${preset === p.value ? 'selected' : ''}`}
                    onClick={() => setPreset(p.value)}
                  >
                    <strong>{p.label}</strong>
                    <span>{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label>Advanced</label>
              <div className="toggle-row">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={networkEnabled}
                    onChange={(e) => setNetworkEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div>
                  <span className="form-label-inline">Network Access</span>
                  <span className="form-hint">
                    {networkEnabled
                      ? 'ON — Agent can reach internal Docker network. No internet unless you configure egress.'
                      : 'OFF (default) — Agent is completely isolated. Most secure option.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 3 && (
          <div className="wizard-body">
            <h2>Review & Create</h2>
            <div className="review-table">
              <div className="review-row"><span>Name</span><strong>{name}</strong></div>
              <div className="review-row"><span>Provider</span><strong>{selectedProvider?.label}</strong></div>
              <div className="review-row"><span>Model</span><strong>{model}</strong></div>
              <div className="review-row"><span>Workspace</span><strong>{workspace || '(auto)'}</strong></div>
              <div className="review-row"><span>Policy</span><strong>{preset}</strong></div>
              <div className="review-row">
                <span>Network</span>
                <strong style={{ color: networkEnabled ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {networkEnabled ? 'Enabled' : 'Disabled (secure)'}
                </strong>
              </div>
            </div>

            <div className="toggle-row" style={{ marginTop: 20 }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span>Start agent immediately after creation</span>
            </div>

            <div className="hardening-badges">
              <span className="badge badge-success">Non-root</span>
              <span className="badge badge-success">Read-only filesystem</span>
              <span className="badge badge-success">All capabilities dropped</span>
              <span className="badge badge-success">No Docker socket</span>
              <span className="badge badge-success">No host ports</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="error-box">{error}</div>}

        {/* Navigation */}
        <div className="wizard-nav">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              ← Previous
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button
              className="btn btn-primary"
              disabled={!canProceed}
              onClick={() => setStep(step + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? 'Creating...' : startNow ? 'Create & Start' : 'Create Agent'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
