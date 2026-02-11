import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Copy, ExternalLink, Terminal, AlertTriangle, RefreshCw } from 'lucide-react';
import { openExternal } from '../lib/tauri';

interface Props {
  onBack: () => void;
  onConnected: () => void;
}

export function ConnectOllama({ onBack, onConnected }: Props) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    setError(null);
    try {
      // Try to fetch tags from local ollama
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onConnected();
        }, 1500);
      } else {
        setError('Ollama is running but returned an error. Check logs.');
      }
    } catch (e) {
      setError('Could not connect to Ollama at http://localhost:11434');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const copyCommand = () => {
    navigator.clipboard.writeText('OLLAMA_ORIGINS="*" ollama serve');
  };

  if (success) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connected!</h2>
          <p className="text-white/60">Ollama is ready to use.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container custom-scroll p-8 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">Connect Local Ollama</h1>
        <p className="text-white/60 text-lg">
          Run open-source models locally on your machine.
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="glass-panel p-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="font-bold text-blue-400">1</span>
            </div>
            <div className="space-y-4 flex-1">
              <h3 className="text-lg font-bold text-white">Install Ollama</h3>
              <p className="text-white/60">
                Download and install Ollama from the official website if you haven't already.
              </p>
              <button 
                onClick={() => openExternal('https://ollama.com')}
                className="glass-button text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Visit ollama.com
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="glass-panel p-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="font-bold text-blue-400">2</span>
            </div>
            <div className="space-y-4 flex-1">
              <h3 className="text-lg font-bold text-white">Configure CORS</h3>
              <p className="text-white/60">
                To allow OpenClaw to talk to Ollama, you need to set the <code>OLLAMA_ORIGINS</code> environment variable.
              </p>
              
              <div className="bg-black/50 p-4 rounded-lg font-mono text-sm relative group">
                <button 
                  onClick={copyCommand}
                  className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy"
                >
                  <Copy className="w-4 h-4 text-white/60" />
                </button>
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Terminal className="w-4 h-4" /> Windows PowerShell
                </div>
                <div className="text-white/80 select-all">
                  $env:OLLAMA_ORIGINS="*"; ollama serve
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg text-yellow-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>You must restart Ollama after setting this variable.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Area */}
        <div className={`glass-panel p-6 border-l-4 ${error ? 'border-red-500' : 'border-blue-500'}`}>
           <div className="flex items-center justify-between">
             <div>
               <h3 className="text-lg font-bold text-white mb-1">Connection Status</h3>
               {error ? (
                 <p className="text-red-400">{error}</p>
               ) : (
                 <p className="text-white/60">Waiting for local server...</p>
               )}
             </div>
             <button 
               onClick={checkConnection} 
               disabled={checking}
               className="glass-button flex items-center gap-2"
             >
               <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
               Retry
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
