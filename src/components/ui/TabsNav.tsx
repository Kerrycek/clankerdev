import React from 'react';
import { NavLink } from 'react-router-dom';

import { clsx } from './clsx';

export type TabsNavItem = {
  to: string;
  label: React.ReactNode;
  end?: boolean;
  testId?: string;
  hidden?: boolean;
  /** Backward-compatible hint ignored by the canonical NavLink-based implementation. */
  active?: boolean;
};

/**
 * TabsNav
 *
 * Canonical navigation tabs used in detail pages.
 *
 * Styling intentionally matches the “pill tabs” used in several modules.
 * They wrap on mobile and remain touch-friendly.
 */
export function TabsNav(props: {
  items?: TabsNavItem[];
  /** Backward-compatible alias used by older pages. */
  tabs?: TabsNavItem[];
  className?: string;
  testId?: string;
}) {
  const items = (props.items ?? props.tabs ?? []).filter((it) => !it.hidden);

  return (
    <div className={clsx('flex flex-wrap gap-2', props.className)} data-testid={props.testId} data-document-title-tabs>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          data-testid={it.testId}
          className={({ isActive }) =>
            clsx(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-surface-2 text-fg ring-1 ring-border' : 'text-muted hover:bg-surface-2 hover:text-fg'
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  );
}
