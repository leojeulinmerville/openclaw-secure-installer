import { AlertTriangle, Play, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';

export function GatewayBanner() {
  const { gatewayStatus, startGateway, refresh } = useDesktop();
  const [starting, setStarting] = useState(false);
  const [minimized, setMinimized] = useState(false);

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
    try {
      await startGateway();
      // Wait a moment then refresh
      setTimeout(refresh, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  };

  const isContainerRunning = gatewayStatus.containerStable;
  const isHealthCheckFailed = isContainerRunning && !gatewayStatus.healthOk;

  const title = isHealthCheckFailed
    ? "Gateway Unhealthy"
    : "Gateway Stopped";
  
  const message = isHealthCheckFailed
    ? "The gateway container is running but not responding to health checks."
    : "The OpenClaw gateway is not running. Agent actions and chat are unavailable.";

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 backdrop-blur-md px-4 py-3 relative animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-white/60">{message}</p>
            {gatewayStatus.lastError && (
               <p className="text-[10px] text-red-300/50 mt-1 font-mono">{gatewayStatus.lastError.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStart}
            disabled={starting}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
          >
            {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Start Gateway
          </button>
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
