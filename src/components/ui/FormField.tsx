import React from 'react';

import { clsx } from './clsx';

export function FormField(props: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <label className={clsx('block', props.className)}>
      <span className={clsx('mb-1 block text-xs font-semibold text-muted', props.labelClassName)}>{props.label}</span>
      {props.children}
    </label>
  );
}
