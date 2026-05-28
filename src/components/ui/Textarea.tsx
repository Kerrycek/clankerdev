import React from 'react';

import { clsx } from './clsx';

export function Textarea(props: {
  testId?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  name?: string;
  rows?: number;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  className?: string;
  label?: React.ReactNode;
}) {
  const textarea = (
    <textarea
      data-testid={props.testId}
      aria-label={props.ariaLabel}
      name={props.name}
      value={props.value}
      defaultValue={props.defaultValue}
      placeholder={props.placeholder}
      rows={props.rows ?? 5}
      disabled={props.disabled}
      onChange={props.onChange}
      className={clsx(
        'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition',
        'focus:border-accent/70 focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-disabled',
        props.className
      )}
    />
  );

  if (!props.label) return textarea;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{props.label}</span>
      {textarea}
    </label>
  );
}
