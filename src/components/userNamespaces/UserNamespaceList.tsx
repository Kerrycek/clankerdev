import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../app/i18n';

import { FilterBar } from '../layout/FilterBar';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CopyButton } from '../ui/CopyButton';
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/EmptyState';
import { FilterChip } from '../ui/FilterChip';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { SmartFilterInput, type SmartFilterSuggestion } from '../ui/SmartFilterInput';
import { SmartInputHelp } from '../ui/SmartInputHelp';
import { TableCard } from '../ui/TableCard';
import { TableRowLink } from '../ui/TableRowLink';

import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';

import { fetchUserNamespaces, type UserNamespace } from '../../lib/api/userNamespaces';

function parseIntParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.floor(n);
}

function userLabel(u: any): string {
  if (!u) return '—';
  return String(u.login ?? u.label ?? u.id ?? '—');
}

export function UserNamespaceList(props: {
  testIdPrefix: string;
  /** Detail route base, e.g. /app/profile/user-namespaces/namespaces */
  namespaceBase: string;
  /** Maps list base, e.g. /app/profile/user-namespaces/maps */
  mapsBase: string;
  /** If set, list is restricted to this user (profile view). */
  fixedUserId?: number;
  /** Show admin-only filters and columns. */
  showAdminFields?: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [sp, setSp] = useSearchParams();

  const q = (sp.get('q') ?? '').trim();
  const size = parseIntParam(sp.get('size'));
  const userId = props.fixedUserId ?? parseIntParam(sp.get('user'));
  const blockCount = parseIntParam(sp.get('block_count'));

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const filterKey = useMemo(() => {
    return JSON.stringify({ q, size, userId: props.fixedUserId ? props.fixedUserId : userId, blockCount, admin: props.showAdminFields ? 1 : 0 });
  }, [blockCount, q, size, userId, props.fixedUserId, props.showAdminFields]);

  const pagination = useKeysetPagination({
    id: `${props.testIdPrefix}.list`,
    filterKey,
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
  });

  const qList = useQuery({
    queryKey: ['user_namespace', 'list', { cursor: pagination.cursor, limit: pagination.limit, q, size, userId, blockCount, fixed: props.fixedUserId }],
    queryFn: async () =>
      (await fetchUserNamespaces({
        limit: pagination.limit,
        fromId: pagination.cursor,
        q: q || undefined,
        size,
        userId,
        blockCount,
      })).data,
    refetchOnWindowFocus: false,
  });

  const rows: UserNamespace[] = qList.data ?? [];
  const pageCursor = cursorFromDescendingPage(rows);
  const canNext = rows.length >= pagination.limit && pageCursor !== null;

  const filtersActive = Boolean(q || size !== undefined || (props.showAdminFields && !props.fixedUserId && (userId !== undefined || blockCount !== undefined)) || smartErrors.length > 0);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  function focusSmartInput() {
    window.requestAnimationFrame(() => smartInputRef.current?.focus());
  }

  function insertSmartKey(key: string) {
    setSmart((prev) => {
      const trim = prev.trim();
      return trim ? `${trim} ${key}:` : `${key}:`;
    });
    focusSmartInput();
  }

  function clearFilters() {
    const next = new URLSearchParams(sp);
    next.delete('q');
    next.delete('size');
    next.delete('block_count');
    if (!props.fixedUserId) next.delete('user');
    setSp(next, { replace: true });
    setSmart('');
    setSmartErrors([]);
  }

  function setFilters(nextVals: { q?: string; size?: number | undefined; userId?: number | undefined; blockCount?: number | undefined }) {
    const next = new URLSearchParams(sp);
    if (nextVals.q && nextVals.q.trim()) next.set('q', nextVals.q.trim());
    else next.delete('q');
    if (typeof nextVals.size === 'number') next.set('size', String(nextVals.size));
    else next.delete('size');
    if (!props.fixedUserId) {
      if (typeof nextVals.userId === 'number') next.set('user', String(nextVals.userId));
      else next.delete('user');
    }
    if (typeof nextVals.blockCount === 'number') next.set('block_count', String(nextVals.blockCount));
    else next.delete('block_count');
    setSp(next, { replace: true });
  }

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? smart).trim();
    if (!raw) return;
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(raw);
    let nextQ = q;
    let nextSize = size;
    let nextUserId = userId;
    let nextBlockCount = blockCount;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        const n = parseNumericToken(token);
        if (n !== null) {
          navigate(`${props.namespaceBase}/${n}`);
          setSmart('');
          setSmartErrors([]);
          return;
        }
        errors.push(t('filters.smart.error.numeric_only', { key: 'id', value: token }));
        continue;
      }

      const key = kv.rawKey.trim().toLowerCase();
      const value = unquoteSmartValue(kv.rawValue).trim();
      if (!value) {
        errors.push(t('filters.smart.error.missing_value', { key }));
        continue;
      }

      switch (key) {
        case 'id': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else {
            navigate(`${props.namespaceBase}/${n}`);
            setSmart('');
            setSmartErrors([]);
            return;
          }
          break;
        }
        case 'q':
        case 'search': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextQ = String(n);
          break;
        }
        case 'size': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextSize = n;
          break;
        }
        case 'blocks':
        case 'block_count': {
          if (!(props.showAdminFields && !props.fixedUserId)) {
            errors.push(t('filters.smart.error.admin_only', { key }));
            break;
          }
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextBlockCount = n;
          break;
        }
        case 'user': {
          if (!(props.showAdminFields && !props.fixedUserId)) {
            errors.push(t('filters.smart.error.admin_only', { key }));
            break;
          }
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextUserId = n;
          break;
        }
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
      }
    }

    setSmartErrors(errors);
    if (errors.length > 0) return;
    setFilters({ q: nextQ, size: nextSize, userId: nextUserId, blockCount: nextBlockCount });
    setSmart('');
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [{
        id: 'help',
        primary: t('filters.help.title'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => {
          setHelpOpen(true);
          setSmart('');
        },
      }];
    }

    const n = parseNumericToken(needle);
    if (n !== null) {
      return [{
        id: `open-${n}`,
        primary: t('userns.namespace.smart.suggestion.open', { id: n }),
        secondary: t('userns.namespace.smart.suggestion.open_hint'),
        onPick: () => {
          navigate(`${props.namespaceBase}/${n}`);
          setSmart('');
          setSmartErrors([]);
        },
      }];
    }

    if (needle.includes(':')) {
      return [{
        id: 'apply',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => applySmart(needle),
      }];
    }

    return [{
      id: 'help-text',
      primary: t('userns.namespace.smart.suggestion.help_title'),
      secondary: t('userns.namespace.smart.suggestion.help_hint'),
      onPick: () => setHelpOpen(true),
    }];
  }, [navigate, props.namespaceBase, smart, t]);

  return (
    <div className="space-y-3" data-testid={`${props.testIdPrefix}.page`}>
      <FilterBar testId={`${props.testIdPrefix}.filters`}>
        <div className="min-w-0 flex-1">
          <SmartFilterInput
            ref={smartInputRef}
            testId={`${props.testIdPrefix}.search.input`}
            ariaLabel={t('userns.namespace.search_placeholder')}
            value={smart}
            onChange={setSmart}
            onSubmit={() => applySmart()}
            suggestions={smartSuggestions}
            placeholder={t('userns.namespace.smart.placeholder')}
            suffix={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
                onClick={() => setHelpOpen(true)}
                aria-label={t('filters.help.open')}
                title={t('filters.help.open')}
                data-testid={`${props.testIdPrefix}.smart.help_button`}
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAdvancedOpen(true)}
            testId={`${props.testIdPrefix}.filters.advanced`}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            {t('filters.advanced.label')}
          </Button>
          <CopyButton text={shareUrl} label={t('common.copy_link')} testId={`${props.testIdPrefix}.filters.copy_link`} />
          {filtersActive ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters} testId={`${props.testIdPrefix}.filters.clear`}>
              {t('common.clear_filters')}
            </Button>
          ) : null}
        </div>
      </FilterBar>

      {(q || size !== undefined || (props.showAdminFields && !props.fixedUserId && (userId !== undefined || blockCount !== undefined)) || smartErrors.length > 0) ? (
        <div className="flex flex-wrap gap-2" data-testid={`${props.testIdPrefix}.filters.chips`}>
          {q ? <FilterChip label={`#${q.replace(/^#/, '')}`} onRemove={() => setFilters({ q: '', size, userId, blockCount })} /> : null}
          {typeof size === 'number' ? <FilterChip label={`${t('userns.namespace.size')}: ${size}`} onRemove={() => setFilters({ q, size: undefined, userId, blockCount })} /> : null}
          {props.showAdminFields && !props.fixedUserId && typeof userId === 'number' ? <FilterChip label={`${t('common.user')}: #${userId}`} onRemove={() => setFilters({ q, size, userId: undefined, blockCount })} /> : null}
          {props.showAdminFields && !props.fixedUserId && typeof blockCount === 'number' ? <FilterChip label={`${t('userns.namespace.blocks')}: ${blockCount}`} onRemove={() => setFilters({ q, size, userId, blockCount: undefined })} /> : null}
          {smartErrors.map((err, idx) => <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((cur) => cur.filter((_, i) => i !== idx))} />)}
        </div>
      ) : null}

      {qList.isLoading ? (
        <Card className="p-4">
          <div className="text-sm text-muted">{t('common.loading')}</div>
        </Card>
      ) : qList.isError ? (
        <Alert title={t('userns.namespace.load_error')} variant="danger">
          {String((qList.error as any)?.message ?? qList.error)}
        </Alert>
      ) : rows.length === 0 ? (
        <>
          <EmptyState
            testId={`${props.testIdPrefix}.empty`}
            title={t('userns.namespace.empty.title')}
            body={filtersActive ? t('userns.namespace.empty.filtered') : t('userns.namespace.empty.body')}
            actionLabel={filtersActive ? t('common.clear_filters') : undefined}
            onAction={filtersActive ? clearFilters : undefined}
          />

          <Card className="mt-4">
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
              testId={`${props.testIdPrefix}.pagination`}
            />
          </Card>
        </>
      ) : (
        <TableCard
          testId={`${props.testIdPrefix}.table`}
          minWidth="lg"
          footer={
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
              testId={`${props.testIdPrefix}.pagination`}
            />
          }
        >
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2">{t('common.id')}</th>
              <th className="px-4 py-2">{t('userns.namespace.size')}</th>
              {props.showAdminFields ? <th className="px-4 py-2">{t('common.user')}</th> : null}
              {props.showAdminFields ? <th className="px-4 py-2">{t('userns.namespace.blocks')}</th> : null}
              <th className="px-4 py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const to = `${props.namespaceBase}/${r.id}`;
              const mapsUrl = `${props.mapsBase}?user_namespace=${r.id}`;
              return (
                <TableRowLink key={r.id} to={to} testId={`${props.testIdPrefix}.row.${r.id}`} className="border-b border-border">
                  <td className="px-4 py-2 text-sm font-medium">#{r.id}</td>
                  <td className="px-4 py-2 text-sm tabular-nums">{typeof r.size === 'number' ? r.size : '—'}</td>
                  {props.showAdminFields ? (
                    <td className="px-4 py-2 text-sm">{userLabel((r as any).user)}</td>
                  ) : null}
                  {props.showAdminFields ? (
                    <td className="px-4 py-2 text-sm tabular-nums">{(r as any).block_count ?? '—'}</td>
                  ) : null}
                  <td className="px-4 py-2 text-sm">
                    <Link to={mapsUrl} data-row-no-nav className="text-sm text-link underline">
                      {t('userns.namespace.view_maps')}
                    </Link>
                  </td>
                </TableRowLink>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title={t('filters.advanced.title')}
        width="lg"
        testId={`${props.testIdPrefix}.filters.advanced.drawer`}
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted">{t('common.search')}</div>
            <div className="mt-1">
              <Input
                testId={`${props.testIdPrefix}.search.advanced`}
                placeholder={t('userns.namespace.search_placeholder')}
                value={q}
                onChange={(e) => setFilters({ q: e.target.value.replace(/^#/, ''), size, userId, blockCount })}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">{t('userns.namespace.size')}</div>
            <div className="mt-1">
              <Input
                testId={`${props.testIdPrefix}.size.input`}
                placeholder={t('common.optional')}
                value={size !== undefined ? String(size) : ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setFilters({ q, size: v ? parseIntParam(v) : undefined, userId, blockCount });
                }}
              />
            </div>
          </div>
          {props.showAdminFields && !props.fixedUserId ? (
            <>
              <div>
                <div className="text-xs text-muted">{t('common.user')}</div>
                <div className="mt-1">
                  <Input
                    testId={`${props.testIdPrefix}.user.input`}
                    placeholder="#123"
                    value={userId !== undefined ? String(userId) : ''}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setFilters({ q, size, userId: v ? parseIntParam(v.replace(/^#/, '')) : undefined, blockCount });
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('userns.namespace.blocks')}</div>
                <div className="mt-1">
                  <Input
                    testId={`${props.testIdPrefix}.blocks.input`}
                    placeholder={t('common.optional')}
                    value={blockCount !== undefined ? String(blockCount) : ''}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setFilters({ q, size, userId, blockCount: v ? parseIntParam(v) : undefined });
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={clearFilters}>{t('common.clear_filters')}</Button>
            <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
          </div>
        </div>
      </Drawer>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('filters.help.title')}
        intro={t('userns.namespace.smart.help.intro')}
        examples={[
          { example: '?', description: t('userns.namespace.smart.help.examples.help') },
          { example: '123', description: t('userns.namespace.smart.help.examples.open_id') },
          { example: 'size:65536', description: t('userns.namespace.smart.help.examples.size') },
          ...(props.showAdminFields && !props.fixedUserId ? [{ example: 'user:42', description: t('userns.namespace.smart.help.examples.user') }] : []),
        ]}
        topKeys={[
          { key: 'id', description: t('userns.namespace.smart.help.keys.id'), example: 'id:123' },
          { key: 'size', description: t('userns.namespace.smart.help.keys.size'), example: 'size:65536' },
          ...(props.showAdminFields && !props.fixedUserId ? [{ key: 'user', description: t('userns.namespace.smart.help.keys.user'), example: 'user:42' }] : []),
          ...(props.showAdminFields && !props.fixedUserId ? [{ key: 'blocks', description: t('userns.namespace.smart.help.keys.blocks'), example: 'blocks:3' }] : []),
        ]}
        inference={[
          t('userns.namespace.smart.help.inference.enter_applies'),
          t('userns.namespace.smart.help.inference.number_opens'),
          t('userns.namespace.smart.help.inference.key_value'),
        ]}
        onInsertKey={insertSmartKey}
        testId={`${props.testIdPrefix}.smart.help`}
      />
    </div>
  );
}
