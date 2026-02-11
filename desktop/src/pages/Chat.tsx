import { useState, useEffect, useRef } from 'react';
import { chatSend, testOllamaConnection, getAllowInternet, hasSecret, getGatewayStatus } from '../lib/tauri';
import type { ChatMessage, GatewayStatusResult } from '../types';
import {
  Send, Bot, User, Loader2, AlertCircle, Wifi, WifiOff,
  Key, Server, CheckCircle2, XCircle,
} from 'lucide-react';

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const OLLAMA_MODELS = ['llama3', 'llama3.1', 'mistral', 'codellama', 'gemma2'];

export default function Chat() {
  const [provider, setProvider] = useState<'openai' | 'ollama'>('ollama');
  const [model, setModel] = useState('llama3');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Security checks
  const [gatewayReady, setGatewayReady] = useState(false);
  const [internetEnabled, setInternetEnabled] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [ollamaOk, setOllamaOk] = useState(false);
  const [checking, setChecking] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const [gwStatus, internet, apiKey, ollama] = await Promise.all([
        getGatewayStatus().catch(() => null as GatewayStatusResult | null),
        getAllowInternet().catch(() => false),
        hasSecret('OPENAI_API_KEY').catch(() => false),
        testOllamaConnection().catch(() => false),
      ]);
      setGatewayReady(gwStatus?.containerStable === true && gwStatus.healthOk === true);
      setInternetEnabled(internet);
      setHasApiKey(apiKey);
      setOllamaOk(ollama);
    } catch {
      // fail silently
    } finally {
      setChecking(false);
    }
  };

  const canChat =
    gatewayReady &&
    (provider === 'ollama' ? ollamaOk : internetEnabled && hasApiKey);

  const handleSend = async () => {
    if (!input.trim() || loading || !canChat) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const response = await chatSend({
        provider,
        model,
        messages: newMessages,
        ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint : undefined,
      });
      setMessages([...newMessages, response.message]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const StatusCheck = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-xs">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        : <XCircle className="w-3.5 h-3.5 text-red-400" />
      }
      <span className={ok ? 'text-white/50' : 'text-red-300/70'}>{label}</span>
    </div>
  );

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Chat</h2>
            <p className="text-xs text-white/30">Talk with AI — securely, through the gateway</p>
          </div>
        </div>
      </div>

      {/* Security Status Bar */}
      <div className="glass-panel p-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <StatusCheck ok={gatewayReady} label="Gateway" />
            {provider === 'openai' && (
              <>
                <StatusCheck ok={internetEnabled} label="Internet" />
                <StatusCheck ok={hasApiKey} label="API Key" />
              </>
            )}
            {provider === 'ollama' && (
              <StatusCheck ok={ollamaOk} label="Ollama" />
            )}
          </div>
          <button onClick={checkStatus} disabled={checking} className="glass-button text-xs flex items-center gap-1.5">
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Provider / Model selector */}
      <div className="glass-panel p-4 mb-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">Provider</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setProvider('ollama'); setModel('llama3'); }}
                className={`glass-button text-sm flex items-center gap-1.5 ${provider === 'ollama' ? 'ring-1 ring-cyan-400/40 bg-cyan-500/10' : ''}`}
              >
                <Server className="w-3.5 h-3.5" /> Ollama (Local)
              </button>
              <button
                onClick={() => { setProvider('openai'); setModel('gpt-4o-mini'); }}
                className={`glass-button text-sm flex items-center gap-1.5 ${provider === 'openai' ? 'ring-1 ring-cyan-400/40 bg-cyan-500/10' : ''}`}
              >
                {internetEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                OpenAI (Cloud)
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="glass-input text-sm w-full"
            >
              {(provider === 'openai' ? OPENAI_MODELS : OLLAMA_MODELS).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {provider === 'ollama' && (
          <div>
            <label className="text-xs text-white/40 block mb-1">Ollama endpoint</label>
            <input
              type="text"
              value={ollamaEndpoint}
              onChange={e => setOllamaEndpoint(e.target.value)}
              className="glass-input text-sm font-mono"
              placeholder="http://localhost:11434"
            />
          </div>
        )}

        {provider === 'openai' && !internetEnabled && (
          <div className="flex items-start gap-2 text-xs text-amber-300/70 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">
            <WifiOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Internet is disabled. Go to <strong>Settings</strong> and enable <strong>Allow Internet</strong> to use OpenAI.</span>
          </div>
        )}

        {provider === 'openai' && internetEnabled && !hasApiKey && (
          <div className="flex items-start gap-2 text-xs text-amber-300/70 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">
            <Key className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No API key found. Add your OpenAI API key in <strong>Settings → Secrets</strong>.</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-messages custom-scroll">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <Bot className="w-12 h-12 text-white/10 mb-3" />
            <p className="text-white/20 text-sm">Start a conversation.</p>
            <p className="text-white/10 text-xs mt-1">
              {provider === 'ollama'
                ? 'Messages stay local — Ollama runs on your machine.'
                : 'OpenAI messages are sent over the internet.'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
            <div className="chat-bubble-icon">
              {msg.role === 'user'
                ? <User className="w-3.5 h-3.5" />
                : <Bot className="w-3.5 h-3.5" />
              }
            </div>
            <div className="chat-bubble-content">
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble-assistant">
            <div className="chat-bubble-icon">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="chat-bubble-content">
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-300/70 bg-red-500/5 p-2.5 rounded-lg border border-red-500/10 mt-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-bar mt-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={canChat ? 'Type a message...' : 'Complete security checks above to chat'}
          disabled={!canChat || loading}
          className="glass-input flex-1"
        />
        <button
          onClick={handleSend}
          disabled={!canChat || loading || !input.trim()}
          className="glass-button-accent flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </div>
    </div>
  );
}
