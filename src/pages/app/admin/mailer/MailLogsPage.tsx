import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { FilterBar } from '../../../../components/layout/FilterBar';
import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';

import { fetchMailLogs, type MailLog } from '../../../../lib/api/mailer';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromAscendingPage } from '../../../../lib/lockIndex';
import { resourceId, refLabel } from '../../../../lib/resources';
import { parseNumericToken, splitKeyValueToken, unquoteSmartValue } from '../../../../lib/smartFilter';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';
import { TableRowLink } from '../../../../components/ui/TableRowLink';

import { MailerTabs } from './MailerTabs';
import { MailLogsRouteGuard } from './MailLogsRouteGuard';

export function MailLogsPage() {
  return (
    <MailLogsRouteGuard>
      <MailLogsPageContent />
    </MailLogsRouteGuard>
  );
}

function MailLogsPageContent() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);

  const pagination = useKeysetPagination({
    id: 'admin.mailer.log.list',
    filterKey: 'all',
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: [
      'mailer',
      'mail_logs',
      'index',
      {
        limit: pagination.limit + 1,
        fromId: pagination.fromId,
      },
    ],
    queryFn: async () =>
      (
        await fetchMailLogs({
          limit: pagination.limit + 1,
          fromId: pagination.fromId,
        })
      ).data,
    staleTime: 10_000,
  });

  const fetchedRows: MailLog[] = listQ.data ?? [];
  const rows = fetchedRows.slice(0, pagination.limit);
  const pageCursor = useMemo(() => cursorFromAscendingPage(rows), [rows]);
  const hasMore = fetchedRows.length > pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  function applySmartText(raw: string) {
    const input = raw.trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const keyValue = splitKeyValueToken(input);
    const key = keyValue?.rawKey.trim().toLowerCase();
    const value = keyValue ? unquoteSmartValue(keyValue.rawValue) : input;
    const supportedKey = !keyValue || key === 'id' || key === '#' || key === 'log';
    const id = supportedKey ? parseNumericToken(value) : null;

    if (id !== null) {
      setSmart('');
      setSmartErrors([]);
      navigate(`${basePath}/mailer/log/${id}`);
      return;
    }

    const error = t('mailer.log.smart.error.id_numeric_only', { value: input });
    setSmartErrors([error]);
    toasts.pushToast({ variant: 'danger', title: error });
  }

  const smartSuggestions = useMemo((): SmartFilterSuggestion[] => {
    const needle = smartNeedle;
    if (!needle) return [];

    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('filters.help.title'),
          secondary: t('filters.help.open'),
          onPick: () => setHelpOpen(true),
        },
      ];
    }

    const keyValue = splitKeyValueToken(needle);
    const key = keyValue?.rawKey.trim().toLowerCase();
    const value = keyValue ? unquoteSmartValue(keyValue.rawValue) : needle;
    if (keyValue && key !== 'id' && key !== '#' && key !== 'log') return [];

    const numeric = parseNumericToken(value);
    if (numeric === null) return [];

    const id = String(numeric);
    return [{
      id: `open:${id}`,
      primary: t('mailer.log.smart.suggest.open', { id }),
      secondary: t('mailer.log.smart.suggest.open.secondary'),
      onPick: () => {
        setSmart('');
        setSmartErrors([]);
        navigate(`${basePath}/mailer/log/${numeric}`);
      },
    }];
  }, [basePath, navigate, smartNeedle, t]);

  const smartErrorChips = smartErrors.map((error, index) => (
    <FilterChip
      key={`error.${index}`}
      label={error}
      tone="danger"
      onRemove={() => setSmartErrors([])}
      testId={`admin.mailer.log.chip.error.${index}`}
    />
  ));

  return (
    <ListShell
      testId="admin.mailer.log.page"
      header={
        <div className="space-y-3">
          <PageHeader
            title={t('mailer.log.list.title')}
            description={t('mailer.log.list.description')}
            testId="admin.mailer.log.header"
          />
          <MailerTabs />
        </div>
      }
      filters={
        <>
          <FilterBar testId="admin.mailer.log.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('mailer.log.list.search.placeholder')}
                ariaLabel={t('mailer.log.list.search.placeholder')}
                testId="admin.mailer.log.smart_filter.input"
                suggestions={smartSuggestions}
                onSubmit={() => void applySmartText(smart)}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => setHelpOpen(true)}
                    aria-label={t('filters.help.open')}
                    title={t('filters.help.open')}
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />

              {smartErrorChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.mailer.log.active_filters">
                  {smartErrorChips}
                </div>
              ) : null}
            </div>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={typeof window !== 'undefined' ? window.location.href : ''}
              testId="admin.mailer.log.copy_link"
            />

            <Button
              variant="secondary"
              size="sm"
              onClick={() => void listQ.refetch()}
              disabled={listQ.isFetching}
              testId="admin.mailer.log.refresh"
            >
              {t('common.refresh')}
            </Button>
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              if (smartNeedle === '?') setSmart('');
            }}
            title={t('filters.help.title')}
            intro={t('mailer.log.smart_help.intro')}
            examples={[
              { example: '?', description: t('mailer.log.smart_help.examples.help') },
              { example: '123', description: t('mailer.log.smart_help.examples.open_id') },
              { example: 'id:123', description: t('mailer.log.smart_help.examples.open_id') },
            ]}
            topKeys={[
              { key: 'id', description: t('mailer.log.smart_help.keys.id'), example: 'id:123' },
            ]}
            inference={[t('mailer.log.smart_help.inference.enter')]}
            onInsertKey={(key) => {
              setSmart(`${key}:`);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 50);
            }}
            testId="admin.mailer.log.smart_help"
            keyRowTestIdPrefix="admin.mailer.log.smart_help.key"
          />
        </>
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="admin.mailer.log.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.mailer.log.error"
          title={t('mailer.log.list.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'admin.mailer.log' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="admin.mailer.log.empty"
          title={t('mailer.log.list.empty')}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((m) => {
              const userId = resourceId((m as any).user);
              const userLabelText = refLabel((m as any).user) ?? (userId ? `#${userId}` : t('common.na'));
              const template = (m as any).mail_template;
              const tplLabel = template ? refLabel(template) : undefined;

              const txId = resourceId((m as any).mail_transaction);

              return (
                <Card key={m.id} testId={`admin.mailer.log.card.${m.id}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          className="block truncate text-base font-semibold text-accent hover:underline"
                          to={`${basePath}/mailer/log/${m.id}`}
                        >
                          {String((m as any).subject ?? t('mailer.log.row.no_subject'))}
                        </Link>
                        <div className="mt-0.5 text-xs text-faint">#{m.id}</div>
                      </div>
                      <Badge variant="neutral">{formatDateTime((m as any).created_at)}</Badge>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-muted">
                      <div>
                        <span className="text-faint">{t('common.user')}:</span>{' '}
                        {userId ? (
                          <Link className="text-accent hover:underline" to={`${basePath}/users/${userId}`}>
                            {userLabelText}
                          </Link>
                        ) : (
                          <span>{userLabelText}</span>
                        )}
                      </div>
                      {tplLabel ? (
                        <div>
                          <span className="text-faint">{t('mailer.log.row.template')}:</span> {tplLabel}
                        </div>
                      ) : null}
                      {(m as any).to ? (
                        <div className="truncate" title={String((m as any).to)}>
                          <span className="text-faint">{t('mailer.log.row.to')}:</span> {String((m as any).to)}
                        </div>
                      ) : null}
                      {(m as any).message_id ? (
                        <div className="truncate" title={String((m as any).message_id)}>
                          <span className="text-faint">{t('mailer.log.row.message_id')}:</span>{' '}
                          {String((m as any).message_id)}
                        </div>
                      ) : null}
                      {txId ? (
                        <div>
                          <span className="text-faint">{t('mailer.log.row.transaction')}:</span>{' '}
                          <Link className="text-accent hover:underline" to={`${basePath}/transactions/items/${txId}`}>
                            #{txId}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {canPaginate ? (
            <Card className="md:hidden">
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="admin.mailer.log.pagination.mobile"
              />
            </Card>
          ) : null}

          {/* Desktop: table */}
          <TableCard
            className="hidden md:block"
            minWidth="lg"
            tableTestId="admin.mailer.log.table"
            footer={
              canPaginate ? (
                <KeysetPagination
                  page={pagination.page}
                  pageCount={pagination.stack.length}
                  canPrev={pagination.canPrev}
                  canNext={canNext}
                  onPrev={pagination.goPrev}
                  onNext={() => pagination.goNext(pageCursor)}
                  onGoToPage={pagination.goToPage}
                  limit={pagination.limit}
                  allowedLimits={pagination.allowedLimits}
                  onLimitChange={pagination.setLimit}
                  testId="admin.mailer.log.pagination.desktop"
                />
              ) : null
            }
          >
            <thead>
              <tr>
                <th className="w-20">{t('common.id')}</th>
                <th>{t('mailer.log.row.subject')}</th>
                <th className="w-56">{t('common.user')}</th>
                <th className="w-56">{t('mailer.log.row.to')}</th>
                <th className="w-56">{t('mailer.log.row.template')}</th>
                <th className="w-48">{t('mailer.log.row.message_id')}</th>
                <th className="w-48">{t('mailer.log.row.transaction')}</th>
                <th className="w-44">{t('common.created')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const userId = resourceId((m as any).user);
                const userText = refLabel((m as any).user) ?? (userId ? `#${userId}` : t('common.na'));
                const template = (m as any).mail_template;
                const tplText = template ? refLabel(template) : t('common.na');
                const txId = resourceId((m as any).mail_transaction);

                return (
                  <TableRowLink
                    key={m.id}
                    to={`${basePath}/mailer/log/${m.id}`}
                    testId={`admin.mailer.log.row.${m.id}`}
                    className="hover:bg-surface-2"
                  >
                    <td className="tabular-nums">#{m.id}</td>
                    <td className="min-w-0">
                      <div className="truncate font-medium">{String((m as any).subject ?? t('mailer.log.row.no_subject'))}</div>
                    </td>
                    <td className="min-w-0">
                      {userId ? (
                        <Link className="truncate text-link hover:underline" to={`${basePath}/users/${userId}`}>
                          {userText}
                        </Link>
                      ) : (
                        <span className="truncate">{userText}</span>
                      )}
                    </td>
                    <td className="min-w-0">
                      <div className="truncate" title={String((m as any).to ?? '')}>
                        {String((m as any).to ?? '—')}
                      </div>
                    </td>
                    <td className="min-w-0">
                      <div className="truncate">{tplText}</div>
                    </td>
                    <td className="min-w-0">
                      <div className="truncate" title={String((m as any).message_id ?? '')}>
                        {String((m as any).message_id ?? '—')}
                      </div>
                    </td>
                    <td className="tabular-nums">
                      {txId ? (
                        <Link className="text-link hover:underline" to={`${basePath}/transactions/items/${txId}`}>
                          #{txId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime((m as any).created_at)}</td>
                  </TableRowLink>
                );
              })}
            </tbody>
          </TableCard>
        </>
      )}
    </ListShell>
  );
}
