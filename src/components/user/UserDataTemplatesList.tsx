import React from 'react';

import { useI18n } from '../../app/i18n';
import type { VpsUserData } from '../../lib/api/vpsUserData';
import { formatErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { KeysetPagination } from '../ui/KeysetPagination';
import { StatusDot } from '../ui/StatusDot';
import { TableCard } from '../ui/TableCard';

import { safeUserDataId, safeUserDataString, userDataFormatLabelKey, userDataUpdatedTimestamp } from './UserDataTemplatesModel';

export function UserDataTemplatesList(props: {
  prefix: string;
  rows: VpsUserData[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  filtersActive: boolean;
  limit: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onLimitChange: (limit: number) => void;
  onCreate: () => void;
  onDeploy: (item: VpsUserData) => void;
  onEdit: (item: VpsUserData) => void;
  onDelete: (item: VpsUserData) => void;
}) {
  const { t } = useI18n();

  if (props.isLoading) {
    return (
      <div className="rounded-md border border-border bg-surface-2 p-4 text-sm text-muted" data-testid={`${props.prefix}.loading`}>
        {t('common.loading')}
      </div>
    );
  }

  if (props.isError) {
    return (
      <Alert variant="danger" title={t('user_data.error.load_failed')}>
        {formatErrorMessage(props.error)}
      </Alert>
    );
  }

  if (props.rows.length === 0) {
    return (
      <div
        className="rounded-md border border-border bg-surface-2 p-6 text-center"
        data-testid={`${props.prefix}.empty`}
      >
        <div className="text-sm font-semibold text-fg">
          {props.filtersActive ? t('empty.list.no_matches.title') : t('empty.list.empty.title')}
        </div>
        <div className="mt-1 text-sm text-muted">
          {props.filtersActive ? t('empty.list.no_matches.body') : t('user_data.empty.body')}
        </div>
        {!props.filtersActive ? (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={props.onCreate}>
              {t('user_data.action.create')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <TableCard
      testId={`${props.prefix}.table`}
      minWidth="md"
      footer={
        <KeysetPagination
          testId={`${props.prefix}.pagination`}
          limit={props.limit}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          onLimitChange={props.onLimitChange}
        />
      }
    >
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('user_data.fields.label')}</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('user_data.fields.format')}</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('user_data.fields.updated')}</th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((item) => {
          const id = safeUserDataId(item.id);
          const label = safeUserDataString(item.label) || `#${id}`;
          const format = safeUserDataString(item.format);
          const updatedAt = userDataUpdatedTimestamp(item);

          return (
            <tr key={id} data-testid={`${props.prefix}.row.${id}`}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{label}</span>
                  <span className="text-xs text-faint">#{id}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot variant="neutral" />
                  <Badge variant="neutral">{t(userDataFormatLabelKey(format))}</Badge>
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                {updatedAt ? <span className="text-xs text-muted">{formatDateTime(updatedAt)}</span> : <span className="text-faint">—</span>}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="inline-flex items-center gap-2" data-row-no-nav>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => props.onDeploy(item)}
                    testId={`${props.prefix}.row.${id}.deploy`}
                  >
                    {t('user_data.action.deploy')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => props.onEdit(item)}
                    testId={`${props.prefix}.row.${id}.edit`}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => props.onDelete(item)}
                    testId={`${props.prefix}.row.${id}.delete`}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableCard>
  );
}
