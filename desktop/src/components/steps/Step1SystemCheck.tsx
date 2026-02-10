import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckDockerResult } from '../types';
import { GlassCard } from '../GlassCard';
import { StatusPill } from '../StatusPill';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

interface Step1Props {
  onNext: () => void;
}

export function Step1SystemCheck({ onNext }: Step1Props) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckDockerResult | null>(null);

  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await invoke<CheckDockerResult>("check_docker");
      setResult(res);
      // Auto-advance if checked? No, let user click Next to be sure.
    } catch (err) {
      console.error(err);
      alert("Check failed: " + err);
    } finally {
      setChecking(false);
    }
  };

  const isSuccess = result?.dockerCliFound && result?.dockerDaemonReachable && result?.composeV2Available;

  return (
    <GlassCard title="System Requirements" className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-6">
        <p className="text-white/70">
          We need to verify that Docker Desktop is installed and running before setting up the gateway.
        </p>

        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Docker CLI
            </span>
            {result ? (
               <StatusPill status={result.dockerCliFound ? 'ok' : 'bad'} text={result.dockerCliFound ? 'Found' : 'Missing'} />
            ) : <span className="text-white/30 text-sm">Pending...</span>}
          </div>

          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Docker Daemon
            </span>
             {result ? (
               <StatusPill status={result.dockerDaemonReachable ? 'ok' : 'bad'} text={result.dockerDaemonReachable ? 'Running' : 'Stopped'} />
            ) : <span className="text-white/30 text-sm">Pending...</span>}
          </div>

          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Docker Compose (V2)
            </span>
             {result ? (
               <StatusPill status={result.composeV2Available ? 'ok' : 'bad'} text={result.composeV2Available ? 'Available' : 'Missing'} />
            ) : <span className="text-white/30 text-sm">Pending...</span>}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          {!result ? (
            <button onClick={runCheck} disabled={checking} className="glass-button bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/30 text-cyan-200">
              {checking ? 'Checking...' : 'Run System Check'}
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={runCheck} className="glass-button text-sm">Re-check</button>
              {isSuccess && (
                <button onClick={onNext} className="glass-button bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-200 flex items-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {result && !isSuccess && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
            <h4 className="font-semibold mb-2">Issues Resolved Needed:</h4>
            <ul className="list-disc list-inside space-y-1 opacity-90">
                {result.diagnostics.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
