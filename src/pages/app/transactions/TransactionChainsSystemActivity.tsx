import React from 'react';

import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { TransactionChainsTable } from './TransactionChainsTable';
import type { TransactionChainRow } from './transactionChainSemantics';

type SystemActivityTableProps = Omit<
  React.ComponentProps<typeof TransactionChainsTable>,
  'rows' | 'canNext' | 'pageCursor' | 'showPagination'
>;

interface TransactionChainsSystemActivityProps {
  rows: TransactionChainRow[];
  open: boolean;
  onToggleOpen: () => void;
  tableProps: SystemActivityTableProps;
}

export function TransactionChainsSystemActivity({ rows, open, onToggleOpen, tableProps }: TransactionChainsSystemActivityProps) {
  if (rows.length === 0) return null;

  const { t } = tableProps;
  return (
    <Card testId="transactions.system_activity">
      <CardHeader
        title={t('operation.system_activity.title', { count: rows.length })}
        subtitle={t('operation.system_activity.body')}
        actions={
          <Button size="sm" variant="secondary" onClick={onToggleOpen} testId="transactions.system_activity.toggle">
            {open ? t('operation.system_activity.hide') : t('operation.system_activity.show')}
          </Button>
        }
      />
      {open ? (
        <CardBody className="p-0">
          <TransactionChainsTable {...tableProps} rows={rows} canNext={false} pageCursor={null} showPagination={false} />
        </CardBody>
      ) : null}
    </Card>
  );
}
