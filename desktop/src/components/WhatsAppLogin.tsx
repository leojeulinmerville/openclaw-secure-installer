import { useState, useEffect } from 'react';
import { QrCode, Loader2, CheckCircle2, XCircle, RefreshCcw, X, AlertCircle } from 'lucide-react';
import { whatsappLoginStart, whatsappLoginWait } from '../lib/tauri';
import { GlassCard } from './GlassCard';

interface WhatsAppLoginProps {
  accountId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type LoginState = 'starting' | 'waiting_for_scan' | 'connecting' | 'connected' | 'error';

export function WhatsAppLogin({ accountId = 'default', onClose, onSuccess }: WhatsAppLoginProps) {
  const [state, setState] = useState<LoginState>('starting');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Initializing WhatsApp session...');

  const startLogin = async (force = false) => {
    setState('starting');
    setError(null);
    try {
      const result = await whatsappLoginStart({
        accountId,
        force,
        verbose: false,
        timeoutMs: 30000
      });

      if (result.qrDataUrl) {
        setQrDataUrl(result.qrDataUrl);
        setState('waiting_for_scan');
        setMessage('Scan the QR code with your phone');
        // Start waiting for the scan
        waitLogin();
      } else {
        // Already connected or other message
        setMessage(result.message);
        if (result.message.includes('already linked')) {
           setState('connected');
           setTimeout(onSuccess, 1500);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  };

  const waitLogin = async () => {
    try {
      const result = await whatsappLoginWait({
        accountId,
        timeoutMs: 120000
      });

      if (result.connected) {
        setState('connected');
        setMessage('✅ WhatsApp connected successfully!');
        setTimeout(onSuccess, 2000);
      } else {
        setError(result.message);
        setState('error');
      }
    } catch (e) {
      // If we are still in waiting state and not closed, it might be a timeout of the wait call itself
      if (state === 'waiting_for_scan') {
        setError('Connection timeout or QR expired.');
        setState('error');
      }
    }
  };

  useEffect(() => {
    startLogin();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <GlassCard className="max-w-md w-full p-6 space-y-6 relative border-white/10 shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
            <QrCode className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Link WhatsApp</h2>
          <p className="text-sm text-white/60">{message}</p>
          {message.includes('MVP Mode') && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              <AlertCircle className="w-3 h-3" />
              Developer Preview / Mock Mode
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center min-h-[280px] bg-black/20 rounded-2xl border border-white/5 relative overflow-hidden">
          {state === 'starting' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <span className="text-xs text-white/40 font-mono">Requesting session...</span>
            </div>
          )}

          {state === 'waiting_for_scan' && qrDataUrl && (
            <div className="p-4 bg-white rounded-xl shadow-inner animate-in zoom-in-95 duration-500">
              <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
          )}

          {state === 'connected' && (
            <div className="flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <span className="text-lg font-medium text-emerald-400">Success!</span>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <XCircle className="w-12 h-12 text-red-400" />
              <p className="text-sm text-red-200/80">{error || 'An error occurred during pairing.'}</p>
              <button 
                onClick={() => startLogin(true)}
                className="glass-button-accent text-xs px-4 py-2"
              >
                <RefreshCcw className="w-3 h-3 mr-2" />
                Retry Pairing
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] text-white/30 text-center leading-tight">
          Open WhatsApp on your phone → Menu or Settings → Linked Devices → Link a Device.
          Your credentials remain encrypted in your local Gateway.
        </div>
      </GlassCard>
    </div>
  );
}
