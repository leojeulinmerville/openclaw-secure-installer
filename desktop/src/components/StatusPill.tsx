import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface StatusPillProps {
  status: 'ok' | 'bad' | 'neutral' | 'loading';
  text: string;
}

export function StatusPill({ status, text }: StatusPillProps) {
  return (
    <span
      className={clsx(
        "pill transition-all duration-300",
        status === 'ok' && "ok",
        status === 'bad' && "bad",
        status === 'neutral' && "neutral",
        status === 'loading' && "neutral animate-pulse"
      )}
    >
      {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
      {text}
    </span>
  );
}
