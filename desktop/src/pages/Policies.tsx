import { Shield, Globe, DollarSign, Gauge, Lock, Info } from 'lucide-react';

export function Policies() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Policies</h2>
      <p className="text-sm text-white/40">
        Security and resource policies applied to all agents. These are enforced by the desktop control plane.
      </p>

      {/* Egress Allowlist */}
      <section className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Egress Allowlist</h3>
            <p className="text-xs text-white/30">Default deny — only listed domains can be reached.</p>
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/[0.05]">
          <div className="space-y-1 font-mono text-xs text-white/60">
            <div className="flex items-center gap-2"><Lock className="w-3 h-3 text-emerald-500" /> api.openai.com</div>
            <div className="flex items-center gap-2"><Lock className="w-3 h-3 text-emerald-500" /> localhost</div>
            <div className="flex items-center gap-2"><Lock className="w-3 h-3 text-emerald-500" /> host.docker.internal</div>
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/25 bg-white/[0.02] p-2 rounded-lg">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Per-agent overrides coming in v1.1. Currently, all agents share this allowlist.</span>
        </div>
      </section>

      {/* Cost Caps */}
      <section className="glass-panel p-5 space-y-3 opacity-75">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Cost Caps</h3>
            <p className="text-xs text-white/30">Daily spending limits to prevent runaway costs.</p>
          </div>
          <span className="pill neutral ml-auto">Coming in v1.1.0</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/40 block mb-1">Global Daily Cap</label>
            <input type="number" placeholder="No limit" className="glass-input" disabled />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Per-Agent Daily Cap</label>
            <input type="number" placeholder="No limit" className="glass-input" disabled />
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-white/25 bg-white/[0.02] p-2 rounded-lg">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Cost tracking requires OpenAI usage API. Will be available in next release.</span>
        </div>
      </section>

      {/* Runtime Limits */}
      <section className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center">
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Runtime Limits</h3>
            <p className="text-xs text-white/30">Resource guards for agent containers.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="metric-card">
            <span className="metric-label">Max Agents</span>
            <span className="metric-value text-lg">5</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">CPU per Agent</span>
            <span className="metric-value text-lg">1 core</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Memory per Agent</span>
            <span className="metric-value text-lg">512 MB</span>
          </div>
        </div>
      </section>

      {/* Security Defaults */}
      <section className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Security Defaults</h3>
            <p className="text-xs text-white/30">Hardened container settings applied to every agent.</p>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-white/50">Non-root container user</span>
            <span className="pill ok">Enforced</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-white/50">Read-only rootfs</span>
            <span className="pill ok">Enforced</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-white/50">All capabilities dropped</span>
            <span className="pill ok">Enforced</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
            <span className="text-white/50">no-new-privileges</span>
            <span className="pill ok">Enforced</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-white/50">Docker socket exposed</span>
            <span className="pill bad">Never</span>
          </div>
        </div>
      </section>
    </div>
  );
}
