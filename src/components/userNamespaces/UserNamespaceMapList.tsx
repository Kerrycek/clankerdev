import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../app/i18n';

import { FilterBar } from '../layout/FilterBar';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CopyButton } from '../ui/CopyButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/EmptyState';
import { FilterChip } from '../ui/FilterChip';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Select } from '../ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../ui/SmartFilterInput';
import { SmartInputHelp } from '../ui/SmartInputHelp';
import { TableCard } from '../ui/TableCard';
import { TableRowLink } from '../ui/TableRowLink';

import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';

import {
  createUserNamespaceMap,
  deleteUserNamespaceMap,
  fetchUserNamespaceMaps,
  fetchUserNamespaces,
  type UserNamespace,
  type UserNamespaceMap,
} from '../../lib/api/userNamespaces';

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

function namespaceRefLabel(ns: any, sizeLabel?: string): string {
  if (!ns) return '—';
  const id = typeof ns.id === 'number' ? ns.id : undefined;
  const size = typeof ns.size === 'number' ? ns.size : undefined;
  if (id != null && size != null && sizeLabel) return `#${id} (${sizeLabel} ${size})`;
  if (id != null && size != null) return `#${id} (${size})`;
  if (id != null) return `#${id}`;
  return '—';
}

export function UserNamespaceMapList(props: {
  testIdPrefix: string;
  /** Detail route base, e.g. /app/profile/user-namespaces/maps */
  mapsBase: string;
  /** Namespaces base, e.g. /app/profile/user-namespaces/namespaces */
  namespacesBase: string;
  /** If set, list is restricted to this user (profile view). */
  fixedUserId?: number;
  /** Show admin-only filters and columns. */
  showAdminFields?: boolean;
  /**
   * When true, the create drawer offers a namespace dropdown populated from the API.
   * Intended for user/profile use where the namespace set is small.
   */
  createWithNamespaceSelect?: boolean;
  /** Optional user filter used when fetching namespaces for the create dropdown. */
  createNamespacesUserId?: number;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [sp, setSp] = useSearchParams();

  const q = (sp.get('q') ?? '').trim();
  const userId = props.fixedUserId ?? parseIntParam(sp.get('user'));
  const userNamespaceId = parseIntParam(sp.get('user_namespace'));

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const filterKey = useMemo(() => {
    return JSON.stringify({ q, userId: props.fixedUserId ? props.fixedUserId : userId, userNamespaceId, admin: props.showAdminFields ? 1 : 0 });
  }, [q, userId, userNamespaceId, props.fixedUserId, props.showAdminFields]);

  const pagination = useKeysetPagination({
    id: `${props.testIdPrefix}.list`,
    filterKey,
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
  });

  const qList = useQuery({
    queryKey: ['user_namespace_map', 'list', { cursor: pagination.cursor, limit: pagination.limit, q, userId, userNamespaceId, fixed: props.fixedUserId }],
    queryFn: async () =>
      (await fetchUserNamespaceMaps({
        limit: pagination.limit,
        fromId: pagination.cursor,
        q: q || undefined,
        userId,
        userNamespaceId,
      })).data,
    refetchOnWindowFocus: false,
  });

  const rows: UserNamespaceMap[] = qList.data ?? [];
  const pageCursor = cursorFromDescendingPage(rows);
  const canNext = rows.length >= pagination.limit && pageCursor !== null;

  const filtersActive = Boolean(q || userNamespaceId !== undefined || (props.showAdminFields && !props.fixedUserId && userId !== undefined) || smartErrors.length > 0);
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

  function setFilters(nextVals: { q?: string; userId?: number | undefined; userNamespaceId?: number | undefined }) {
    const next = new URLSearchParams(sp);
    if (nextVals.q && nextVals.q.trim()) next.set('q', nextVals.q.trim());
    else next.delete('q');
    if (typeof nextVals.userNamespaceId === 'number') next.set('user_namespace', String(nextVals.userNamespaceId));
    else next.delete('user_namespace');
    if (!props.fixedUserId) {
      if (typeof nextVals.userId === 'number') next.set('user', String(nextVals.userId));
      else next.delete('user');
    }
    setSp(next, { replace: true });
  }

  const clearFilters = () => {
    setFilters({ q: '', userId: undefined, userNamespaceId: undefined });
    setSmart('');
    setSmartErrors([]);
  };

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? smart).trim();
    if (!raw) return;
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(raw);
    let nextQ = q;
    let nextUserId = userId;
    let nextUserNamespaceId = userNamespaceId;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        const n = parseNumericToken(token);
        if (n !== null) {
          navigate(`${props.mapsBase}/${n}`);
          setSmart('');
          setSmartErrors([]);
          return;
        }
        nextQ = unquoteSmartValue(token);
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
            navigate(`${props.mapsBase}/${n}`);
            setSmart('');
            setSmartErrors([]);
            return;
          }
          break;
        }
        case 'q':
        case 'search':
        case 'label':
          nextQ = value;
          break;
        case 'namespace':
        case 'user_namespace': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextUserNamespaceId = n;
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
    setFilters({ q: nextQ, userId: nextUserId, userNamespaceId: nextUserNamespaceId });
    setSmart('');
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [{ id: 'help', primary: t('filters.help.title'), secondary: t('filters.help.suggestion.secondary'), onPick: () => { setHelpOpen(true); setSmart(''); } }];
    }

    const n = parseNumericToken(needle);
    if (n !== null) {
      return [{
        id: `open-${n}`,
        primary: t('userns.map.smart.suggestion.open', { id: n }),
        secondary: t('userns.map.smart.suggestion.open_hint'),
        onPick: () => { navigate(`${props.mapsBase}/${n}`); setSmart(''); setSmartErrors([]); },
      }];
    }

    return [{
      id: 'apply',
      primary: t('filters.smart.suggest.apply.primary'),
      secondary: t('filters.smart.suggest.apply.secondary'),
      onPick: () => applySmart(needle),
    }];
  }, [navigate, props.mapsBase, smart, t]);

  // Create map drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [createNsId, setCreateNsId] = useState<string>('');
  const [createErr, setCreateErr] = useState<string | null>(null);

  const namespacesQ = useQuery({
    queryKey: ['user_namespace', 'list', { forCreate: true, userId: props.createNamespacesUserId }],
    queryFn: async () => (await fetchUserNamespaces({ limit: 200, userId: props.createNamespacesUserId })).data,
    enabled: createOpen && Boolean(props.createWithNamespaceSelect),
  });

  useEffect(() => {
    if (!createOpen) return;

    // For profile: preselect the single namespace.
    const list = namespacesQ.data;
    if (props.createWithNamespaceSelect && list && list.length === 1) {
      const onlyNamespace = list[0];
      if (onlyNamespace) setCreateNsId(String(onlyNamespace.id));
    }
  }, [createOpen, namespacesQ.data, props.createWithNamespaceSelect]);

  const createM = useMutation({
    mutationFn: async () => {
      setCreateErr(null);
      const label = createLabel.trim();
      const nsId = Number(createNsId);

      if (!label) throw new Error(t('userns.map.create.validation.label_required'));
      if (!Number.isFinite(nsId) || nsId <= 0) throw new Error(t('userns.map.create.validation.namespace_required'));

      return createUserNamespaceMap({ userNamespaceId: nsId, label });
    },
    onSuccess: (res) => {
      setCreateOpen(false);
      setCreateLabel('');
      setCreateNsId('');
      qc.invalidateQueries({ queryKey: ['user_namespace_map', 'list'] });
      navigate(`${props.mapsBase}/${res.data.id}`);
    },
    onError: (e: any) => {
      setCreateErr(String(e?.message ?? e));
    },
  });

  // Delete map
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteM = useMutation({
    mutationFn: async (mapId: number) => deleteUserNamespaceMap(mapId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user_namespace_map', 'list'] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      setCreateErr(String(e?.message ?? e));
    },
  });

  return (
    <div className="space-y-3" data-testid={`${props.testIdPrefix}.page`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted">{t('userns.map.list_hint')}</div>
        <Button testId={`${props.testIdPrefix}.create`} size="sm" onClick={() => setCreateOpen(true)}>
          {t('common.new')}
        </Button>
      </div>

      <FilterBar testId={`${props.testIdPrefix}.filters`}>
        <div className="min-w-0 flex-1">
          <SmartFilterInput
            ref={smartInputRef}
            testId={`${props.testIdPrefix}.search.input`}
            ariaLabel={t('userns.map.search_placeholder')}
            value={smart}
            onChange={setSmart}
            onSubmit={() => applySmart()}
            suggestions={smartSuggestions}
            placeholder={t('userns.map.smart.placeholder')}
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

      {filtersActive ? (
        <div className="flex flex-wrap gap-2" data-testid={`${props.testIdPrefix}.filters.chips`}>
          {q ? <FilterChip label={q.startsWith('#') || /^\d+$/.test(q) ? `#${q.replace(/^#/, '')}` : q} onRemove={() => setFilters({ q: '', userId, userNamespaceId })} /> : null}
          {typeof userNamespaceId === 'number' ? <FilterChip label={`${t('userns.map.namespace')}: #${userNamespaceId}`} onRemove={() => setFilters({ q, userId, userNamespaceId: undefined })} /> : null}
          {props.showAdminFields && !props.fixedUserId && typeof userId === 'number' ? <FilterChip label={`${t('common.user')}: #${userId}`} onRemove={() => setFilters({ q, userId: undefined, userNamespaceId })} /> : null}
          {smartErrors.map((err, idx) => <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((cur) => cur.filter((_, i) => i !== idx))} />)}
        </div>
      ) : null}

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
                placeholder={t('userns.map.search_placeholder')}
                value={q}
                onChange={(e) => setFilters({ q: e.target.value, userId, userNamespaceId })}
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-muted">{t('userns.map.namespace')}</div>
            <div className="mt-1">
              <Input
                testId={`${props.testIdPrefix}.namespace.input`}
                placeholder="#123"
                value={userNamespaceId !== undefined ? String(userNamespaceId) : ''}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setFilters({ q, userId, userNamespaceId: v ? parseIntParam(v.replace(/^#/, '')) : undefined });
                }}
              />
            </div>
          </div>

          {props.showAdminFields && !props.fixedUserId ? (
            <div>
              <div className="text-xs text-muted">{t('common.user')}</div>
              <div className="mt-1">
                <Input
                  testId={`${props.testIdPrefix}.user.input`}
                  placeholder="#123"
                  value={userId !== undefined ? String(userId) : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setFilters({ q, userId: v ? parseIntParam(v.replace(/^#/, '')) : undefined, userNamespaceId });
                  }}
                />
              </div>
            </div>
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
        intro={t('userns.map.smart.help.intro')}
        examples={[
          { example: '?', description: t('userns.map.smart.help.examples.help') },
          { example: 'default', description: t('userns.map.smart.help.examples.search') },
          { example: '123', description: t('userns.map.smart.help.examples.open_id') },
          { example: 'namespace:101', description: t('userns.map.smart.help.examples.namespace') },
          ...(props.showAdminFields && !props.fixedUserId ? [{ example: 'user:42', description: t('userns.map.smart.help.examples.user') }] : []),
        ]}
        topKeys={[
          { key: 'q', description: t('userns.map.smart.help.keys.q'), example: 'q:default' },
          { key: 'id', description: t('userns.map.smart.help.keys.id'), example: 'id:123' },
          { key: 'namespace', description: t('userns.map.smart.help.keys.namespace'), example: 'namespace:101' },
          ...(props.showAdminFields && !props.fixedUserId ? [{ key: 'user', description: t('userns.map.smart.help.keys.user'), example: 'user:42' }] : []),
        ]}
        inference={[
          t('userns.map.smart.help.inference.enter_applies'),
          t('userns.map.smart.help.inference.number_opens'),
          t('userns.map.smart.help.inference.key_value'),
        ]}
        onInsertKey={insertSmartKey}
        testId={`${props.testIdPrefix}.smart.help`}
      />

      {createErr ? (
        <Alert title={t('common.error')} variant="danger">
          {createErr}
        </Alert>
      ) : null}

      {qList.isLoading ? (
        <Card className="p-4">
          <div className="text-sm text-muted">{t('common.loading')}</div>
        </Card>
      ) : qList.isError ? (
        <Alert title={t('userns.map.load_error')} variant="danger">
          {String((qList.error as LegacyAny)?.message ?? qList.error)}
        </Alert>
      ) : rows.length === 0 ? (
        <>
          <EmptyState
            testId={`${props.testIdPrefix}.empty`}
            title={t('userns.map.empty.title')}
            body={filtersActive ? t('userns.map.empty.filtered') : t('userns.map.empty.body')}
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
              <th className="px-4 py-2">{t('common.label')}</th>
              <th className="px-4 py-2">{t('userns.map.namespace')}</th>
              {props.showAdminFields ? <th className="px-4 py-2">{t('common.user')}</th> : null}
              <th className="px-4 py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const to = `${props.mapsBase}/${r.id}`;
              const ns = (r as LegacyAny).user_namespace;
              const owner = (ns as LegacyAny)?.user;

              return (
                <TableRowLink key={r.id} to={to} testId={`${props.testIdPrefix}.row.${r.id}`} className="border-b border-border">
                  <td className="px-4 py-2 text-sm font-medium">#{r.id}</td>
                  <td className="px-4 py-2 text-sm">{String(r.label ?? '')}</td>
                  <td className="px-4 py-2 text-sm">{namespaceRefLabel(ns, t('userns.namespace.size'))}</td>
                  {props.showAdminFields ? <td className="px-4 py-2 text-sm">{userLabel(owner)}</td> : null}
                  <td className="px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Link to={to} data-row-no-nav className="text-link underline">
                        {t('common.open')}
                      </Link>
                      <button
                        data-row-no-nav
                        data-testid={`${props.testIdPrefix}.row.${r.id}.delete`}
                        className="text-xs text-danger underline"
                        onClick={() => setDeleteId(r.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </TableRowLink>
              );
            })}
          </tbody>
        </TableCard>
      )}

      {/* Create drawer */}
      <Drawer
        testId={`${props.testIdPrefix}.create.drawer`}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateErr(null);
        }}
        title={t('userns.map.create.title')}
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted">{t('common.label')}</div>
            <Input
              testId={`${props.testIdPrefix}.create.label`}
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder={t('userns.map.create.label_placeholder')}
            />
          </div>

          {props.createWithNamespaceSelect ? (
            (namespacesQ.data ?? []).length <= 1 ? (
              <div>
                <div className="text-xs text-muted">{t('userns.map.namespace')}</div>
                <div className="mt-1 text-sm text-fg">{createNsId ? `#${createNsId}` : '—'}</div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-muted">{t('userns.map.namespace')}</div>
                <Select
                  testId={`${props.testIdPrefix}.create.namespace`}
                  value={createNsId}
                  onChange={(e) => setCreateNsId(e.target.value)}
                >
                  <option value="">{t('common.select')}</option>
                  {(namespacesQ.data ?? []).map((ns: UserNamespace) => (
                    <option key={ns.id} value={String(ns.id)}>
                      #{ns.id} ({t('userns.namespace.size')} {ns.size ?? '—'})
                    </option>
                  ))}
                </Select>
              </div>
            )
          ) : (
            <div>
              <div className="text-xs text-muted">{t('userns.map.namespace')}</div>
              <Input
                testId={`${props.testIdPrefix}.create.namespace`}
                value={createNsId}
                onChange={(e) => setCreateNsId(e.target.value)}
                placeholder="#123"
              />
              <div className="mt-1 text-xs text-faint">
                {t('userns.map.create.namespace_hint')}{' '}
                <Link className="underline" to={props.namespacesBase}>
                  {t('userns.tabs.namespaces')}
                </Link>
              </div>
            </div>
          )}

          {createErr ? (
            <Alert title={t('common.error')} variant="danger">
              {createErr}
            </Alert>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              testId={`${props.testIdPrefix}.create.submit`}
              onClick={() => createM.mutate()}
              loading={createM.isPending}
              disabled={createM.isPending}
            >
              {t('common.create')}
            </Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        testId={`${props.testIdPrefix}.delete.confirm`}
        open={deleteId !== null}
        title={t('userns.map.delete.title')}
        description={t('userns.map.delete.desc')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteM.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId != null) deleteM.mutate(deleteId);
        }}
      />
    </div>
  );
}
