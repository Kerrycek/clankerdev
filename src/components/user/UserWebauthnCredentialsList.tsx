import React from 'react';

import { useI18n } from '../../app/i18n';

import type { UserWebauthnCredential } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';

import { webauthnCredentialBadge, webauthnCredentialLabel } from './UserWebauthnCredentialsModel';

export function UserWebauthnCredentialsList(props: {
  credentials: readonly UserWebauthnCredential[];
  testIdPrefix: string;
  onEdit: (credential: UserWebauthnCredential) => void;
  onDelete: (credentialId: number) => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {props.credentials.map((credential) => {
          const badge = webauthnCredentialBadge(credential);
          return (
            <div
              key={credential.id}
              data-testid={`${prefix}.webauthn.row.${credential.id}`}
              className="rounded-md border border-border bg-surface-2 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-fg">{webauthnCredentialLabel(credential)}</div>
                  <div className="mt-0.5 text-xs text-faint">#{credential.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badge.variant}>{t(`profile.mfa.webauthn.badge.${badge.label}`)}</Badge>
                </div>
              </div>

              <div className="mt-2 text-xs text-muted">
                <div>
                  {t('profile.mfa.webauthn.field.last_use')}: {credential.last_use_at ? formatDateTime(credential.last_use_at) : '—'}
                </div>
                <div>
                  {t('profile.mfa.webauthn.field.use_count')}:{' '}
                  {typeof credential.use_count === 'number' ? String(credential.use_count) : '—'}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => props.onEdit(credential)}
                  testId={`${prefix}.webauthn.row.${credential.id}.edit`}
                >
                  {t('common.edit')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => props.onDelete(credential.id)}
                  testId={`${prefix}.webauthn.row.${credential.id}.delete`}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <Table minWidth="md" testId={`${prefix}.webauthn.table`}>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2">{t('profile.mfa.webauthn.table.label')}</th>
              <th className="px-4 py-2">{t('profile.mfa.webauthn.table.status')}</th>
              <th className="px-4 py-2">{t('profile.mfa.webauthn.table.last_use')}</th>
              <th className="px-4 py-2">{t('profile.mfa.webauthn.table.use_count')}</th>
              <th className="px-4 py-2">{t('profile.mfa.webauthn.table.created')}</th>
              <th className="px-4 py-2 text-right">{t('profile.mfa.webauthn.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {props.credentials.map((credential) => {
              const badge = webauthnCredentialBadge(credential);
              return (
                <tr
                  key={credential.id}
                  className="border-b border-border/60 last:border-b-0"
                  data-testid={`${prefix}.webauthn.row.${credential.id}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-fg">{webauthnCredentialLabel(credential)}</div>
                    <div className="text-xs text-faint">#{credential.id}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={badge.variant}>{t(`profile.mfa.webauthn.badge.${badge.label}`)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted tabular-nums">
                    {credential.last_use_at ? formatDateTime(credential.last_use_at) : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted tabular-nums">
                    {typeof credential.use_count === 'number' ? String(credential.use_count) : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted tabular-nums">
                    {credential.created_at ? formatDateTime(credential.created_at) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => props.onEdit(credential)}
                        testId={`${prefix}.webauthn.row.${credential.id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => props.onDelete(credential.id)}
                        testId={`${prefix}.webauthn.row.${credential.id}.delete`}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </>
  );
}
