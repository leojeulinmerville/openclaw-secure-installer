import { useState, useEffect } from 'react';
import { createRun, listAgents } from '../lib/tauri';
import type { AgentListItem } from '../types';
import { Play, ArrowLeft, Bot, FolderOpen, Loader2, AlertCircle } from 'lucide-react';

interface CreateRunProps {
  onNavigate: (page: 'runs') => void;
}

export function CreateRun({ onNavigate }: CreateRunProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  
  // Form State
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [workspacePath, setWorkspacePath] = useState(''); // Default from agent?
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await listAgents();
        setAgents(list);
        if (list.length > 0) {
          setSelectedAgentId(list[0].id);
          setWorkspacePath(list[0].workspacePath);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAgents(false);
      }
    }
    load();
  }, []);

  // Update workspace when agent changes
  useEffect(() => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (agent) {
      setWorkspacePath(agent.workspacePath);
    }
  }, [selectedAgentId, agents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !title.trim() || !goal.trim()) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (!agent) throw new Error("Agent not found");

      await createRun(
        agent.id,
        agent.provider,
        agent.model,
        title,
        goal,
        workspacePath || agent.workspacePath
      );
      
      onNavigate('runs');
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  if (loadingAgents) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Bot className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No Agents Found</h3>
        <p className="text-white/40 mb-6">You need to create an agent before you can start a run.</p>
        <button onClick={() => onNavigate('runs')} className="glass-button">Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <button 
        onClick={() => onNavigate('runs')}
        className="text-white/40 hover:text-white flex items-center gap-2 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Runs
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Start New Run</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent Selection */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-violet-500/15 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Select Agent</h3>
              <p className="text-xs text-white/30">Which agent should perform this task?</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map(agent => (
              <div 
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`cursor-pointer p-3 rounded-lg border transition-all ${
                  selectedAgentId === agent.id 
                    ? 'bg-violet-500/20 border-violet-500/50' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="font-bold text-white text-sm">{agent.name}</div>
                <div className="text-xs text-white/40 mt-1 flex items-center gap-2">
                  <span className="uppercase tracking-wider">{agent.model}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Details */}
        <div className="glass-panel p-5 space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1">Run Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Fix login bug"
              className="glass-input w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1">Goal (Prompt)</label>
            <textarea 
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Describe what the agent should do..."
              className="glass-input w-full h-32 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 block mb-1">Workspace Path</label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-2.5 w-4 h-4 text-white/20" />
              <input 
                type="text" 
                value={workspacePath}
                readOnly
                className="glass-input w-full pl-9 opacity-60 cursor-not-allowed"
              />
            </div>
            <p className="text-[10px] text-white/20 mt-1">Workspace is tied to the selected agent.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-300/70 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button 
          type="submit" 
          disabled={submitting || !title || !goal}
          className="w-full glass-button-accent py-3 flex items-center justify-center gap-2 font-bold text-base"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          Start Run
        </button>
      </form>
    </div>
  );
}
