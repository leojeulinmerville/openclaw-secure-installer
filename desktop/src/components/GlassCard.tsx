import clsx from 'clsx';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

export function GlassCard({ children, className, title, actions }: GlassCardProps) {
  return (
    <div className={clsx("glass-panel p-6", className)}>
      {(title || actions) && (
        <div className="flex justify-between items-center mb-4">
          {title && <h2 className="text-lg font-semibold text-white/90">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
