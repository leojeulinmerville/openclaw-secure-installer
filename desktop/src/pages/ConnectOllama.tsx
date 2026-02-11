import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, ExternalLink, RefreshCw, Download, Server } from 'lucide-react';
import { openExternal, invoke } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';

interface Props {
  onBack: () => void;
  onConnected: () => void;
}

interface OllamaModel {
  name: String;
  size: number;
  digest: String;
}

// Check local connection (localhost:11434 via Rust backend)
async function checkLocalConnection(): Promise<string> {
   return await invoke('ollama_test', { endpoint: 'http://127.0.0.1:11434' });
}

async function listModels(): Promise<OllamaModel[]> {
   return await invoke('ollama_list_models', { endpoint: 'http://127.0.0.1:11434' });
}

async function pullModel(model: string): Promise<void> {
   return await invoke('ollama_pull_model', { endpoint: 'http://127.0.0.1:11434', model });
}

export function ConnectOllama({ onBack, onConnected }: Props) {
  const [step, setStep] = useState(1); // 1: Check, 2: List/Pull, 3: Done
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<any>(null);

  useEffect(() => {
    // Listen for pull progress
    const unlisten = listen('ollama-pull-progress', (event) => {
      setPullProgress(event.payload);
    });
    
    // Auto-check on mount
    checkConnection();

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    setError(null);
    try {
      await checkLocalConnection();
      // Connection success
      setStep(2);
      loadModels();
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
    } catch (e: any) {
      setError("Connected, but failed to list models: " + e.toString());
    }
  };

  const handlePullBasic = async () => {
    setPulling(true);
    setPullProgress({ status: "Starting pull..." });
    try {
      await pullModel("gemma:2b"); // fast, small model for testing
      await loadModels(); // refresh list
    } catch (e: any) {
      setError("Pull failed: " + e.toString());
    } finally {
      setPulling(false);
      setPullProgress(null);
    }
  };

  // If connection confirmed and user clicks "I'm ready"
  const handleFinish = () => {
    onConnected();
  };

  return (
    <div className="page-container custom-scroll p-8 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Connect Local Ollama</h1>
        <p className="text-white/60 text-lg">
          Run open-source models locally. Private and fast.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Connection Status */}
        <div className={`glass-panel p-6 ${error ? 'border-red-500/30' : 'border-blue-500/30'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 
              ${checking ? 'bg-blue-500/10 text-blue-400' : error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {checking ? <RefreshCw className="w-5 h-5 animate-spin" /> : 
               error ? <Server className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-bold text-white">
                {checking ? "Checking Connection..." : error ? "Connection Failed" : "Connected to Ollama"}
              </h3>
              
              {checking && <p className="text-white/60">Ping http://127.0.0.1:11434 ...</p>}
              
              {error && (
                <div className="space-y-3">
                  <p className="text-red-300 text-sm">Could not connect to Ollama on 127.0.0.1:11434</p>
                  <div className="text-xs bg-black/30 p-3 rounded font-mono text-red-200/70 overflow-x-auto">
                    {error}
                  </div>
                  <div className="text-sm text-white/60">
                    <p className="mb-2">Troubleshooting:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Is Ollama installed and running?</li>
                      <li>Run <code className="bg-white/10 px-1 rounded">ollama serve</code> in your terminal.</li>
                    </ul>
                  </div>
                  <button onClick={() => openExternal('https://ollama.com')} className="glass-button text-xs gap-2">
                    <ExternalLink className="w-3 h-3" /> Install Ollama
                  </button>
                  <button onClick={checkConnection} className="glass-button w-full justify-center">Try Again</button>
                </div>
              )}

              {!checking && !error && (
                <div className="space-y-2">
                   <p className="text-green-300 text-sm">Successfully connected to local instance.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Model Setup */}
        {step >= 2 && (
          <div className="glass-panel p-6">
             <h3 className="text-lg font-bold text-white mb-4">Installed Models</h3>
             
             {models.length === 0 ? (
               <div className="text-center py-8 space-y-4">
                 <div className="text-white/40">No models found.</div>
                 <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-left">
                    <h4 className="font-bold text-blue-300 mb-1">Recommendation</h4>
                    <p className="text-sm text-white/70 mb-3">
                      We recommend <b>gemma:2b</b> or <b>llama3:8b</b> for a balance of speed and quality.
                    </p>
                    <button 
                      onClick={handlePullBasic} 
                      disabled={pulling}
                      className="glass-button-accent w-full justify-center gap-2"
                    >
                      {pulling ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                      {pulling ? "Pulling..." : "Pull gemma:2b (Fast)"}
                    </button>
                    {pulling && pullProgress && (
                      <div className="mt-2 text-xs font-mono text-white/50">
                        {pullProgress.status} {pullProgress.completed && `(${Math.round((pullProgress.completed/pullProgress.total)*100)}%)`}
                      </div>
                    )}
                 </div>
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="grid gap-2">
                   {models.map((m, i) => (
                     <div key={i} className="bg-white/5 p-3 rounded flex items-center justify-between">
                       <span className="font-mono text-sm text-white">{m.name}</span>
                       <span className="text-xs text-white/40">{(Number(m.size) / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                     </div>
                   ))}
                 </div>
                 <button onClick={handleFinish} className="glass-button-accent w-full justify-center gap-2">
                   <CheckCircle className="w-4 h-4" /> I'm Ready
                 </button>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
