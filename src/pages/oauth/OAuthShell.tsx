import React from 'react';

import { clsx } from '../../components/ui/clsx';

export function OAuthShell(props: {
  children: React.ReactNode;
  testId?: string;
  variant?: 'progress' | 'error';
}) {
  return (
    <main
      className="min-h-dvh bg-bg px-4 py-8 text-fg sm:px-6 lg:px-8"
      data-testid={props.testId}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-content-sm items-center">
        <div className="w-full">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-fg shadow-card">
              VA
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-fg">vpsAdmin</div>
              <div className="text-xs text-muted">next UI</div>
            </div>
          </div>

          <div
            className={clsx(
              'rounded-lg border bg-surface shadow-panel',
              props.variant === 'error' ? 'border-danger/60' : 'border-border',
            )}
          >
            {props.children}
          </div>
        </div>
      </div>
    </main>
  );
}
