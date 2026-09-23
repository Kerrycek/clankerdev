import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { NODE_HISTORY_PAGE_SIZE, type NodeHistoryPageOptions } from '../../../lib/api/nodeHistory';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Table } from '../../../components/ui/Table';

export function NodeHistoryTable<T extends { id: number }>(props: {
  nodeId: number;
  section: string;
  load: (nodeId: number, options: NodeHistoryPageOptions) => Promise<T[]>;
  columns: { label: string; render: (row: T) => ReactNode }[];
}) {
  const { t } = useI18n();
  const auth = useAuth();
  const [cursors, setCursors] = useState<Array<number | undefined>>([undefined]);
  const fromId = cursors.at(-1);
  const query = useQuery({
    queryKey: ['node-history', auth.user?.id, auth.role, props.nodeId, props.section, fromId],
    queryFn: ({ signal }) => props.load(props.nodeId, { fromId, signal }),
    retry: false,
  });
  const rows = query.data ?? [];
  // Use the last returned row: system history cursors follow observation time,
  // which need not be the same order as the numerical IDs.
  const next = rows.at(-1)?.id;
  return (
    <div className="min-w-0 space-y-3" data-testid={`node.history.${props.section}`}>
      {query.isError ? <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} /> : query.isPending ? <LoadingState /> : rows.length === 0 ? (
        <p className="p-4 text-muted">{t('admin.node.history.empty')}</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <dl key={row.id} className="space-y-3 rounded-lg border border-border p-4">
                {props.columns.map((column) => (
                  <div key={column.label}>
                    <dt className="text-xs text-muted">{t(column.label)}</dt>
                    <dd className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <Table minWidth="md">
              <thead><tr>{props.columns.map((column) => <th key={column.label} scope="col" className="px-3 py-2 text-left">{t(column.label)}</th>)}</tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  {props.columns.map((column) => <td key={column.label} className="max-w-md break-words px-3 py-2 align-top [overflow-wrap:anywhere]">{column.render(row)}</td>)}
                </tr>
              ))}</tbody>
            </Table>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors((value) => value.slice(0, -1))}>{t('pagination.prev')}</Button>
        <Button variant="secondary" disabled={query.isError || query.isFetching || rows.length < NODE_HISTORY_PAGE_SIZE || next === undefined || cursors.includes(next)} onClick={() => setCursors((value) => [...value, next])}>{t('pagination.next')}</Button>
        <Button variant="ghost" loading={query.isFetching} onClick={() => { void query.refetch(); }}>{t('common.refresh')}</Button>
      </div>
    </div>
  );
}
