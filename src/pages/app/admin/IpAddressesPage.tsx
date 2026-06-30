import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { fetchIpAddresses, type IpAddress } from '../../../lib/api/ipAddresses';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { parseBoolParam, parseNonNegativeInt, parsePositiveInt } from '../../../lib/parse';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';

import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { LoadingState } from '../../../components/ui/LoadingState';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';

import { IpAddressesFilters } from './ipAddresses/IpAddressesFilters';
import { IpAddressesListMobile } from './ipAddresses/IpAddressesListMobile';
import { IpAddressesListTable } from './ipAddresses/IpAddressesListTable';
import {
  canonicalKey,
  IpListOrder,
  ipId,
  looksLikeIpish,
  parseBoolToken,
  resolveOrderValue,
  resolveVersionValue,
} from './ipAddresses/ipAddressListSemantics';

export function IpAddressesPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();
  const location = useLocation();
  const [sp, setSp] = useSearchParams();

  const na = t('common.na');

  const ipDetailBasePath = useMemo(() => {
    const networkingPrefix = `${basePath}/networking/ip-addresses`;
    return location.pathname.startsWith(networkingPrefix) ? networkingPrefix : `${basePath}/ip-addresses`;
  }, [basePath, location.pathname]);

  const qText = useMemo(() => String(sp.get('q') ?? ''), [sp]);
  const addr = useMemo(() => String(sp.get('addr') ?? ''), [sp]);
  const prefixNum = useMemo(() => {
    const parsed = parseNonNegativeInt(sp.get('prefix'));
    if (parsed === undefined || parsed < 0 || parsed > 128) return undefined;
    return parsed;
  }, [sp]);
  const vpsId = useMemo(() => parsePositiveInt(sp.get('vps')), [sp]);
  const userId = useMemo(() => parsePositiveInt(sp.get('user')), [sp]);
  const networkId = useMemo(() => parsePositiveInt(sp.get('network')), [sp]);
  const ifaceId = useMemo(() => parsePositiveInt(sp.get('network_interface')), [sp]);
  const locationId = useMemo(() => parsePositiveInt(sp.get('location')), [sp]);
  const versionNum = useMemo(() => {
    const value = String(sp.get('version') ?? '').trim();
    if (value === '4') return 4;
    if (value === '6') return 6;
    return undefined;
  }, [sp]);
  const assignedToInterface = useMemo(() => parseBoolParam(sp.get('assigned_to_interface')), [sp]);
  const order = useMemo<IpListOrder>(() => {
    const value = String(sp.get('order') ?? '').trim().toLowerCase();
    if (value === 'asc' || value === 'interface' || value === 'desc') return value;
    return 'desc';
  }, [sp]);

  const setTextParam = (key: string, value: string | undefined) => {
    const trimmed = String(value ?? '').trim();
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (trimmed) next.set(key, trimmed);
      else next.delete(key);
      return next;
    });
  };

  const setIntParam = (key: string, value: number | undefined | null) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) next.set(key, String(Math.floor(value)));
      else next.delete(key);
      return next;
    });
  };

  const setBoolParamInUrl = (key: string, value: boolean | undefined) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (value === true) next.set(key, '1');
      else if (value === false) next.set(key, '0');
      else next.delete(key);
      return next;
    });
  };

  const setAddressFilter = (nextAddr: string, nextPrefix?: string) => {
    const addrValue = nextAddr.trim();
    const prefixValue = String(nextPrefix ?? '').trim();

    setSp((prev) => {
      const next = new URLSearchParams(prev);

      if (addrValue) next.set('addr', addrValue);
      else next.delete('addr');

      if (prefixValue) next.set('prefix', prefixValue);
      else next.delete('prefix');

      return next;
    });
  };

  const filtersActive = Boolean(
    qText.trim() ||
      addr.trim() ||
      prefixNum !== undefined ||
      vpsId !== undefined ||
      userId !== undefined ||
      networkId !== undefined ||
      ifaceId !== undefined ||
      locationId !== undefined ||
      versionNum !== undefined ||
      assignedToInterface !== undefined
  );

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [userLookup, setUserLookup] = useState('');

  useEffect(() => {
    if (advancedOpen) return;
    setUserLookup(userId !== undefined ? String(userId) : '');
  }, [advancedOpen, userId]);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('addr');
      next.delete('prefix');
      next.delete('vps');
      next.delete('user');
      next.delete('network');
      next.delete('network_interface');
      next.delete('location');
      next.delete('version');
      next.delete('assigned_to_interface');
      next.delete('order');
      return next;
    });
  };

  const pagination = useKeysetPagination({
    id: 'admin.ip_addresses.list',
    filterKey: JSON.stringify({
      q: qText.trim(),
      addr: addr.trim(),
      prefixNum,
      vpsId,
      userId,
      networkId,
      ifaceId,
      locationId,
      versionNum,
      assignedToInterface,
      order,
      scope: basePath,
    }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: [
      'ip_addresses',
      'index',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qText.trim() || undefined,
        addr: addr.trim() || undefined,
        prefix: prefixNum,
        vps: vpsId,
        user: userId,
        network: networkId,
        networkInterface: ifaceId,
        location: locationId,
        version: versionNum,
        assignedToInterface,
        order,
      },
    ],
    queryFn: async () =>
      (
        await fetchIpAddresses({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qText.trim() || undefined,
          addr: addr.trim() || undefined,
          prefix: prefixNum,
          vps: vpsId,
          user: userId,
          network: networkId,
          networkInterface: ifaceId,
          location: locationId,
          version: versionNum,
          assignedToInterface,
          order: order === 'desc' ? undefined : order,
          purpose: 'vps',
          includes: 'network,network_interface,vps,user',
        })
      ).data,
    staleTime: 10_000,
  });

  const pageData = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || pageData.length > 0;

  const openIp = (ipId: number) => {
    navigate(`${ipDetailBasePath}/${ipId}`);
  };

  const applySmartText = (raw: string) => {
    const input = String(raw ?? '').trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input);

    if (tokens.length === 1) {
      const num = parseNumericToken(tokens[0] ?? '');
      if (num) {
        openIp(num);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    const plain: string[] = [];
    const errors: string[] = [];

    tokens.forEach((token) => {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        plain.push(unquoteSmartValue(token));
        return;
      }

      const key = canonicalKey(kv.rawKey);
      if (!key) {
        plain.push(unquoteSmartValue(token));
        return;
      }

      const valueRaw = unquoteSmartValue(kv.rawValue);
      if (!valueRaw.trim()) {
        errors.push(t('filters.smart.error.missing_value', { key: kv.rawKey.trim() }));
        return;
      }

      switch (key) {
        case 'id': {
          const id = parseNumericToken(valueRaw);
          if (!id) errors.push(t('admin.ip_addresses.smart.error.id', { value: valueRaw }));
          else openIp(id);
          return;
        }
        case 'q':
          setTextParam('q', valueRaw);
          return;
        case 'addr': {
          const match = valueRaw.trim().match(/^(.+?)\/(\d+)$/);
          if (match && match[1] && match[2]) {
            setAddressFilter(match[1], match[2]);
          } else {
            setAddressFilter(valueRaw.trim());
          }
          return;
        }
        case 'prefix': {
          const prefix = parseNonNegativeInt(valueRaw);
          if (prefix === undefined || prefix < 0 || prefix > 128) errors.push(t('admin.ip_addresses.smart.error.prefix', { value: valueRaw }));
          else setTextParam('prefix', String(prefix));
          return;
        }
        case 'vps':
        case 'user':
        case 'network':
        case 'iface':
        case 'location': {
          const id = parsePositiveInt(valueRaw);
          if (!id) {
            errors.push(t('admin.ip_addresses.smart.error.int', { key, value: valueRaw }));
            return;
          }
          const targetKey = key === 'iface' ? 'network_interface' : key;
          setIntParam(targetKey, id);
          return;
        }
        case 'version': {
          const version = resolveVersionValue(valueRaw);
          if (!version) errors.push(t('admin.ip_addresses.smart.error.version', { value: valueRaw }));
          else setTextParam('version', String(version));
          return;
        }
        case 'assigned': {
          const parsed = parseBoolToken(valueRaw);
          if (parsed === null) errors.push(t('admin.ip_addresses.smart.error.bool', { key: 'assigned', value: valueRaw }));
          else setBoolParamInUrl('assigned_to_interface', parsed);
          return;
        }
        case 'order': {
          const parsed = resolveOrderValue(valueRaw);
          if (!parsed) errors.push(t('admin.ip_addresses.smart.error.order', { value: valueRaw }));
          else setTextParam('order', parsed === 'desc' ? undefined : parsed);
          return;
        }
      }
    });

    const qPlain = plain.join(' ').trim();
    if (qPlain) {
      const match = qPlain.match(/^(.+?)\/(\d+)$/);
      if (match && match[1] && (match[1].includes('.') || match[1].includes(':'))) setTextParam('q', match[1]);
      else setTextParam('q', qPlain);
    }

    setSmart('');
    setSmartErrors(errors);
    if (errors.length > 0) {
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
    }
  };

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const suggestions: SmartFilterSuggestion[] = [];
    if (!smartNeedle) return suggestions;

    if (smartNeedle === '?') {
      suggestions.push({
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => setHelpOpen(true),
        testId: 'admin.ip_addresses.smart.suggest.help',
      });
      return suggestions;
    }

    const tokens = tokenizeSmartInput(smartNeedle);
    if (tokens.length === 1) {
      const kv = splitKeyValueToken(tokens[0] ?? '');
      if (kv && canonicalKey(kv.rawKey)) return suggestions;
    }

    const num = parseNumericToken(smartNeedle);
    if (num) {
      suggestions.push({
        id: 'open',
        primary: t('admin.ip_addresses.smart.suggest.open', { id: num }),
        secondary: t('admin.ip_addresses.smart.suggest.open.secondary'),
        onPick: () => {
          openIp(num);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.ip_addresses.smart.suggest.open',
      });
    }

    if (looksLikeIpish(smartNeedle)) {
      const match = smartNeedle.match(/^(.+?)\/(\d+)$/);
      const q = match && match[1] ? match[1] : smartNeedle;
      const prefix = match && match[2] ? match[2] : null;

      suggestions.push({
        id: 'search',
        primary: t('admin.ip_addresses.smart.suggest.search', { q }),
        secondary: t('admin.ip_addresses.smart.suggest.search.secondary'),
        onPick: () => {
          setTextParam('q', q);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.ip_addresses.smart.suggest.search',
      });

      suggestions.push({
        id: 'addr',
        primary: prefix
          ? t('admin.ip_addresses.smart.suggest.addr_prefix', { addr: q, prefix })
          : t('admin.ip_addresses.smart.suggest.addr', { addr: q }),
        secondary: t('admin.ip_addresses.smart.suggest.addr.secondary'),
        onPick: () => {
          setTextParam('addr', q);
          setTextParam('prefix', prefix || undefined);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.ip_addresses.smart.suggest.addr',
      });
    }

    return suggestions;
  }, [openIp, setTextParam, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (qText.trim()) {
      chips.push(<FilterChip key="q" label={`q:${qText.trim()}`} onRemove={() => setTextParam('q', undefined)} testId="admin.ip_addresses.chip.q" />);
    }
    if (addr.trim()) {
      const label = prefixNum !== undefined ? `addr:${addr.trim()}/${prefixNum}` : `addr:${addr.trim()}`;
      chips.push(
        <FilterChip
          key="addr"
          label={label}
          onRemove={() => {
            setTextParam('addr', undefined);
            if (prefixNum !== undefined) setTextParam('prefix', undefined);
          }}
          testId="admin.ip_addresses.chip.addr"
        />
      );
    }
    if (!addr.trim() && prefixNum !== undefined) {
      chips.push(<FilterChip key="prefix" label={`prefix:${prefixNum}`} onRemove={() => setTextParam('prefix', undefined)} testId="admin.ip_addresses.chip.prefix" />);
    }
    if (vpsId !== undefined) chips.push(<FilterChip key="vps" label={`vps:#${vpsId}`} onRemove={() => setIntParam('vps', undefined)} testId="admin.ip_addresses.chip.vps" />);
    if (userId !== undefined) chips.push(<FilterChip key="user" label={`user:#${userId}`} onRemove={() => setIntParam('user', undefined)} testId="admin.ip_addresses.chip.user" />);
    if (networkId !== undefined) {
      chips.push(<FilterChip key="network" label={`network:#${networkId}`} onRemove={() => setIntParam('network', undefined)} testId="admin.ip_addresses.chip.network" />);
    }
    if (ifaceId !== undefined) {
      chips.push(
        <FilterChip key="iface" label={`iface:#${ifaceId}`} onRemove={() => setIntParam('network_interface', undefined)} testId="admin.ip_addresses.chip.iface" />
      );
    }
    if (locationId !== undefined) {
      chips.push(
        <FilterChip key="location" label={`location:#${locationId}`} onRemove={() => setIntParam('location', undefined)} testId="admin.ip_addresses.chip.location" />
      );
    }
    if (versionNum !== undefined) {
      chips.push(
        <FilterChip key="version" label={versionNum === 4 ? 'IPv4' : 'IPv6'} onRemove={() => setTextParam('version', undefined)} testId="admin.ip_addresses.chip.version" />
      );
    }
    if (assignedToInterface !== undefined) {
      chips.push(
        <FilterChip
          key="assigned"
          label={assignedToInterface ? t('admin.ip_addresses.chip.assigned_true') : t('admin.ip_addresses.chip.assigned_false')}
          onRemove={() => setBoolParamInUrl('assigned_to_interface', undefined)}
          testId="admin.ip_addresses.chip.assigned"
        />
      );
    }

    smartErrors.forEach((error, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={error}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`admin.ip_addresses.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [addr, assignedToInterface, ifaceId, locationId, networkId, prefixNum, qText, setBoolParamInUrl, setIntParam, setTextParam, smartErrors, t, userId, versionNum, vpsId]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);

  return (
    <ListShell
      testId="admin.ip_addresses.page"
      header={
        <PageHeader
          title={t('admin.ip_addresses.title')}
          description={t('admin.ip_addresses.subtitle')}
          meta={filtersActive ? <span className="text-xs text-faint">{t('admin.ip_addresses.filter_hint')}</span> : null}
          testId="admin.ip_addresses.list.header"
        />
      }
      filters={
        <IpAddressesFilters
          smart={smart}
          setSmart={setSmart}
          smartErrors={smartErrors}
          clearSmartErrors={() => setSmartErrors([])}
          smartInputRef={smartInputRef}
          smartNeedle={smartNeedle}
          helpOpen={helpOpen}
          setHelpOpen={setHelpOpen}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          activeFilterChips={activeFilterChips}
          smartSuggestions={smartSuggestions}
          applySmartText={applySmartText}
          filtersActive={filtersActive}
          shareUrl={shareUrl}
          clearFilters={clearFilters}
          qText={qText}
          addr={addr}
          prefixNum={prefixNum}
          vpsId={vpsId}
          userLookup={userLookup}
          setUserLookup={setUserLookup}
          networkId={networkId}
          ifaceId={ifaceId}
          locationId={locationId}
          versionNum={versionNum}
          assignedToInterface={assignedToInterface}
          order={order}
          setTextParam={setTextParam}
          setIntParam={setIntParam}
          setBoolParamInUrl={setBoolParamInUrl}
        />
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="admin.ip_addresses.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.ip_addresses.error"
          error={listQ.error}
          onRetry={() => listQ.refetch()}
          actions={{
            primary: {
              label: t('common.retry'),
              onClick: () => listQ.refetch(),
            },
            secondary: {
              label: t('admin.ip_addresses.open_legacy'),
              href: `${basePath}/ip-addresses`,
            },
          }}
        />
      ) : pageData.length === 0 ? (
        <EmptyState
          testId="admin.ip_addresses.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('admin.ip_addresses.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          <IpAddressesListMobile
            pageData={pageData}
            ipDetailBasePath={ipDetailBasePath}
            basePath={basePath}
            na={na}
            canPaginate={canPaginate}
            pagination={{
              page: pagination.page,
              pageCount: pagination.stack.length,
              canPrev: pagination.canPrev,
              canNext,
              onPrev: pagination.goPrev,
              onNext: () => pagination.goNext(pageCursor),
              onGoToPage: pagination.goToPage,
              limit: pagination.limit,
              allowedLimits: pagination.allowedLimits,
              onLimitChange: pagination.setLimit,
            }}
          />

          <IpAddressesListTable
            pageData={pageData}
            ipDetailBasePath={ipDetailBasePath}
            basePath={basePath}
            na={na}
            canPaginate={canPaginate}
            pagination={{
              page: pagination.page,
              pageCount: pagination.stack.length,
              canPrev: pagination.canPrev,
              canNext,
              onPrev: pagination.goPrev,
              onNext: () => pagination.goNext(pageCursor),
              onGoToPage: pagination.goToPage,
              limit: pagination.limit,
              allowedLimits: pagination.allowedLimits,
              onLimitChange: pagination.setLimit,
            }}
          />
        </>
      )}
    </ListShell>
  );
}
