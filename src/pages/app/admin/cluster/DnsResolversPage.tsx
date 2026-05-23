import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';

import { useChrome } from '../../../../components/layout/ChromeContext';
import { FilterBar } from '../../../../components/layout/FilterBar';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../../components/ui/Drawer';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';

import { getMetaActionStateId } from '../../../../lib/api/haveapi';
import { fetchLocations, type Location } from '../../../../lib/api/infra';
import { objectRef } from '../../../../lib/objectRef';
import { parseNumericToken, splitKeyValueToken, unquoteSmartValue } from '../../../../lib/smartFilter';
import { parseBoolParam, parsePositiveInt } from '../../../../lib/parse';
import {
  createDnsResolver,
  deleteDnsResolver,
  fetchDnsResolvers,
  updateDnsResolver,
  type DnsResolver,
} from '../../../../lib/api/dnsResolvers';

function locLabel(l: Location | null | undefined): string {
  const x: any = l ?? {};
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  return label || (typeof x.id === 'number' ? `#${x.id}` : '—');
}

type EditorState =
  | null
  | {
      mode: 'create' | 'edit';
      resolver?: DnsResolver;
    };

type FormState = {
  label: string;
  ipAddr: string;
  isUniversal: boolean;
  locationId: string;
};

function initForm(r?: DnsResolver): FormState {
  const x: any = r ?? {};
  return {
    label: typeof x.label === 'string' ? x.label : '',
    ipAddr: typeof x.ip_addr === 'string' ? x.ip_addr : '',
    isUniversal: typeof x.is_universal === 'boolean' ? x.is_universal : true,
    locationId: typeof x.location?.id === 'number' ? String(x.location.id) : '',
  };
}

