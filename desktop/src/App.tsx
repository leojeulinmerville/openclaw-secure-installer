import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { InstallerState, GatewayStartResult } from './types';
import { Step1SystemCheck } from './components/steps/Step1SystemCheck';
import { Step2Configure } from './components/steps/Step2Configure';
import { Step3Gateway } from './components/steps/Step3Gateway';
import { Step4Dashboard } from './components/steps/Step4Dashboard';
import { CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export default function App() {
  const [step, setStep] = useState(1);
  const [activeImage, setActiveImage] = useState("ghcr.io/leojeulinmerville/openclaw-gateway:stable");
  const [startResult, setStartResult] = useState<GatewayStartResult|null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const state = await invoke<InstallerState>("get_state");
        if (state.gateway_image) {
          setActiveImage(state.gateway_image);
        }
        
        // Check if running
        const result = await invoke<GatewayStartResult>("is_gateway_running");
        if (result.gatewayActive) {
          setStartResult(result);
          setStep(4);
        }
        setStateLoaded(true);
      } catch (err) {
        console.error("Init failed:", err);
      }
    }
    init();
  }, []);

  if (!stateLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-white/50">Loading...</div>;
  }

  return (
    <div className="min-h-screen p-6 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Logo Placeholder - assuming assets/icon.png is loaded by browser as /src/assets/icon.png if imported? 
              Actually Vite serves public assets from / if in public, or relative if imported. 
              We'll use text for now or try to load the icon if copied to public/assets */}
          <div className="w-10 h-10 bg-cyan-500 rounded-lg shadow-lg shadow-cyan-500/20 flex items-center justify-center font-bold text-white text-xl">
             My
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            My OpenClaw
          </h1>
        </div>
        <button className="p-2 rounded-full hover:bg-white/5 text-white/50 hover:text-white/80 transition-colors">
          <HelpCircle className="w-5 h-5"/>
        </button>
      </header>
      
      {/* Stepper (Simplified) */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between px-4 relative">
         <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -z-10" />
         {[1, 2, 3, 4].map((s) => (
           <div key={s} className="flex flex-col items-center gap-2 bg-slate-900 px-2">
             <div className={clsx(
               "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500",
               step >= s ? "bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-slate-800 border-slate-700 text-slate-500"
             )}>
               {step > s ? <CheckCircle2 className="w-5 h-5"/> : s}
             </div>
             <span className={clsx("text-xs font-medium transition-colors duration-300", step >= s ? "text-cyan-200" : "text-slate-500")}>
               {s === 1 && "Start"}
               {s === 2 && "Config"}
               {s === 3 && "Gateway"}
               {s === 4 && "Dash"}
             </span>
           </div>
         ))}
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto">
        {step === 1 && <Step1SystemCheck onNext={() => setStep(2)} />}
        {step === 2 && <Step2Configure onNext={() => setStep(3)} activeImage={activeImage} />}
        {step === 3 && (
          <Step3Gateway 
            activeImage={activeImage} 
            onImageChange={setActiveImage}
            onNext={(res) => {
              setStartResult(res);
              setStep(4);
            }} 
          />
        )}
        {step === 4 && startResult && (
          <Step4Dashboard 
            startResult={startResult} 
            onStop={() => {
              setStartResult(null);
              setStep(3); // Go back to setup handling
            }} 
          />
        )}
      </main>
    </div>
  );
}
