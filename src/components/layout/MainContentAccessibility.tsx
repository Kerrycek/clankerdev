import React from 'react';

import { clsx } from '../ui/clsx';

export const MAIN_CONTENT_ID = 'main-content';

export function SkipToMainContentLink(props: { label: string; testId?: string }) {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-contrast focus:shadow-panel focus:outline-none focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg"
      data-testid={props.testId}
    >
      {props.label}
    </a>
  );
}

type MainContentProps = Omit<React.ComponentPropsWithoutRef<'main'>, 'id' | 'tabIndex'>;

/**
 * Shared focus target for skip links and client-side route changes. The scroll
 * margin keeps the destination clear of the sticky public and app headers.
 */
export function MainContent({ className, ...mainProps }: MainContentProps) {
  return <main {...mainProps} id={MAIN_CONTENT_ID} className={clsx('scroll-mt-24', className)} tabIndex={-1} />;
}
