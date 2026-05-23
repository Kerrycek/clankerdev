import React from 'react';

import { PageContainer, type PageContainerVariant } from './PageContainer';
import { clsx } from '../ui/clsx';

/**
 * DetailShell
 *
 * Standard wrapper for object detail pages.
 *
 * Applies:
 * - PageContainer (width)
 * - consistent vertical rhythm between header/sections
 */
export function DetailShell(props: {
  variant?: PageContainerVariant;
  testId?: string;
  className?: string;
  header?: React.ReactNode;
  tabs?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageContainer variant={props.variant} testId={props.testId}>
      <div className={clsx('space-y-6', props.className)}>
        {props.banner}
        {props.header}
        {props.tabs}
        {props.children}
      </div>
    </PageContainer>
  );
}
