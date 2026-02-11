import type { Page } from '../../types';
import {
  LayoutDashboard,
  Bot,
  Cpu,
  Shield,
  Activity,
  Settings,
  Cloudy,
  MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  gatewayOk: boolean;
}

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'overview',  label: 'Overview',   icon: LayoutDashboard },
  { page: 'providers', label: 'Providers',  icon: Cloudy },
  { page: 'agents',    label: 'Agents',     icon: Bot },
  { page: 'chat',      label: 'Chat',       icon: MessageCircle },
  { page: 'policies',  label: 'Policies',   icon: Shield },
  { page: 'activity',  label: 'Activity',   icon: Activity },
  { page: 'settings',  label: 'Settings',   icon: Settings },
];

export function Sidebar({ page, onNavigate, gatewayOk }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen border-r border-white/[0.06] bg-black/20 backdrop-blur-xl">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">My OpenClaw</h1>
          <p className="text-[10px] text-white/30 font-medium">Mission Control</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto custom-scroll">
        {NAV_ITEMS.map(({ page: p, label, icon: Icon }) => (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            className={clsx('nav-item w-full', page === p && 'active')}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Footer: gateway status */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            gatewayOk ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-red-400 shadow-sm shadow-red-400/50'
          )} />
          <span className="text-xs text-white/40">
            Gateway {gatewayOk ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  );
}
