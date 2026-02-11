import { useState, useEffect } from 'react';
import { setSecret, hasSecret, deleteSecret } from '../lib/tauri';
import {
  Key, Eye, EyeOff, Check, Trash2, TestTube, Server, Loader2
} from 'lucide-react';

export function Providers() {
  // ── OpenAI state ──────────────────────────────────────────────────
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<string | null>(null);
  const [openaiTesting, setOpenaiTesting] = useState(false);

  // ── Ollama state ──────────────────────────────────────────────────
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://host.docker.internal:11434');
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaTesting, setOllamaTesting] = useState(false);

  useEffect(() => {
    hasSecret('OPENAI_API_KEY').then(setOpenaiKeySet).catch(console.error);
  }, []);

  const saveOpenaiKey = async () => {
    if (!openaiKey.trim()) return;
    setOpenaiSaving(true);
    try {
      await setSecret('OPENAI_API_KEY', openaiKey.trim());
      setOpenaiKeySet(true);
      setOpenaiKey('');
      setOpenaiTestResult('Key saved to OS keychain.');
    } catch (e) {
      setOpenaiTestResult(`Error: ${e}`);
    } finally {
      setOpenaiSaving(false);
    }
  };

  const removeOpenaiKey = async () => {
    try {
      await deleteSecret('OPENAI_API_KEY');
      setOpenaiKeySet(false);
      setOpenaiTestResult('Key removed from keychain.');
    } catch (e) {
      setOpenaiTestResult(`Error: ${e}`);
    }
  };

  const testOpenai = async () => {
    setOpenaiTesting(true);
    setOpenaiTestResult(null);
    try {
      // We can't call OpenAI directly from Tauri without the key in frontend.
      // This just validates the key is stored.
      const exists = await hasSecret('OPENAI_API_KEY');
      setOpenaiTestResult(exists
        ? 'API key is stored in OS keychain. It will be injected when agents start.'
        : 'No API key found. Please set your key first.'
      );
    } catch (e) {
      setOpenaiTestResult(`Error: ${e}`);
    } finally {
      setOpenaiTesting(false);
    }
  };

  const testOllama = async () => {
    setOllamaTesting(true);
    try {
      const resp = await fetch(`${ollamaEndpoint}/api/tags`);
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || []).map((m: { name: string }) => m.name);
        setOllamaModels(models);
        setOllamaStatus('connected');
      } else {
        setOllamaStatus('error');
        setOllamaModels([]);
      }
    } catch {
      setOllamaStatus('error');
      setOllamaModels([]);
    } finally {
      setOllamaTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Providers</h2>
      <p className="text-sm text-white/40">
        Configure your AI provider credentials. Secrets are stored in your OS keychain — never saved to disk as plaintext.
      </p>

      {/* ── OpenAI ─────────────────────────────────────────────── */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500/15 rounded-lg flex items-center justify-center">
            <Key className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">OpenAI</h3>
            <p className="text-xs text-white/30">GPT-4, GPT-3.5, and newer models</p>
          </div>
          <div className="ml-auto">
            {openaiKeySet
              ? <span className="pill ok"><Check className="w-3 h-3" /> Key Set</span>
              : <span className="pill neutral">No Key</span>
            }
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder={openaiKeySet ? '••••••••••••••••' : 'sk-...'}
              className="glass-input pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={saveOpenaiKey} disabled={!openaiKey.trim() || openaiSaving} className="glass-button-accent">
            {openaiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          {openaiKeySet && (
            <>
              <button onClick={testOpenai} disabled={openaiTesting} className="glass-button text-sm">
                <TestTube className="w-4 h-4" />
              </button>
              <button onClick={removeOpenaiKey} className="glass-button-danger text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {openaiTestResult && (
          <div className="text-xs text-white/50 bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
            {openaiTestResult}
          </div>
        )}
      </div>

      {/* ── Ollama ─────────────────────────────────────────────── */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center">
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Ollama</h3>
            <p className="text-xs text-white/30">Local models — Llama, Mistral, CodeLlama, etc.</p>
          </div>
          <div className="ml-auto">
            {ollamaStatus === 'connected'
              ? <span className="pill ok"><Check className="w-3 h-3" /> Connected</span>
              : ollamaStatus === 'error'
                ? <span className="pill bad">Unreachable</span>
                : <span className="pill neutral">Not tested</span>
            }
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={ollamaEndpoint}
            onChange={e => setOllamaEndpoint(e.target.value)}
            className="glass-input flex-1"
            placeholder="http://host.docker.internal:11434"
          />
          <button onClick={testOllama} disabled={ollamaTesting} className="glass-button-accent">
            {ollamaTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
          </button>
        </div>

        {ollamaModels.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/40">Available models ({ollamaModels.length}):</p>
            <div className="flex flex-wrap gap-2">
              {ollamaModels.map(m => (
                <span key={m} className="pill info">{m}</span>
              ))}
            </div>
          </div>
        )}

        {ollamaStatus === 'error' && (
          <div className="text-xs text-red-300/60 bg-red-500/[0.05] rounded-lg p-3 border border-red-500/10">
            Could not reach Ollama at {ollamaEndpoint}. Make sure Ollama is running on your machine.
          </div>
        )}
      </div>
    </div>
  );
}
