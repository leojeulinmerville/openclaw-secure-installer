import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GlassCard } from '../GlassCard';
import { StatusPill } from '../StatusPill';
import { GatewayStartResult, HealthCheckResult } from '../../types';
import { Activity, ExternalLink, FileText, FolderOpen, Power, RefreshCw } from 'lucide-react';

interface Step4Props {
  startResult: GatewayStartResult;
  onStop: () => void;
}

export function Step4Dashboard({ startResult, onStop }: Step4Props) {
  const [health, setHealth] = useState<HealthCheckResult|null>(null);
  const [checking, setChecking] = useState(false);
  const [runtimeLogs, setRuntimeLogs] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [stopping, setStopping] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await invoke<HealthCheckResult>("check_gateway_health");
      setHealth(res);
    } catch (err) {
       console.error(err);
    } finally {
      setChecking(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const logs = await invoke<string>("gateway_logs");
      setRuntimeLogs(logs);
      setShowLogs(prev => !prev);
    } catch (err) {
      alert("Failed to fetch logs: " + err);
    }
  };

  const handleStop = async () => {
    if(!confirm("Are you sure you want to stop the gateway?")) return;
    setStopping(true);
    try {
      await invoke("stop_gateway");
      onStop();
    } catch (err) {
      alert("Error stopping: " + err);
      setStopping(false);
    }
  };

  // Initial health check
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GlassCard title="Dashboard" className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
           <div>
             <h3 className="text-lg font-bold text-white">Gateway Running</h3>
             <p className="text-sm text-white/50 font-mono mt-1 w-full max-w-sm truncate text-ellipsis">
               Compose: {startResult.composeFilePath}
             </p>
           </div>
           <div className="text-right">
              <div className="text-sm text-white/50 mb-1">Health Status</div>
              {health ? (
                <StatusPill status={health.healthy ? 'ok' : 'bad'} text={health.healthy ? 'Healthy' : `Error (${health.statusCode||'?'})`} />
              ) : (
                <StatusPill status="loading" text="Checking..." />
              )}
           </div>
        </div>

        {/* Warning Banner */}
        {(startResult.warning || (health && !health.healthy)) && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-200 text-sm flex gap-3 items-start">
             <Activity className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
               <strong>Attention Needed:</strong>
               <p>{startResult.warning || (health?.error ? health.error : "Gateway is unhealthy")}</p>
             </div>
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
           <button onClick={() => invoke("open_app_data_folder")} className="glass-button flex items-center justify-center gap-2 py-4">
             <FolderOpen className="w-5 h-5 text-blue-300"/> Open App Data
           </button>
           <button onClick={checkHealth} disabled={checking} className="glass-button flex items-center justify-center gap-2 py-4">
             <RefreshCw className={`w-5 h-5 text-emerald-300 ${checking?'animate-spin':''}`}/> Re-check Health
           </button>
           <button onClick={fetchLogs} className="glass-button flex items-center justify-center gap-2 py-4">
             <FileText className="w-5 h-5 text-slate-300"/> {showLogs ? 'Hide Logs' : 'View Logs'}
           </button>
           <button onClick={handleStop} disabled={stopping} className="glass-button bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-300 flex items-center justify-center gap-2 py-4">
             <Power className="w-5 h-5"/> Stop Gateway
           </button>
        </div>
        
        {/* Open Browser Big Button */}
        <a 
          href={`http://localhost:${80}`} // TODO: Get actual port from config
          target="_blank"
          className="block w-full py-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-center no-underline"
        >
          <ExternalLink className="w-5 h-5"/> Open in Browser
        </a>

        {/* Logs Viewer */}
        {showLogs && (
          <div className="mt-4 bg-black/40 rounded-lg border border-white/10 p-3 animate-in slide-in-from-top-2">
             <pre className="text-xs font-mono text-slate-300 h-64 overflow-y-auto logs-scroll whitespace-pre-wrap">
               {runtimeLogs || "Loading logs..."}
             </pre>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
