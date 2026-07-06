import React from 'react';

export interface UserSecurityMetricGridItem {
  key: string;
  label: string;
  value: React.ReactNode;
}

export function UserSecurityMetricGrid(props: {
  items: readonly UserSecurityMetricGridItem[];
  testId: string;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid={props.testId}>
      {props.items.map((item) => (
        <div key={item.key} className="rounded-md border border-border bg-surface-2 p-3">
          <div className="text-xs text-muted">{item.label}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
