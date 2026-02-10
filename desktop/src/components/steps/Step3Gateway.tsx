import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BuildResult, GatewayStartResult, PullTestResult } from '../types';
import { GlassCard } from '../GlassCard';
import { StatusPill } from '../StatusPill';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Play, RefreshCw, Terminal } from 'lucide-react';
import clsx from 'clsx';

interface Step3Props {
  onNext: (result: GatewayStartResult) => void;
  activeImage: string;
  onImageChange: (img: string) => void;
}

type Mode = 'public' | 'private' | 'local';

export function Step3Gateway({ onNext, activeImage, onImageChange }: Step3Props) {
  const [mode, setMode] = useState<Mode>('public');
  // Local state for inputs to allow typing before committing to activeImage parent state
  const [publicInput, setPublicInput] = useState(activeImage.includes('/') && !activeImage.includes('openclaw-gateway:dev') ? activeImage : "ghcr.io/leojeulinmerville/openclaw-gateway:stable");
  const [registryUrl, setRegistryUrl] = useState("ghcr.io");
  const [privateImage, setPrivateImage] = useState("");
  const [buildContext, setBuildContext] = useState("D:\\MVP\\openclaw-secure-installer\\gateway"); // default hint

  // Diagnostics
  const [pullStatus, setPullStatus] = useState<'idle'|'testing'|'ok'|'bad'>('idle');
  const [pullResult, setPullResult] = useState<PullTestResult|null>(null);
  const [buildStatus, setBuildStatus] = useState<'idle'|'building'|'ok'|'bad'>('idle');
  const [buildLogs, setBuildLogs] = useState("");
  const [startLogs, setStartLogs] = useState("");
  const [starting, setStarting] = useState(false);
  const [showPullDiagnostics, setShowPullDiagnostics] = useState(false);

  // Sync mode based on initial activeImage
  useEffect(() => {
    if (activeImage === 'openclaw-gateway:dev') {
      setMode('local');
    } else if (activeImage && activeImage !== "ghcr.io/leojeulinmerville/openclaw-gateway:stable") {
      setMode('public');
      setPublicInput(activeImage);
    }
  }, []);

  // Effect to update parent activeImage when inputs change (debounce slightly?)
  // Actually, for "Start", we want the current visible input.
  // We'll update parent on blur or specific actions.
  // User asked for "Interdire toute divergence". So we should sync frequently.

  useEffect(() => {
    let img = "";
    if (mode === 'public') img = publicInput;
    else if (mode === 'private') img = `${registryUrl}/${privateImage}`;
    else if (mode === 'local') img = 'openclaw-gateway:dev';
    
    if (img && img !== activeImage) {
      onImageChange(img);
    }
  }, [mode, publicInput, registryUrl, privateImage]);


  const testPull = async () => {
    setPullStatus('testing');
    setPullResult(null);
    setShowPullDiagnostics(false);
    
    try {
      const res = await invoke<PullTestResult>("test_pull_access", { image: activeImage });
      setPullResult(res);
      setPullStatus(res.accessible ? 'ok' : 'bad');
      // Auto-show warning if present?
    } catch (err) {
      console.error(err);
      setPullStatus('bad');
    }
  };

  const buildLocal = async () => {
    setBuildStatus('building');
    setBuildLogs(`Building from ${buildContext}...\n`);
    try {
      const res = await invoke<BuildResult>("build_local_image", { contextPath: buildContext });
      setBuildLogs(prev => prev + res.logs + (res.success ? "\n✅ Success" : "\n❌ Failed"));
      if (res.success) {
        setBuildStatus('ok');
        onImageChange(res.imageTag);
        // Persist immediately? Start will persist it anyway.
      } else {
        setBuildStatus('bad');
      }
    } catch (err) {
       setBuildLogs(prev => prev + "\nError: " + err);
       setBuildStatus('bad');
    }
  };

  const startGateway = async () => {
    if (!activeImage) return alert("No image selected");
    setStarting(true);
    setStartLogs(`Using runtime image: ${activeImage}\nSaving configuration...\n`);

    try {
      await invoke("save_gateway_image", { image: activeImage });
      await invoke("update_compose_image", { image: activeImage });
      
      setStartLogs(prev => prev + "Starting Gateway...\nVerifying stability...\n");
      
      const res = await invoke<GatewayStartResult>("start_gateway");
      
      if (res.gatewayActive) {
        setStartLogs(prev => prev + "✅ " + res.userFriendlyTitle + "\n");
        if (res.warning) setStartLogs(prev => prev + "⚠️ " + res.warning + "\n");
        
        // Wait briefly then next
        setTimeout(() => onNext(res), 1000);
      } else {
        setStartLogs(prev => prev + "❌ " + res.userFriendlyTitle + "\n");
        // Show detailed error in logs or a separate error box
      }
    } catch (err) {
      setStartLogs(prev => prev + "\nUnexpected error: " + err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <GlassCard title="Gateway Setup" className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
      <div className="space-y-6">
        
        {/* Tabs */}
        <div className="flex p-1 bg-black/20 rounded-lg">
          {(['public', 'private', 'local'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize",
                mode === m ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white/80"
              )}
            >
              {m} Image
            </button>
          ))}
        </div>

        {/* Content based on mode */}
        <div className="min-h-[120px]">
          {mode === 'public' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
               <label className="text-sm font-medium text-white/80">Image Name (Docker Hub / GHCR)</label>
               <input 
                 value={publicInput} 
                 onChange={e => setPublicInput(e.target.value)}
                 className="glass-input" 
                 placeholder="ghcr.io/org/image:tag"
               />
            </div>
          )}

          {mode === 'private' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
               <div className="grid grid-cols-3 gap-2">
                 <div className="col-span-1">
                    <label className="text-sm font-medium text-white/80">Registry</label>
                    <input 
                      value={registryUrl} onChange={e => setRegistryUrl(e.target.value)}
                      className="glass-input" placeholder="ghcr.io"
                    />
                 </div>
                 <div className="col-span-2">
                    <label className="text-sm font-medium text-white/80">Image</label>
                    <input 
                      value={privateImage} onChange={e => setPrivateImage(e.target.value)}
                      className="glass-input" placeholder="my-org/my-image:latest"
                    />
                 </div>
               </div>
               <button 
                 onClick={() => {
                    navigator.clipboard.writeText(`docker login ${registryUrl}`);
                    alert("Copied: docker login " + registryUrl);
                 }}
                 className="text-xs flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
               >
                 <Copy className="w-3 h-3"/> Copy 'docker login' command
               </button>
            </div>
          )}

          {mode === 'local' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
               <label className="text-sm font-medium text-white/80">Build Context Path</label>
               <div className="flex gap-2">
                 <input 
                   value={buildContext} onChange={e => setBuildContext(e.target.value)}
                   className="glass-input" 
                 />
                 <button onClick={buildLocal} disabled={buildStatus === 'building'} className="glass-button bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/30">
                   {buildStatus === 'building' ? <RefreshCw className="w-4 h-4 animate-spin"/> : 'Build'}
                 </button>
               </div>
               {buildLogs && (
                 <pre className="text-xs bg-black/40 p-2 rounded border border-white/5 h-24 overflow-y-auto logs-scroll font-mono text-slate-300">
                   {buildLogs}
                 </pre>
               )}
            </div>
          )}
        </div>

        {/* Pull Test Action (for non-local) */}
        {mode !== 'local' && (
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
             <div className="flex items-center gap-3">
               <button onClick={testPull} disabled={pullStatus === 'testing'} className="glass-button text-sm">
                 {pullStatus === 'testing' ? 'Testing...' : 'Test Pull Access'}
               </button>
               {pullStatus !== 'idle' && (
                 <StatusPill status={pullStatus} text={pullStatus === 'ok' ? 'Accessible' : 'Not Accessible'} />
               )}
             </div>
             {/* Diagnostics Toggle */}
             {(pullResult?.diagnostics || pullResult?.warning) && (
               <button 
                 onClick={() => setShowPullDiagnostics(!showPullDiagnostics)}
                 className="text-xs text-white/40 hover:text-white flex items-center gap-1"
               >
                 {showPullDiagnostics ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                 {showPullDiagnostics ? 'Hide Info' : 'Show Info'}
               </button>
             )}
          </div>
        )}

        {/* Pull Diagnostics Area */}
        {mode !== 'local' && (showPullDiagnostics || (pullResult?.accessible && pullResult?.warning)) && (
          <div className={clsx("text-sm p-3 rounded-lg border", 
             pullResult?.accessible ? "bg-amber-500/10 border-amber-500/20 text-amber-200" : "bg-red-500/10 border-red-500/20 text-red-200"
          )}>
             {pullResult?.warning && (
               <div className="flex items-start gap-2 mb-2">
                 <AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>
                 <span>{pullResult.warning}</span>
               </div>
             )}
             {showPullDiagnostics && pullResult?.diagnostics && (
               <pre className="text-xs opacity-80 whitespace-pre-wrap font-mono mt-2 bg-black/20 p-2 rounded">
                 {pullResult.diagnostics}
               </pre>
             )}
          </div>
        )}
        
        {/* Start Action */}
        <div className="pt-4 border-t border-white/10">
          <button 
             onClick={startGateway} 
             disabled={starting || !activeImage}
             className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-100 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
          >
            {starting ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Play className="w-5 h-5 fill-current"/>}
            Start Gateway
          </button>
          
          {startLogs && (
            <div className="mt-4 bg-black/40 rounded-lg border border-white/10 p-3">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-2 border-b border-white/5 pb-1">
                <Terminal className="w-3 h-3"/> Install Logs
              </div>
              <pre className="text-xs font-mono text-slate-300 h-32 overflow-y-auto logs-scroll whitespace-pre-wrap">
                {startLogs}
              </pre>
            </div>
          )}
        </div>

      </div>
    </GlassCard>
  );
}
