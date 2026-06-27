import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

import { useChrome } from '../../../../components/layout/ChromeContext';
import { FilterBar } from '../../../../components/layout/FilterBar';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { TableCard } from '../../../../components/ui/TableCard';

import { getMetaActionStateId } from '../../../../lib/api/haveapi';
import { fetchLocations, type Location } from '../../../../lib/api/infra';
import { objectRef } from '../../../../lib/objectRef';
import { parseBoolParam, parseNonNegativeInt, parsePositiveInt } from '../../../../lib/parse';
import {
  createNetwork,
  fetchNetworks,
  updateNetwork,
  type Network,
  type NetworkPurpose,
  type NetworkRole,
  type NetworkSplitAccess,
} from '../../../../lib/api/networks';

function locLabel(l: Location | null | undefined): string {
  const x: any = l ?? {};
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  return label || (typeof x.id === 'number' ? `#${x.id}` : '—');
}

function netLabel(n: Network): string {
  const addr = typeof n.address === 'string' ? n.address : '';
  const prefix = typeof n.prefix === 'number' ? String(n.prefix) : '';
  if (addr && prefix) return `${addr}/${prefix}`;
  if (addr) return addr;
  return `#${n.id}`;
}

type EditorState =
  | null
  | {
      mode: 'create' | 'edit';
      network?: Network;
    };

type FormState = {
  label: string;
  ipVersion: '4' | '6';
  address: string;
  prefix: string;
  role: NetworkRole;
  managed: boolean;
  splitAccess: NetworkSplitAccess;
  splitPrefix: string;
  purpose: NetworkPurpose;
  addIpAddresses: boolean;
};

function initForm(n?: Network): FormState {
  const x: any = n ?? {};
  const ipV = typeof x.ip_version === 'number' && (x.ip_version === 4 || x.ip_version === 6) ? String(x.ip_version) : '4';
  const prefix = typeof x.prefix === 'number' ? String(x.prefix) : '';
  const splitPrefix = typeof x.split_prefix === 'number' ? String(x.split_prefix) : prefix;

  return {
    label: typeof x.label === 'string' ? x.label : '',
    ipVersion: ipV === '6' ? '6' : '4',
    address: typeof x.address === 'string' ? x.address : '',
    prefix,
    role: (x.role as NetworkRole) ?? 'public_access',
    managed: typeof x.managed === 'boolean' ? x.managed : true,
    splitAccess: (x.split_access as NetworkSplitAccess) ?? 'no_access',
    splitPrefix,
    purpose: (x.purpose as NetworkPurpose) ?? 'any',
    addIpAddresses: false,
  };
}

function parseIpVersion(s: string | null | undefined): 4 | 6 | undefined {
  const n = parseNonNegativeInt(s);
  if (n === 4 || n === 6) return n;
  return undefined;
}

function roleOptions(t: (k: string) => string): SelectOption[] {
  return [
    { value: '', label: t('common.all') },
    { value: 'public_access', label: t('admin.cluster.networks.role.public') },
    { value: 'private_access', label: t('admin.cluster.networks.role.private') },
  ];
}

function purposeOptions(t: (k: string) => string): SelectOption[] {
  return [
    { value: '', label: t('common.all') },
    { value: 'any', label: t('admin.cluster.networks.purpose.any') },
    { value: 'vps', label: t('admin.cluster.networks.purpose.vps') },
    { value: 'export', label: t('admin.cluster.networks.purpose.export') },
  ];
}

function ipVersionOptions(t: (k: string) => string): SelectOption[] {
  return [
    { value: '', label: t('common.all') },
    { value: '4', label: t('admin.cluster.networks.ipv4') },
    { value: '6', label: t('admin.cluster.networks.ipv6') },
  ];
}

function managedOptions(t: (k: string) => string): SelectOption[] {
  return [
    { value: '', label: t('common.all') },
    { value: 'true', label: t('admin.cluster.networks.managed.true') },
    { value: 'false', label: t('admin.cluster.networks.managed.false') },
  ];
}

