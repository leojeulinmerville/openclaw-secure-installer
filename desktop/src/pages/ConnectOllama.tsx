import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, ExternalLink, RefreshCw, Download, Server, Zap } from 'lucide-react';
import { openExternal, invoke } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';

interface Props {
  onBack: () => void;
  onConnected: () => void;
}

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
}

// Curated models: ordered by size (smallest first for quick start)
const CURATED_MODELS = [
  { id: 'llama3.2:1b', label: 'Llama 3.2 1B', desc: '~1 GB — fastest, great for quick tests' },
  { id: 'gemma3:1b', label: 'Gemma 3 1B', desc: '~700 MB — Google\'s efficient 1B model' },
  { id: 'phi4-mini', label: 'Phi-4 Mini', desc: '~2 GB — Microsoft, balanced quality' },
  { id: 'llama3.1:8b', label: 'Llama 3.1 8B', desc: '~5 GB — strong general-purpose model' },
];

async function checkLocalConnection(): Promise<string> {
  return await invoke('ollama_test', { endpoint: 'http://localhost:11434' });
}

async function listModels(): Promise<OllamaModel[]> {
  return await invoke('ollama_list_models', { endpoint: 'http://localhost:11434' });
}

async function pullModel(model: string): Promise<void> {
  return await invoke('ollama_pull_model', { endpoint: 'http://localhost:11434', model });
}

async function testCompletion(model: string): Promise<string> {
  return await invoke('ollama_run_test_completion', { endpoint: 'http://localhost:11434', model });
}

