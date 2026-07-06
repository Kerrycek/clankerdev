import React from 'react';

import { clsx } from '../ui/clsx';

/**
 * Brand-inspired mark for the public Status landing.
 *
 * Intent: a subtle “we love servers” nod (heart + server stack),
 * without turning the status page into marketing.
 */
export function StatusLandingMark(props: {
  className?: string;
  title?: string;
}) {
  const title = props.title ?? 'vpsAdmin status';

  return (
    <svg
      viewBox="0 0 140 64"
      className={clsx('h-12 w-auto text-accent', props.className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* Heart outline (left) */}
      <path
        d="M40 14
           C32 6 20 10 20 22
           C20 34 32 40 40 50
           C48 40 60 34 60 22
           C60 10 48 6 40 14 Z"
      />

      {/* Server stack (right) */}
      <rect x="84" y="10" width="44" height="12" rx="3" />
      <rect x="84" y="26" width="44" height="12" rx="3" />
      <rect x="84" y="42" width="44" height="12" rx="3" />

      {/* Small indicator squares */}
      <rect x="88" y="14" width="6" height="6" rx="1" />
      <rect x="88" y="30" width="6" height="6" rx="1" />
      <rect x="88" y="46" width="6" height="6" rx="1" />
    </svg>
  );
}
