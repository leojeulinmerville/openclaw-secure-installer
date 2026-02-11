import { useState, useEffect } from 'react';
import { Run, RunEvent } from '../types';
import { getRun, getRunEvents, startRun, submitApproval, readWorkspaceFile } from '../lib/tauri';
import { StatusPill } from '../components/StatusPill';
import { GlassCard } from '../components/GlassCard';
import { ChevronLeft, Play, Clock, Box, FileText, ShieldAlert, X } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface RunDetailProps {
  runId: string;
  onNavigate: (page: 'runs') => void;
}

export function RunDetail({ runId, onNavigate }: RunDetailProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'artifacts'>('timeline');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [viewFile, setViewFile] = useState<{ path: string, content: string | null, open: boolean }>({ path: '', content: null, open: false });

  const fetchData = async () => {
    try {
      const r = await getRun(runId);
      setRun(r);
      const e = await getRunEvents(runId);
      setEvents(e);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(async () => {
       if (run?.status === 'running' || run?.status === 'queued' || run?.status === 'blocked') {
          const e = await getRunEvents(runId);
          setEvents(e);
          const r = await getRun(runId);
          setRun(r);
       }
    }, 2000);
    return () => clearInterval(interval);
  }, [runId, run?.status]);

  const handleStart = async () => {
    if (!run) return;
    setStarting(true);
    try {
      const updated = await startRun(run.id);
      setRun(updated);
    } catch (err) {
      alert("Failed to start run: " + err);
    } finally {
      setStarting(false);
    }
  };

  const handleApprove = async (approvalId: string, decision: 'approved'|'rejected') => {
      try {
        await submitApproval(runId, approvalId, decision);
        const e = await getRunEvents(runId);
        setEvents(e);
      } catch (err) {
        alert("Failed to submit approval: " + err);
      }
  };

  const handleViewFile = async (path: string) => {
      try {
          const content = await readWorkspaceFile(runId, path);
          setViewFile({ path, content, open: true });
      } catch (err) {
          alert("Failed to read file: " + err);
      }
  };

  if (loading && !run) {
    return <div className="p-8 text-center text-white/50 animate-pulse">Loading run details...</div>;
  }

  if (!run) {
    return <div className="p-8 text-center text-red-400">Run not found</div>;
  }

  const artifacts = events
    .filter(e => e.type === 'artifact.created')
    .map(e => e.payload as any);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('runs')} 
            className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              {run.title}
              <span className="text-sm font-normal text-white/40 font-mono">#{run.id.slice(0, 8)}</span>
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
              <span className="flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" /> {run.model}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <StatusPill status={getStatusColor(run.status)} text={run.status} />
           {run.status === 'queued' && (
             <button 
               onClick={handleStart}
               disabled={starting}
               className="glass-button bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-4 py-1.5 flex items-center gap-2"
             >
               {starting ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent"/> : <Play className="w-4 h-4 fill-current"/>} Start Run
             </button>
           )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
         <button 
           onClick={() => setActiveTab('timeline')}
           className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'timeline' ? "border-cyan-400 text-cyan-400" : "border-transparent text-white/40 hover:text-white")}
         >
           Timeline ({events.length})
         </button>
         <button 
           onClick={() => setActiveTab('artifacts')}
           className={clsx("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'artifacts' ? "border-cyan-400 text-cyan-400" : "border-transparent text-white/40 hover:text-white")}
         >
           Artifacts ({artifacts.length})
         </button>
      </div>

      {/* Content */}
      <GlassCard className="min-h-[500px]">
        {activeTab === 'timeline' && (
          <div className="space-y-6">
             {events.length === 0 ? (
               <div className="text-center py-12 text-white/30">No events yet</div>
             ) : (
               events.map((ev, i) => (
                 <TimelineItem key={i} event={ev} onApprove={handleApprove} />
               ))
             )}
             
             {run.status === 'running' && (
                <div className="flex items-center gap-3 animate-pulse opacity-50 pl-4 border-l-2 border-white/10">
                   <div className="w-2 h-2 rounded-full bg-cyan-400" />
                   <span className="text-sm text-cyan-400">Agent is working...</span>
                </div>
             )}
          </div>
        )}

        {activeTab === 'artifacts' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {artifacts.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-white/30">No artifacts produced yet</div>
              ) : (
                artifacts.map((art: any, i: number) => (
                   <div key={i} className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                         {art.type === 'patch' ? <FileText className="w-5 h-5 text-amber-400"/> : <FileText className="w-5 h-5 text-blue-400"/>}
                         <div className="font-medium text-white">{art.name}</div>
                      </div>
                      <div className="text-xs text-white/40 font-mono">{art.path}</div>
                      <div className="mt-3 flex gap-2">
                         <button onClick={() => handleViewFile(art.path)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition">View Content</button>
                         {art.type === 'patch' && (
                            <button onClick={() => handleViewFile(art.path)} className="text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-2 py-1 rounded transition">Review Patch</button>
                         )}
                      </div>
                   </div>
                ))
              )}
           </div>
        )}
      </GlassCard>

      {/* File Viewer Modal */}
      {viewFile.open && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <GlassCard className="w-full max-w-4xl max-h-[80vh] flex flex-col relative" title={viewFile.path}>
               <button 
                  onClick={() => setViewFile({ ...viewFile, open: false })}
                  className="absolute top-4 right-4 text-white/50 hover:text-white"
               >
                  <X className="w-6 h-6" />
               </button>
               <div className="flex-1 overflow-auto mt-4 bg-black/30 rounded-lg p-4 border border-white/5">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{viewFile.content}</pre>
               </div>
            </GlassCard>
         </div>
      )}
    </div>
  );
}

