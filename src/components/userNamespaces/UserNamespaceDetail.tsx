import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import { Alert } from '../ui/Alert';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ChipLink } from '../ui/ChipLink';
import { Spinner } from '../ui/Spinner';

import { fetchUserNamespace, type UserNamespace } from '../../lib/api/userNamespaces';

function field(label: string, value: React.ReactNode) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      <div className="text-sm text-faint">{label}</div>
      <div className="col-span-2 text-sm text-fg">{value ?? '—'}</div>
    </div>
  );
}

export function UserNamespaceDetail(props: {
  id: number;
  mapsUrl: string;
  testIdPrefix: string;
}) {
  const { t } = useI18n();

  const q = useQuery({
    queryKey: ['user_namespace', props.id],
    queryFn: async () => (await fetchUserNamespace(props.id)).data,
    enabled: Number.isFinite(props.id) && props.id > 0,
  });

  const ns: UserNamespace | null = q.data ?? null;

  return (
    <div className="space-y-4" data-testid={`${props.testIdPrefix}.panel`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-document-title-root data-document-title-kind="object">
          <div className="text-lg font-semibold text-fg" data-testid={`${props.testIdPrefix}.title`} data-document-title-heading>
            {t('userns.namespace.title')} #{props.id}
          </div>
          <div className="text-sm text-muted" data-testid={`${props.testIdPrefix}.subtitle`}>
            {t('userns.namespace.subtitle')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChipLink to={props.mapsUrl} title={t('userns.namespace.view_maps_title')}>
            {t('userns.namespace.view_maps')}
          </ChipLink>
        </div>
      </div>

      <Card testId={`${props.testIdPrefix}.card`}>
        <CardHeader title={t('userns.namespace.info.title')} />
        <CardBody>
          {q.isLoading ? (
            <Spinner label={t('common.loading')} />
          ) : q.isError ? (
            <Alert title={t('userns.namespace.load_error')} variant="danger">
              {String((q.error as LegacyAny)?.message ?? q.error)}
            </Alert>
          ) : !ns ? (
            <Alert title={t('userns.namespace.not_found')} variant="danger">
              {t('error.not_found.body')}
            </Alert>
          ) : (
            <>
              {field(t('common.id'), <span className="font-medium">#{ns.id}</span>)}
              {field(t('userns.namespace.size'), typeof ns.size === 'number' ? ns.size : '—')}

              {(ns as LegacyAny).user ? field(t('common.user'), <span className="font-medium">{String((ns as LegacyAny).user?.login ?? (ns as LegacyAny).user?.id)}</span>) : null}
              {(ns as LegacyAny).offset !== undefined ? field(t('userns.namespace.offset'), String((ns as LegacyAny).offset)) : null}
              {(ns as LegacyAny).block_count !== undefined ? field(t('userns.namespace.blocks'), String((ns as LegacyAny).block_count)) : null}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
