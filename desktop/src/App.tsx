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
import { Missions } from './pages/Missions';
import { MissionDetail } from './pages/MissionDetail';
import { Setup } from './pages/Setup';
import { ConnectOllama } from './pages/ConnectOllama';
import { Console } from './pages/Console';
import { Connections } from './pages/Connections';
import { PageErrorBoundary } from './components/layout/PageErrorBoundary';
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

  const currentPageName = typeof page === 'string' ? page : page.name;

  const renderPage = () => {
    switch (currentPageName) {
      case 'overview':      return <Overview />;
      case 'console':       return <Console />;
      case 'connections':   return <Connections />;
      case 'providers':     return <Providers onNavigate={navigate} />;
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
      case 'create-run':
        {
          const ctx = typeof page === 'object' ? page : {};
          return <CreateRun 
            onNavigate={navigate} 
            missionId={'mission_id' in ctx ? ctx.mission_id : undefined}
            contractId={'contract_id' in ctx ? ctx.contract_id : undefined}
          />;
        }
      case 'run-detail':
          return agentDetailId 
            ? <RunDetail runId={agentDetailId} onNavigate={() => navigate('runs')} />
            : <Runs onNavigate={navigate} />;
      case 'missions':      return <Missions onNavigate={navigate} />;
      case 'mission-detail':
          return agentDetailId
            ? <MissionDetail missionId={agentDetailId} onNavigate={navigate} />
            : <Missions onNavigate={navigate} />;
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
          <PageErrorBoundary page={currentPageName} onOpenConsole={() => navigate('console')}>
            {renderPage()}
          </PageErrorBoundary>
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