export function ConnectOllama({ onBack, onConnected }: Props) {
  const [step, setStep] = useState(1); // 1: Detect, 2: Models, 3: Test
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pullModel_, setPullModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<any>(null);
  const [customPullName, setCustomPullName] = useState('');
  const [testModel, setTestModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ response: string; latencyMs: number } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    const promise = listen('ollama-pull-progress', (event) => {
      setPullProgress(event.payload);
    });

    // Auto-detect on mount
    checkConnection();

    return () => {
      promise.then(f => f());
    };
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    setError(null);
    try {
      await checkLocalConnection();
      setStep(2);
      await loadModels();
    } catch (e: any) {
      setError(e.toString());
      setStep(1);
    } finally {
      setChecking(false);
    }
  };

  const loadModels = async () => {
    try {
      const list = await listModels();
      setModels(list);
      if (list.length > 0 && !testModel) {
        setTestModel(list[0].name);
      }
    } catch (e: any) {
      setError('Connected, but failed to list models: ' + e.toString());
    }
  };

  const handlePull = async (modelName: string) => {
    const name = modelName.trim();
    if (!name) return;
    setPulling(true);
    setPullModel(name);
    setPullProgress({ status: 'Starting pull…' });
    setError(null);
    try {
      await pullModel(name);
      await loadModels();
    } catch (e: any) {
      setError('Pull failed: ' + e.toString());
    } finally {
      setPulling(false);
      setPullModel(null);
      setPullProgress(null);
    }
  };

  const handleTestCompletion = async () => {
    if (!testModel) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    const t0 = Date.now();
    try {
      const response = await testCompletion(testModel);
      setTestResult({ response, latencyMs: Date.now() - t0 });
      setStep(3);
    } catch (e: any) {
      setTestError(e.toString());
    } finally {
      setTesting(false);
    }
  };

  const pullPercent = pullProgress?.total
    ? Math.round((pullProgress.completed / pullProgress.total) * 100)
    : null;

  return (
    <div className="page-container custom-scroll p-8 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Connect Local Ollama</h1>
        <p className="text-white/60 text-lg">
          Run open-source models locally. Private, offline-capable, and fast.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Step 1: Detect ── */}
        <div className={`glass-panel p-6 ${error ? 'border-red-500/30' : step >= 2 ? 'border-green-500/30' : 'border-blue-500/30'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
              ${checking ? 'bg-blue-500/10 text-blue-400' : error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> :
               error ? <Server className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-bold text-white">
                {checking ? 'Detecting Ollama…' : error ? 'Not Detected' : 'Ollama Connected'}
              </h3>

              {checking && <p className="text-white/60 text-sm">Checking http://localhost:11434 …</p>}

              {error && (
                <div className="space-y-3">
                  <p className="text-red-300 text-sm">Could not connect to Ollama on 127.0.0.1:11434</p>
                  <div className="text-xs bg-black/30 p-3 rounded font-mono text-red-200/70 overflow-x-auto">
                    {error}
                  </div>
                  <div className="text-sm text-white/60 space-y-1">
                    <p className="font-medium">How to fix:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Is Ollama installed? <button onClick={() => openExternal('https://ollama.com')} className="text-blue-400 hover:underline inline-flex items-center gap-1">Download it <ExternalLink className="w-3 h-3" /></button></li>
                      <li>Start Ollama from your system tray or Applications folder.</li>
                      <li>Then click <strong>Detect Again</strong> below.</li>
                    </ul>
                  </div>
                  <button onClick={checkConnection} className="glass-button w-full justify-center">
                    <RefreshCw className="w-4 h-4" /> Detect Again
                  </button>
                </div>
              )}

              {!checking && !error && (
                <p className="text-green-300 text-sm">Successfully connected to local Ollama at 127.0.0.1:11434</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Step 2: Models ── */}
        {step >= 2 && (
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Installed Models {models.length > 0 && <span className="text-white/40 text-sm font-normal">({models.length})</span>}
              </h3>
              <button onClick={loadModels} className="glass-button text-xs gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {models.length === 0 ? (
              <div className="space-y-4">
                <p className="text-white/40 text-sm text-center py-4">No models found. Pull one to get started.</p>

                {/* Curated model grid */}
                <div className="grid grid-cols-1 gap-2">
                  {CURATED_MODELS.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                      <div>
                        <span className="font-mono text-sm text-white">{m.id}</span>
                        <p className="text-xs text-white/40 mt-0.5">{m.desc}</p>
                      </div>
                      <button
                        onClick={() => handlePull(m.id)}
                        disabled={pulling}
                        className="glass-button text-xs gap-1.5 shrink-0"
                      >
                        {pulling && pullModel_ === m.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        {pulling && pullModel_ === m.id ? 'Pulling…' : 'Pull'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Custom pull */}
                <div className="flex gap-2 mt-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Custom model name (e.g. mistral:latest)"
                    value={customPullName}
                    onChange={e => setCustomPullName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePull(customPullName)}
                  />
                  <button
                    onClick={() => handlePull(customPullName)}
                    disabled={pulling || !customPullName.trim()}
                    className="glass-button text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Pull
                  </button>
                </div>

                {/* Pull progress */}
                {pulling && pullProgress && (
                  <div className="bg-black/30 rounded p-3 text-xs font-mono text-white/50">
                    <div className="flex justify-between mb-1">
                      <span>{pullProgress.status}</span>
                      {pullPercent !== null && <span>{pullPercent}%</span>}
                    </div>
                    {pullPercent !== null && (
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${pullPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Model list */}
                <div className="grid gap-2">
                  {models.map((m) => (
                    <div key={m.name} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                      <span className="font-mono text-sm text-white">{m.name}</span>
                      <span className="text-xs text-white/40">{(Number(m.size) / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    </div>
                  ))}
                </div>

                {/* Pull more */}
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Pull another model…"
                    value={customPullName}
                    onChange={e => setCustomPullName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePull(customPullName)}
                  />
                  <button
                    onClick={() => handlePull(customPullName)}
                    disabled={pulling || !customPullName.trim()}
                    className="glass-button text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Pull
                  </button>
                </div>

                {pulling && pullProgress && (
                  <div className="bg-black/30 rounded p-3 text-xs font-mono text-white/50">
                    <div className="flex justify-between mb-1">
                      <span>{pullProgress.status}</span>
                      {pullPercent !== null && <span>{pullPercent}%</span>}
                    </div>
                    {pullPercent !== null && (
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${pullPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Test Completion — Step 3 entry point */}
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-white/80">Test a Model</h4>

                  <div className="flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={testModel}
                      onChange={e => setTestModel(e.target.value)}
                    >
                      {models.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleTestCompletion}
                      disabled={testing || !testModel}
                      className="glass-button-accent text-xs gap-1.5"
                    >
                      {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {testing ? 'Testing…' : 'Test Completion'}
                    </button>
                  </div>

                  {testError && (
                    <div className="text-xs text-red-300 bg-red-500/10 rounded p-2">{testError}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Test result ── */}
        {testResult && (
          <div className="glass-panel p-6 border-green-500/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-white">Completion Success</h3>
                  <span className="text-xs text-white/40 font-mono">{testResult.latencyMs}ms</span>
                </div>
                <div className="bg-black/30 rounded p-3 text-sm text-green-200/90 font-mono">
                  {testResult.response}
                </div>
                <p className="text-xs text-white/40 mt-2">Model: {testModel} · Latency: {testResult.latencyMs}ms</p>

                <button onClick={onConnected} className="glass-button-accent w-full justify-center gap-2 mt-4">
                  <CheckCircle className="w-4 h-4" /> Done — Use {testModel} in Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Finish without testing */}
        {step >= 2 && models.length > 0 && !testResult && (
          <button onClick={onConnected} className="glass-button w-full justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> I'm Ready — Skip Test
          </button>
        )}
      </div>
    </div>
  );
}
