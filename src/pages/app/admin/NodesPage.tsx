import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SummaryGrid } from '../../../components/layout/SummaryGrid';

import { fetchNodes } from '../../../lib/api/nodes';
import { fetchPublicNodeStatus, type PublicNodeStatus } from '../../../lib/api/public';
import { formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { parseBoolParam } from '../../../lib/parse';
import { useTierSlowIntervalMs } from '../../../lib/refreshTiers';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';

import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Drawer } from '../../../components/ui/Drawer';
import { FilterChip } from '../../../components/ui/FilterChip';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LinkButton } from '../../../components/ui/LinkButton';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { StatCard } from '../../../components/ui/StatCard';
import { LockBadge } from '../../../components/ui/LockBadge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../components/ui/tone';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';

interface NodeRow {
  id?: number;
  name: string;
  fqdn?: string;
  domain_name?: string;
  locationLabel?: string;

  // From public status
  status?: boolean;
  last_report?: string;
  cpu_idle?: number;
  vps_count?: number;
  vps_free?: number;
  hypervisor_type?: string;
  maintenance_lock?: any;
  maintenance_lock_reason?: string;
}

type NodeStateFilter = 'active' | 'inactive' | 'all';

function normalizeNodeState(v: string | null): NodeStateFilter {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'inactive') return 'inactive';
  if (s === 'all') return 'all';
  return 'active';
}

function locationLabel(loc: any): string | undefined {
  if (!loc) return undefined;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'number') return String(loc);
  if (typeof loc === 'object') {
    if (typeof loc.label === 'string' && loc.label) return loc.label;
    if (typeof loc.name === 'string' && loc.name) return loc.name;
    if (typeof loc.id === 'number') return `#${loc.id}`;
  }
  return undefined;
}

function keyCandidates(v: any): string[] {
  const out: string[] = [];
  const push = (s: unknown) => {
    if (typeof s === 'string' && s.trim()) out.push(s.trim().toLowerCase());
  };
  push(v?.name);
  push(v?.domain_name);
  push(v?.fqdn);
  return out;
}

function buildStatusIndex(list: PublicNodeStatus[]): Map<string, PublicNodeStatus> {
  const m = new Map<string, PublicNodeStatus>();
  for (const n of list) {
    for (const k of keyCandidates(n)) m.set(k, n);
  }
  return m;
}

function badgeForStatus(
  t: (key: any, vars?: any) => string,
  status: boolean | undefined
): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } {
  if (status === true) return { variant: 'ok', label: t('state.up') };
  if (status === false) return { variant: 'danger', label: t('state.down') };
  return { variant: 'neutral', label: t('state.unknown') };
}

function nodeRowVariant(r: NodeRow): 'warn' | 'danger' | undefined {
  if (r.status === false) return 'danger';
  if (Boolean(r.maintenance_lock)) return 'warn';
  return undefined;
}

function nodeDotVariant(r: NodeRow): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (r.status === false) return 'danger';
  if (Boolean(r.maintenance_lock)) return 'warn';
  if (r.status === true) return 'ok';
  return 'neutral';
}

function hasIssues(r: NodeRow): boolean {
  return nodeRowVariant(r) !== undefined;
}

function rowKey(r: NodeRow, idx: number): string {
  if (typeof r.id === 'number') return String(r.id);
  // Best-effort key for status-only fallback rows.
  return `${r.name || 'node'}-${idx}`;
}

function maintenanceReason(row: NodeRow): string | undefined {
  const direct = typeof row.maintenance_lock_reason === 'string' ? row.maintenance_lock_reason.trim() : '';
  if (direct) return direct;

  const lock = row.maintenance_lock as any;
  if (typeof lock === 'string') {
    const s = lock.trim();
    return s || undefined;
  }

  if (lock && typeof lock === 'object' && typeof lock.reason === 'string') {
    const s = lock.reason.trim();
    return s || undefined;
  }

  return undefined;
}

