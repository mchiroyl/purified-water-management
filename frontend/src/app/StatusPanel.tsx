import type { ReactNode } from 'react';

type StatusPanelProps = {
  tone: 'loading' | 'error' | 'info' | 'success';
  children: ReactNode;
};

export function StatusPanel({ tone, children }: StatusPanelProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  const className = tone === 'error' ? 'alert error' : tone === 'success' ? 'alert success' : 'status-panel';

  return <div className={className} role={role}>{children}</div>;
}