export function NetworksPage() {
  const { t } = useI18n();
  const chrome = useChrome();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [location, setLocation] = useState(() => searchParams.get('location') ?? '');
  const [ipVersion, setIpVersion] = useState(() => searchParams.get('ip_version') ?? '');
  const [role, setRole] = useState(() => searchParams.get('role') ?? '');
  const [managed, setManaged] = useState(() => searchParams.get('managed') ?? '');
  const [purpose, setPurpose] = useState(() => searchParams.get('purpose') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync local state on navigation.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlLoc = searchParams.get('location') ?? '';
    const urlIp = searchParams.get('ip_version') ?? '';
    const urlRole = searchParams.get('role') ?? '';
    const urlManaged = searchParams.get('managed') ?? '';
    const urlPurpose = searchParams.get('purpose') ?? '';
    if (urlQ !== q) setQ(urlQ);
    if (urlLoc !== location) setLocation(urlLoc);
    if (urlIp !== ipVersion) setIpVersion(urlIp);
    if (urlRole !== role) setRole(urlRole);
    if (urlManaged !== managed) setManaged(urlManaged);
    if (urlPurpose !== purpose) setPurpose(urlPurpose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const locationId = useMemo(() => parsePositiveInt(location), [location]);
  const ipV = useMemo(() => parseIpVersion(ipVersion), [ipVersion]);
  const managedBool = useMemo(() => parseBoolParam(managed), [managed]);

  const roleKey = useMemo(() => {
    const s = (role ?? '').trim();
    return s === 'public_access' || s === 'private_access' ? (s as NetworkRole) : undefined;
  }, [role]);

  const purposeKey = useMemo(() => {
    const s = (purpose ?? '').trim();
    return s === 'any' || s === 'vps' || s === 'export' ? (s as NetworkPurpose) : undefined;
  }, [purpose]);

  const filtersActive = Boolean(qTrim || locationId || ipV || roleKey || managedBool !== undefined || purposeKey || smartErrors.length > 0);
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
    setLocation('');
    setIpVersion('');
    setRole('');
    setManaged('');
    setPurpose('');
  }

  // Persist filters in URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (locationId) next.set('location', String(locationId));
    else next.delete('location');

    if (ipV) next.set('ip_version', String(ipV));
    else next.delete('ip_version');

    if (roleKey) next.set('role', roleKey);
    else next.delete('role');

    if (managedBool === true) next.set('managed', 'true');
    else if (managedBool === false) next.set('managed', 'false');
    else next.delete('managed');

    if (purposeKey) next.set('purpose', purposeKey);
    else next.delete('purpose');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [ipV, locationId, managedBool, purposeKey, qTrim, roleKey, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: 'admin.cluster.networks',
    filterKey: JSON.stringify({ q: qTrim, l: locationId, ip: ipV, r: roleKey, m: managedBool, p: purposeKey }),
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

  useEffect(() => {
    if (smart.trim() === '?') setHelpOpen(true);
  }, [smart]);

  function resolveLocation(value: string): number | undefined {
    const id = parsePositiveInt(value);
    if (id) return id;
    const lower = value.trim().toLowerCase();
    if (!lower) return undefined;
    const match = locs.find((l) => {
      const label = locLabel(l).toLowerCase();
      return label === lower || label.startsWith(lower);
    });
    return match?.id;
  }

  function applySmart(rawInput?: string) {
    const raw = String(rawInput ?? smart).trim();
    if (!raw) return;
    if (raw === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(raw);
    let nextQ = qTrim;
    let nextLocation = location;
    let nextIpVersion = ipVersion;
    let nextRole = role;
    let nextManaged = managed;
    let nextPurpose = purpose;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);

      if (!kv) {
        const n = parseNumericToken(token);
        if (n !== null) {
          navigate(`/admin/cluster/networks/${n}`);
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
        case 'q':
        case 'search':
        case 'label':
        case 'addr':
        case 'address':
          nextQ = value;
          break;
        case 'id': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else {
            navigate(`/admin/cluster/networks/${n}`);
            setSmart('');
            setSmartErrors([]);
            return;
          }
          break;
        }
        case 'location':
        case 'loc': {
          if (value === 'all') nextLocation = '';
          else {
            const id = resolveLocation(value);
            if (!id) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
            else nextLocation = String(id);
          }
          break;
        }
        case 'version':
        case 'ip_version':
        case 'ipv':
          if (value === 'all') nextIpVersion = '';
          else if (value === '4' || value === '6') nextIpVersion = value;
          else errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          break;
        case 'role':
          if (value === 'all') nextRole = '';
          else if (value === 'public_access' || value === 'private_access') nextRole = value;
          else errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          break;
        case 'managed':
          if (value === 'all') nextManaged = '';
          else {
            const parsed = parseBoolParam(value);
            if (parsed === undefined) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
            else nextManaged = parsed ? 'true' : 'false';
          }
          break;
        case 'purpose':
          if (value === 'all') nextPurpose = '';
          else if (value === 'any' || value === 'vps' || value === 'export') nextPurpose = value;
          else errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          break;
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
          break;
      }
    }

    setSmartErrors(errors);
    if (errors.length > 0) return;
    setQ(nextQ);
    setLocation(nextLocation);
    setIpVersion(nextIpVersion);
    setRole(nextRole);
    setManaged(nextManaged);
    setPurpose(nextPurpose);
    setSmart('');
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('admin.cluster.networks.smart.help.title'),
          secondary: t('admin.cluster.networks.smart.help.example_help'),
          onPick: () => {
            setHelpOpen(true);
            setSmart('');
          },
        },
      ];
    }

    const out: SmartFilterSuggestion[] = [];
    const n = parseNumericToken(needle);
    if (n !== null) {
      out.push({
        id: `open-${n}`,
        primary: t('admin.cluster.networks.smart.suggestion.id', { id: n }),
        secondary: t('admin.cluster.networks.smart.suggestion.id_hint'),
        onPick: () => {
          navigate(`/admin/cluster/networks/${n}`);
          setSmart('');
          setSmartErrors([]);
        },
      });
    }

    out.push({
      id: `search-${needle}`,
      primary: t('admin.cluster.networks.smart.suggestion.search', { value: needle }),
      secondary: t('admin.cluster.networks.smart.suggestion.search_hint'),
      onPick: () => applySmart(needle),
    });

    return out;
  }, [navigate, smart, t]);

  const listQ = useQuery({
    queryKey: ['networks', pagination.cursor, pagination.limit, qTrim, locationId, ipV, roleKey, managedBool, purposeKey],
    queryFn: async () =>
      (
        await fetchNetworks({
          limit: pagination.limit,
          fromId: pagination.cursor,
          q: qTrim || undefined,
          locationId,
          ipVersion: ipV,
          role: roleKey,
          managed: managedBool,
          purpose: purposeKey,
        })
      ).data,
    staleTime: 5_000,
  });

  const networks = listQ.data ?? [];

  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<FormState>(() => initForm());

  const openCreate = () => {
    setForm(initForm());
    setEditor({ mode: 'create' });
  };

  const openEdit = (n: Network) => {
    setForm(initForm(n));
    setEditor({ mode: 'edit', network: n });
  };

  // audit:ignore missing-local-lock (new network has no stable object id before creation; UI disables submit while pending)
  const createM = useMutation({
    mutationFn: async () => {
      const prefixNum = parseNonNegativeInt(form.prefix);
      const splitPrefixNum = parseNonNegativeInt(form.splitPrefix);

      if (!prefixNum || !splitPrefixNum) throw new Error('Invalid prefix');

      return createNetwork({
        label: form.label.trim() || undefined,
        ipVersion: form.ipVersion === '6' ? 6 : 4,
        address: form.address.trim(),
        prefix: prefixNum,
        role: form.role,
        managed: form.managed,
        splitAccess: form.splitAccess,
        splitPrefix: splitPrefixNum,
        purpose: form.purpose,
        addIpAddresses: form.addIpAddresses,
      });
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
      const networkId = res.data?.id;
      if (asId)
        chrome.trackActionState(asId, {
          actionLabelKey: 'admin.cluster.networks.action.create',
          objectLabel: form.address.trim() || undefined,
          object: typeof networkId === 'number' ? objectRef('Network', networkId) : undefined,
        });

      await qc.invalidateQueries({ queryKey: ['networks'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.networks.toast.created') });
      setEditor(null);
    },
    onError: (e) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e) }),
    });

  const updateM = useMutation({
    mutationFn: async () => {
      const n = editor?.network;
      if (!n) throw new Error('Missing network');

      const prefixNum = parseNonNegativeInt(form.prefix);
      const splitPrefixNum = parseNonNegativeInt(form.splitPrefix);
      if (!prefixNum || !splitPrefixNum) throw new Error('Invalid prefix');

      return updateNetwork({
        id: n.id,
        label: form.label.trim(),
        ipVersion: form.ipVersion === '6' ? 6 : 4,
        address: form.address.trim(),
        prefix: prefixNum,
        role: form.role,
        managed: form.managed,
        splitAccess: form.splitAccess,
        splitPrefix: splitPrefixNum,
        purpose: form.purpose,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['networks'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.networks.toast.saved') });
      setEditor(null);
    },
    onError: (e) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e) }),
  });

  const busy = createM.isPending || updateM.isPending;

  if (listQ.isLoading) {
    return <LoadingState testId="admin.cluster.networks.loading" />;
  }

  if (listQ.isError) {
    return (
      <ErrorState
        title={t('admin.cluster.networks.error.title')}
        message={t('admin.cluster.networks.error.body')}
        onRetry={() => listQ.refetch()}
        testId="admin.cluster.networks.error"
      />
    );
  }

  const canSave =
    Boolean(form.address.trim()) &&
    Boolean(parseNonNegativeInt(form.prefix)) &&
    Boolean(parseNonNegativeInt(form.splitPrefix)) &&
    Boolean(form.role) &&
    Boolean(form.splitAccess) &&
    Boolean(form.purpose);

  const pageCursor = networks.length > 0 ? networks[networks.length - 1]?.id : undefined;
  const hasMore = networks.length === pagination.limit && typeof pageCursor === 'number';
  const canNext = pagination.hasForward || hasMore;

  return (
    <div className="mt-4 space-y-4" data-testid="admin.cluster.networks.page">
      <FilterBar testId="admin.cluster.networks.filters">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SmartFilterInput
              ref={smartInputRef}
              testId="admin.cluster.networks.search.input"
              value={smart}
              onChange={setSmart}
              onSubmit={() => applySmart()}
              suggestions={smartSuggestions}
              ariaLabel={t('admin.cluster.networks.filter.q_placeholder')}
              placeholder={t('admin.cluster.networks.filter.q_placeholder')}
              className="min-w-0 flex-1"
              suffix={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('filters.help.open')}
                  onClick={() => setHelpOpen(true)}
                  className="px-2"
                  testId="admin.cluster.networks.smart.help_button"
                >
                  <CircleHelp className="h-4 w-4" />
                </Button>
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setAdvancedOpen(true)}
                testId="admin.cluster.networks.advanced.open"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {t('common.advanced')}
              </Button>
              <CopyButton text={shareUrl} label={t('common.copy_link')} testId="admin.cluster.networks.copy_link" />
              <Button variant="secondary" onClick={() => listQ.refetch()}>
                {t('common.refresh')}
              </Button>
              {filtersActive ? (
                <Button variant="secondary" onClick={clearAllFilters} testId="admin.cluster.networks.filter.clear">
                  {t('common.clear_filters')}
                </Button>
              ) : null}
              <Button variant="primary" onClick={openCreate} testId="admin.cluster.networks.create">
                {t('admin.cluster.networks.create.button')}
              </Button>
            </div>
          </div>

          {qTrim || locationId || ipV || roleKey || managedBool !== undefined || purposeKey || smartErrors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {qTrim ? <FilterChip label={`q: ${qTrim}`} onRemove={() => setQ('')} /> : null}
              {locationId ? <FilterChip label={`${t('common.location')}: ${locLabel(locs.find((l) => l.id === locationId))}`} onRemove={() => setLocation('')} /> : null}
              {ipV ? <FilterChip label={`${t('admin.cluster.networks.field.ip_version')}: IPv${ipV}`} onRemove={() => setIpVersion('')} /> : null}
              {roleKey ? <FilterChip label={`${t('admin.cluster.networks.field.role')}: ${t(roleKey === 'public_access' ? 'admin.cluster.networks.role.public' : 'admin.cluster.networks.role.private')}`} onRemove={() => setRole('')} /> : null}
              {managedBool !== undefined ? <FilterChip label={`${t('admin.cluster.networks.field.managed')}: ${t(managedBool ? 'admin.cluster.networks.managed.true' : 'admin.cluster.networks.managed.false')}`} onRemove={() => setManaged('')} /> : null}
              {purposeKey ? <FilterChip label={`${t('admin.cluster.networks.field.purpose')}: ${t(`admin.cluster.networks.purpose.${purposeKey}`)}`} onRemove={() => setPurpose('')} /> : null}
              {smartErrors.map((err, idx) => (
                <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))} />
              ))}
            </div>
          ) : null}
        </div>
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('admin.cluster.networks.smart.help.title')}
        intro={t('admin.cluster.networks.smart.help.intro')}
        examples={[
          { example: '?', description: t('admin.cluster.networks.smart.help.example_help') },
          { example: '198.51.100', description: t('admin.cluster.networks.smart.help.example_search') },
          { example: 'location:1', description: t('admin.cluster.networks.smart.help.example_location') },
          { example: 'managed:true', description: t('admin.cluster.networks.smart.help.example_managed') },
        ]}
        topKeys={[
          { key: 'q', description: t('admin.cluster.networks.smart.key.q'), example: 'q:198.51.100' },
          { key: 'id', description: t('admin.cluster.networks.smart.key.id'), example: 'id:101' },
          { key: 'location', description: t('admin.cluster.networks.smart.key.location'), example: 'location:1' },
          { key: 'version', description: t('admin.cluster.networks.smart.key.version'), example: 'version:6' },
          { key: 'role', description: t('admin.cluster.networks.smart.key.role'), example: 'role:private_access' },
          { key: 'managed', description: t('admin.cluster.networks.smart.key.managed'), example: 'managed:true' },
        ]}
        moreKeys={[
          { key: 'purpose', description: t('admin.cluster.networks.smart.key.purpose'), example: 'purpose:vps' },
        ]}
        inference={[
          t('admin.cluster.networks.smart.help.inference.text'),
          t('admin.cluster.networks.smart.help.inference.number'),
          t('admin.cluster.networks.smart.help.inference.keyvalue'),
        ]}
        onInsertKey={insertSmartKey}
      />

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title={t('common.advanced_filters')}
        width="lg"
        testId="admin.cluster.networks.advanced"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={clearAllFilters}>{t('common.clear_filters')}</Button>
            <Button variant="primary" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input testId="admin.cluster.networks.filter.q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.cluster.networks.filter.q_placeholder')} />
          <Select testId="admin.cluster.networks.filter.location" value={location} onChange={(e) => setLocation(e.target.value)} options={locationOptions} />
          <Select testId="admin.cluster.networks.filter.ip_version" value={ipVersion} onChange={(e) => setIpVersion(e.target.value)} options={ipVersionOptions(t)} />
          <Select testId="admin.cluster.networks.filter.role" value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions(t)} />
          <Select testId="admin.cluster.networks.filter.managed" value={managed} onChange={(e) => setManaged(e.target.value)} options={managedOptions(t)} />
          <Select testId="admin.cluster.networks.filter.purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} options={purposeOptions(t)} />
        </div>
      </Drawer>

      {networks.length === 0 ? (
        <EmptyState
          title={t('admin.cluster.networks.empty.title')}
          message={t('admin.cluster.networks.empty.body')}
          testId="admin.cluster.networks.empty"
        />
      ) : (
        <TableCard
          testId="admin.cluster.networks.table"
          minWidth="xl"
          footer={
            <KeysetPagination
              testId="admin.cluster.networks.pagination"
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.networks.col.network')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.label')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.networks.col.role')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.networks.col.purpose')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.networks.col.managed')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.networks.col.used')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.networks.col.assigned')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.networks.col.owned')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.networks.col.free')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.location')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.networks.col.locations')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => {
              const id = n.id;
              const label = typeof n.label === 'string' ? n.label.trim() : '';
              const roleVal = String(n.role ?? '');
              const purposeVal = String(n.purpose ?? '');
              const managedVal = Boolean(n.managed);

              const size = typeof n.size === 'number' ? n.size : undefined;
              const used = typeof n.used === 'number' ? n.used : undefined;
              const assigned = typeof n.assigned === 'number' ? n.assigned : undefined;
              const owned = typeof n.owned === 'number' ? n.owned : undefined;
              const taken = typeof n.taken === 'number' ? n.taken : undefined;

              const free =
                typeof size === 'number' && typeof taken === 'number' && Number.isFinite(size) && Number.isFinite(taken)
                  ? Math.max(0, size - taken)
                  : undefined;

              return (
                <tr key={id} data-testid={`admin.cluster.networks.row.${id}`}>
                  <td className="px-3 py-2">
                    <Link className="font-mono text-xs text-fg hover:underline" to={`/admin/cluster/networks/${id}`}>
                      {netLabel(n)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-fg">{label || '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={roleVal === 'public_access' ? 'ok' : 'neutral'}>
                      {roleVal === 'public_access' ? t('admin.cluster.networks.role.public') : t('admin.cluster.networks.role.private')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={purposeVal === 'vps' ? 'ok' : purposeVal === 'export' ? 'warn' : 'neutral'}>
                      {purposeVal === 'vps'
                        ? t('admin.cluster.networks.purpose.vps')
                        : purposeVal === 'export'
                          ? t('admin.cluster.networks.purpose.export')
                          : t('admin.cluster.networks.purpose.any')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={managedVal ? 'ok' : 'neutral'}>
                      {managedVal ? t('admin.cluster.networks.managed.true') : t('admin.cluster.networks.managed.false')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{used ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{assigned ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{owned ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{free ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{locLabel((n as LegacyAny).primary_location ?? null)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{(n as LegacyAny).locations_count ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(n)}
                        testId={`admin.cluster.networks.row.${id}.edit`}
                      >
                        {t('common.edit')}
                      </Button>
                      <LinkButton
                        size="sm"
                        variant="primary"
                        to={`/admin/cluster/networks/${id}`}
                        testId={`admin.cluster.networks.row.${id}.open`}
                      >
                        {t('common.open')}
                      </LinkButton>
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
        title={editor?.mode === 'edit' ? t('admin.cluster.networks.edit.title') : t('admin.cluster.networks.create.title')}
        onClose={() => (busy ? null : setEditor(null))}
        testId="admin.cluster.networks.editor"
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
              disabled={!canSave}
              testId="admin.cluster.networks.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="neutral" title={t('admin.cluster.networks.editor.notice.title')}>
            {t('admin.cluster.networks.editor.notice.body')}
          </Alert>

          <div>
            <div className="text-xs font-semibold text-muted">{t('common.label')}</div>
            <div className="mt-1">
              <Input
                testId="admin.cluster.networks.editor.label"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.ip_version')}</div>
              <div className="mt-1">
                <Select
                  testId="admin.cluster.networks.editor.ip_version"
                  value={form.ipVersion}
                  onChange={(e) => setForm((p) => ({ ...p, ipVersion: e.target.value === '6' ? '6' : '4' }))}
                  options={[
                    { value: '4', label: t('admin.cluster.networks.ipv4') },
                    { value: '6', label: t('admin.cluster.networks.ipv6') },
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.role')}</div>
              <div className="mt-1">
                <Select
                  testId="admin.cluster.networks.editor.role"
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      role: e.target.value === 'private_access' ? 'private_access' : 'public_access',
                    }))
                  }
                  options={[
                    { value: 'public_access', label: t('admin.cluster.networks.role.public') },
                    { value: 'private_access', label: t('admin.cluster.networks.role.private') },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.address')}</div>
              <div className="mt-1">
                <Input
                  testId="admin.cluster.networks.editor.address"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="font-mono text-xs tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.prefix')}</div>
              <div className="mt-1">
                <Input
                  testId="admin.cluster.networks.editor.prefix"
                  value={form.prefix}
                  onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))}
                  inputMode="numeric"
                  className="font-mono text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.purpose')}</div>
              <div className="mt-1">
                <Select
                  testId="admin.cluster.networks.editor.purpose"
                  value={form.purpose}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      purpose:
                        e.target.value === 'vps' || e.target.value === 'export' || e.target.value === 'any'
                          ? (e.target.value as NetworkPurpose)
                          : 'any',
                    }))
                  }
                  options={[
                    { value: 'any', label: t('admin.cluster.networks.purpose.any') },
                    { value: 'vps', label: t('admin.cluster.networks.purpose.vps') },
                    { value: 'export', label: t('admin.cluster.networks.purpose.export') },
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.split_access')}</div>
              <div className="mt-1">
                <Select
                  testId="admin.cluster.networks.editor.split_access"
                  value={form.splitAccess}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      splitAccess:
                        e.target.value === 'user_split' || e.target.value === 'owner_split' || e.target.value === 'no_access'
                          ? (e.target.value as NetworkSplitAccess)
                          : 'no_access',
                    }))
                  }
                  options={[
                    { value: 'no_access', label: t('admin.cluster.networks.split_access.no_access') },
                    { value: 'user_split', label: t('admin.cluster.networks.split_access.user_split') },
                    { value: 'owner_split', label: t('admin.cluster.networks.split_access.owner_split') },
                  ]}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted">{t('admin.cluster.networks.field.split_prefix')}</div>
            <div className="mt-1 text-xs text-muted">{t('admin.cluster.networks.field.split_prefix_desc')}</div>
            <div className="mt-2">
              <Input
                testId="admin.cluster.networks.editor.split_prefix"
                value={form.splitPrefix}
                onChange={(e) => setForm((p) => ({ ...p, splitPrefix: e.target.value }))}
                inputMode="numeric"
                className="font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <SwitchRow
            testId="admin.cluster.networks.editor.managed"
            checked={form.managed}
            onChange={(v) => setForm((p) => ({ ...p, managed: v }))}
            label={t('admin.cluster.networks.field.managed')}
            description={t('admin.cluster.networks.field.managed_desc')}
          />

          {editor?.mode === 'create' ? (
            <SwitchRow
              testId="admin.cluster.networks.editor.add_ip_addresses"
              checked={form.addIpAddresses}
              onChange={(v) => setForm((p) => ({ ...p, addIpAddresses: v }))}
              label={t('admin.cluster.networks.field.add_ip_addresses')}
              description={t('admin.cluster.networks.field.add_ip_addresses_desc')}
            />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