export function NodesPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qText = useMemo(() => String(searchParams.get('q') ?? ''), [searchParams]);
  const issuesOnly = useMemo(() => parseBoolParam(searchParams.get('issues')) === true, [searchParams]);
  const state = useMemo(() => normalizeNodeState(searchParams.get('state')), [searchParams]);

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const smartInputRef = useRef<HTMLInputElement>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const setTextParam = (key: string, value: string | undefined) => {
    const v = String(value ?? '').trim();
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v) p.set(key, v);
      else p.delete(key);
      return p;
    });
  };

  const setIssuesParam = (on: boolean) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (on) p.set('issues', '1');
      else p.delete('issues');
      return p;
    });
  };

  const setStateParam = (st: NodeStateFilter) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (st === 'active') p.delete('state');
      else p.set('state', st);
      return p;
    });
  };

  const filtersActive = Boolean(qText.trim() || issuesOnly || state !== 'active');

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);

    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('q');
      p.delete('issues');
      p.delete('state');
      return p;
    });
  };

  const pagination = useKeysetPagination({
    id: 'admin.nodes.list',
    filterKey: JSON.stringify({ q: qText.trim(), state, issuesOnly, scope: basePath }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const tierSlowRefetchMs = useTierSlowIntervalMs();

  const nodesQ = useQuery({
    queryKey: [
      'nodes',
      'index',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qText.trim() || undefined,
        state: state === 'active' ? undefined : state,
      },
    ],
    queryFn: async () =>
      (
        await fetchNodes({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qText.trim() || undefined,
          state: state === 'active' ? undefined : state,
        })
      ).data,
    staleTime: 15000,
    refetchInterval: tierSlowRefetchMs,
  });

  const statusQ = useQuery({
    queryKey: ['nodes', 'public_status'],
    queryFn: async () => (await fetchPublicNodeStatus()).data,
    staleTime: 15000,
    refetchInterval: tierSlowRefetchMs,
  });

  const statusIndex = useMemo(() => buildStatusIndex(statusQ.data ?? []), [statusQ.data]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [searchParams]);

  const openNode = (nodeId: number) => {
    navigate(`${basePath}/nodes/${nodeId}`);
  };

  const resolveStateValue = (raw: string): NodeStateFilter | null => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v || v === 'active' || v === 'on') return 'active';
    if (v === 'inactive' || v === 'off') return 'inactive';
    if (v === 'all' || v === '*' || v === 'any') return 'all';

    const opts: NodeStateFilter[] = ['active', 'inactive', 'all'];
    const matches = opts.filter((x) => x.startsWith(v));
    if (matches.length === 1) return matches[0] ?? null;
    return null;
  };

  const parseIssuesValue = (raw: string): boolean | null => {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) return true;
    if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on' || v === 'enabled') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'off' || v === 'disabled') return false;
    return null;
  };

  const applySmartText = (raw: string) => {
    const input = String(raw ?? '').trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input);

    // Fast path: numeric opens the node detail.
    if (tokens.length === 1) {
      const num = parseNumericToken(tokens[0] ?? '');
      if (num !== null) {
        openNode(num);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    const free: string[] = [];
    const errors: string[] = [];

    for (const tok of tokens) {
      const kv = splitKeyValueToken(tok);
      if (!kv) {
        const bare = unquoteSmartValue(tok);
        const low = bare.trim().toLowerCase();

        if (low === 'issues' || low === 'issue' || low === 'problem' || low === 'problems') {
          setIssuesParam(true);
          continue;
        }

        // Convenience: allow bare state tokens.
        const st = resolveStateValue(low);
        if (st) {
          setStateParam(st);
          continue;
        }

        free.push(bare);
        continue;
      }

      const keyRaw = String(kv.rawKey ?? '').trim();
      const value = unquoteSmartValue(kv.rawValue);
      const key = keyRaw.toLowerCase();

      if (!key) {
        errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        continue;
      }

      if (key === 'id' || key === '#') {
        const id = parseNumericToken(value);
        if (id === null) {
          errors.push(t('filters.smart.error.numeric_only', { key: 'id', value }));
          continue;
        }
        openNode(id);
        setSmart('');
        setSmartErrors([]);
        return;
      }

      if (key === 'q' || key === 'search' || key === 's' || key === 'text') {
        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: keyRaw }));
          continue;
        }
        free.push(value);
        continue;
      }

      if (key === 'state') {
        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: keyRaw }));
          continue;
        }

        const st = resolveStateValue(value);
        if (!st) {
          errors.push(t('admin.nodes.smart.error.state', { value }));
          continue;
        }

        setStateParam(st);
        continue;
      }

      if (key === 'issues') {
        const b = parseIssuesValue(value);
        if (b === null) {
          errors.push(t('admin.nodes.smart.error.issues', { value }));
          continue;
        }
        setIssuesParam(b);
        continue;
      }

      errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
    }

    const q = free.join(' ').trim();
    setTextParam('q', q || undefined);

    setSmart('');
    setSmartErrors(errors);

    if (errors.length > 0) {
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
    }
  };

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const out: SmartFilterSuggestion[] = [];
    const needle = smartNeedle;
    if (!needle) return out;

    if (needle === '?') {
      out.push({
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('filters.help.suggestion.secondary'),
        onPick: () => setHelpOpen(true),
        testId: 'admin.nodes.smart.suggest.help',
      });
      return out;
    }

    const num = parseNumericToken(needle);
    if (num !== null) {
      out.push({
        id: `open.${num}`,
        primary: t('admin.nodes.smart.suggest.open_node', { id: num }),
        secondary: t('admin.nodes.smart.suggest.open_node.secondary'),
        onPick: () => {
          openNode(num);
          setSmart('');
        },
        testId: 'admin.nodes.smart.suggest.open_node',
      });
    }

    const low = needle.toLowerCase();
    if (low === 'issues' || low === 'issue') {
      out.push({
        id: 'issues',
        primary: 'issues',
        secondary: t('admin.nodes.smart.suggest.issues'),
        onPick: () => {
          setIssuesParam(true);
          setSmart('');
        },
      });
    }

    const st = resolveStateValue(low);
    if (st && st !== 'active') {
      out.push({
        id: `state.${st}`,
        primary: `state:${st}`,
        secondary: t('admin.nodes.smart.suggest.state', { state: st }),
        onPick: () => {
          setStateParam(st);
          setSmart('');
        },
      });
    }

    out.push({
      id: 'search',
      primary: t('admin.nodes.smart.suggest.search', { q: needle }),
      secondary: t('admin.nodes.smart.suggest.search.secondary'),
      onPick: () => {
        setTextParam('q', needle);
        setSmart('');
      },
      testId: 'admin.nodes.smart.suggest.search',
    });

    return out;
  }, [openNode, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (qText.trim()) {
      chips.push(
        <FilterChip
          key="q"
          label={`q:${qText.trim()}`}
          tone="neutral"
          onRemove={() => setTextParam('q', undefined)}
          testId="admin.nodes.chip.q"
        />
      );
    }

    if (state !== 'active') {
      chips.push(
        <FilterChip
          key="state"
          label={`state:${state}`}
          tone="neutral"
          onRemove={() => setStateParam('active')}
          testId="admin.nodes.chip.state"
        />
      );
    }

    if (issuesOnly) {
      chips.push(
        <FilterChip
          key="issues"
          label="issues"
          tone="danger"
          onRemove={() => setIssuesParam(false)}
          testId="admin.nodes.chip.issues"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))}
          testId={`admin.nodes.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [issuesOnly, qText, setTextParam, smartErrors, state]);

  const pageNodes = nodesQ.data ?? [];

  const rows: NodeRow[] = useMemo(() => {
    // Primary: authenticated node index (supports keyset pagination).
    if (Array.isArray(nodesQ.data)) {
      return nodesQ.data.map((n: any) => {
        let st: PublicNodeStatus | undefined;
        for (const k of keyCandidates(n)) {
          st = statusIndex.get(k);
          if (st) break;
        }

        return {
          id: typeof n.id === 'number' ? n.id : undefined,
          name: String(n.domain_name ?? n.name ?? n.fqdn ?? `#${(n as any).id ?? '?'}`),
          fqdn: typeof (n as any).fqdn === 'string' ? (n as any).fqdn : undefined,
          domain_name: typeof (n as any).domain_name === 'string' ? (n as any).domain_name : undefined,
          locationLabel: locationLabel((n as any).location),

          status: st?.status,
          last_report: st?.last_report,
          cpu_idle: st?.cpu_idle,
          vps_count: st?.vps_count,
          vps_free: st?.vps_free,
          hypervisor_type: st?.hypervisor_type,
          maintenance_lock: (st as any)?.maintenance_lock,
          maintenance_lock_reason:
            typeof (st as any)?.maintenance_lock_reason === 'string'
              ? ((st as any).maintenance_lock_reason as string)
              : undefined,
        } satisfies NodeRow;
      });
    }

    // Fallback: public status only (does not support from_id).
    if (nodesQ.isError && Array.isArray(statusQ.data)) {
      return statusQ.data.map((st: any) => ({
        id: typeof st.id === 'number' ? st.id : undefined,
        name: String(st.domain_name ?? st.name ?? st.fqdn ?? 'node'),
        fqdn: typeof st.fqdn === 'string' ? st.fqdn : undefined,
        domain_name: typeof st.domain_name === 'string' ? st.domain_name : undefined,
        locationLabel: locationLabel(st.location),

        status: st.status,
        last_report: st.last_report,
        cpu_idle: st.cpu_idle,
        vps_count: st.vps_count,
        vps_free: st.vps_free,
        hypervisor_type: st.hypervisor_type,
        maintenance_lock: st.maintenance_lock,
        maintenance_lock_reason: typeof st.maintenance_lock_reason === 'string' ? st.maintenance_lock_reason : undefined,
      }));
    }

    return [];
  }, [nodesQ.data, nodesQ.isError, statusIndex, statusQ.data]);

  const filtered = useMemo(() => {
    let out = rows;
    if (issuesOnly) out = out.filter(hasIssues);

    // If the authenticated node index is unavailable, we fall back to the public status list.
    // In that mode, apply q filtering client-side, because the public endpoint is unfiltered.
    const q = qText.trim().toLowerCase();
    if (q && nodesQ.isError) {
      out = out.filter((r) => {
        const hay = [r.name, r.fqdn, r.domain_name, r.locationLabel, String(r.id ?? '')]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return out;
  }, [issuesOnly, nodesQ.isError, qText, rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const down = rows.filter((r) => r.status === false).length;
    const locked = rows.filter((r) => Boolean(r.maintenance_lock)).length;
    return { total, down, locked };
  }, [rows]);

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageNodes as any), [pageNodes]);
  const hasMore = pageNodes.length >= pagination.limit;

  const canPaginate = nodesQ.isSuccess;
  const canNext = canPaginate && (pagination.hasForward || (hasMore && pageCursor !== null));

  const listHint = nodesQ.isError && statusQ.data ? t('admin.nodes.meta.auth_index_unavailable') : undefined;

  const statsScopeLabel = canPaginate ? t('admin.nodes.stats.scope_page') : t('admin.nodes.stats.scope_total');

  return (
    <ListShell
      testId="admin.nodes.page"
      header={
        <PageHeader
          title={t('admin.nodes.title')}
          description={t('admin.nodes.subtitle')}
          meta={
            filtersActive ? (
              <span className="text-xs text-faint">{listHint ?? t('list.meta.filters_active')}</span>
            ) : null
          }
          testId="admin.nodes.list.header"
        />
      }
      filters={
        <>
          <FilterBar testId="admin.nodes.list.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('admin.nodes.search.placeholder')}
                ariaLabel={t('admin.nodes.search.placeholder')}
                testId="admin.nodes.search.input"
                suggestions={smartSuggestions}
                onSubmit={() => applySmartText(smart)}
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

              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.nodes.active_filters">
                  {activeFilterChips}
                </div>
              ) : null}

              <div className="mt-1 text-xs text-faint">
                {t('common.showing_n_of_m', { shown: filtered.length, total: rows.length })}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              aria-label={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <Button
              variant={issuesOnly ? 'danger' : 'secondary'}
              size="sm"
              onClick={() => setIssuesParam(!issuesOnly)}
              title={t('admin.nodes.filter.issues_only_help')}
              testId="admin.nodes.issues_toggle"
            >
              {t('admin.nodes.filter.issues_only')}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void nodesQ.refetch();
                void statusQ.refetch();
              }}
              testId="admin.nodes.refresh"
            >
              {t('common.refresh')}
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={shareUrl}
              testId="admin.nodes.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.nodes.filter.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t('admin.nodes.smart_help.title')}
            intro={t('admin.nodes.smart_help.intro')}
            examples={[
              { example: '?', description: t('admin.nodes.smart_help.examples.help') },
              { example: '123', description: t('admin.nodes.smart_help.examples.open') },
              { example: 'issues', description: t('admin.nodes.smart_help.examples.issues') },
              { example: 'state:inactive', description: t('admin.nodes.smart_help.examples.state') },
              { example: 'q:node7 state:all', description: t('admin.nodes.smart_help.examples.q_state') },
            ]}
            topKeys={[
              { key: 'q', description: t('admin.nodes.smart_help.keys.q'), example: 'q:node7' },
              { key: 'state', description: t('admin.nodes.smart_help.keys.state'), example: 'state:inactive' },
              { key: 'issues', description: t('admin.nodes.smart_help.keys.issues'), example: 'issues:true' },
              { key: 'id', description: t('admin.nodes.smart_help.keys.id'), example: 'id:123' },
            ]}
            inference={[
              t('admin.nodes.smart_help.inference.enter'),
              t('admin.nodes.smart_help.inference.numeric'),
              t('admin.nodes.smart_help.inference.advanced'),
            ]}
            onInsertKey={(key) => {
              const prefix = `${key}:`;
              setSmart(prefix);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 0);
            }}
            actions={[
              {
                label: t('filters.advanced.label'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
                variant: 'secondary',
              },
            ]}
            testId="admin.nodes.smart_help"
            keyRowTestIdPrefix="admin.nodes.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.nodes.advanced.drawer"
          >
            <div className="space-y-4">
              <div className="text-sm text-muted">{t('admin.nodes.advanced.hint')}</div>

              <div>
                <div className="text-xs font-medium text-faint">{t('admin.nodes.advanced.q.label')}</div>
                <Input
                  value={qText}
                  onChange={(e) => setTextParam('q', e.target.value)}
                  placeholder={t('admin.nodes.search.placeholder')}
                  testId="admin.nodes.advanced.q"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-faint">{t('admin.nodes.advanced.state.label')}</div>
                <Select
                  value={state}
                  onChange={(e) => setStateParam(normalizeNodeState(e.target.value))}
                  testId="admin.nodes.advanced.state"
                  className="w-56"
                >
                  <option value="active">{t('admin.nodes.advanced.state.active')}</option>
                  <option value="all">{t('admin.nodes.advanced.state.all')}</option>
                  <option value="inactive">{t('admin.nodes.advanced.state.inactive')}</option>
                </Select>
              </div>

              <Checkbox
                checked={issuesOnly}
                onChange={(v) => setIssuesParam(v)}
                label={t('admin.nodes.advanced.issues.label')}
                description={t('admin.nodes.advanced.issues.hint')}
                testId="admin.nodes.advanced.issues"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                {filtersActive ? (
                  <Button variant="secondary" onClick={clearFilters} testId="admin.nodes.advanced.clear">
                    {t('common.clear_filters')}
                  </Button>
                ) : null}

                <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
                  {t('common.done')}
                </Button>
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {nodesQ.isError && statusQ.isError && rows.length === 0 ? (
        <ErrorState
          testId="admin.nodes.error"
          title={t('admin.nodes.alert.load_failed.title')}
          body={t('admin.nodes.alert.load_failed.body')}
          error={nodesQ.error}
          onRetry={() => {
            void nodesQ.refetch();
            void statusQ.refetch();
          }}
          showBack={false}
          detailsExtra={{
            page: 'admin.nodes',
            nodesError: String((nodesQ.error as any)?.message ?? nodesQ.error),
            statusError: String((statusQ.error as any)?.message ?? statusQ.error),
          }}
        />
      ) : null}

      {nodesQ.isError && statusQ.data ? (
        <Alert title={t('admin.nodes.alert.auth_index_unavailable.title')} variant="warn">
          <div>{t('admin.nodes.alert.auth_index_unavailable.body')}</div>
          <div className="mt-2 text-xs text-muted">{String((nodesQ.error as any)?.message ?? nodesQ.error)}</div>
        </Alert>
      ) : null}

      {statusQ.isError && nodesQ.data ? (
        <Alert title={t('admin.nodes.alert.public_status_unavailable.title')} variant="warn">
          <div>{t('admin.nodes.alert.public_status_unavailable.body')}</div>
          <div className="mt-2 text-xs text-muted">{String((statusQ.error as any)?.message ?? statusQ.error)}</div>
        </Alert>
      ) : null}

      {nodesQ.isLoading && !nodesQ.data && statusQ.isLoading && !statusQ.data ? (
        <LoadingState testId="admin.nodes.loading" />
      ) : (
        <>
          <SummaryGrid testId="admin.nodes.summary">
            <StatCard
              className="md:col-span-4"
              testId="admin.nodes.summary.total"
              title={t('admin.nodes.stats.total')}
              value={stats.total}
              subtitle={statsScopeLabel}
              variant="standard"
            />

            <StatCard
              className="md:col-span-4"
              testId="admin.nodes.summary.down"
              title={t('admin.nodes.stats.down')}
              value={<span className={stats.down > 0 ? 'text-danger' : undefined}>{stats.down}</span>}
              subtitle={statsScopeLabel}
              variant={stats.down > 0 ? 'featured' : 'standard'}
            />

            <StatCard
              className="md:col-span-4"
              testId="admin.nodes.summary.maintenance"
              title={t('admin.nodes.stats.maintenance')}
              value={<span className={stats.locked > 0 ? 'text-warn' : undefined}>{stats.locked}</span>}
              subtitle={statsScopeLabel}
              variant="standard"
            />
          </SummaryGrid>

          {filtered.length === 0 ? (
            <EmptyState
              testId="admin.nodes.empty"
              title={filtersActive ? t('empty.list.no_matches.title') : t('admin.nodes.empty.none.title')}
              body={filtersActive ? t('empty.list.no_matches.body') : t('admin.nodes.empty.none.body')}
              actionLabel={filtersActive ? t('common.clear_filters') : t('common.refresh')}
              onAction={
                filtersActive
                  ? clearFilters
                  : () => {
                      void nodesQ.refetch();
                      void statusQ.refetch();
                    }
              }
            />
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((n, idx) => {
                  const b = badgeForStatus(t, n.status);
                  const rowVariant = nodeRowVariant(n);
                  const dotVariant = nodeDotVariant(n);

                  const reason = maintenanceReason(n);
                  const showMaintenance = Boolean(n.maintenance_lock);

                  return (
                    <Card
                      key={rowKey(n, idx)}
                      testId={typeof n.id === 'number' ? `admin.nodes.card.${n.id}` : undefined}
                      className={toneSurfaceClass(rowVariant)}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <StatusDot
                                variant={dotVariant}
                                testId={typeof n.id === 'number' ? `admin.nodes.card.${n.id}.dot` : undefined}
                              />
                              <div className="truncate text-base font-semibold text-fg">{n.name}</div>
                            </div>
                            <div className="mt-0.5 text-xs text-faint">
                              {n.fqdn ? n.fqdn : n.domain_name ? n.domain_name : n.id ? `#${n.id}` : t('common.na')}
                            </div>
                          </div>
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                          <div>
                            <span className="text-faint">{t('admin.node.field.location')}:</span> {n.locationLabel ?? t('common.na')}
                          </div>
                          <div>
                            <span className="text-faint">{t('common.vps')}:</span>{' '}
                            {typeof n.vps_count === 'number' ? n.vps_count : t('common.na')}
                            {typeof n.vps_free === 'number' ? (
                              <span className="text-faint"> · {t('common.free_count', { count: n.vps_free })}</span>
                            ) : null}
                          </div>
                          <div>
                            <span className="text-faint">{t('admin.node.field.cpu_idle')}:</span>{' '}
                            {typeof n.cpu_idle === 'number' ? `${n.cpu_idle}%` : t('common.na')}
                          </div>
                          <div>
                            <span className="text-faint">{t('admin.node.field.last_report')}:</span> {formatDateTime(n.last_report)}
                          </div>
                        </div>

                        {showMaintenance ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <LockBadge kind="maintenance" maintenanceReason={reason} t={t} />
                            {reason ? <div className="min-w-0 truncate text-xs text-danger">{reason}</div> : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {n.fqdn ? <CopyButton text={n.fqdn} /> : n.name ? <CopyButton text={n.name} /> : null}
                          {typeof n.id === 'number' ? (
                            <LinkButton to={`${basePath}/nodes/${n.id}`} variant="secondary" size="sm">
                              {t('common.details')}
                            </LinkButton>
                          ) : null}
                          {typeof n.id === 'number' ? (
                            <LinkButton
                              to={`${basePath}/vps?node=${n.id}`}
                              variant="secondary"
                              size="sm"
                              title={t('admin.node.action.show_vps.title')}
                            >
                              {t('admin.nodes.action.vpses')}
                            </LinkButton>
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
                    testId="admin.nodes.pagination.mobile"
                  />
                </Card>
              ) : null}

              {/* Desktop: table */}
              <TableCard
                className="hidden md:block"
                minWidth="lg"
                tableTestId="admin.nodes.table"
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
                      testId="admin.nodes.pagination.desktop"
                    />
                  ) : null
                }
              >
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="w-8 px-4 py-2"><span className="sr-only">{t('common.state')}</span></th>
                    <th className="px-4 py-2">{t('common.node')}</th>
                    <th className="px-4 py-2">{t('admin.node.field.location')}</th>
                    <th className="px-4 py-2">{t('admin.node.field.status')}</th>
                    <th className="px-4 py-2">{t('common.vps')}</th>
                    <th className="px-4 py-2">{t('admin.node.field.cpu_idle')}</th>
                    <th className="px-4 py-2">{t('admin.node.field.last_report')}</th>
                    <th className="px-4 py-2">{t('admin.node.maintenance.title')}</th>
                    <th className="px-4 py-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n, idx) => {
                    const b = badgeForStatus(t, n.status);
                    const reason = maintenanceReason(n);
                    const showMaintenance = Boolean(n.maintenance_lock);
                    const rowVariant = nodeRowVariant(n);
                    const dotVariant = nodeDotVariant(n);

                    return (
                      <TableRowLink
                        key={rowKey(n, idx)}
                        testId={typeof n.id === 'number' ? `admin.nodes.row.${n.id}` : undefined}
                        to={typeof n.id === 'number' ? `${basePath}/nodes/${n.id}` : undefined}
                        variant={rowVariant}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="px-4 py-2">
                          <StatusDot
                            variant={dotVariant}
                            testId={typeof n.id === 'number' ? `admin.nodes.row.${n.id}.dot` : undefined}
                            ariaLabel={b.label}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-fg">{n.name}</div>
                          <div className="mt-1 text-xs text-faint">
                            {n.fqdn ? n.fqdn : n.domain_name ? n.domain_name : n.id ? `#${n.id}` : t('common.na')}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">{n.locationLabel ?? t('common.na')}</td>
                        <td className="px-4 py-2">
                          <Badge variant={b.variant}>{b.label}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">
                          {typeof n.vps_count === 'number' ? n.vps_count : t('common.na')}
                          {typeof n.vps_free === 'number' ? (
                            <span className="text-faint"> · {t('common.free_count', { count: n.vps_free })}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">
                          {typeof n.cpu_idle === 'number' ? `${n.cpu_idle}%` : t('common.na')}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted">{formatDateTime(n.last_report)}</td>
                        <td className="px-4 py-2 text-xs">
                          {showMaintenance ? (
                            <LockBadge kind="maintenance" maintenanceReason={reason} t={t} />
                          ) : (
                            <span className="text-faint">{t('common.na')}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {n.fqdn ? <CopyButton text={n.fqdn} /> : n.name ? <CopyButton text={n.name} /> : null}
                            {typeof n.id === 'number' ? (
                              <LinkButton to={`${basePath}/nodes/${n.id}`} variant="secondary" size="sm">
                                {t('common.details')}
                              </LinkButton>
                            ) : null}
                            {typeof n.id === 'number' ? (
                              <LinkButton
                                to={`${basePath}/vps?node=${n.id}`}
                                variant="secondary"
                                size="sm"
                                title={t('admin.node.action.show_vps.title')}
                              >
                                {t('admin.nodes.action.vpses')}
                              </LinkButton>
                            ) : null}
                          </div>
                        </td>
                      </TableRowLink>
                    );
                  })}
                </tbody>
              </TableCard>
            </>
          )}
        </>
      )}
    </ListShell>
  );
}
