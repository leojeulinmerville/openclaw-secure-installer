import { useState } from 'react';
import type { Page } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Overview } from './pages/Overview';
import { Providers } from './pages/Providers';
import AgentsList from './pages/AgentsList';
import { Policies } from './pages/Policies';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';
import CreateAgent from './pages/CreateAgent';
import AgentDetail from './pages/AgentDetail';
import Chat from './pages/Chat';
import { Runs } from './pages/Runs';
import { RunDetail } from './pages/RunDetail';
import { CreateRun } from './pages/CreateRun';
import { Setup } from './pages/Setup';
import { ConnectOllama } from './pages/ConnectOllama';
import { GatewayBanner } from './components/GatewayBanner';
import { DesktopProvider, useDesktop } from './contexts/DesktopContext';

function AppContent() {
  const [page, setPage] = useState<Page>('overview');
  const [agentDetailId, setAgentDetailId] = useState<string | null>(null);
  const { gatewayStatus } = useDesktop();

  // Navigation helper that accepts optional detail param
  const navigate = (p: Page, detail?: string) => {
    setPage(p);
    if (detail) setAgentDetailId(detail);
  };

  const renderPage = () => {
    switch (page) {
      case 'overview':      return <Overview />;
      case 'providers':     return <Providers />;
      case 'agents':        return <AgentsList onNavigate={navigate} />;
      case 'create-agent':  return <CreateAgent onNavigate={navigate} />;
      case 'agent-detail':
        return agentDetailId
          ? <AgentDetail agentId={agentDetailId} onNavigate={navigate} />
          : <AgentsList onNavigate={navigate} />;
      case 'policies':      return <Policies />;
      case 'activity':      return <Activity />;
      case 'settings':      return <Settings />;
      case 'chat':          return <Chat />;
      case 'runs':          return <Runs onNavigate={navigate} />;
      case 'create-run':    return <CreateRun onNavigate={navigate} />;
      case 'run-detail':
          return agentDetailId 
            ? <RunDetail runId={agentDetailId} onNavigate={() => navigate('runs')} />
            : <Runs onNavigate={navigate} />;
      case 'setup':         return <Setup onNavigate={navigate} />;
      case 'connect-ollama': return <ConnectOllama onBack={() => navigate('providers')} onConnected={() => navigate('providers')} />;
      default:              return <Overview />;
    }
  };

  const isGatewayOk = gatewayStatus?.containerStable && gatewayStatus?.healthOk;

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden">
      <GatewayBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar page={page} onNavigate={navigate} gatewayOk={!!isGatewayOk} />
        <main className="main-content custom-scroll flex-1 bg-gradient-to-br from-gray-900 to-black relative">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DesktopProvider>
      <AppContent />
    </DesktopProvider>
  );
}
