import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import {
  closeUserSession,
  fetchUserSessions,
  updateUserSessionLabel,
  type UserSession,
} from '../../lib/api/userDossier';

import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { useTierCIntervalMs } from '../../lib/refreshTiers';
import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

function isOpenSession(s: UserSession): boolean {
  return !s.closed_at;
}

function looksLikeIpSearch(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  // Quick heuristic: contain dot/colon and only [0-9a-fA-F:.]
  if (!s.includes('.') && !s.includes(':')) return false;
  return /^[0-9a-fA-F:.]+$/.test(s);
}

function sessionSearchHaystack(s: UserSession): string {
  const parts = [
    String(s.id ?? ''),
    String(s.label ?? ''),
    String(s.auth_type ?? ''),
    String(s.api_ip_addr ?? ''),
    String(s.api_ip_ptr ?? ''),
    String(s.client_ip_addr ?? ''),
    String(s.client_ip_ptr ?? ''),
    String(s.user_agent ?? ''),
    String(s.client_version ?? ''),
    String(s.scope ?? ''),
    String(s.token_fragment ?? ''),
    String(s.token_lifetime ?? ''),
    String(s.token_interval ?? ''),
    String((s.user as any)?.login ?? ''),
    String((s.admin as any)?.login ?? ''),
  ];

  return parts.join(' ').toLowerCase();
}

