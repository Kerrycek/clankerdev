import React, { useId } from 'react';

import { Checkbox } from './Checkbox';

/**
 * A simple row-style boolean input.
 *
 * We intentionally implement this using the existing Checkbox component to keep
 * consistent accessibility and styling.
 */
export function SwitchRow(props: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      data-testid={props.testId}
      className={
        'flex items-start gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 ' +
        (props.disabled ? 'opacity-60' : 'cursor-pointer')
      }
    >
      <div className="mt-0.5">
        <Checkbox
          id={id}
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={(v) => props.onChange(Boolean(v))}
        />
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{props.label}</div>
        {props.description ? <div className="mt-0.5 text-xs text-muted">{props.description}</div> : null}
      </div>
    </label>
  );
}
