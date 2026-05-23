import React from 'react';

import { clsx } from '../ui/clsx';

export type PageContainerVariant = 'default' | 'wide' | 'narrow';

/**
 * PageContainer
 *
 * A simple max-width wrapper used to keep pages from stretching to full ultra-wide
 * widths in desktop layouts, while still allowing table-heavy screens to opt into
 * a wider container.
 *
 * Note: AppLayout already applies consistent padding (p-4). PageContainer only
 * controls width and does not add additional padding.
 */
export function PageContainer(props: {
  variant?: PageContainerVariant;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const v = props.variant ?? 'default';

  return (
    <div
      data-testid={props.testId}
      className={clsx(
        'mx-auto w-full',
        v === 'wide' ? 'max-w-screen-2xl' : v === 'narrow' ? 'max-w-screen-lg' : 'max-w-screen-xl',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
