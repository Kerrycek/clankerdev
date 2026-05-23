import React from 'react';
import { clsx } from './clsx';

export interface InputProps {
  testId?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  name?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return (
    <input
      ref={ref}
      data-testid={props.testId}
      aria-label={props.ariaLabel}
      type={props.type ?? 'text'}
      name={props.name}
      inputMode={props.inputMode}
      value={props.value}
      defaultValue={props.defaultValue}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      min={props.min}
      max={props.max}
      step={props.step}
      disabled={props.disabled}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      className={clsx(
        'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none transition',
        'focus:border-accent/70 focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-disabled',
        props.className
      )}
    />
  );
});
