import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { parseLookupIdLike } from '../../../../lib/lookupInput';
import { parsePositiveInt } from '../../../../lib/parse';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

import { FilterBar } from '../../../../components/layout/FilterBar';
import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { Modal } from '../../../../components/ui/Modal';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';

import { getMetaTotalCount } from '../../../../lib/api/haveapi';
import { fetchEnvironments } from '../../../../lib/api/infra';
import {
  createClusterResourcePackage,
  deleteClusterResourcePackage,
  fetchUserClusterResourcePackages,
  fetchClusterResourcePackages,
  updateClusterResourcePackage,
  type ClusterResourcePackage,
} from '../../../../lib/api/clusterResourcePackages';
import { normalizeResourcePackageScope, resolveResourcePackageEnvironment, resourcePackageEnvironmentLabel, resourcePackageScopeFilters, resourcePackageUserLabel, type ResourcePackageScope } from './ResourcePackagesListModel';

type EditorState =
  | null
  | {
      mode: 'create' | 'edit';
      pkg?: ClusterResourcePackage;
    };

export function ResourcePackagesPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [scope, setScope] = useState<ResourcePackageScope>(() => normalizeResourcePackageScope(searchParams.get('scope')));
  const [environment, setEnvironment] = useState(() => searchParams.get('environment') ?? '');
  const [user, setUser] = useState(() => searchParams.get('user') ?? '');
  const [userDraft, setUserDraft] = useState(() => searchParams.get('user') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // User is the exact personal-package selector. It must not silently narrow
  // the explicit global or all scopes.
  useEffect(() => {
    if (scope === 'global' && environment) setEnvironment('');
    if (scope !== 'personal' && (user || userDraft)) {
      setUser('');
      setUserDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // Sync local state on navigation.
  useEffect(() => {
    const urlScope = normalizeResourcePackageScope(searchParams.get('scope'));
    const urlEnv = searchParams.get('environment') ?? '';
    const urlUser = searchParams.get('user') ?? '';
    if (urlScope !== scope) setScope(urlScope);
    if (urlEnv !== environment) setEnvironment(urlEnv);
    if (urlUser !== user) {
      setUser(urlUser);
      setUserDraft(urlUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const envId = useMemo(() => parsePositiveInt(environment), [environment]);
  const userId = useMemo(() => parsePositiveInt(user), [user]);
  const { environmentId: effectiveEnvironmentId, userId: effectiveUserId, personalUserRequired: scopeRequiresUser } = resourcePackageScopeFilters(scope, envId, userId);
  const personalUserRequired = scopeRequiresUser || (scope === 'personal' && userDraft.trim() !== user.trim());
  const filtersActive = Boolean(scope !== 'global' || effectiveEnvironmentId || effectiveUserId || smartErrors.length > 0);
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

  function clearAllFilters() {
    setSmart('');
    setSmartErrors([]);
    setScope('global');
    setEnvironment('');
    setUser('');
    setUserDraft('');
  }

  function closeAdvancedFilters() {
    setUserDraft(user);
    setAdvancedOpen(false);
  }
  // Persist filters in URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    // Older links exposed a full-text filter that the API never supported.
    // Normalize them before sharing or navigating without issuing an invalid request.
    next.delete('q');

    if (scope && scope !== 'global') next.set('scope', scope);
    else next.delete('scope');

    if (effectiveEnvironmentId) next.set('environment', String(effectiveEnvironmentId));
    else next.delete('environment');

    if (typeof effectiveUserId === 'number') next.set('user', String(effectiveUserId));
    else next.delete('user');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [effectiveEnvironmentId, effectiveUserId, scope, searchParams, setSearchParams, user]);

  const pagination = useKeysetPagination({
    id: 'admin.cluster.resource_packages',
    filterKey: JSON.stringify({ s: scope, e: effectiveEnvironmentId, u: effectiveUserId }),
    searchParams,
    setSearchParams,
    allowedLimits: [25, 50, 100, 200],
    defaultLimit: 50,
  });

  const envQ = useQuery({
    queryKey: ['environments', { limit: 500 }],
    queryFn: async () => (await fetchEnvironments({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ['cluster_resource_packages', { scope, envId: effectiveEnvironmentId, userId: effectiveUserId, limit: pagination.limit, fromId: pagination.fromId }],
    enabled: !personalUserRequired,
    queryFn: async () =>
      await fetchClusterResourcePackages({
        environmentId: effectiveEnvironmentId,
        userId: effectiveUserId,
        limit: pagination.limit,
        fromId: pagination.fromId ?? undefined,
      }),
    staleTime: 5_000,
  });

  const packages = personalUserRequired ? [] : listQ.data?.data ?? [];
  const lastPackage = packages[packages.length - 1];
  const pageCursor = lastPackage ? lastPackage.id : null;
  const hasMore = packages.length === pagination.limit && typeof pageCursor === 'number';
  const canNext = pagination.hasForward || hasMore;

  const environmentOptions: SelectOption[] = useMemo(() => {
    const list = envQ.data ?? [];
    return [
      { value: '', label: t('common.all') },
      ...list.map((e) => ({ value: String(e.id), label: resourcePackageEnvironmentLabel(e) })),
    ];
  }, [envQ.data, t]);

  const scopeOptions: SelectOption[] = useMemo(
    () => [
      { value: 'global', label: t('admin.cluster.resource_packages.scope.global') },
      { value: 'personal', label: t('admin.cluster.resource_packages.scope.personal') },
      { value: 'all', label: t('common.all') },
    ],
    [t]
  );

  useEffect(() => {
    if (smart.trim() === '?') setHelpOpen(true);
  }, [smart]);

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? smart).trim();
    if (!raw) return;
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(raw);
    let nextScope = scope;
    let nextEnvironment = environment;
    let nextUser = user;
    let scopeSpecified = false;
    let environmentSpecified = false;
    let userSpecified = false;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        const n = parseNumericToken(token);
        if (n !== null) {
          navigate(`/admin/cluster/resource-packages/${n}`);
          setSmart('');
          setSmartErrors([]);
          return;
        }
        errors.push(t('admin.cluster.resource_packages.smart.error.text_unsupported'));
        continue;
      }

      const key = kv.rawKey.trim().toLowerCase();
      const value = unquoteSmartValue(kv.rawValue).trim();
      if (!value) {
        errors.push(t('filters.smart.error.missing_value', { key }));
        continue;
      }

      switch (key) {
        case 'q':
        case 'search':
        case 'label':
          errors.push(t('admin.cluster.resource_packages.smart.error.text_unsupported'));
          break;
        case 'id': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else {
            navigate(`/admin/cluster/resource-packages/${n}`);
            setSmart('');
            setSmartErrors([]);
            return;
          }
          break;
        }
        case 'scope':
        case 'personal':
          if (value === 'global' || value === 'personal' || value === 'all') {
            nextScope = value as ResourcePackageScope;
            scopeSpecified = true;
          }
          else errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          break;
        case 'environment':
        case 'env': {
          if (value === 'all') nextEnvironment = '';
          else {
            const id = resolveResourcePackageEnvironment(envQ.data ?? [], value);
            if (!id) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
            else {
              nextEnvironment = String(id);
              environmentSpecified = true;
            }
          }
          break;
        }
        case 'user': {
          const id = parsePositiveInt(value);
          if (!id) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          else {
            nextUser = String(id);
            userSpecified = true;
          }
          break;
        }
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
      }
    }

    if (userSpecified && scopeSpecified && nextScope !== 'personal') {
      errors.push(t('admin.cluster.resource_packages.smart.error.user_scope'));
    } else if (userSpecified) {
      nextScope = 'personal';
    }

    if (environmentSpecified && scopeSpecified && nextScope === 'global') {
      errors.push(t('admin.cluster.resource_packages.smart.error.environment_global'));
    } else if (environmentSpecified && !scopeSpecified && nextScope === 'global') {
      nextScope = 'all';
    }

    setSmartErrors(errors);
    if (errors.length > 0) return;
    if (nextScope === 'global') {
      nextEnvironment = '';
    }
    if (nextScope !== 'personal') {
      nextUser = '';
    }
    setScope(nextScope);
    setEnvironment(nextEnvironment);
    setUser(nextUser);
    setUserDraft(nextUser);
    setSmart('');
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [{ id: 'help', primary: t('admin.cluster.resource_packages.smart.help.title'), secondary: t('admin.cluster.resource_packages.smart.help.example_help'), onPick: () => { setHelpOpen(true); setSmart(''); } }];
    }
    const out: SmartFilterSuggestion[] = [];
    const n = parseNumericToken(needle);
    if (n !== null) {
      out.push({ id: `open-${n}`, primary: t('admin.cluster.resource_packages.smart.suggestion.id', { id: n }), secondary: t('admin.cluster.resource_packages.smart.suggestion.id_hint'), onPick: () => { navigate(`/admin/cluster/resource-packages/${n}`); setSmart(''); setSmartErrors([]); } });
    }
    return out;
  }, [navigate, smart, t]);

  const [editor, setEditor] = useState<EditorState>(null);
  const [label, setLabel] = useState('');

  function openCreate() {
    setEditor({ mode: 'create' });
    setLabel('');
  }

  function openEdit(pkg: ClusterResourcePackage) {
    setEditor({ mode: 'edit', pkg });
    setLabel(typeof pkg.label === 'string' ? pkg.label : '');
  }

  const createM = useMutation({
    mutationFn: async () => await createClusterResourcePackage({ label: label.trim() }),
    onSuccess: async () => {
      setEditor(null);
      setLabel('');
      await qc.invalidateQueries({ queryKey: ['cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.toast.created') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const id = editor?.pkg?.id;
      if (!id) throw new Error('Missing package id');
      return await updateClusterResourcePackage({ id, label: label.trim() });
    },
    onSuccess: async () => {
      setEditor(null);
      setLabel('');
      await qc.invalidateQueries({ queryKey: ['cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.toast.updated') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const [deleteState, setDeleteState] = useState<{ open: boolean; pkg: ClusterResourcePackage | null }>({
    open: false,
    pkg: null,
  });
  const deletePkg = deleteState.pkg;

  const deleteImpactQ = useQuery({
    queryKey: ['user_cluster_resource_packages', 'count', { pkgId: deletePkg?.id }],
    enabled: deleteState.open && Boolean(deletePkg) && !(deletePkg as any)?.is_personal,
    queryFn: async () => {
      if (!deletePkg) return 0;
      const res = await fetchUserClusterResourcePackages({ clusterResourcePackageId: deletePkg.id, limit: 1 });
      return getMetaTotalCount(res.meta);
    },
    staleTime: 5_000,
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      if (!deletePkg) throw new Error('Missing package');
      return await deleteClusterResourcePackage(deletePkg.id);
    },
    onSuccess: async () => {
      setDeleteState({ open: false, pkg: null });
      await qc.invalidateQueries({ queryKey: ['cluster_resource_packages'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.resource_packages.toast.deleted') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const editorBusy = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      <FilterBar testId="admin.cluster.resource_packages.filters">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SmartFilterInput
              ref={smartInputRef}
              testId="admin.cluster.resource_packages.search"
              value={smart}
              onChange={setSmart}
              onSubmit={() => applySmart()}
              suggestions={smartSuggestions}
              placeholder={t('admin.cluster.resource_packages.filter.smart_placeholder')}
              ariaLabel={t('admin.cluster.resource_packages.filter.smart_placeholder')}
              className="min-w-0 flex-1"
              suffix={
                <Button variant="ghost" size="sm" aria-label={t('filters.help.open')} className="px-2" onClick={() => setHelpOpen(true)} testId="admin.cluster.resource_packages.smart.help_button">
                  <CircleHelp className="h-4 w-4" />
                </Button>
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setAdvancedOpen(true)} testId="admin.cluster.resource_packages.advanced.open">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {t('common.advanced')}
              </Button>
              <CopyButton text={shareUrl} label={t('common.copy_link')} testId="admin.cluster.resource_packages.copy_link" />
              <Button variant="secondary" onClick={() => listQ.refetch()} disabled={personalUserRequired || listQ.isFetching}>{t('common.refresh')}</Button>
              {filtersActive ? <Button variant="secondary" onClick={clearAllFilters} testId="admin.cluster.resource_packages.filter.clear">{t('common.clear_filters')}</Button> : null}
              <Button variant="primary" onClick={openCreate} testId="admin.cluster.resource_packages.create">{t('admin.cluster.resource_packages.create.button')}</Button>
            </div>
          </div>

          {filtersActive ? (
            <div className="flex flex-wrap gap-2">
              {scope !== 'global' ? <FilterChip label={`${t('admin.cluster.resource_packages.col.scope')}: ${t(scope === 'personal' ? 'admin.cluster.resource_packages.scope.personal' : 'common.all')}`} onRemove={() => setScope('global')} /> : null}
              {effectiveEnvironmentId ? <FilterChip label={`${t('common.environment')}: ${resourcePackageEnvironmentLabel((envQ.data ?? []).find((e) => e.id === effectiveEnvironmentId))}`} onRemove={() => setEnvironment('')} /> : null}
              {typeof effectiveUserId === 'number' ? <FilterChip label={`${t('common.user')}: #${effectiveUserId}`} onRemove={() => { setUser(''); setUserDraft(''); }} testId="admin.cluster.resource_packages.chip.user" /> : null}
              {smartErrors.map((err, idx) => <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))} />)}
            </div>
          ) : null}
        </div>
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('admin.cluster.resource_packages.smart.help.title')}
        intro={t('admin.cluster.resource_packages.smart.help.intro')}
        examples={[
          { example: '?', description: t('admin.cluster.resource_packages.smart.help.example_help') },
          { example: '21', description: t('admin.cluster.resource_packages.smart.help.example_id') },
          { example: 'scope:personal user:42', description: t('admin.cluster.resource_packages.smart.help.example_scope') },
          { example: 'env:1', description: t('admin.cluster.resource_packages.smart.help.example_environment') },
        ]}
        topKeys={[
          { key: 'id', description: t('admin.cluster.resource_packages.smart.key.id'), example: 'id:10' },
          { key: 'scope', description: t('admin.cluster.resource_packages.smart.key.scope'), example: 'scope:personal' },
          { key: 'env', description: t('admin.cluster.resource_packages.smart.key.environment'), example: 'env:1' },
          { key: 'user', description: t('admin.cluster.resource_packages.smart.key.user'), example: 'user:42' },
        ]}
        inference={[
          t('admin.cluster.resource_packages.smart.help.inference.number'),
          t('admin.cluster.resource_packages.smart.help.inference.keyvalue'),
          t('admin.cluster.resource_packages.smart.help.inference.exact'),
        ]}
        onInsertKey={insertSmartKey}
      />

      <Drawer
        open={advancedOpen}
        onClose={closeAdvancedFilters}
        title={t('common.advanced_filters')}
        width="lg"
        testId="admin.cluster.resource_packages.advanced"
        footer={<div className="flex items-center justify-between gap-2"><Button variant="secondary" onClick={clearAllFilters}>{t('common.clear_filters')}</Button><Button variant="primary" onClick={closeAdvancedFilters}>{t('common.done')}</Button></div>}
      >
        <div className="space-y-4">
          <div><label htmlFor="admin-resource-packages-scope" className="mb-1 block text-xs font-semibold text-muted">{t('admin.cluster.resource_packages.col.scope')}</label><Select selectId="admin-resource-packages-scope" testId="admin.cluster.resource_packages.scope" value={scope} onChange={(e) => setScope(e.target.value as ResourcePackageScope)} options={scopeOptions} className="w-full" /></div>
          <div><label htmlFor="admin-resource-packages-environment" className="mb-1 block text-xs font-semibold text-muted">{t('common.environment')}</label><Select selectId="admin-resource-packages-environment" testId="admin.cluster.resource_packages.environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} options={environmentOptions} disabled={scope === 'global'} className="w-full" /></div>
          <UserLookupInput label={t('common.user')} value={userDraft} onChange={(value) => { const id = parseLookupIdLike(value); setUserDraft(id ? String(id) : value); if (!value.trim() || id) setUser(id ? String(id) : ''); }} placeholder={t('admin.cluster.resource_packages.filter.user_placeholder')} className="w-full" testId="admin.cluster.resource_packages.user" loadingLabel={t('common.loading')} noResultsLabel={t('common.no_results')} disabled={scope !== 'personal'} />
        </div>
      </Drawer>

      {personalUserRequired ? (
        <EmptyState
          title={t('admin.cluster.resource_packages.personal_user_required.title')}
          message={t('admin.cluster.resource_packages.personal_user_required.body')}
          testId="admin.cluster.resource_packages.personal_user_required"
        />
      ) : listQ.isError ? (
        <ErrorState error={listQ.error} testId="admin.cluster.resource_packages.error" />
      ) : packages.length === 0 ? (
        <EmptyState
          title={t('admin.cluster.resource_packages.empty.title')}
          message={t('admin.cluster.resource_packages.empty.body')}
          testId="admin.cluster.resource_packages.empty"
        />
      ) : (
        <TableCard
          testId="admin.cluster.resource_packages.table"
          minWidth="lg"
          footer={
            <KeysetPagination
              testId="admin.cluster.resource_packages.pagination"
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
            />
          }
        >
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.label')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.resource_packages.col.scope')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.environment')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.user')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => {
              const id = p.id;
              const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim() : `#${id}`;
              const personal = Boolean((p as any).is_personal) || Boolean((p as any).user);

              return (
                <tr key={id} data-testid={`admin.cluster.resource_packages.row.${id}`}>
                  <td className="px-3 py-2 text-fg">
                    <Link
                      className="font-medium hover:underline"
                      to={`/admin/cluster/resource-packages/${id}`}
                      data-testid={`admin.cluster.resource_packages.row.${id}.open`}
                    >
                      {label}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={personal ? 'warn' : 'neutral'}>
                      {personal ? t('admin.cluster.resource_packages.scope.personal') : t('admin.cluster.resource_packages.scope.global')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted">{personal ? resourcePackageEnvironmentLabel((p as any).environment) : '—'}</td>
                  <td className="px-3 py-2 text-muted">{personal ? resourcePackageUserLabel((p as any).user) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(p)}
                        testId={`admin.cluster.resource_packages.row.${id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={personal}
                        disabledReason={personal ? t('admin.cluster.resource_packages.delete_disabled.personal') : undefined}
                        onClick={() => {
                          deleteM.reset();
                          setDeleteState({ open: true, pkg: p });
                        }}
                        testId={`admin.cluster.resource_packages.row.${id}.delete`}
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
      )}

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'edit' ? t('admin.cluster.resource_packages.edit.title') : t('admin.cluster.resource_packages.create.title')}
        onClose={() => (editorBusy ? null : setEditor(null))}
        testId="admin.cluster.resource_packages.editor"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={editorBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (editor?.mode === 'edit') updateM.mutate();
                else createM.mutate();
              }}
              loading={editorBusy}
              disabled={!label.trim()}
              testId="admin.cluster.resource_packages.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-fg">{t('common.label')}</div>
            <div className="mt-1">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('admin.cluster.resource_packages.form.label_placeholder')}
                autoComplete="off"
                testId="admin.cluster.resource_packages.editor.label"
              />
            </div>
            <div className="mt-1 text-xs text-muted">{t('admin.cluster.resource_packages.form.label_hint')}</div>
            {editor?.mode === 'create' ? (
              <div className="mt-2 text-xs text-muted">{t('admin.cluster.resource_packages.form.scope_hint')}</div>
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        onCancel={() => {
          deleteM.reset();
          setDeleteState({ open: false, pkg: null });
        }}
        onConfirm={() => deleteM.mutate()}
        danger
        title={t('admin.cluster.resource_packages.delete_confirm.title')}
        description={t('admin.cluster.resource_packages.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteM.isPending}
        confirmDisabled={!deletePkg}
        testId="admin.cluster.resource_packages.delete_confirm"
      >
        {deletePkg ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface-subtle px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t('admin.cluster.resource_packages.delete_confirm.target')}
              </div>
              <div className="mt-1 font-medium text-fg">
                {typeof deletePkg.label === 'string' && deletePkg.label.trim() ? deletePkg.label.trim() : `#${deletePkg.id}`}
                {typeof deletePkg.label === 'string' && deletePkg.label.trim() ? (
                  <span className="ml-2 text-sm font-normal text-muted">#{deletePkg.id}</span>
                ) : null}
              </div>
            </div>
            <div className="text-sm text-muted">
              {t('admin.cluster.resource_packages.delete_confirm.impact', {
                count: deleteImpactQ.isLoading || deleteImpactQ.isError ? '—' : String(deleteImpactQ.data ?? 0),
              })}
            </div>
            {deleteM.isError ? (
              <Alert variant="danger" title={t('common.error')} testId="admin.cluster.resource_packages.delete_confirm.error">
                {formatErrorMessage(deleteM.error)}
              </Alert>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
