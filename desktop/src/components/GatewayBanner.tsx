import { AlertTriangle, Play, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import type { GatewayStartResult } from '../types';

export function GatewayBanner() {
  const { gatewayStatus, startGateway, refresh } = useDesktop();
  const [starting, setStarting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [startError, setStartError] = useState<GatewayStartResult | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  // If status is null (loading) or healthy, show nothing
  if (!gatewayStatus || (gatewayStatus.containerStable && gatewayStatus.healthOk)) {
    return null;
  }

  // If minimized, show a small pill
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMinimized(false)}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Gateway Offline
        </button>
      </div>
    );
  }

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await startGateway();
      if (!res.gatewayActive) {
        // Surface the structured error — don't silently cancel
        setStartError(res);
      } else {
        // Success — refresh immediately so banner clears
        await refresh();
      }
    } catch (e) {
      // Tauri invoke error (e.g. serialisation issue) — surface as raw error
      setStartError({
        gatewayActive: false,
        status: 'failed',
        userFriendlyTitle: 'Start Failed',
        userFriendlyMessage: String(e),
        rawDiagnostics: '',
        remediationSteps: [],
        composeFilePath: '',
        warning: null,
      } as GatewayStartResult);
    } finally {
      setStarting(false);
    }
  };

  const isContainerRunning = gatewayStatus.containerStable;
  const isHealthCheckFailed = isContainerRunning && !gatewayStatus.healthOk;

  const title = startError
    ? startError.userFriendlyTitle
    : isHealthCheckFailed
    ? 'Gateway Unhealthy'
    : 'Gateway Stopped';

  const message = startError
    ? startError.userFriendlyMessage
    : isHealthCheckFailed
    ? 'The gateway container is running but not responding to health checks.'
    : 'The OpenClaw gateway is not running. Agent actions and chat are unavailable.';

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 backdrop-blur-md px-4 py-3 relative animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-white/60 mt-0.5">{message}</p>
            {/* Remediation steps if present */}
            {startError && startError.remediationSteps.length > 0 && (
              <ul className="mt-1.5 text-xs text-amber-300/70 list-disc list-inside space-y-0.5">
                {startError.remediationSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            )}
            {/* Raw diagnostics toggle */}
            {startError && startError.rawDiagnostics && (
              <div className="mt-1.5">
                <button
                  onClick={() => setShowDiag(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                >
                  {showDiag ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showDiag ? 'Hide' : 'Show'} diagnostics
                </button>
                {showDiag && (
                  <pre className="mt-1 text-[10px] text-red-200/50 font-mono bg-black/30 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                    {startError.rawDiagnostics}
                  </pre>
                )}
              </div>
            )}
            {/* Existing last-error from gateway status (when not showing start error) */}
            {!startError && gatewayStatus.lastError && (
              <p className="text-[10px] text-red-300/50 mt-1 font-mono">
                {gatewayStatus.lastError.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!startError ? (
            <button
              onClick={handleStart}
              disabled={starting}
              className="bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {starting ? 'Starting…' : 'Start Gateway'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={starting}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {starting ? 'Retrying…' : 'Retry'}
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