export function DnsResolversPage() {
  const { t } = useI18n();
  const chrome = useChrome();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [isUniversal, setIsUniversal] = useState(() => searchParams.get('is_universal') ?? '');
  const [location, setLocation] = useState(() => searchParams.get('location') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync local state on navigation.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlU = searchParams.get('is_universal') ?? '';
    const urlL = searchParams.get('location') ?? '';
    if (urlQ !== q) setQ(urlQ);
    if (urlU !== isUniversal) setIsUniversal(urlU);
    if (urlL !== location) setLocation(urlL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const isUniversalBool = useMemo(() => parseBoolParam(isUniversal), [isUniversal]);
  const locationId = useMemo(() => parsePositiveInt(location), [location]);

  // Persist filters in URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (isUniversalBool === true) next.set('is_universal', 'true');
    else if (isUniversalBool === false) next.set('is_universal', 'false');
    else next.delete('is_universal');

    if (locationId) next.set('location', String(locationId));
    else next.delete('location');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [isUniversalBool, locationId, qTrim, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: 'admin.cluster.dns_resolvers',
    filterKey: JSON.stringify({ q: qTrim, u: isUniversalBool, l: locationId }),
    searchParams,
    setSearchParams,
    allowedLimits: [25, 50, 100, 200],
    defaultLimit: 50,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: async () => (await fetchLocations({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const locs = locationsQ.data ?? [];

  const locationOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.all') }];
    for (const l of locs) opts.push({ value: String(l.id), label: locLabel(l) });
    return opts;
  }, [locs, t]);

  const universalOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: t('common.all') },
      { value: 'true', label: t('admin.cluster.dns_resolvers.filter.universal_true') },
      { value: 'false', label: t('admin.cluster.dns_resolvers.filter.universal_false') },
    ],
    [t]
  );

  const listQ = useQuery({
    queryKey: ['dns_resolvers', pagination.cursor, pagination.limit, qTrim, isUniversalBool, locationId],
    queryFn: async () =>
      (
        await fetchDnsResolvers({
          limit: pagination.limit,
          fromId: pagination.cursor,
          q: qTrim || undefined,
          isUniversal: isUniversalBool,
          locationId,
        })
      ).data,
    staleTime: 5_000,
  });

  const resolvers = listQ.data ?? [];

  const pageCursor = resolvers.length > 0 ? resolvers[resolvers.length - 1]?.id : undefined;
  const hasMore = resolvers.length === pagination.limit && typeof pageCursor === 'number';
  const canNext = pagination.hasForward || hasMore;
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
    setQ('');
    setIsUniversal('');
    setLocation('');
  }

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? smart).trim();
    if (!raw) return;
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = raw.match(/\S+/g) ?? [];
    let nextQ = qTrim;
    let nextUniversal = isUniversal;
    let nextLocation = location;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);

      if (!kv) {
        const n = parseNumericToken(token);
        if (n !== undefined) {
          nextQ = String(n);
        } else {
          nextQ = unquoteSmartValue(token);
        }
        continue;
      }

      const key = kv.key.trim().toLowerCase();
      const value = unquoteSmartValue(kv.value).trim();
      if (!value) {
        errors.push(t('filters.smart.error.missing_value', { key }));
        continue;
      }

      switch (key) {
        case 'q':
        case 'search':
        case 'label':
          nextQ = value;
          break;
        case 'id': {
          const n = parseNumericToken(value);
          if (n === undefined) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextQ = String(n);
          break;
        }
        case 'location':
        case 'loc': {
          const n = parseNumericToken(value);
          if (n === undefined) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextLocation = String(n);
          break;
        }
        case 'universal':
        case 'is_universal':
        case 'scope': {
          if (value === 'all' || value === '*') nextUniversal = '';
          else {
            const b = parseBoolParam(value);
            if (b === undefined) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
            else nextUniversal = b ? 'true' : 'false';
          }
          break;
        }
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
      }
    }

    if (errors.length > 0) {
      setSmartErrors(errors);
      return;
    }

    setSmart('');
    setSmartErrors([]);
    setQ(nextQ);
    setIsUniversal(nextUniversal);
    setLocation(nextLocation);
  }

  const activeChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    if (qTrim) chips.push(<FilterChip key="q" label={`q:${qTrim}`} onRemove={() => setQ('')} />);
    if (isUniversalBool === true) chips.push(<FilterChip key="u-t" label={t('admin.cluster.dns_resolvers.filter.universal_true')} tone="info" onRemove={() => setIsUniversal('')} />);
    if (isUniversalBool === false) chips.push(<FilterChip key="u-f" label={t('admin.cluster.dns_resolvers.filter.universal_false')} tone="warn" onRemove={() => setIsUniversal('')} />);
    if (locationId) chips.push(<FilterChip key="loc" label={`${t('common.location')}: ${locationId}`} onRemove={() => setLocation('')} />);
    smartErrors.forEach((msg, i) => chips.push(<FilterChip key={`err-${i}`} label={msg} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, idx) => idx !== i))} />));
    return chips;
  }, [isUniversalBool, locationId, qTrim, smartErrors, t]);

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const raw = smart.trim();
    if (!raw) return [];
    if (raw === '?') {
      return [{
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('admin.cluster.dns_resolvers.smart.help.intro'),
        onPick: () => {
          setHelpOpen(true);
          setSmart('');
        },
      }];
    }

    const suggestions: SmartFilterSuggestion[] = [];
    const numeric = parseNumericToken(raw);
    if (numeric !== undefined) {
      suggestions.push({
        id: 'id',
        primary: t('admin.cluster.dns_resolvers.smart.suggestion.id', { id: numeric }),
        secondary: t('admin.cluster.dns_resolvers.smart.suggestion.id_hint'),
        onPick: () => {
          setQ(String(numeric));
          setSmart('');
          setSmartErrors([]);
        },
      });
    }

    const kv = splitKeyValueToken(raw);
    if (kv) {
      suggestions.push({
        id: 'apply-kv',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: raw,
        onPick: () => applySmart(raw),
      });
      return suggestions;
    }

    suggestions.push({
      id: 'search',
      primary: t('admin.cluster.dns_resolvers.smart.suggestion.search', { value: raw }),
      secondary: t('admin.cluster.dns_resolvers.smart.suggestion.search_hint'),
      onPick: () => {
        setQ(raw);
        setSmart('');
        setSmartErrors([]);
      },
    });

    return suggestions;
  }, [smart, t]);

  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<FormState>(() => initForm());
  const [deleteState, setDeleteState] = useState<{ open: boolean; resolver?: DnsResolver; force: boolean }>({
    open: false,
    resolver: undefined,
    force: false,
  });

  const openCreate = () => {
    setForm(initForm());
    setEditor({ mode: 'create' });
  };

  const openEdit = (r: DnsResolver) => {
    setForm(initForm(r));
    setEditor({ mode: 'edit', resolver: r });
  };

  const createM = useMutation({
    mutationFn: async () => {
      const locId = parsePositiveInt(form.locationId.trim());
      return createDnsResolver({
        ipAddr: form.ipAddr.trim(),
        label: form.label.trim(),
        isUniversal: form.isUniversal,
        locationId: form.isUniversal ? null : locId ?? null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.created') });
      setEditor(null);
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const r = editor?.resolver;
      if (!r) throw new Error('Missing resolver');

      const locId = parsePositiveInt(form.locationId.trim());
      return updateDnsResolver({
        id: r.id,
        ipAddr: form.ipAddr.trim(),
        label: form.label.trim(),
        isUniversal: form.isUniversal,
        locationId: form.isUniversal ? null : locId ?? null,
      });
    },
    onMutate: () => {
      const resolverId = editor?.resolver?.id;
      if (!resolverId) return {};
      const ref = objectRef('DnsResolver', resolverId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
      const resolverId = editor?.resolver?.id;
      if (asId)
        chrome.trackActionState(asId, {
          actionLabelKey: 'admin.cluster.dns_resolvers.action.update',
          objectLabel: form.label.trim() || undefined,
          object: resolverId ? objectRef('DnsResolver', resolverId) : undefined,
        });

      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.saved') });
      setEditor(null);
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      const r = deleteState.resolver;
      if (!r) throw new Error('Missing resolver');
      return deleteDnsResolver({ id: r.id, force: deleteState.force });
    },
    onMutate: () => {
      const resolverId = deleteState.resolver?.id;
      if (!resolverId) return {};
      const ref = objectRef('DnsResolver', resolverId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
      const resolverId = deleteState.resolver?.id;
      if (asId)
        chrome.trackActionState(asId, {
          actionLabelKey: 'admin.cluster.dns_resolvers.action.delete',
          objectLabel: deleteState.resolver?.label ?? undefined,
          object: resolverId ? objectRef('DnsResolver', resolverId) : undefined,
        });

      await qc.invalidateQueries({ queryKey: ['dns_resolvers'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.dns_resolvers.toast.deleted') });
      setDeleteState({ open: false, resolver: undefined, force: false });
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  const busy = createM.isPending || updateM.isPending;

  if (listQ.isLoading) {
    return <LoadingState testId="admin.cluster.dns_resolvers.loading" />;
  }

  if (listQ.isError) {
    return (
      <ErrorState
        title={t('admin.cluster.dns_resolvers.error.title')}
        message={t('admin.cluster.dns_resolvers.error.body')}
        onRetry={() => listQ.refetch()}
        testId="admin.cluster.dns_resolvers.error"
      />
    );
  }

  return (
    <div className="mt-4 space-y-4" data-testid="admin.cluster.dns_resolvers.page">
      <FilterBar testId="admin.cluster.dns_resolvers.filters">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <SmartFilterInput
            ref={smartInputRef}
            testId="admin.cluster.dns_resolvers.search.input"
            value={smart}
            onChange={setSmart}
            onSubmit={() => applySmart()}
            placeholder={t('admin.cluster.dns_resolvers.filter.search_placeholder')}
            ariaLabel={t('admin.cluster.dns_resolvers.filter.search_placeholder')}
            suggestions={smartSuggestions}
            suffix={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
                aria-label={t('filters.help.open')}
                title={t('filters.help.open')}
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp className="h-4 w-4" aria-hidden />
              </button>
            }
          />

          {activeChips.length > 0 ? <div className="flex flex-wrap gap-2">{activeChips}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setAdvancedOpen(true)} testId="admin.cluster.dns_resolvers.advanced">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span>{t('filters.advanced.label')}</span>
          </Button>
          <CopyButton text={shareUrl} label={t('common.copy_link')} testId="admin.cluster.dns_resolvers.copy_link" />
          {(qTrim || isUniversal || location || smartErrors.length > 0) ? (
            <Button variant="secondary" onClick={clearAllFilters} testId="admin.cluster.dns_resolvers.filter.clear">
              {t('common.clear_filters')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => listQ.refetch()}>{t('common.refresh')}</Button>
          <Button variant="primary" onClick={openCreate} testId="admin.cluster.dns_resolvers.create">
            {t('admin.cluster.dns_resolvers.create.button')}
          </Button>
        </div>
      </FilterBar>

      {resolvers.length === 0 ? (
        <EmptyState
          title={t('admin.cluster.dns_resolvers.empty.title')}
          message={t('admin.cluster.dns_resolvers.empty.body')}
          testId="admin.cluster.dns_resolvers.empty"
        />
      ) : (
        <TableCard
          testId="admin.cluster.dns_resolvers.table"
          minWidth="lg"
          footer={
            <KeysetPagination
              testId="admin.cluster.dns_resolvers.pagination"
              canPrev={pagination.canPrev}
              canNext={canNext}
              page={pagination.page}
              pageCount={pagination.stack.length}
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.dns_resolvers.col.ip_addr')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.dns_resolvers.col.universal')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.location')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {resolvers.map((r) => {
              const id = r.id;
              const label = typeof r.label === 'string' && r.label.trim() ? r.label : `#${id}`;
              const ip = typeof r.ip_addr === 'string' ? r.ip_addr : '—';
              const uni = Boolean(r.is_universal);

              return (
                <tr key={id} data-testid={`admin.cluster.dns_resolvers.row.${id}`}>
                  <td className="px-3 py-2 text-fg">{label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{ip}</td>
                  <td className="px-3 py-2">
                    <Badge variant={uni ? 'ok' : 'neutral'}>
                      {uni ? t('admin.cluster.dns_resolvers.badge.universal') : t('admin.cluster.dns_resolvers.badge.location_bound')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted">{uni ? '—' : locLabel((r as any).location ?? null)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(r)}
                        testId={`admin.cluster.dns_resolvers.row.${id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteState({ open: true, resolver: r, force: false })}
                        testId={`admin.cluster.dns_resolvers.row.${id}.delete`}
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

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        width="lg"
        title={t('filters.advanced.title')}
        testId="admin.cluster.dns_resolvers.advanced.drawer"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={clearAllFilters}>
              {t('common.clear_filters')}
            </Button>
            <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
              {t('common.done')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('common.search')}</div>
            <Input
              testId="admin.cluster.dns_resolvers.advanced.q"
              ariaLabel={t('common.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.cluster.dns_resolvers.filter.search_placeholder')}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('admin.cluster.dns_resolvers.field.universal')}</div>
            <Select
              testId="admin.cluster.dns_resolvers.universal.select"
              aria-label={t('admin.cluster.dns_resolvers.field.universal')}
              value={isUniversal}
              onChange={(e) => setIsUniversal(e.target.value)}
              options={universalOptions}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('common.location')}</div>
            <Select
              testId="admin.cluster.dns_resolvers.location.select"
              aria-label={t('common.location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              options={locationOptions}
            />
          </div>
        </div>
      </Drawer>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('admin.cluster.dns_resolvers.smart.help.title')}
        intro={t('admin.cluster.dns_resolvers.smart.help.intro')}
        examples={[
          { example: '?', description: t('admin.cluster.dns_resolvers.smart.help.example_help') },
          { example: '8.8.8.8', description: t('admin.cluster.dns_resolvers.smart.help.example_search') },
          { example: 'location:1', description: t('admin.cluster.dns_resolvers.smart.help.example_location') },
          { example: 'universal:true', description: t('admin.cluster.dns_resolvers.smart.help.example_universal') },
        ]}
        topKeys={[
          { key: 'q', description: t('admin.cluster.dns_resolvers.smart.key.q'), example: 'q:google' },
          { key: 'location', description: t('admin.cluster.dns_resolvers.smart.key.location'), example: 'location:1' },
          { key: 'universal', description: t('admin.cluster.dns_resolvers.smart.key.universal'), example: 'universal:true' },
          { key: 'id', description: t('admin.cluster.dns_resolvers.smart.key.id'), example: 'id:12' },
        ]}
        inference={[
          t('admin.cluster.dns_resolvers.smart.help.inference.text'),
          t('admin.cluster.dns_resolvers.smart.help.inference.number'),
          t('admin.cluster.dns_resolvers.smart.help.inference.keyvalue'),
        ]}
        onInsertKey={insertSmartKey}
        testId="admin.cluster.dns_resolvers.smart.help"
        keyRowTestIdPrefix="admin.cluster.dns_resolvers.smart.help.key"
      />

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'edit' ? t('admin.cluster.dns_resolvers.edit.title') : t('admin.cluster.dns_resolvers.create.title')}
        onClose={() => (busy ? null : setEditor(null))}
        testId="admin.cluster.dns_resolvers.editor"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                if (editor?.mode === 'edit') updateM.mutate();
                else createM.mutate();
              }}
              disabled={!form.label.trim() || !form.ipAddr.trim() || (!form.isUniversal && !parsePositiveInt(form.locationId.trim()))}
              testId="admin.cluster.dns_resolvers.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('common.label')}</div>
            <Input
              testId="admin.cluster.dns_resolvers.editor.label"
              ariaLabel={t('common.label')}
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium text-fg">{t('admin.cluster.dns_resolvers.field.ip_addr')}</div>
            <div className="text-xs text-muted">{t('admin.cluster.dns_resolvers.field.ip_addr_desc')}</div>
            <Input
              testId="admin.cluster.dns_resolvers.editor.ip"
              ariaLabel={t('admin.cluster.dns_resolvers.field.ip_addr')}
              value={form.ipAddr}
              onChange={(e) => setForm((p) => ({ ...p, ipAddr: e.target.value }))}
              className="font-mono text-xs tabular-nums"
            />
          </div>

          <SwitchRow
            testId="admin.cluster.dns_resolvers.editor.universal"
            label={t('admin.cluster.dns_resolvers.field.universal')}
            description={t('admin.cluster.dns_resolvers.field.universal_desc')}
            checked={form.isUniversal}
            onChange={(v) => setForm((p) => ({ ...p, isUniversal: v }))}
          />

          {!form.isUniversal ? (
            <div className="space-y-1">
              <div className="text-sm font-medium text-fg">{t('common.location')}</div>
              <Select
                testId="admin.cluster.dns_resolvers.editor.location"
                value={form.locationId}
                onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                options={[{ value: '', label: t('common.select') }, ...locs.map((l) => ({ value: String(l.id), label: locLabel(l) }))]}
              />
            </div>
          ) : null}

          {locationsQ.isError ? (
            <Alert variant="warn" title={t('admin.cluster.dns_resolvers.locations.error')}>{formatErrorMessage(locationsQ.error)}</Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title={t('admin.cluster.dns_resolvers.delete.title')}
        description={
          deleteState.resolver
            ? t('admin.cluster.dns_resolvers.delete.desc', {
                label: typeof deleteState.resolver.label === 'string' ? deleteState.resolver.label : `#${deleteState.resolver.id}`,
              })
            : undefined
        }
        danger
        confirmLabel={t('common.delete')}
        confirmLoading={deleteM.isPending}
        onCancel={() => (deleteM.isPending ? null : setDeleteState({ open: false, resolver: undefined, force: false }))}
        onConfirm={() => deleteM.mutate()}
        testId="admin.cluster.dns_resolvers.delete"
      >
        <SwitchRow
          testId="admin.cluster.dns_resolvers.delete.force"
          label={t('admin.cluster.dns_resolvers.delete.force')}
          description={t('admin.cluster.dns_resolvers.delete.force_desc')}
          checked={deleteState.force}
          onChange={(v) => setDeleteState((p) => ({ ...p, force: v }))}
        />
      </ConfirmDialog>
    </div>
  );
}
