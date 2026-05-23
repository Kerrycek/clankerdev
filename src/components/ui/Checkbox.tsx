import React from 'react';

import { clsx } from './clsx';

export function Checkbox(props: {
  id?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  children?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  const handleChange = (checked: boolean) => {
    props.onChange?.(checked);
    props.onCheckedChange?.(checked);
  };

  const label = props.label ?? props.children;

  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-surface-2',
        props.disabled ? 'cursor-not-allowed opacity-60 hover:bg-transparent' : '',
        props.className
      )}
    >
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => handleChange(e.target.checked)}
        data-testid={props.testId}
        className="mt-1 h-4 w-4 rounded border-border"
      />
      <div>
        {label ? <div className="text-sm font-medium">{label}</div> : null}
        {props.description ? <div className="text-xs text-muted">{props.description}</div> : null}
      </div>
    </label>
  );
}
