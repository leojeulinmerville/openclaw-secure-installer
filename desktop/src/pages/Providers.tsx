import { useState, useEffect } from 'react';
import {
  invoke,
  setSecret,
  hasSecret,
  deleteSecret,
  testOllamaConnection,
  testGatewayOllamaAccess,
  lmstudioListModels
} from '../lib/tauri';
import {
  Key, Eye, EyeOff, Check, Trash2, TestTube, Server, Loader2, RefreshCcw
} from 'lucide-react';

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

import type { Page } from '../types';

interface Props {
  onNavigate: (page: Page) => void;
}

export function Providers({ onNavigate }: Props) {
  // ── OpenAI state ──────────────────────────────────────────────────
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiTestResult, setOpenaiTestResult] = useState<string | null>(null);
  const [openaiTesting, setOpenaiTesting] = useState(false);

  // ── Ollama state ──────────────────────────────────────────────────
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
      <OllamaWizard onNavigate={onNavigate} />

      {/* ── LM Studio ────────────────────────────────────────────── */}
      <LMStudioWizard />

      {/* ── Container Lifecycle ────────────────────────────────── */}
      <LifecycleSettings />
    </div>
  );
}

function LifecycleSettings() {
  const [stopAgents, setStopAgents] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial state
    invoke<any>('get_state').then(state => {
        setStopAgents(state.stop_agents_on_gateway_stop || false);
        setLoading(false);
    });
  }, []);

  const toggle = async () => {
     const newValue = !stopAgents;
     setStopAgents(newValue);
     await invoke('set_stop_agents_on_gateway_stop', { enabled: newValue });
  };

  return (
    <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center">
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Container Lifecycle</h3>
            <p className="text-xs text-white/30">Manage how Docker containers behave.</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
            <div className="space-y-1">
                <p className="text-sm text-white font-medium">Stop Agents with Gateway</p>
                <p className="text-xs text-white/50">
                    When you stop the Gateway, also stop all running Agent containers.
                </p>
            </div>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-white/30" /> : (
            <button 
                onClick={toggle}
                className={`w-10 h-5 rounded-full relative transition-colors ${stopAgents ? 'bg-green-500' : 'bg-white/10'}`}
            >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${stopAgents ? 'left-6' : 'left-1'}`} />
            </button>
            )}
        </div>
    </div>
  );
}

function OllamaWizard({ onNavigate }: Props) {
  const [step, setStep] = useState(1); // 1: Intro, 2: Check Local, 3: Check Gateway, 4: Success/Fail
  const [localOk, setLocalOk] = useState(false);
  const [gatewayOk, setGatewayOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const runChecks = async () => {
    setLoading(true);
    setErrorMsg('');
    setStep(2);
    setLocalOk(false);
    setGatewayOk(false);

    try {
      // Step 2: Check Localhost directly (from Tauri/browser side)
      const localReachable = await testOllamaConnection('http://localhost:11434');
      if (!localReachable) {
        setLocalOk(false);
        setErrorMsg('Could not reach Ollama at http://localhost:11434.');
        setLoading(false);
        return;
      }
      setLocalOk(true);

      setStep(3);
      const gatewayReachable = await testGatewayOllamaAccess();
      if (!gatewayReachable) {
        setGatewayOk(false);
        setErrorMsg(
          'Gateway container could not reach Ollama at http://localhost:11434.'
        );
        setLoading(false);
        return;
      }

      setGatewayOk(true);
      setStep(4);

    } catch (e) {
      setErrorMsg(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5 space-y-4">
       <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center">
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Ollama Connection Wizard</h3>
            <p className="text-xs text-white/30">Connect your local Ollama instance to OpenClaw.</p>
          </div>
        </div>

        <div className="space-y-4 mt-4">
           {/* Step 1: Start */}
           {step === 1 && (
             <div className="text-sm text-white/70 space-y-3">
               <p>This wizard will help you connect OpenClaw to your local Ollama.</p>
               <div className="bg-white/5 p-3 rounded-lg text-xs space-y-2">
                 <p className="font-bold text-white">Prerequisites:</p>
                 <ul className="list-disc pl-4 space-y-1">
                   <li>Ollama must be installed and running.</li>
                   <li>Ollama must allow local connections.</li>
                 </ul>
               </div>
               <button onClick={() => onNavigate('connect-ollama')} className="glass-button-accent w-full">
                 Open Connection Guide
               </button>
             </div>
           )}

           {/* Progress Steps */}
           {step > 1 && (
             <div className="space-y-3">
               {/* Check 1: Local */}
               <div className="flex items-center gap-3">
                 {step === 2 && loading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : 
                  localOk ? <Check className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-white/20"/>}
                 <span className={step === 2 && loading ? 'text-white' : localOk ? 'text-emerald-400' : 'text-white/30'}>
                   Checking Localhost (11434)...
                 </span>
               </div>

               {/* Check 2: Gateway */}
               {step >= 3 && (
                 <div className="flex items-center gap-3">
                   {step === 3 && loading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : 
                    gatewayOk ? <Check className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-white/20"/>}
                    <span className={step === 3 && loading ? 'text-white' : gatewayOk ? 'text-emerald-400' : 'text-white/30'}>
                      Verifying Gateway Access...
                    </span>
                 </div>
               )}

                {/* Failure Guide */}
                {!loading && step === 2 && !localOk && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-sm text-white/80 space-y-3 animate-in slide-in-from-top-2">
                    <p className="font-bold text-red-300">Could not reach Ollama on 127.0.0.1:11434</p>
                    {errorMsg && <p className="text-xs font-mono text-red-300/70">{errorMsg}</p>}
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      <li>Is Ollama running? (Try `ollama serve` in terminal)</li>
                      <li>Is it blocked by firewall?</li>
                    </ul>
                    <button onClick={runChecks} className="glass-button w-full mt-2">Retry</button>
                  </div>
                )}

                {!loading && step === 3 && !gatewayOk && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-sm text-white/80 space-y-3 animate-in slide-in-from-top-2">
                    <p className="font-bold text-red-300">
                      Gateway cannot access Ollama via 127.0.0.1:11434
                    </p>
                    {errorMsg && <p className="text-xs font-mono text-red-300/70">{errorMsg}</p>}
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      <li>Keep Ollama running and reachable from Docker.</li>
                      <li>Ensure Ollama is bound to 0.0.0.0 (not localhost-only).</li>
                    </ul>
                    <button onClick={runChecks} className="glass-button w-full mt-2">Retry</button>
                  </div>
                )}
                
                {/* Success */}
                {step === 4 && gatewayOk && (
                   <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-sm text-white/80 animate-in slide-in-from-top-2">
                     <p className="font-bold text-emerald-300 flex items-center gap-2"><Check className="w-4 h-4"/> Connected Successfully</p>
                     <p className="text-xs mt-1">Ollama is ready to use with agents.</p>
                     <button onClick={() => setStep(1)} className="glass-button w-full mt-3 text-xs">Done</button>
                   </div>
                )}
             </div>
           )}
        </div>
    </div>
  );
}

function LMStudioWizard() {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const runChecks = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await lmstudioListModels('http://localhost:1234/v1');
      if (result && result.length > 0) {
        setModels(result.map((m: any) => typeof m === 'string' ? m : m.name || m.id));
      } else {
        setModels([]);
        setErrorMsg('LM Studio is reachable but no models are loaded.');
      }
    } catch (e) {
      setErrorMsg(toErrorMessage(e));
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <div className="glass-panel p-5 space-y-4">
       <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center">
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">LM Studio Wizard</h3>
            <p className="text-xs text-white/30">Connect your local LM Studio server.</p>
          </div>
          <div className="ml-auto">
            <button onClick={runChecks} disabled={loading} className="glass-button text-sm">
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="space-y-4 mt-4">
           <div className="text-sm text-white/70 space-y-3">
             <div className="bg-white/5 p-3 rounded-lg text-xs space-y-2">
               <p className="font-bold text-white">Instructions:</p>
               <ul className="list-disc pl-4 space-y-1">
                 <li>Open LM Studio and go to the <b>Local Server</b> tab.</li>
                 <li>Start the server on port <b>1234</b>.</li>
                 <li>Load a model. OpenClaw will detect it automatically.</li>
               </ul>
             </div>
           </div>

           {/* Status Block */}
           {!loading && errorMsg && (
             <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-sm text-white/80 space-y-3 animate-in slide-in-from-top-2">
               <p className="font-bold text-red-300">LM Studio Server Offline</p>
               <p className="text-xs font-mono text-red-300/70">{errorMsg.includes('fetch') || errorMsg.includes('Connection failed') || errorMsg.includes('Failed to fetch') ? 'Ensure the server is started inside LM Studio.' : errorMsg}</p>
             </div>
           )}

           {!loading && !errorMsg && models.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-sm text-white/80 animate-in slide-in-from-top-2">
                <p className="font-bold text-emerald-300 flex items-center gap-2"><Check className="w-4 h-4"/> Connected Successfully</p>
                <div className="mt-2 pl-6">
                    <p className="text-xs text-white/50 mb-1">Loaded Models:</p>
                    <ul className="list-disc text-white text-xs space-y-1">
                        {models.map(m => <li key={m}>{m}</li>)}
                    </ul>
                </div>
              </div>
           )}
        </div>
    </div>
  );
}
