import React from 'react';

import { useI18n } from '../../app/i18n';
import type { UserSession } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';

import { formatUserSessionPrimaryIp, isOpenUserSession, userSessionDisplayLabel } from './UserSessionsModel';

export function UserSessionsList(props: {
  sessions: readonly UserSession[];
  testIdPrefix: string;
  onRename: (session: UserSession) => void;
  onClose: (session: UserSession) => void;
}) {
  const { t } = useI18n();
  const prefix = props.testIdPrefix;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {props.sessions.map((session) => (
          <div
            key={session.id}
            data-testid={`${prefix}.row.${session.id}`}
            className="rounded-md border border-border bg-surface-2 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-fg">{userSessionDisplayLabel(session)}</div>
                <div className="mt-0.5 text-xs text-faint">#{session.id}</div>
              </div>
              <SessionStateBadges session={session} />
            </div>

            <SessionMetaBlock session={session} />

            <SessionRowActions
              session={session}
              testIdPrefix={prefix}
              onRename={props.onRename}
              onClose={props.onClose}
            />
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table minWidth="lg" testId={`${prefix}.table`}>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2">{t('profile.sessions.table.label')}</th>
              <th className="px-4 py-2">{t('profile.sessions.table.state')}</th>
              <th className="px-4 py-2">{t('profile.sessions.table.ip')}</th>
              <th className="px-4 py-2">{t('profile.sessions.table.last_request')}</th>
              <th className="px-4 py-2">{t('profile.sessions.table.created')}</th>
              <th className="px-4 py-2 text-right">{t('profile.sessions.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {props.sessions.map((session) => (
              <tr
                key={session.id}
                className="border-b border-border/60 last:border-b-0"
                data-testid={`${prefix}.row.${session.id}`}
              >
                <td className="px-4 py-2">
                  <div className="font-medium text-fg">{userSessionDisplayLabel(session)}</div>
                  <div className="text-xs text-faint">#{session.id}</div>
                  {session.user_agent ? (
                    <div className="mt-1 text-xs text-muted">
                      <span className="break-all">{session.user_agent}</span>
                    </div>
                  ) : null}
                  <SessionAuthInline session={session} />
                </td>
                <td className="px-4 py-2">
                  <SessionStateBadges session={session} />
                </td>
                <td className="px-4 py-2 text-xs text-muted">
                  <span className="break-all tabular-nums">{formatUserSessionPrimaryIp(session)}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted tabular-nums">
                  {session.last_request_at ? formatDateTime(session.last_request_at) : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-muted tabular-nums">
                  {session.created_at ? formatDateTime(session.created_at) : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <SessionRowActions
                    session={session}
                    testIdPrefix={prefix}
                    align="right"
                    onRename={props.onRename}
                    onClose={props.onClose}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function SessionStateBadges(props: { session: UserSession }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.session.current ? <Badge variant="neutral">{t('profile.sessions.badge.current')}</Badge> : null}
      {isOpenUserSession(props.session) ? (
        <Badge variant="ok">{t('profile.sessions.state.open')}</Badge>
      ) : (
        <Badge variant="neutral">{t('profile.sessions.state.closed')}</Badge>
      )}
    </div>
  );
}

function SessionAuthInline(props: { session: UserSession }) {
  const authType = props.session.auth_type;
  const tokenFragment = props.session.token_fragment;
  if (!authType && !tokenFragment) return null;

  return (
    <div className="mt-1 text-xs text-faint">
      {authType ? <span>{authType}</span> : null}
      {authType && tokenFragment ? <span className="mx-2">•</span> : null}
      {tokenFragment ? <span className="font-mono">{tokenFragment}…</span> : null}
    </div>
  );
}

function SessionMetaBlock(props: { session: UserSession }) {
  const { t } = useI18n();

  return (
    <div className="mt-2 text-xs text-muted">
      <div className="break-all">
        {t('profile.sessions.row.ip', { ip: formatUserSessionPrimaryIp(props.session) })}
      </div>
      {props.session.last_request_at ? (
        <div>{t('profile.sessions.row.last', { ts: formatDateTime(props.session.last_request_at) })}</div>
      ) : null}
      <SessionAuthInline session={props.session} />
    </div>
  );
}

function SessionRowActions(props: {
  session: UserSession;
  testIdPrefix: string;
  align?: 'left' | 'right';
  onRename: (session: UserSession) => void;
  onClose: (session: UserSession) => void;
}) {
  const { t } = useI18n();
  const className = props.align === 'right' ? 'flex justify-end gap-2' : 'mt-3 flex flex-wrap items-center gap-2';

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => props.onRename(props.session)}
        testId={`${props.testIdPrefix}.row.${props.session.id}.rename`}
      >
        {t('profile.sessions.action.rename')}
      </Button>

      {isOpenUserSession(props.session) ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => props.onClose(props.session)}
          testId={`${props.testIdPrefix}.row.${props.session.id}.close`}
        >
          {t('profile.sessions.action.close')}
        </Button>
      ) : null}
    </div>
  );
}
