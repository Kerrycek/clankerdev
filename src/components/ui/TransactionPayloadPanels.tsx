import React from 'react';

import { CopyButton } from './CopyButton';
import { clsx } from './clsx';

/**
 * TransactionPayloadPanels
 *
 * Shared rendering for transaction input/output payloads.
 *
 * - Uses opaque surfaces (no alpha hacks)
 * - Uses tabular numerals via surrounding table/list contracts
 * - Provides Copy buttons for power users
 */
export function TransactionPayloadPanels(props: {
  t: (k: any, vars?: any) => string;
  input: string;
  output: string;
  /** e.g. "max-h-80" or "max-h-96" */
  maxHeightClass?: string;
}) {
  const maxH = (() => {
    // Keep the allowed values explicit so Tailwind can statically see them.
    if (props.maxHeightClass === 'max-h-80') return 'max-h-80';
    return 'max-h-96';
  })();

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted">{props.t('transactions.tx.input')}</div>
          {props.input ? <CopyButton text={props.input} /> : null}
        </div>
        {props.input ? (
          <pre
            className={clsx('mt-2 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted', maxH)}
          >
            {props.input}
          </pre>
        ) : (
          <div className="mt-2 text-xs text-muted">{props.t('transactions.tx.no_payload')}</div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted">{props.t('transactions.tx.output')}</div>
          {props.output ? <CopyButton text={props.output} /> : null}
        </div>
        {props.output ? (
          <pre
            className={clsx('mt-2 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted', maxH)}
          >
            {props.output}
          </pre>
        ) : (
          <div className="mt-2 text-xs text-muted">{props.t('transactions.tx.no_payload')}</div>
        )}
      </div>
    </div>
  );
}