export function UserSessionsPanel(props: {
  /** Admin-only: show sessions for this user. */
  userId?: number;
  /** Test id prefix, e.g. "profile.sessions" or "admin.user.sessions" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sessionsState, setSessionsState] = useState<'open' | 'all' | 'closed'>(() => {
    const v = searchParams.get('state');
    if (v === 'all' || v === 'open' || v === 'closed') return v;
    return 'open';
  });
  const [sessionsSearch, setSessionsSearch] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (sessionsSearch.trim()) next.set('q', sessionsSearch.trim());
    else next.delete('q');

    if (sessionsState && sessionsState !== 'open') next.set('state', sessionsState);
    else next.delete('state');

    // NOTE: pagination params are managed by useKeysetPagination.

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, sessionsSearch, sessionsState, setSearchParams]);

  const searchTrim = sessionsSearch.trim();
  const ipSearch = looksLikeIpSearch(searchTrim) ? searchTrim : undefined;

  const pagination = useKeysetPagination({
    id: `${props.testIdPrefix}.pagination`,
    filterKey: JSON.stringify({ userId: props.userId ?? null, state: sessionsState, q: searchTrim }),
    searchParams,
    setSearchParams,
    defaultLimit: 25,
    allowedLimits: [25, 50, 100],
  });

  const interval = useTierCIntervalMs();

  const sessionsQ = useQuery({
    queryKey: [
      'user_sessions',
      {
        userId: props.userId ?? null,
        state: sessionsState,
        q: searchTrim,
        ip: ipSearch ?? null,
        fromId: pagination.fromId ?? null,
        limit: pagination.limit,
      },
    ],
    queryFn: async () => {
      const res = await fetchUserSessions({
        userId: props.userId,
        state: sessionsState,
        limit: pagination.limit,
        fromId: pagination.fromId,
        ip_addr: ipSearch,
      });
      return res.data;
    },
    refetchInterval: interval,
  });

  const pageCursor = useMemo(() => cursorFromDescendingPage(sessionsQ.data as any), [sessionsQ.data]);
  const hasMore = (sessionsQ.data ?? []).length >= pagination.limit;

  const sessions = useMemo(() => {
    const raw = sessionsQ.data ?? [];
    const byState =
      sessionsState === 'open'
        ? raw.filter((s) => isOpenSession(s))
        : sessionsState === 'closed'
          ? raw.filter((s) => !isOpenSession(s))
          : raw;

    if (!searchTrim) return byState;
    const needle = searchTrim.toLowerCase();
    return byState.filter((s) => sessionSearchHaystack(s).includes(needle));
  }, [searchTrim, sessionsQ.data, sessionsState]);

  // Rename / close state
  const [renamingSession, setRenamingSession] = useState<UserSession | null>(null);
  const [sessionLabel, setSessionLabel] = useState('');
  const [sessionLabelError, setSessionLabelError] = useState<string | null>(null);
  const [closeSessionId, setCloseSessionId] = useState<number | null>(null);

  const renameM = useMutation({
    mutationFn: async () => {
      if (!renamingSession) return;
      const label = sessionLabel.trim();
      if (!label) throw new Error(t('profile.sessions.validation.label_required'));
      await updateUserSessionLabel(renamingSession.id, label);
    },
    onSuccess: async () => {
      setRenamingSession(null);
      setSessionLabel('');
      setSessionLabelError(null);
      await qc.invalidateQueries({ queryKey: ['user_sessions'] });
    },
    onError: (e) => {
      setSessionLabelError(formatErrorMessage(e));
    },
  });

  const closeM = useMutation({
    mutationFn: async (id: number) => closeUserSession(id),
    onSuccess: async () => {
      setCloseSessionId(null);
      await qc.invalidateQueries({ queryKey: ['user_sessions'] });
    },
  });

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.card`}>
        <CardHeader
          title={t('profile.sessions.title')}
          subtitle={t('profile.sessions.subtitle')}
          actions={
            <Button
              variant="secondary"
              onClick={() => void sessionsQ.refetch()}
              disabled={sessionsQ.isFetching}
              testId={`${prefix}.refresh`}
            >
              {t('common.refresh')}
            </Button>
          }
        />

        <CardBody>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted">{t('profile.sessions.filter.state')}</div>
              <div className="mt-1">
                <Select
                  value={sessionsState}
                  onChange={(e) => setSessionsState(e.target.value as any)}
                  options={[
                    { value: 'open', label: t('profile.sessions.state.open') },
                    { value: 'all', label: t('profile.sessions.state.all') },
                    { value: 'closed', label: t('profile.sessions.state.closed') },
                  ]}
                  testId={`${prefix}.state`}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-muted">{t('profile.sessions.filter.search')}</div>
              <div className="mt-1">
                <Input
                  value={sessionsSearch}
                  onChange={(e) => setSessionsSearch(e.target.value)}
                  placeholder={t('profile.sessions.search.placeholder')}
                  testId={`${prefix}.search`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('profile.sessions.search.hint')}</div>
            </div>
          </div>

          {sessionsQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : sessionsQ.isError ? (
            <Alert variant="danger" title={t('profile.sessions.load_failed')}>
              {formatErrorMessage(sessionsQ.error)}
            </Alert>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.empty`}>
              {t('profile.sessions.empty')}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    data-testid={`${prefix}.row.${s.id}`}
                    className="rounded-md border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{s.label ?? `#${s.id}`}</div>
                        <div className="mt-0.5 text-xs text-faint">#{s.id}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.current ? <Badge variant="neutral">{t('profile.sessions.badge.current')}</Badge> : null}
                        {isOpenSession(s) ? (
                          <Badge variant="ok">{t('profile.sessions.state.open')}</Badge>
                        ) : (
                          <Badge variant="neutral">{t('profile.sessions.state.closed')}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-muted">
                      <div className="break-all">
                        {t('profile.sessions.row.ip', { ip: String(s.api_ip_addr ?? s.client_ip_addr ?? '—') })}
                      </div>
                      {s.last_request_at ? (
                        <div>{t('profile.sessions.row.last', { ts: formatDateTime(s.last_request_at) })}</div>
                      ) : null}
                      {s.auth_type || s.token_fragment ? (
                        <div className="mt-1 text-faint">
                          {s.auth_type ? <span>{String(s.auth_type)}</span> : null}
                          {s.auth_type && s.token_fragment ? <span className="mx-2">•</span> : null}
                          {s.token_fragment ? <span className="font-mono">{String(s.token_fragment)}…</span> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRenamingSession(s);
                          setSessionLabel(String(s.label ?? ''));
                          setSessionLabelError(null);
                        }}
                        testId={`${prefix}.row.${s.id}.rename`}
                      >
                        {t('profile.sessions.action.rename')}
                      </Button>

                      {isOpenSession(s) ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setCloseSessionId(s.id)}
                          testId={`${prefix}.row.${s.id}.close`}
                        >
                          {t('profile.sessions.action.close')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
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
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-border/60 last:border-b-0"
                        data-testid={`${prefix}.row.${s.id}`}
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium text-fg">{s.label ?? `#${s.id}`}</div>
                          <div className="text-xs text-faint">#{s.id}</div>
                          <div className="mt-1 text-xs text-muted">
                            {s.user_agent ? <span className="break-all">{s.user_agent}</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-faint">
                            {s.auth_type ? <span>{String(s.auth_type)}</span> : null}
                            {s.auth_type && s.token_fragment ? <span className="mx-2">•</span> : null}
                            {s.token_fragment ? <span className="font-mono">{String(s.token_fragment)}…</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {s.current ? <Badge variant="neutral">{t('profile.sessions.badge.current')}</Badge> : null}
                            {isOpenSession(s) ? (
                              <Badge variant="ok">{t('profile.sessions.state.open')}</Badge>
                            ) : (
                              <Badge variant="neutral">{t('profile.sessions.state.closed')}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">
                          <span className="break-all tabular-nums">{String(s.api_ip_addr ?? s.client_ip_addr ?? '—')}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">
                          {s.last_request_at ? formatDateTime(s.last_request_at) : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted tabular-nums">
                          {s.created_at ? formatDateTime(s.created_at) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setRenamingSession(s);
                                setSessionLabel(String(s.label ?? ''));
                                setSessionLabelError(null);
                              }}
                              testId={`${prefix}.row.${s.id}.rename`}
                            >
                              {t('profile.sessions.action.rename')}
                            </Button>

                            {isOpenSession(s) ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setCloseSessionId(s.id)}
                                testId={`${prefix}.row.${s.id}.close`}
                              >
                                {t('profile.sessions.action.close')}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>

        <KeysetPagination
          page={pagination.page}
          pageCount={pagination.stack.length}
          canPrev={pagination.canPrev}
          canNext={pagination.hasForward || (hasMore && pageCursor !== null)}
          onPrev={pagination.goPrev}
          onNext={() => pagination.goNext(pageCursor)}
          onGoToPage={pagination.goToPage}
          limit={pagination.limit}
          allowedLimits={pagination.allowedLimits}
          onLimitChange={pagination.setLimit}
          testId={`${prefix}.pagination`}
        />
      </Card>

      <Modal
        open={renamingSession !== null}
        onClose={() => {
          if (renameM.isPending) return;
          setRenamingSession(null);
          setSessionLabel('');
          setSessionLabelError(null);
        }}
        title={t('profile.sessions.rename.title')}
        testId={`${prefix}.rename_modal`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (renameM.isPending) return;
                setRenamingSession(null);
                setSessionLabel('');
                setSessionLabelError(null);
              }}
              testId={`${prefix}.rename_modal.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => renameM.mutate()}
              loading={renameM.isPending}
              testId={`${prefix}.rename_modal.save`}
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {sessionLabelError ? (
          <Alert variant="danger" title={t('profile.sessions.rename.failed')}>
            {sessionLabelError}
          </Alert>
        ) : null}

        <div className={sessionLabelError ? 'mt-4 space-y-3' : 'space-y-3'}>
          <div>
            <div className="text-sm font-medium">{t('profile.sessions.rename.field')}</div>
            <div className="mt-1">
              <Input
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                placeholder={t('profile.sessions.rename.placeholder')}
                testId={`${prefix}.rename_modal.label`}
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={closeSessionId !== null}
        onCancel={() => {
          if (closeM.isPending) return;
          setCloseSessionId(null);
        }}
        title={t('profile.sessions.close.title')}
        description={t('profile.sessions.close.description')}
        confirmLabel={t('profile.sessions.action.close')}
        danger
        confirmLoading={closeM.isPending}
        onConfirm={() => {
          if (!closeSessionId) return;
          closeM.mutate(closeSessionId);
        }}
        testId={`${prefix}.close_dialog`}
      />
    </>
  );
}
