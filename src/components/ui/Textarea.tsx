import React from 'react';

import { clsx } from './clsx';

export interface TextareaProps {
  testId?: string;
  textareaId?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  name?: string;
  rows?: number;
  maxLength?: number;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  className?: string;
  label?: React.ReactNode;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(props, ref) {
  const textarea = (
    <textarea
      ref={ref}
      id={props.textareaId}
      data-testid={props.testId}
      aria-label={props.ariaLabel}
      name={props.name}
      value={props.value}
      defaultValue={props.defaultValue}
      placeholder={props.placeholder}
      rows={props.rows ?? 5}
      maxLength={props.maxLength}
      disabled={props.disabled}
      aria-invalid={props.ariaInvalid}
      aria-describedby={props.ariaDescribedBy}
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
});
