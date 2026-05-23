import React from 'react';

import { PageContainer, type PageContainerVariant } from './PageContainer';
import { clsx } from '../ui/clsx';

/**
 * ListShell
 *
 * Standard layout wrapper for list pages.
 *
 * `header` is optional because a few simple surfaces render their own PageHeader
 * inside children while still using the same page rhythm / container contract.
 */
export function ListShell(props: {
  header?: React.ReactNode;
  children: React.ReactNode;
  variant?: PageContainerVariant;
  filters?: React.ReactNode;
  banner?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <PageContainer variant={props.variant} testId={props.testId}>
      <div className={clsx('space-y-6', props.className)}>
        {props.banner}
        {props.header}
        {props.filters}
        {props.children}
      </div>
    </PageContainer>
  );
}
