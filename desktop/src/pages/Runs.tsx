import { useState, useEffect } from 'react';
import { listRuns } from '../lib/tauri';
import type { Run } from '../types';
import { Play, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RunsProps {
  onNavigate: (page: 'run-detail' | 'create-run', runId?: string) => void;
}

export function Runs({ onNavigate }: RunsProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await listRuns();
      setRuns(data);
    } catch (e) {
      console.error('Failed to list runs', e);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-slate-400" />;
      case 'blocked': return <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Runs</h2>
          <p className="text-sm text-white/40">History of agent operations on your workspace.</p>
        </div>
        <button 
          onClick={() => onNavigate('create-run')} // mapped to create-agent or new create-run page? 
          className="glass-button-accent flex items-center gap-2"
        >
          <Play className="w-4 h-4" /> New Run
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
             <div className="text-center py-10">
               <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/20" />
             </div>
        ) : runs.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Play className="w-5 h-5 text-white/20 ml-1" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No runs yet</h3>
            <p className="text-sm text-white/40 mb-4">Start your first agent run to see it here.</p>
            <button onClick={() => onNavigate('create-run')} className="glass-button">
              Create Run
            </button>
          </div>
        ) : (
          runs.map(run => (
            <div 
              key={run.id} 
              onClick={() => onNavigate('run-detail', run.id)}
              className="glass-panel p-4 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center gap-4 group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 
                ${run.status === 'running' ? 'bg-cyan-500/10' : 
                  run.status === 'done' ? 'bg-emerald-500/10' : 
                  run.status === 'blocked' ? 'bg-amber-500/10' : 'bg-white/5'}`}
              >
                <StatusIcon status={run.status} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white truncate">{run.title}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                    {run.model}
                  </span>
                </div>
                <p className="text-xs text-white/40 truncate">{run.user_goal}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs font-mono text-white/30">
                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                </div>
                <div className="text-xs text-white/20 mt-1 capitalize group-hover:text-cyan-300 transition-colors">
                  {run.status} &rarr;
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
