import React from 'react';
import { Link } from 'react-router-dom';

import { Card } from './Card';
import { clsx } from './clsx';
import { Table, type TableMinWidth, type TableVariant } from './Table';

interface TableCardRow {
  label: React.ReactNode;
  value: React.ReactNode;
}

type TableModeProps = {
  children: React.ReactNode;
  minWidth?: TableMinWidth;
  variant?: TableVariant;
  className?: string;
  tableClassName?: string;
  footer?: React.ReactNode;
  testId?: string;
  tableTestId?: string;
  title?: never;
  subtitle?: never;
  rows?: never;
  to?: never;
};

type SummaryModeProps = {
  children?: never;
  minWidth?: never;
  variant?: never;
  className?: string;
  tableClassName?: never;
  footer?: React.ReactNode;
  testId?: string;
  tableTestId?: never;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rows: Array<TableCardRow | null | undefined | false>;
  to?: string;
};

/**
 * TableCard
 *
 * Standard card wrapper for tables, with a backward-compatible summary-card mode
 * used by older mobile list views.
 */
export function TableCard(props: TableModeProps | SummaryModeProps) {
  if ('rows' in props && Array.isArray(props.rows)) {
    const body = (
      <div className="p-4">
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold text-fg">{props.title}</div>
          {props.subtitle ? <div className="mt-1 break-words text-xs text-muted">{props.subtitle}</div> : null}
        </div>

        <div className="mt-3 space-y-2">
          {props.rows.filter(Boolean).map((row, idx) => {
            const item = row as TableCardRow;
            return (
              <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                <div className="text-faint">{item.label}</div>
                <div className="min-w-0 break-words text-right text-fg">{item.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <Card testId={props.testId} className={props.className}>
        {props.to ? <Link to={props.to} className="block">{body}</Link> : body}
        {props.footer}
      </Card>
    );
  }

  return (
    <Card testId={props.testId} className={props.className}>
      <div className="overflow-x-auto">
        <Table
          testId={props.tableTestId}
          minWidth={props.minWidth}
          variant={props.variant}
          className={clsx(props.tableClassName)}
        >
          {props.children}
        </Table>
      </div>
      {props.footer}
    </Card>
  );
}
