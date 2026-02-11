import { useState, useEffect } from 'react';
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
import { getGatewayStatus } from './lib/tauri';
import { GatewayBanner } from './components/GatewayBanner';
import type { GatewayStatusResult } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [agentDetailId, setAgentDetailId] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusResult | null>(null);

  // Navigation helper that accepts optional detail param
  const navigate = (p: Page, detail?: string) => {
    setPage(p);
    if (detail) setAgentDetailId(detail);
  };

  // Periodic gateway status check for the sidebar indicator
  useEffect(() => {
    checkGateway();
    const interval = setInterval(checkGateway, 5000); // Check every 5s for responsiveness
    return () => clearInterval(interval);
  }, []);

  const checkGateway = async () => {
    try {
      const status = await getGatewayStatus();
      setGatewayStatus(status);
    } catch (e) {
      console.error("Gateway poll failed:", e);
      // If poll fails, assume down
      setGatewayStatus({
        containerStable: false,
        healthOk: false,
        version: null,
        lastError: null
      });
    }
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
      default:              return <Overview />;
    }
  };

  const isGatewayOk = gatewayStatus?.containerStable && gatewayStatus?.healthOk;

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden">
      <GatewayBanner status={gatewayStatus} onRefresh={checkGateway} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar page={page} onNavigate={navigate} gatewayOk={!!isGatewayOk} />
        <main className="main-content custom-scroll flex-1 bg-gradient-to-br from-gray-900 to-black relative">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
