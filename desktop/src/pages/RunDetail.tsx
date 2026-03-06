import { useState, useEffect, useRef } from 'react';
import type { Run, RunEvent } from '../types';
import { getRun, getRunEvents, startRun, submitApproval, readWorkspaceFile, safeFormatDistanceToNow, safeFormatTime, deleteRun } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';
import { StatusPill } from '../components/StatusPill';
import { GlassCard } from '../components/GlassCard';
import { ChevronLeft, Play, Box, Clock, ShieldAlert, FileText, RotateCcw, Trash2, X } from 'lucide-react';
import clsx from 'clsx';

interface RunDetailProps {
  runId: string;
  onNavigate: (page: 'runs' | 'create-run') => void;
}

export function RunDetail({ runId, onNavigate }: RunDetailProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'artifacts'>('timeline');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [viewFile, setViewFile] = useState<{ path: string; content: string | null; open: boolean; isDiff: boolean }>({
    path: '', content: null, open: false, isDiff: false,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Initial load ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [r, e] = await Promise.all([getRun(runId), getRunEvents(runId)]);
        if (mounted) { setRun(r); setEvents(e); }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [runId]);

  // ── Real-time streaming via Tauri events (no polling) ───────────────
  useEffect(() => {
    let mounted = true;
    let unlistenEvent: (() => void) | null = null;
    let unlistenStatus: (() => void) | null = null;

    listen<any>('run-event', (ev) => {
      if (!mounted) return;
      const e = ev.payload as RunEvent & { run_id?: string };
      // Filter by run_id (emitted as camelCase from Rust via serde)
      if (e.run_id !== runId && (e as any).runId !== runId) return;
      setEvents(prev => [...prev, e]);
    }).then(fn => { if (mounted) unlistenEvent = fn; });

    listen<any>('run-status', (ev) => {
      if (!mounted) return;
      if (ev.payload.run_id !== runId) return;
      setRun(prev => prev ? { ...prev, status: ev.payload.status, error: ev.payload.error } : prev);
    }).then(fn => { if (mounted) unlistenStatus = fn; });

    return () => {
      mounted = false;
      unlistenEvent?.();
      unlistenStatus?.();
    };
  }, [runId]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const handleDelete = async () => {
    if (!run || !confirm('Are you sure you want to delete this run permanently?')) return;
    try {
      await deleteRun(run.id);
      onNavigate('runs');
    } catch (err) {
      alert('Failed to delete run: ' + err);
    }
  };

  const handleRerun = () => {
    if (!run) return;
    sessionStorage.setItem('openclaw_rerun', JSON.stringify({
      title: run.title,
      goal: run.user_goal,
      agent_id: run.agent_id
    }));
    onNavigate('create-run');
  };

  const handleStart = async () => {
    if (!run) return;
    setStarting(true);
    try {
      const updated = await startRun(run.id);
      setRun(updated);
    } catch (err) {
      alert('Failed to start run: ' + err);
    } finally {
      setStarting(false);
    }
  };

  const handleApprove = async (approvalId: string, decision: 'approved' | 'rejected') => {
    try {
      await submitApproval(runId, approvalId, decision);
      const r = await getRun(runId);
      setRun(r);
    } catch (err) {
      alert('Failed to submit approval: ' + err);
    }
  };

  const handleViewFile = async (path: string) => {
    try {
      const content = await readWorkspaceFile(runId, path);
      const isDiff = path.endsWith('.diff') || path.endsWith('.patch');
      setViewFile({ path, content, open: true, isDiff });
    } catch (err) {
      alert('Failed to read file: ' + err);
    }
  };

  if (loading && !run) return <div className="p-8 text-center text-white/50 animate-pulse">Loading run details...</div>;
  if (!run) return <div className="p-8 text-center text-red-400">Run not found</div>;

  const artifacts = events.filter(e => e.type === 'artifact.created').map(e => e.payload as any);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('runs')} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              {run.title}
              <span className="text-sm font-normal text-white/40 font-mono">#{run.id.slice(0, 8)}</span>
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
              <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> {run.model}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {safeFormatDistanceToNow(run.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleRerun} className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-cyan-400 transition-colors group" title="Re-Run (Duplicate)">
            <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
          </button>
          <button onClick={handleDelete} className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-red-400 transition-colors" title="Delete Run">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <StatusPill status={statusColor(run.status)} text={run.status} />
          {run.status === 'queued' && (
            <button onClick={handleStart} disabled={starting}
              className="glass-button bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-4 py-1.5 flex items-center gap-2">
              {starting ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Play className="w-4 h-4 fill-current" />}
              Start Run
            </button>
          )}
          {run.status === 'running' && (
            <div className="flex items-center gap-2 text-cyan-400 text-sm animate-pulse">
              <div className="w-2 h-2 rounded-full bg-cyan-400" /> Live
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-white/10">
        {(['timeline', 'artifacts'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx('px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/40 hover:text-white')}>
            {tab} ({tab === 'timeline' ? events.length : artifacts.length})
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <GlassCard className="min-h-[500px]">
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {events.length === 0
              ? <div className="text-center py-12 text-white/30">No events yet</div>
              : events.map((ev, i) => <TimelineItem key={ev.id || i} event={ev} onApprove={handleApprove} />)
            }
            {run.status === 'running' && (
              <div className="flex items-center gap-3 animate-pulse opacity-50 pl-4 border-l-2 border-white/10">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-sm text-cyan-400">Agent is working...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {artifacts.length === 0
              ? <div className="col-span-2 text-center py-12 text-white/30">No artifacts produced yet</div>
              : artifacts.map((art: any, i: number) => (
                <div key={i} className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className={`w-5 h-5 ${art.type === 'patch' ? 'text-amber-400' : 'text-blue-400'}`} />
                    <div className="font-medium text-white">{art.name}</div>
                    {art.type === 'patch' && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">diff</span>}
                  </div>
                  <div className="text-xs text-white/40 font-mono">{art.path}</div>
                  <div className="mt-3">
                    <button onClick={() => handleViewFile(art.path)}
                      className={`text-xs px-2 py-1 rounded transition ${art.type === 'patch' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-white/10 hover:bg-white/20'}`}>
                      {art.type === 'patch' ? 'View Diff' : 'View'}
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </GlassCard>

      {/* ── File / Diff Viewer Modal ── */}
      {viewFile.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <GlassCard className="w-full max-w-4xl max-h-[80vh] flex flex-col relative" title={viewFile.path}>
            <button onClick={() => setViewFile(v => ({ ...v, open: false }))} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <div className="flex-1 overflow-auto mt-4 bg-black/30 rounded-lg border border-white/5">
              {viewFile.isDiff
                ? <DiffViewer content={viewFile.content ?? ''} />
                : <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap p-4">{viewFile.content}</pre>
              }
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ── Inline syntax-colored diff viewer ──────────────────────────────────
function DiffViewer({ content }: { content: string }) {
  return (
    <div className="font-mono text-xs p-4 overflow-x-auto select-text">
      {content.split('\n').map((line, i) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isDel = line.startsWith('-') && !line.startsWith('---');
        const isHunk = line.startsWith('@@');
        const isHeader = line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++');
        return (
          <div key={i} className={clsx('whitespace-pre leading-5 px-2',
            isAdd && 'bg-emerald-500/15 text-emerald-300',
            isDel && 'bg-red-500/15 text-red-300',
            isHunk && 'text-cyan-400/70 bg-cyan-500/5',
            isHeader && 'text-white/40',
            !isAdd && !isDel && !isHunk && !isHeader && 'text-slate-400')}>
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline item ────────────────────────────────────────────────────
function TimelineItem({ event, onApprove }: { event: RunEvent; onApprove: (id: string, decision: 'approved' | 'rejected') => void }) {
  const isAgent = event.type === 'agent.message';
  const isTool = event.type === 'tool.requested' || event.type === 'tool.result';
  const isArtifact = event.type === 'artifact.created';
  const isApproval = event.type === 'approval.requested';

  return (
    <div className={clsx('flex gap-4', isAgent ? 'pl-0' : 'pl-4')}>
      <div className="flex flex-col items-center">
        <div className={clsx('w-2 h-2 rounded-full mt-2 ring-4 ring-black/50',
          isAgent ? 'bg-cyan-400' : isTool ? 'bg-purple-400' : isArtifact ? 'bg-amber-400' : isApproval ? 'bg-red-500' : 'bg-slate-500')} />
        <div className="w-px h-full bg-white/5 my-2" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-white/40">{safeFormatTime(event.timestamp)}</span>
          <span className={clsx('text-xs font-bold uppercase tracking-wider',
            isAgent ? 'text-cyan-400' : isTool ? 'text-purple-400' : isArtifact ? 'text-amber-400' : isApproval ? 'text-red-400' : 'text-slate-400')}>
            {event.type.replace(/\./g, ' ')}
          </span>
        </div>
        <div className="text-sm text-white/80 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
          <EventPayload event={event} onApprove={onApprove} />
        </div>
      </div>
    </div>
  );
}

function EventPayload({ event, onApprove }: { event: RunEvent; onApprove: (id: string, decision: 'approved' | 'rejected') => void }) {
  const p = event.payload as any;
  const type = event.type as string;
  if (type === 'agent.message') return <p className="whitespace-pre-wrap">{p.content}</p>;
  if (type === 'artifact.created') return <p>Created artifact: <strong>{p.name}</strong> ({p.type})</p>;
  if (type === 'approval.requested') return (
    <div className="flex gap-3 items-start">
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
  if (type === 'run.failed') return <p className="text-red-300">{p.reason ?? 'Run failed'}</p>;
  if (type === 'patch.apply.succeeded') return <p className="text-emerald-300">✓ Patch applied to {(p.files as string[] ?? []).join(', ') || 'workspace'}</p>;
  if (type === 'run.completed') return <p className="text-emerald-300">✓ Run completed successfully</p>;
  return <pre className="text-xs opacity-60 overflow-x-auto">{JSON.stringify(p, null, 2)}</pre>;
}

function statusColor(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  switch (status) {
    case 'running': return 'info';
    case 'queued': return 'neutral';
    case 'done': return 'ok';
    case 'failed': return 'bad';
    case 'blocked': return 'warn';
    default: return 'neutral';
  }
}
