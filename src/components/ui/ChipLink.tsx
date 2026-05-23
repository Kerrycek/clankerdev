import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';

import { clsx } from './clsx';

/**
 * Small “chip” style link used for filter pivots in tables and task views.
 */
export function ChipLink(props: LinkProps) {
  const { className, ...rest } = props;
  return (
    <Link
      {...rest}
      className={clsx(
        'inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted hover:bg-surface-2/70',
        className
      )}
    />
  );
}

/**
 * Tiny auxiliary link (e.g. “open”) placed next to chips.
 */
export function MiniLink(props: LinkProps) {
  const { className, ...rest } = props;
  return <Link {...rest} className={clsx('text-xs text-link hover:underline', className)} />;
}
