import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GlassCard } from '../GlassCard';
import { ArrowRight, Settings2 } from 'lucide-react';

interface Step2Props {
  onNext: () => void;
  activeImage: string;
}

export function Step2Configure({ onNext, activeImage }: Step2Props) {
  const [httpPort, setHttpPort] = useState(80);
  const [httpsPort, setHttpsPort] = useState(443);
  const [saving, setSaving] = useState(false);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await invoke("configure_installation", {
        httpPort,
        httpsPort,
        gatewayImage: activeImage,
      });
      onNext();
    } catch (err) {
      alert("Configuration failed: " + err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard title="Network Configuration" className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
      <div className="space-y-6">
        <p className="text-white/70">
          Choose the ports where the Gateway will listen. Ensure these ports are free on your machine.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">HTTP Port</label>
            <input
              type="number"
              value={httpPort}
              onChange={(e) => setHttpPort(parseInt(e.target.value) || 0)}
              className="glass-input"
              placeholder="80"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">HTTPS Port</label>
            <input
              type="number"
              value={httpsPort}
              onChange={(e) => setHttpsPort(parseInt(e.target.value) || 0)}
              className="glass-input"
              placeholder="443"
            />
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3 text-sm text-blue-200">
           <Settings2 className="w-5 h-5 shrink-0" />
           <p>
             The installer uses <strong>Host Networking</strong> by mapping these ports.
             If you have another web server (IIS, Apache, Nginx) running on port 80/443, please stop it or change these ports.
           </p>
        </div>

        <div className="flex justify-end pt-2">
           <button onClick={saveConfig} disabled={saving} className="glass-button bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/30 text-cyan-200 flex items-center gap-2">
             {saving ? 'Saving...' : 'Save & Continue'}
             <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </GlassCard>
  );
}
