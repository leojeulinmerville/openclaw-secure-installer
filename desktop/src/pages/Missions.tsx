import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Mission } from '../types';
import { Shield, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronRight, Plus, X } from 'lucide-react';

interface MissionsProps {
  onNavigate: (page: 'mission-detail', missionId: string) => void;
}

export function Missions({ onNavigate }: MissionsProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New Mission Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionIntent, setNewMissionIntent] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<Mission[]>('list_missions');
      setMissions(data);
    } catch (e) {
      console.error('Failed to list missions', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async () => {
    if (!newMissionTitle || !newMissionIntent) return;
    
    setCreating(true);
    try {
      await invoke('create_mission', { 
        title: newMissionTitle, 
        intent: newMissionIntent 
      });
      setIsModalOpen(false);
      setNewMissionTitle('');
      setNewMissionIntent('');
      await loadMissions();
    } catch (e) {
      console.error('Failed to create mission', e);
      alert(`Failed to create mission: ${e}`);
    } finally {
      setCreating(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status.toLowerCase()) {
      case 'active': return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'paused': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Missions</h2>
          <p className="text-sm text-white/40">Strategic objectives and their current execution status.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="glass-button flex items-center gap-2 py-2 px-4"
        >
          <Plus className="w-4 h-4" /> New Mission
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/20" />
          </div>
        ) : error ? (
          <div className="glass-panel p-8 text-center border-red-500/20">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Error Loading Missions</h3>
            <p className="text-sm text-white/40 mb-4">{error}</p>
            <button onClick={loadMissions} className="glass-button">Retry</button>
          </div>
        ) : missions.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-5 h-5 text-white/20" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No missions yet</h3>
            <p className="text-sm text-white/40">Strategic missions will appear here when initialized.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="glass-button mt-4"
            >
              Initialize First Mission
            </button>
          </div>
        ) : (
          missions.map(mission => (
            <div 
              key={mission.mission_id} 
              onClick={() => onNavigate('mission-detail', mission.mission_id)}
              className="glass-panel p-4 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center gap-4 group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 
                ${mission.status === 'active' ? 'bg-cyan-500/10' : 
                  mission.status === 'completed' ? 'bg-emerald-500/10' : 'bg-white/5'}`}
              >
                <StatusIcon status={mission.status} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white truncate">{mission.title}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                    {mission.mission_mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  <span>Health: {mission.health_state}</span>
                  <span>Governance: {mission.governance_state}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-white/20 capitalize group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                  View Detail <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Mission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 space-y-4 relative shadow-2xl border-white/20">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-white">Initialize New Mission</h3>
              <p className="text-sm text-white/40">Define a high-level goal for autonomous agents to pursue.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Title</label>
                <input 
                  type="text" 
                  autoFocus
                  value={newMissionTitle}
                  onChange={(e) => setNewMissionTitle(e.target.value)}
                  placeholder="e.g. Security Audit of Core Plugins"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Intent</label>
                <textarea 
                  value={newMissionIntent}
                  onChange={(e) => setNewMissionIntent(e.target.value)}
                  placeholder="Describe the desired outcome and constraints..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 glass-button py-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateMission}
                disabled={creating || !newMissionTitle || !newMissionIntent}
                className="flex-1 glass-button py-2 bg-cyan-500/20 border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Initialize Mission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
