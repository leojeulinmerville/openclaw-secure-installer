import { useState } from 'react';
import { Step1SystemCheck } from '../components/steps/Step1SystemCheck';
import { Step2Configure } from '../components/steps/Step2Configure';
import { Step3Gateway } from '../components/steps/Step3Gateway';
import { Step4Dashboard } from '../components/steps/Step4Dashboard';
import { GatewayStartResult } from '../types';
import { useDesktop } from '../contexts/DesktopContext';

interface SetupProps {
  onNavigate: (page: 'overview') => void;
}

export function Setup({ onNavigate }: SetupProps) {
  const [step, setStep] = useState(1);
  const [activeImage, setActiveImage] = useState("ghcr.io/leojeulinmerville/openclaw-gateway:stable");
  const [startResult, setStartResult] = useState<GatewayStartResult | null>(null);
  const { refresh } = useDesktop();

  const next = () => setStep(s => s + 1);
  
  const handleGatewayStarted = (res: GatewayStartResult) => {
    setStartResult(res);
    setStep(4);
    refresh(); // Refresh global context
  };

  const handleStop = () => {
    setStartResult(null);
    setStep(3);
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Stepper Header */}
      <div className="flex items-center justify-center mb-10">
         {[1, 2, 3, 4].map(s => (
           <div key={s} className="flex items-center">
             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
               ${step === s ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-black' : 
                 step > s ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/30'}`}>
                {step > s ? '✓' : s}
             </div>
             {s < 4 && (
               <div className={`w-12 h-0.5 mx-2 transition-colors ${step > s ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
             )}
           </div>
         ))}
      </div>

      <div className="min-h-[400px]">
        {step === 1 && <Step1SystemCheck onNext={next} />}
        {step === 2 && <Step2Configure onNext={next} activeImage={activeImage} />}
        {step === 3 && (
          <Step3Gateway 
            onNext={handleGatewayStarted} 
            activeImage={activeImage} 
            onImageChange={setActiveImage} 
          />
        )}
        {step === 4 && startResult && (
          <Step4Dashboard startResult={startResult} onStop={handleStop} />
        )}
      </div>
      
      {step === 4 && (
        <div className="mt-8 text-center pt-8 border-t border-white/5">
           <button onClick={() => onNavigate('overview')} className="text-white/40 hover:text-white text-sm">
             &larr; Return to Dashboard
           </button>
        </div>
      )}
    </div>
  );
}
