import { useState } from 'react';
import { GlassCard } from '../GlassCard';
import { ArrowRight, AlertTriangle, Settings2 } from 'lucide-react';
import { configureInstallation } from '../../lib/tauri';

interface Step2Props {
  onNext: () => void;
  activeImage: string;
}

export function Step2Configure({ onNext, activeImage }: Step2Props) {
  const [httpPort, setHttpPort] = useState(8080);
  const [httpsPort, setHttpsPort] = useState(8443);
  const [exposeGatewayToLan, setExposeGatewayToLan] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await configureInstallation(httpPort, httpsPort, activeImage, exposeGatewayToLan);
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
              placeholder="8080"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">HTTPS Port</label>
            <input
              type="number"
              value={httpsPort}
              onChange={(e) => setHttpsPort(parseInt(e.target.value) || 0)}
              className="glass-input"
              placeholder="8443"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <label className="flex items-center justify-between gap-3 text-sm text-white/80">
            <span>Expose gateway to LAN (advanced)</span>
            <button
              type="button"
              onClick={() => setExposeGatewayToLan(!exposeGatewayToLan)}
              className={`w-10 h-5 rounded-full relative transition-colors ${exposeGatewayToLan ? 'bg-amber-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${exposeGatewayToLan ? 'left-6' : 'left-1'}`} />
            </button>
          </label>
          <p className="text-xs text-white/50">
            Default is localhost-only (`127.0.0.1`) for safety. Enable LAN exposure only if you need remote clients on your network.
          </p>
          {exposeGatewayToLan && (
            <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Gateway will listen on all interfaces (`0.0.0.0`). Restrict access with host firewall rules and trusted network boundaries.
              </span>
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3 text-sm text-blue-200">
           <Settings2 className="w-5 h-5 shrink-0" />
           <p>
             The installer maps the container port to your selected local host ports.
             If another service already uses these ports, choose different values.
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
