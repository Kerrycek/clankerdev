import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { clsx } from './clsx';

export type TableRowVariant = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted';

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  // Elements that should keep their own click behavior (links, buttons, form controls, etc.)
  // Also allow opt-out via `data-row-no-nav`.
  const selector =
    'a, button, input, textarea, select, option, label, summary, details, [role="button"], [role="link"], [data-row-no-nav], [data-row-no-nav="true"], [contenteditable="true"]';

  return Boolean(target.closest(selector));
}

function hasTextSelection(): boolean {
  // Avoid hijacking clicks when the user is selecting text.
  const sel = window.getSelection?.();
  if (!sel) return false;
  if (sel.isCollapsed) return false;
  return sel.toString().trim().length > 0;
}

/**
 * TableRowLink
 *
 * A <tr> that behaves like a "row link": clicking anywhere on the row (except interactive elements)
 * navigates to the provided route.
 *
 * This is a convenience feature for power users; we keep real links/buttons inside the row intact.
 */
export function TableRowLink(props: {
  to?: string;
  disabled?: boolean;
  variant?: TableRowVariant;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const clickable = Boolean(props.to) && !props.disabled;

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (!clickable) return;
      if (!props.to) return;

      // Respect nested controls.
      if (isInteractiveElement(e.target)) return;

      // Don't navigate when selecting text.
      if (hasTextSelection()) return;

      // Modifier click: open in new tab/window.
      if (e.metaKey || e.ctrlKey) {
        window.open(props.to, '_blank', 'noopener,noreferrer');
        return;
      }

      navigate(props.to);
    },
    [clickable, navigate, props.to]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (!clickable) return;
      if (!props.to) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(props.to);
      }
    },
    [clickable, navigate, props.to]
  );

  return (
    <tr
      data-testid={props.testId}
      className={clsx(props.className)}
      data-row-clickable={clickable ? 'true' : undefined}
      data-row-variant={props.variant}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {props.children}
    </tr>
  );
}
