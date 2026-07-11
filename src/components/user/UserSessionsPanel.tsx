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
import { formatErrorMessage } from '../../lib/errors';

import {
  buildUserSessionSummary,
  filterUserSessions,
  isUserSessionStateFilter,
  looksLikeSessionIpSearch,
  type UserSessionStateFilter,
} from './UserSessionsModel';
import { UserSessionCloseDialog, UserSessionRenameDialog } from './UserSessionsDialogs';
import { UserSessionsList } from './UserSessionsList';
import { UserSecurityMetricGrid } from './UserSecurityMetricGrid';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';

export function UserSessionsPanel(props: {
  /** Admin-only: show sessions for this user. */
  userId?: number;
  /** Test id prefix, e.g. "profile.sessions" or "admin.user.sessions" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sessionsState, setSessionsState] = useState<UserSessionStateFilter>(() => {
    const value = searchParams.get('state');
    return isUserSessionStateFilter(value) ? value : 'open';
  });
  const [sessionsSearch, setSessionsSearch] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (sessionsSearch.trim()) next.set('q', sessionsSearch.trim());
    else next.delete('q');

    if (sessionsState && sessionsState !== 'open') next.set('state', sessionsState);
    else next.delete('state');

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, sessionsSearch, sessionsState, setSearchParams]);

  const searchTrim = sessionsSearch.trim();
  const ipSearch = looksLikeSessionIpSearch(searchTrim) ? searchTrim : undefined;

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

  const pageCursor = useMemo(() => cursorFromDescendingPage(sessionsQ.data, (session) => session.id), [sessionsQ.data]);
  const hasMore = (sessionsQ.data ?? []).length >= pagination.limit;
  const sessions = useMemo(
    () => filterUserSessions(sessionsQ.data, sessionsState, searchTrim),
    [searchTrim, sessionsQ.data, sessionsState]
  );
  const sessionSummary = useMemo(() => buildUserSessionSummary(sessionsQ.data), [sessionsQ.data]);
  const hasFilters = Boolean(searchTrim) || sessionsState !== 'open';

  const [renamingSession, setRenamingSession] = useState<UserSession | null>(null);
  const [sessionLabel, setSessionLabel] = useState('');
  const [sessionLabelError, setSessionLabelError] = useState<string | null>(null);
  const [closeSession, setCloseSession] = useState<UserSession | null>(null);

  const renameM = useMutation({
    mutationFn: async () => {
      if (!renamingSession) return;
      const label = sessionLabel.trim();
      if (!label) throw new Error(t('profile.sessions.validation.label_required'));
      await updateUserSessionLabel(renamingSession.id, label);
    },
    onSuccess: async () => {
      closeRenameDialog();
      await qc.invalidateQueries({ queryKey: ['user_sessions'] });
    },
    onError: (e) => {
      setSessionLabelError(formatErrorMessage(e));
    },
  });

  const closeM = useMutation({
    mutationFn: async (id: number) => closeUserSession(id),
    onSuccess: async () => {
      setCloseSession(null);
      await qc.invalidateQueries({ queryKey: ['user_sessions'] });
    },
  });

  function startRename(session: UserSession) {
    setRenamingSession(session);
    setSessionLabel(String(session.label ?? ''));
    setSessionLabelError(null);
  }

  function closeRenameDialog() {
    setRenamingSession(null);
    setSessionLabel('');
    setSessionLabelError(null);
  }

  function clearFilters() {
    setSessionsSearch('');
    setSessionsState('open');
  }

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
          <SessionsFilters
            state={sessionsState}
            search={sessionsSearch}
            testIdPrefix={prefix}
            onStateChange={setSessionsState}
            onSearchChange={setSessionsSearch}
          />

          <UserSecurityMetricGrid
            testId={`${prefix}.summary`}
            items={[
              { key: 'open', label: t('profile.sessions.summary.open'), value: sessionSummary.open },
              { key: 'current', label: t('profile.sessions.summary.current'), value: sessionSummary.current },
              { key: 'token', label: t('profile.sessions.summary.tokens'), value: sessionSummary.token },
              { key: 'closed', label: t('profile.sessions.summary.closed'), value: sessionSummary.closed },
            ]}
          />

          {sessionsQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : sessionsQ.isError ? (
            <Alert variant="danger" title={t('profile.sessions.load_failed')}>
              {formatErrorMessage(sessionsQ.error)}
            </Alert>
          ) : sessions.length === 0 ? (
            <SessionsEmptyState hasFilters={hasFilters} testIdPrefix={prefix} onClearFilters={clearFilters} />
          ) : (
            <UserSessionsList sessions={sessions} testIdPrefix={prefix} onRename={startRename} onClose={setCloseSession} />
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

      <UserSessionRenameDialog
        open={renamingSession !== null}
        label={sessionLabel}
        error={sessionLabelError}
        saving={renameM.isPending}
        testIdPrefix={prefix}
        onLabelChange={setSessionLabel}
        onCancel={() => {
          if (renameM.isPending) return;
          closeRenameDialog();
        }}
        onSave={() => renameM.mutate()}
      />

      <UserSessionCloseDialog
        session={closeSession}
        closing={closeM.isPending}
        testIdPrefix={prefix}
        onCancel={() => {
          if (closeM.isPending) return;
          setCloseSession(null);
        }}
        onConfirm={() => {
          if (!closeSession) return;
          closeM.mutate(closeSession.id);
        }}
      />
    </>
  );
}

function SessionsFilters(props: {
  state: UserSessionStateFilter;
  search: string;
  testIdPrefix: string;
  onStateChange: (state: UserSessionStateFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <div className="text-xs font-medium text-muted">{t('profile.sessions.filter.state')}</div>
        <div className="mt-1">
          <Select
            value={props.state}
            onChange={(e) => {
              const value = e.target.value;
              if (isUserSessionStateFilter(value)) props.onStateChange(value);
            }}
            options={[
              { value: 'open', label: t('profile.sessions.state.open') },
              { value: 'all', label: t('profile.sessions.state.all') },
              { value: 'closed', label: t('profile.sessions.state.closed') },
            ]}
            testId={`${props.testIdPrefix}.state`}
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <div className="text-xs font-medium text-muted">{t('profile.sessions.filter.search')}</div>
        <div className="mt-1">
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder={t('profile.sessions.search.placeholder')}
            testId={`${props.testIdPrefix}.search`}
          />
        </div>
        <div className="mt-1 text-xs text-faint">{t('profile.sessions.search.hint')}</div>
      </div>
    </div>
  );
}

function SessionsEmptyState(props: {
  hasFilters: boolean;
  testIdPrefix: string;
  onClearFilters: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="py-8 text-center text-sm text-muted" data-testid={`${props.testIdPrefix}.empty`}>
      <div>{props.hasFilters ? t('profile.sessions.empty_filtered') : t('profile.sessions.empty')}</div>
      {props.hasFilters ? (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={props.onClearFilters} testId={`${props.testIdPrefix}.clear_filters`}>
            {t('common.clear_filters')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