function TimelineItem({ event, onApprove }: { event: RunEvent, onApprove: (id: string, decision: 'approved'|'rejected') => void }) {
  const isAgent = event.type === 'agent.message';
  const isTool = event.type === 'tool.requested' || event.type === 'tool.result';
  const isArtifact = event.type === 'artifact.created';
  const isApproval = event.type === 'approval.requested';
  
  return (
    <div className={clsx("flex gap-4", isAgent ? "pl-0" : "pl-4")}>
       <div className="flex flex-col items-center">
          <div className={clsx(
            "w-2 h-2 rounded-full mt-2 ring-4 ring-black/50",
            isAgent ? "bg-cyan-400" : 
            isTool ? "bg-purple-400" : 
            isArtifact ? "bg-amber-400" : 
            isApproval ? "bg-red-500" : "bg-slate-500"
          )} />
          <div className="w-px h-full bg-white/5 my-2" />
       </div>
       <div className="flex-1 pb-4">
          <div className="flex items-center gap-2 mb-1">
             <span className="text-xs font-mono text-white/40">{new Date(event.timestamp).toLocaleTimeString()}</span>
             <span className={clsx("text-xs font-bold uppercase tracking-wider", 
                 isAgent ? "text-cyan-400" : 
                 isTool ? "text-purple-400" : 
                 isArtifact ? "text-amber-400" : 
                 isApproval ? "text-red-400" : "text-slate-400"
             )}>
               {event.type.replace('.', ' ')}
             </span>
          </div>
          
          <div className="text-sm text-white/80 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
             {renderPayload(event, onApprove)}
          </div>
       </div>
    </div>
  );
}

function renderPayload(event: RunEvent, onApprove: (id: string, decision: 'approved'|'rejected') => void) {
   const p = event.payload as any;
   if (event.type === 'agent.message') return <p className="whitespace-pre-wrap">{p.content}</p>;
   if (event.type === 'artifact.created') return <p>Created artifact: <strong>{p.name}</strong> ({p.type})</p>;
   if (event.type === 'approval.requested') return (
      <div className="flex gap-3 items-start p-1">
         <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
         <div>
            <div className="font-bold text-amber-200">Approval Required</div>
            <p className="text-white/60 text-xs mt-1">{p.summary}</p>
            <div className="mt-3 flex gap-2">
               <button onClick={() => onApprove(event.id, 'approved')} className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs rounded font-medium">Approve</button>
               <button onClick={() => onApprove(event.id, 'rejected')} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded font-medium">Reject</button>
            </div>
         </div>
      </div>
   );
   return <pre className="text-xs opacity-60 overflow-x-auto">{JSON.stringify(p, null, 2)}</pre>;
}

function getStatusColor(status: string): any {
  switch (status) {
    case 'running': return 'info';
    case 'queued': return 'neutral';
    case 'done': return 'ok';
    case 'failed': return 'bad';
    case 'blocked': return 'warn';
    default: return 'neutral';
  }
}
