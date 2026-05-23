import React from 'react';

export function Spinner(props: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted"
        aria-hidden
      />
      {props.label ? <span>{props.label}</span> : null}
    </div>
  );
}
