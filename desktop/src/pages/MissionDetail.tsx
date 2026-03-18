import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Mission, MissionStateProjection, Contract, MissionArtifact, RunLinkage, DecisionRecord, ValidationRecord } from '../types';
import { listMissionContracts, listMissionArtifacts, listMissionRunLinkages, listMissionDecisions, listMissionValidations } from '../lib/tauri';
import { 
  Shield, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, 
  ChevronLeft, Calendar, FileText, Pause, Play, RefreshCw 
} from 'lucide-react';

interface MissionDetailProps {
  missionId: string;
  onNavigate: (page: any) => void;
}

export function MissionDetail({ missionId, onNavigate }: MissionDetailProps) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [projection, setProjection] = useState<MissionStateProjection | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [artifacts, setArtifacts] = useState<MissionArtifact[]>([]);
  const [runs, setRuns] = useState<RunLinkage[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMission();
    loadProjection();
    loadLinkedData();

    const unlisten = listen('mission-projection-updated', (event) => {
      if (event.payload === missionId) {
        loadMission();
        loadProjection();
        loadLinkedData();
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [missionId]);

  const loadMission = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<Mission>('get_mission_detail', { missionId });
      setMission(data);
    } catch (e) {
      console.error('Failed to get mission detail', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadProjection = async () => {
    try {
      const data = await invoke<MissionStateProjection>('get_mission_projection', { missionId });
      setProjection(data);
    } catch (e) {
      console.error('Failed to get mission projection', e);
      // Don't set global error, projection might not exist yet
    }
  };

  const loadLinkedData = async () => {
    try {
      const [contractsData, artifactsData, runsData, decisionsData, validationsData] = await Promise.all([
        listMissionContracts(missionId),
        listMissionArtifacts(missionId),
        listMissionRunLinkages(missionId),
        listMissionDecisions(missionId, 10),
        listMissionValidations(missionId, 10)
      ]);
      setContracts(contractsData);
      setArtifacts(artifactsData);
      setRuns(runsData);
      setDecisions(decisionsData);
      setValidations(validationsData);
    } catch (e) {
      console.error('Failed to load linked data', e);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await invoke('pause_mission', { missionId });
      await Promise.all([loadMission(), loadProjection(), loadLinkedData()]);
    } catch (e) {
      console.error('Failed to pause mission', e);
      alert('Failed to pause mission: ' + e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await invoke('resume_mission', { missionId });
      await Promise.all([loadMission(), loadProjection(), loadLinkedData()]);
    } catch (e) {
      console.error('Failed to resume mission', e);
      alert('Failed to resume mission: ' + e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    setActionLoading(true);
    try {
      await invoke('refresh_mission_state', { missionId });
      await Promise.all([loadMission(), loadProjection(), loadLinkedData()]);
    } catch (e) {
      console.error('Failed to refresh mission state', e);
      alert('Failed to refresh mission: ' + e);
    } finally {
      setActionLoading(false);
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

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/20" />
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="space-y-4">
        <button onClick={() => onNavigate('missions')} className="glass-button flex items-center gap-2 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to Missions
        </button>
        <div className="glass-panel p-8 text-center border-red-500/20">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Error Loading Mission</h3>
          <p className="text-sm text-white/40 mb-4">{error || 'Mission not found'}</p>
          <button onClick={loadMission} className="glass-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('missions')} className="glass-button p-2">
            <ChevronLeft className="w-4 h-4 text-white/40" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{mission.title}</h2>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 
                ${mission.status === 'active' ? 'bg-cyan-500/10 text-cyan-400' : 
                  mission.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40'}`}
              >
                <StatusIcon status={mission.status} /> {mission.status}
              </div>
            </div>
            <p className="text-xs text-white/40 mt-1">Mission ID: {mission.mission_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={actionLoading}
            className="glass-button flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Refresh mission state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          {mission.status === 'active' ? (
            <button 
              onClick={handlePause}
              disabled={actionLoading}
              className="glass-button flex items-center gap-2 px-3 py-1.5 text-xs text-amber-400"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause
            </button>
          ) : mission.status === 'paused' ? (
            <button 
              onClick={handleResume}
              disabled={actionLoading}
              className="glass-button flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400"
            >
              <Play className="w-3.5 h-3.5" />
              Resume
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Health State</span>
          <span className="text-sm font-medium text-white">{mission.health_state}</span>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Governance State</span>
          <span className="text-sm font-medium text-white">{mission.governance_state}</span>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Mode</span>
          <span className="text-sm font-medium text-white uppercase">{mission.mission_mode}</span>
        </div>
        <div className="glass-panel p-4 flex flex-col gap-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Current Phase</span>
          <span className="text-sm font-medium text-cyan-400">{mission.current_phase || 'N/A'}</span>
        </div>
      </div>

      {projection && (
        <div className="glass-panel p-6 border-cyan-500/20 bg-cyan-500/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white">Live State Projection</h3>
            </div>
            <span className="text-[10px] text-white/30">
              Last Updated: {new Date(projection.updated_at).toLocaleTimeString()}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Projected Focus</span>
              <p className="text-sm text-white/80">{projection.focus || 'Calculating...'}</p>
            </div>
            <div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Blocker Risk</span>
              <p className={`text-sm font-medium ${projection.blocker_risk === 'high' ? 'text-red-400' : 'text-white/80'}`}>
                {projection.blocker_risk || 'None identified'}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Resume Readiness</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${projection.resume_readiness ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`} />
                <span className={`text-sm ${projection.resume_readiness ? 'text-emerald-400' : 'text-white/40'}`}>
                  {projection.resume_readiness ? 'Ready' : 'Waiting for state'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Human Attention</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${projection.needs_human_attention ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-white/10'}`} />
                <span className={`text-sm ${projection.needs_human_attention ? 'text-amber-400 font-bold' : 'text-white/40'}`}>
                  {projection.needs_human_attention ? 'REQUIRED' : 'Autonomous'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Active Contracts</span>
              <p className="text-lg font-mono text-white">{projection.active_contract_count}</p>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Last Decision</span>
                <p className="text-xs text-white/60 italic leading-relaxed">
                  {projection.last_decision_summary || 'No decisions recorded yet.'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Last Validation</span>
                <p className="text-xs text-white/60 italic leading-relaxed">
                  {projection.last_validation_summary || 'No validations performed yet.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white">Summary</h3>
          </div>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
            {mission.summary_current || 'No summary available for this mission yet.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white">Risk Profile</h3>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-white/40">Initial Risk Level</span>
              <span className="text-sm text-white font-mono">{mission.risk_level_initial || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-white/40">Current Risk Level</span>
              <span className="text-sm text-white font-mono">{mission.risk_level_current || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/40">Resume Readiness</span>
              <span className={`text-sm font-bold ${mission.resume_readiness ? 'text-emerald-400' : 'text-amber-400'}`}>
                {mission.resume_readiness ? 'Ready' : 'Incomplete'}
              </span>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white">Timeline</h3>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-white/40">Created</span>
              <span className="text-sm text-white font-mono">{new Date(mission.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/40">Last Updated</span>
              <span className="text-sm text-white font-mono">{new Date(mission.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bridge Data Panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Contracts Panel */}
        <div className="glass-panel p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white">Active Contracts</h3>
            </div>
          </div>
          <div className="flex-1 space-y-3 custom-scroll overflow-y-auto max-h-[300px] pr-2">
            {contracts.length === 0 ? (
              <p className="text-sm text-white/40 italic">No contracts found.</p>
            ) : (
              contracts.map(c => (
                <div key={c.contract_id} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{c.title || c.contract_type}</span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm 
                      ${c.status === 'admitted' ? 'bg-amber-500/20 text-amber-400' : 
                        c.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 
                        c.status === 'fulfilled' ? 'bg-emerald-500/20 text-emerald-400' : 
                        'bg-red-500/20 text-red-400'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex justify-start">
                    <button
                      onClick={() => onNavigate({ name: 'create-run', mission_id: missionId, contract_id: c.contract_id })}
                      className="text-[10px] bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors"
                    >
                      Launch Linked Run
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Linked Runs Panel */}
        <div className="glass-panel p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white">Linked Runs</h3>
            </div>
          </div>
          <div className="flex-1 space-y-3 custom-scroll overflow-y-auto max-h-[300px] pr-2">
            {runs.length === 0 ? (
              <p className="text-sm text-white/40 italic">No runs linked yet.</p>
            ) : (
              runs.map(r => (
                <div key={r.run_id} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white/70 truncate mr-2" title={r.run_id}>
                      {r.run_id.substring(0, 8)}...
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm 
                      ${r.status === 'running' ? 'bg-cyan-500/20 text-cyan-400' : 
                        r.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : 
                        r.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                        'bg-white/10 text-white/60'}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/40">
                    Linked: {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Artifacts Panel */}
        <div className="glass-panel p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white">Discovered Artifacts</h3>
            </div>
          </div>
          <div className="flex-1 space-y-3 custom-scroll overflow-y-auto max-h-[300px] pr-2">
            {artifacts.length === 0 ? (
              <p className="text-sm text-white/40 italic">No artifacts discovered.</p>
            ) : (
              artifacts.map(a => (
                <div key={a.artifact_id} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm truncate mr-2" title={a.name}>
                      {a.name}
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 uppercase font-bold px-1.5 py-0.5 rounded-sm">
                      {a.artifact_type}
                    </span>
                  </div>
                  {a.storage_path && (
                    <div className="text-[10px] text-white/40 font-mono truncate" title={a.storage_path}>
                      {a.storage_path}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Governance Feeds (Block 4.5) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
        {/* Decision Feed */}
        <div className="glass-panel p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white">Decision Feed</h3>
            </div>
          </div>
          <div className="flex-1 space-y-3 custom-scroll overflow-y-auto max-h-[350px] pr-2">
            {decisions.length === 0 ? (
              <p className="text-sm text-white/40 italic">No decisions recorded yet.</p>
            ) : (
              decisions.map(d => (
                <div key={d.decision_id} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-white text-sm break-words">{d.summary}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] bg-white/10 text-white/60 uppercase font-bold px-1.5 py-0.5 rounded-sm">
                      {d.decision_type}
                    </span>
                    <span className="text-[10px] text-white/40">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {d.outcome && (
                    <div className="text-xs text-emerald-400 font-mono mt-1">Outcome: {d.outcome}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Validation Feed */}
        <div className="glass-panel p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white">Validation Feed</h3>
            </div>
          </div>
          <div className="flex-1 space-y-3 custom-scroll overflow-y-auto max-h-[350px] pr-2">
            {validations.length === 0 ? (
              <p className="text-sm text-white/40 italic">No validations recorded yet.</p>
            ) : (
              validations.map(v => (
                <div key={v.validation_id} className={`p-3 rounded-lg border space-y-2 
                  ${v.is_passing ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-white text-sm break-words">{v.summary}</span>
                    {v.is_passing ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] bg-white/10 text-white/60 uppercase font-bold px-1.5 py-0.5 rounded-sm">
                      {v.validation_type}
                    </span>
                    <span className="text-[10px] text-white/40">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
