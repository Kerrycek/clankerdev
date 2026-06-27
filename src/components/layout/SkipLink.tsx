import React from 'react';

import { clsx } from '../ui/clsx';

export function SkipLink(props: { targetId: string; label: string; className?: string }) {
  const focusTarget = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(props.targetId);
    if (!target) return;

    event.preventDefault();
    target.focus();
    target.scrollIntoView({ block: 'start' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${props.targetId}`);
  };

  return (
    <a
      href={`#${props.targetId}`}
      onClick={focusTarget}
      className={clsx(
        'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50',
        'focus:rounded-md focus:border focus:border-border focus:bg-overlay-surface focus:px-3 focus:py-2',
        'focus:text-sm focus:font-semibold focus:text-fg focus:shadow-panel focus:outline-none focus:ring-2 focus:ring-focus',
        props.className
      )}
    >
      {props.label}
    </a>
  );
}
