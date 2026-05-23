import React from 'react';

import { Card } from './Card';
import { Button, type ButtonVariant } from './Button';
import { clsx } from './clsx';

type EmptyStateActionConfig = {
  label: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
};

function isActionConfig(value: React.ReactNode | EmptyStateActionConfig | undefined): value is EmptyStateActionConfig {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !React.isValidElement(value) &&
      'label' in value
  );
}

export function EmptyState(props: {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Backward-compatible alias. */
  message?: React.ReactNode;
  /** Backward-compatible inline action slot or action config. */
  action?: React.ReactNode | EmptyStateActionConfig;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  className?: string;
  testId?: string;
}) {
  const testId = props.testId;
  const actionTestId = testId ? `${testId}.action` : undefined;
  const body = props.body ?? props.message;

  let actionNode: React.ReactNode = null;
  if (props.action !== undefined) {
    if (isActionConfig(props.action)) {
      actionNode = (
        <Button
          testId={actionTestId}
          variant={props.action.variant ?? 'secondary'}
          onClick={props.action.onClick}
        >
          {props.action.label}
        </Button>
      );
    } else {
      actionNode = props.action;
    }
  } else if (props.actionLabel && props.onAction) {
    actionNode = (
      <Button
        testId={actionTestId}
        variant={props.actionVariant ?? 'secondary'}
        onClick={props.onAction}
      >
        {props.actionLabel}
      </Button>
    );
  }

  return (
    <Card testId={testId}>
      <div className={clsx('p-4 text-center', props.className)}>
        <div className="text-sm font-semibold text-fg">{props.title}</div>
        {body ? <div className="mt-1 text-sm text-muted">{body}</div> : null}

        {actionNode ? <div className="mt-4">{actionNode}</div> : null}
      </div>
    </Card>
  );
}
