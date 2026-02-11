import clsx from 'clsx';

interface StatusPillProps {
  status: 'ok' | 'bad' | 'warn' | 'neutral' | 'info' | 'loading' | 'testing';
  text: string;
}

export function StatusPill({ status, text }: StatusPillProps) {
  return (
    <span className={clsx('pill', status)}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        status === 'ok' && 'bg-emerald-400',
        status === 'bad' && 'bg-red-400',
        status === 'warn' && 'bg-amber-400',
        status === 'neutral' && 'bg-slate-400',
        status === 'info' && 'bg-cyan-400',
        status === 'loading' && 'bg-white/50 animate-pulse',
        status === 'testing' && 'bg-violet-400 animate-pulse',
      )} />
      {text}
    </span>
  );
}
