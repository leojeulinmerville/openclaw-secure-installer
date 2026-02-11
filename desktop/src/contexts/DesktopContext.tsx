import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  checkDocker,
  isGatewayRunning,
  checkGatewayHealth,
  getState,
  getGatewayStatus,
  getAllowInternet,
  setAllowInternet as setLibAllowInternet,
  startGateway as startGatewayLib,
  stopGateway as stopGatewayLib,
} from '../lib/tauri';
import type {
  CheckDockerResult,
  InstallerState,
  GatewayStartResult,
  HealthCheckResult,
  GatewayStatusResult,
} from '../types';

interface DesktopContextType {
  // State
  docker: CheckDockerResult | null;
  gatewayRunning: GatewayStartResult | null; // From simple check
  gatewayHealth: HealthCheckResult | null;   // From /health
  gatewayStatus: GatewayStatusResult | null; // From specialized command
  config: InstallerState | null;
  allowInternet: boolean;
  
  // Computed
  isGatewayReady: boolean;
  isGatewayStable: boolean;
  isLoading: boolean;

  // Actions
  refresh: () => Promise<void>;
  startGateway: () => Promise<GatewayStartResult>;
  stopGateway: () => Promise<void>;
  setInternet: (enabled: boolean) => Promise<void>;
  setConfig: (cfg: InstallerState) => void; // Optimistic update
}

const DesktopContext = createContext<DesktopContextType | null>(null);

export const useDesktop = () => {
  const context = useContext(DesktopContext);
  if (!context) {
    throw new Error('useDesktop must be used within a DesktopProvider');
  }
  return context;
};

export const DesktopProvider = ({ children }: { children: ReactNode }) => {
  const [docker, setDocker] = useState<CheckDockerResult | null>(null);
  const [gatewayRunning, setGatewayRunning] = useState<GatewayStartResult | null>(null);
  const [gatewayHealth, setGatewayHealth] = useState<HealthCheckResult | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusResult | null>(null);
  const [config, setConfig] = useState<InstallerState | null>(null);
  const [allowInternet, setAllowInternetState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Poll intervals
  const FAST_POLL_MS = 5000;   // Gateway status
  const SLOW_POLL_MS = 30000;  // Docker status

  const refreshCore = useCallback(async () => {
    try {
      const [run, status, internet] = await Promise.all([
        isGatewayRunning(),
        getGatewayStatus(),
        getAllowInternet()
      ]);
      
      setGatewayRunning(run);
      setGatewayStatus(status);
      setAllowInternetState(internet);

      // If running, define health from status
      if (status.healthOk) {
         // Construct synthetic health result if needed or fetch real one
         // For now let's fetch real to keep compatible types
         const h = await checkGatewayHealth();
         setGatewayHealth(h);
      } else {
         setGatewayHealth(null);
      }
    } catch (e) {
      console.error('Core refresh failed:', e);
    }
  }, []);

  const refreshDockerAndConfig = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([checkDocker(), getState()]);
      setDocker(d);
      setConfig(c);
    } catch (e) {
      console.error('Docker/Config refresh failed:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([refreshCore(), refreshDockerAndConfig()]);
      setIsLoading(false);
    };
    init();
  }, [refreshCore, refreshDockerAndConfig]);

  // Fast loop (Gateway)
  useEffect(() => {
    const interval = setInterval(refreshCore, FAST_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshCore]);

  // Slow loop (Docker)
  useEffect(() => {
    const interval = setInterval(refreshDockerAndConfig, SLOW_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshDockerAndConfig]);

  // Actions
  const startGateway = async () => {
    const res = await startGatewayLib();
    await refreshCore(); // Immediate update
    return res;
  };

  const stopGateway = async () => {
    await stopGatewayLib();
    await refreshCore(); // Immediate update
  };

  const setInternet = async (enabled: boolean) => {
    await setLibAllowInternet(enabled);
    setAllowInternetState(enabled);
    // Refresh config in case it affects it
    await refreshDockerAndConfig();
  };

  const isGatewayReady = !!(gatewayStatus?.containerStable && gatewayStatus?.healthOk);

  return (
    <DesktopContext.Provider value={{
        docker,
        gatewayRunning,
        gatewayHealth,
        gatewayStatus,
        config,
        allowInternet,
        isGatewayReady,
        isGatewayStable: !!gatewayStatus?.containerStable,
        isLoading,
        refresh: async () => { await Promise.all([refreshCore(), refreshDockerAndConfig()]); },
        startGateway,
        stopGateway,
        setInternet,
        setConfig
    }}>
      {children}
    </DesktopContext.Provider>
  );
};
