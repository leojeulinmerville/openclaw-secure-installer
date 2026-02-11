import { useState, useEffect } from 'react';
import { Server, Power, StopCircle, Play, Loader2, Container } from 'lucide-react';
import { startGateway, stopGateway, stopAgent, listAgents } from '../lib/tauri';
import { useDesktop } from '../contexts/DesktopContext';

export function RuntimeCard() {
  const { gatewayRunning, isGatewayReady, refresh } = useDesktop();
  const [agents, setAgents] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  const fetchAgents = async () => {
    if (!isGatewayReady) return;
    try {
      const list = await listAgents();
      setAgents(list);
    } catch (e) {
      console.error("Failed to list agents", e);
    }
  };

  useEffect(() => {
    fetchAgents();
    // Poll for agents every 5s if gateway is running
    const interval = setInterval(() => {
        if (isGatewayReady) fetchAgents();
    }, 5000);
    return () => clearInterval(interval);
  }, [isGatewayReady]);

  const handleToggleGateway = async () => {
    setProcessing(true);
    try {
        if (gatewayRunning?.gatewayActive) {
            await stopGateway();
        } else {
            await startGateway();
        }
        await refresh();
    } finally {
        setProcessing(false);
    }
  };

  const handleStopAllAgents = async () => {
    setProcessing(true);
    try {
        const runningAgents = agents.filter(a => a.status === 'running');
        await Promise.all(runningAgents.map(a => stopAgent(a.id)));
        await fetchAgents();
    } finally {
        setProcessing(false);
    }
  };

  const runningCount = agents.filter(a => a.status === 'running').length;

  return (
    <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${gatewayRunning?.gatewayActive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <Server className={`w-5 h-5 ${gatewayRunning?.gatewayActive ? 'text-green-400' : 'text-red-400'}`} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">Runtime</h3>
                    <p className="text-xs text-white/40">
                        {gatewayRunning?.gatewayActive ? "Gateway Ready" : "Gateway Stopped"} • {runningCount} Active Agents
                    </p>
                </div>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={handleStopAllAgents}
                    disabled={runningCount === 0 || processing || !isGatewayReady}
                    className="glass-button-danger text-xs gap-2"
                    title="Stop all running agents"
                >
                    <StopCircle className="w-3 h-3" /> Stop Agents
                </button>
                <button 
                    onClick={handleToggleGateway}
                    disabled={processing}
                    className={`glass-button text-xs gap-2 min-w-[100px] justify-center ${gatewayRunning?.gatewayActive ? 'hover:bg-red-500/20 hover:text-red-300' : 'hover:bg-green-500/20 hover:text-green-300'}`}
                >
                    {processing ? <Loader2 className="w-3 h-3 animate-spin"/> : gatewayRunning?.gatewayActive ? <Power className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {gatewayRunning?.gatewayActive ? "Stop Gateway" : "Start Gateway"}
                </button>
            </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
             <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                 <span className="text-white/50">Gateway Container</span>
                 <span className="font-mono text-white">{gatewayRunning?.gatewayActive ? "RUNNING" : "STOPPED"}</span>
             </div>
             <div className="bg-white/5 p-2 rounded flex items-center justify-between">
                 <span className="text-white/50">Agent Containers</span>
                 <div className="flex items-center gap-2">
                     <span className="font-mono text-white">{runningCount}</span>
                     <Container className="w-3 h-3 text-white/20" />
                 </div>
             </div>
        </div>
    </div>
  );
}
