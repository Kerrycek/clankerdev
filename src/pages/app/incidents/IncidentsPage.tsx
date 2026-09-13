import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useObjectScope } from '../../../app/objectScope';
import { useToasts } from '../../../app/toasts';
import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { searchUsers } from '../../../lib/api/users';
import { fetchIncidentReports } from '../../../lib/api/incidents';
import { fetchMailboxes } from '../../../lib/api/mailer';
import { compactText, formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import {
  parseNumericToken,
  splitKeyValueToken,
  tokenizeSmartInput,
  unquoteSmartValue,
} from '../../../lib/smartFilter';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ChipLink, MiniLink } from '../../../components/ui/ChipLink';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { type SmartFilterSuggestion, SmartFilterInput } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../components/ui/VpsLookupInput';
import { dotVariantFromRowVariant } from '../../../lib/variantMap';
import {
  canonicalKey,
  incidentRowVariant,
  looksLikeIpish,
  mailboxLabel,
  resolveMailboxId,
  safeNumber,
  UNSUPPORTED_INCIDENT_SEARCH_KEY,
  vpsActionLabelKey,
  vpsActionVariant,
} from './incidentListSemantics';

function normalizeIncidentSearchParams(searchParams: URLSearchParams, isAdmin: boolean) {
  const next = new URLSearchParams(searchParams);

  next.delete('q');
  if (!isAdmin) {
    next.delete('user');
    next.delete('filed_by');
    next.delete('mailbox');
  }

  const changed = next.toString() !== searchParams.toString();
  if (changed) {
    next.delete('from_id');
    next.set('page', '1');
  }

  return { changed, searchParams: next };
}

export function IncidentsPage() {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const isAdmin = mode === 'admin' && auth.role === 'admin';
  const scope = useObjectScope();
  const { t } = useI18n();
  const navigate = useNavigate();
  const toasts = useToasts();

  const [sp, setSp] = useSearchParams();
  const searchParamsKey = sp.toString();
  const normalizedSearch = useMemo(
    () => normalizeIncidentSearchParams(new URLSearchParams(searchParamsKey), isAdmin),
    [isAdmin, searchParamsKey]
  );
  const activeSearchParams = normalizedSearch.searchParams;
  const activeSearchParamsKey = activeSearchParams.toString();

  const [vps, setVps] = useState(() => activeSearchParams.get('vps') ?? '');
  const [user, setUser] = useState(() => activeSearchParams.get('user') ?? '');
  const [filedBy, setFiledBy] = useState(() => activeSearchParams.get('filed_by') ?? '');
  const [ip, setIp] = useState(() => activeSearchParams.get('ip_addr') ?? '');
  const [assignment, setAssignment] = useState(() => activeSearchParams.get('ip_address_assignment') ?? '');
  const [codename, setCodename] = useState(() => activeSearchParams.get('codename') ?? '');
  const [mailbox, setMailbox] = useState(() => activeSearchParams.get('mailbox') ?? '');

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement | null>(null);
  const hydratingFiltersFromUrlRef = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Remove obsolete or unauthorized filters before the list query can run.
  useLayoutEffect(() => {
    if (!normalizedSearch.changed) return;
    setSp(activeSearchParams, { replace: true });
  }, [activeSearchParams, normalizedSearch.changed, setSp]);

  // Sync from URL on navigation.
  useLayoutEffect(() => {
    hydratingFiltersFromUrlRef.current = true;
    const current = new URLSearchParams(activeSearchParamsKey);
    setVps(current.get('vps') ?? '');
    setUser(current.get('user') ?? '');
    setFiledBy(current.get('filed_by') ?? '');
    setIp(current.get('ip_addr') ?? '');
    setAssignment(current.get('ip_address_assignment') ?? '');
    setCodename(current.get('codename') ?? '');
    setMailbox(current.get('mailbox') ?? '');
  }, [activeSearchParamsKey]);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const vpsId = useMemo(() => safeNumber(vps), [vps]);
  const userId = useMemo(() => (isAdmin ? safeNumber(user) : undefined), [isAdmin, user]);
  const effectiveUserId = isAdmin ? userId : scope.mineUserId;
  const filedById = useMemo(() => (isAdmin ? safeNumber(filedBy) : undefined), [filedBy, isAdmin]);
  const assignmentId = useMemo(() => safeNumber(assignment), [assignment]);
  const mailboxId = useMemo(() => (isAdmin ? safeNumber(mailbox) : undefined), [isAdmin, mailbox]);

  // Keep filters in the URL.
  useEffect(() => {
    if (hydratingFiltersFromUrlRef.current) {
      hydratingFiltersFromUrlRef.current = false;
      return;
    }

    const next = new URLSearchParams(activeSearchParams);
    next.delete('q');

    if (vpsId) next.set('vps', String(vpsId));
    else if (!vps.trim()) next.delete('vps');

    if (isAdmin) {
      if (userId) next.set('user', String(userId));
      else if (!user.trim()) next.delete('user');

      if (filedById) next.set('filed_by', String(filedById));
      else if (!filedBy.trim()) next.delete('filed_by');
    } else {
      next.delete('user');
      next.delete('filed_by');
    }

    const ipTrim = ip.trim();
    if (ipTrim) next.set('ip_addr', ipTrim);
    else next.delete('ip_addr');

    if (assignmentId) next.set('ip_address_assignment', String(assignmentId));
    else if (!assignment.trim()) next.delete('ip_address_assignment');

    const codeTrim = codename.trim();
    if (codeTrim) next.set('codename', codeTrim);
    else next.delete('codename');

    if (isAdmin) {
      if (mailboxId) next.set('mailbox', String(mailboxId));
      else if (!mailbox.trim()) next.delete('mailbox');
    } else {
      next.delete('mailbox');
    }

    if (next.toString() !== searchParamsKey) setSp(next, { replace: true });
  }, [activeSearchParams, assignment, assignmentId, codename, filedBy, filedById, ip, isAdmin, mailbox, mailboxId, searchParamsKey, setSp, user, userId, vps, vpsId]);

  const filtersActive = Boolean(
    vpsId ||
      (isAdmin && userId) ||
      (isAdmin && filedById) ||
      ip.trim() ||
      assignmentId ||
      codename.trim() ||
      (isAdmin && mailboxId)
  );
  const hasFilterState = filtersActive || smartErrors.length > 0;

  const pagination = useKeysetPagination({
    id: 'incidents.list',
    filterKey: JSON.stringify({
      scope: basePath,
      vps: vpsId,
      user: effectiveUserId,
      filedBy: filedById,
      ip: ip.trim(),
      assignment: assignmentId,
      codename: codename.trim(),
      mailbox: mailboxId,
    }),
    searchParams: activeSearchParams,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: [
      'incident_reports',
      'index',
      {
        limit: pagination.limit,
        from: pagination.cursor,
        vps: vpsId,
        user: effectiveUserId,
        filedBy: filedById,
        ip: ip.trim(),
        assignment: assignmentId,
        codename: codename.trim(),
        mailbox: mailboxId,
        scope: basePath,
      },
    ],
    queryFn: async () =>
      (
        await fetchIncidentReports({
          limit: pagination.limit,
          fromId: pagination.cursor as number | undefined,
          vpsId,
          userId: effectiveUserId,
          filedById,
          ipAddr: ip.trim() || undefined,
          ipAddressAssignmentId: assignmentId,
          codename: codename.trim() || undefined,
          mailboxId,
          includes:
            isAdmin ? 'user,vps,ip_address_assignment,filed_by,mailbox' : 'vps,ip_address_assignment,filed_by',
        })
      ).data,
    enabled: !normalizedSearch.changed,
  });

  const mailboxesQ = useQuery({
    queryKey: ['mailboxes', 'index', { scope: basePath }],
    queryFn: async () => (await fetchMailboxes({ limit: 200 })).data,
    enabled: isAdmin,
  });

  const rows = listQ.data ?? [];

  const mailboxOptions = useMemo(() => {
    if (!isAdmin) return [];
    const list = mailboxesQ.data ?? [];
    const opts = [{ value: '', label: t('common.all') }];
    for (const m of list) {
      opts.push({ value: String(m.id), label: mailboxLabel(m) });
    }
    return opts;
  }, [isAdmin, mailboxesQ.data, t]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [searchParamsKey]);

  const clearFilters = () => {
    setVps('');
    setUser('');
    setFiledBy('');
    setIp('');
    setAssignment('');
    setCodename('');
    setMailbox('');
    setSmart('');
    setSmartErrors([]);
  };

  const openIncident = (id: number) => {
    navigate(`${basePath}/incidents/${id}`);
  };

  async function applySmartText(raw: string) {
    const s = String(raw ?? '').trim();
    if (!s) return;
    if (s === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(s);

    // Numeric single-token defaults to "open by id".
    if (tokens.length === 1) {
      const n = parseNumericToken(tokens[0] ?? '');
      if (n !== null) {
        openIncident(n);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    let nextVps = vps;
    let nextUser = user;
    let nextFiledBy = filedBy;
    let nextIp = ip;
    let nextAssignment = assignment;
    let nextCodename = codename;
    let nextMailbox = mailbox;

    let hasUnsupportedText = false;
    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        hasUnsupportedText = true;
        continue;
      }

      const key = canonicalKey(kv.rawKey);
      if (!key) {
        errs.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        continue;
      }

      const value = unquoteSmartValue(kv.rawValue);
      if (!value.trim()) {
        errs.push(t('filters.smart.error.missing_value', { key: kv.rawKey }));
        continue;
      }

      if (key === UNSUPPORTED_INCIDENT_SEARCH_KEY) {
        hasUnsupportedText = true;
        continue;
      }

      if (key === 'id') {
        const n = parseNumericToken(value);
        if (n === null) {
          errs.push(t('filters.smart.error.numeric_only', { key: 'id', value }));
          continue;
        }
        openIncident(n);
        setSmart('');
        setSmartErrors([]);
        return;
      }

      if (key === 'vps') {
        const n = parseNumericToken(value);
        if (n === null) {
          errs.push(t('filters.smart.error.numeric_only', { key: 'vps', value }));
          continue;
        }
        nextVps = String(n);
        continue;
      }

      if (key === 'assignment') {
        const n = parseNumericToken(value);
        if (n === null) {
          errs.push(t('filters.smart.error.numeric_only', { key: 'assignment', value }));
          continue;
        }
        nextAssignment = String(n);
        continue;
      }

      if (key === 'ip') {
        nextIp = value;
        continue;
      }

      if (key === 'codename') {
        nextCodename = value;
        continue;
      }

      if (key === 'user') {
        if (!isAdmin) {
          errs.push(t('filters.smart.error.user_admin_only'));
          continue;
        }

        const n = parseNumericToken(value);
        if (n !== null) {
          nextUser = String(n);
          continue;
        }

        try {
          const users = (await searchUsers({ q: value, limit: 10 })).data;
          const exact = users.filter((u) => u.login.toLowerCase() === value.trim().toLowerCase());
          if (exact.length === 1) {
            const [resolvedUser] = exact;
            if (resolvedUser) nextUser = String(resolvedUser.id);
          } else {
            errs.push(t('filters.smart.error.user_unresolved', { value }));
          }
        } catch {
          errs.push(t('filters.smart.error.user_unresolved', { value }));
        }
        continue;
      }

      if (key === 'filed_by') {
        if (!isAdmin) {
          errs.push(t('filters.smart.error.admin_only', { key: 'filed_by' }));
          continue;
        }

        const n = parseNumericToken(value);
        if (n !== null) {
          nextFiledBy = String(n);
          continue;
        }

        try {
          const users = (await searchUsers({ q: value, limit: 10 })).data;
          const exact = users.filter((u) => u.login.toLowerCase() === value.trim().toLowerCase());
          if (exact.length === 1) {
            const [resolvedFiledBy] = exact;
            if (resolvedFiledBy) nextFiledBy = String(resolvedFiledBy.id);
          } else {
            errs.push(t('filters.smart.error.user_unresolved', { value }));
          }
        } catch {
          errs.push(t('filters.smart.error.user_unresolved', { value }));
        }
        continue;
      }

      if (key === 'mailbox') {
        if (!isAdmin) {
          errs.push(t('filters.smart.error.admin_only', { key: 'mailbox' }));
          continue;
        }

        const n = parseNumericToken(value);
        if (n !== null) {
          nextMailbox = String(n);
          continue;
        }

        const resolved = resolveMailboxId(mailboxesQ.data ?? [], value);
        if ('id' in resolved) {
          nextMailbox = String(resolved.id);
        } else if (resolved.err === 'ambiguous') {
          errs.push(t('incidents.smart.error.mailbox_ambiguous', { value }));
        } else {
          errs.push(t('incidents.smart.error.mailbox_unresolved', { value }));
        }
        continue;
      }
    }

    if (hasUnsupportedText) errs.push(t('incidents.smart.error.unsupported_text'));

    if (errs.length > 0) {
      setSmartErrors(errs);
      toasts.pushToast({ variant: 'danger', title: errs[0] ?? t('common.unknown_error') });
      return;
    }

    setVps(nextVps);
    setUser(nextUser);
    setFiledBy(nextFiledBy);
    setIp(nextIp);
    setAssignment(nextAssignment);
    setCodename(nextCodename);
    setMailbox(nextMailbox);
    setSmart('');
    setSmartErrors([]);
  }

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const needle = smartNeedle;
    if (!needle) return [];

    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('filters.help.open'),
          secondary: t('filters.help.suggestion.secondary'),
          onPick: () => setHelpOpen(true),
          testId: 'incidents.smart.suggest.help',
        },
      ];
    }

    // Suggestions are intentionally single-token only.
    if (needle.includes(' ')) return [];

    // If the user already typed a recognized key:value token, avoid suggestions so Enter applies it via onSubmit.
    const tokens = tokenizeSmartInput(needle);
    if (tokens.length === 1) {
      const kv = splitKeyValueToken(tokens[0] ?? '');
      if (kv) {
        const key = canonicalKey(kv.rawKey);
        if (key) return [];
      }
    }

    const out: SmartFilterSuggestion[] = [];

    const n = parseNumericToken(needle);
    if (n !== null) {
      out.push({
        id: 'open',
        primary: t('incidents.smart.suggest.open', { id: n }),
        secondary: t('incidents.smart.suggest.open.secondary'),
        onPick: () => {
          openIncident(n);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'incidents.smart.suggest.open',
      });

      out.push({
        id: 'vps',
        primary: t('incidents.smart.suggest.vps', { id: n }),
        secondary: t('incidents.smart.suggest.vps.secondary'),
        onPick: () => {
          setVps(String(n));
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'incidents.smart.suggest.vps',
      });

      if (isAdmin) {
        out.push({
          id: 'user',
          primary: t('incidents.smart.suggest.user', { id: n }),
          secondary: t('incidents.smart.suggest.user.secondary'),
          onPick: () => {
            setUser(String(n));
            setSmart('');
            setSmartErrors([]);
          },
          testId: 'incidents.smart.suggest.user',
        });
      }

      out.push({
        id: 'assignment',
        primary: t('incidents.smart.suggest.assignment', { id: n }),
        secondary: t('incidents.smart.suggest.assignment.secondary'),
        onPick: () => {
          setAssignment(String(n));
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'incidents.smart.suggest.assignment',
      });
    }

    if (looksLikeIpish(needle)) {
      out.push({
        id: 'ip',
        primary: t('incidents.smart.suggest.ip', { ip: needle }),
        secondary: t('incidents.smart.suggest.ip.secondary'),
        onPick: () => {
          setIp(needle);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'incidents.smart.suggest.ip',
      });
    }

    return out;
  }, [isAdmin, openIncident, smartNeedle, t]);

  const activeChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (vpsId) {
      chips.push(
        <FilterChip key="vps" label={`vps:${vpsId}`} onRemove={() => setVps('')} testId="incidents.chip.vps" />
      );
    }

    if (isAdmin && userId) {
      chips.push(
        <FilterChip key="user" label={`user:${userId}`} onRemove={() => setUser('')} testId="incidents.chip.user" />
      );
    }

    if (isAdmin && filedById) {
      chips.push(
        <FilterChip
          key="filed_by"
          label={`filed_by:${filedById}`}
          onRemove={() => setFiledBy('')}
          testId="incidents.chip.filed_by"
        />
      );
    }

    if (ip.trim()) {
      chips.push(
        <FilterChip key="ip" label={`ip:${ip.trim()}`} onRemove={() => setIp('')} testId="incidents.chip.ip" />
      );
    }

    if (assignmentId) {
      chips.push(
        <FilterChip
          key="assignment"
          label={`assignment:${assignmentId}`}
          onRemove={() => setAssignment('')}
          testId="incidents.chip.assignment"
        />
      );
    }

    if (codename.trim()) {
      chips.push(
        <FilterChip
          key="codename"
          label={`codename:${codename.trim()}`}
          onRemove={() => setCodename('')}
          testId="incidents.chip.codename"
        />
      );
    }

    if (isAdmin && mailboxId) {
      chips.push(
        <FilterChip
          key="mailbox"
          label={`mailbox:${mailboxId}`}
          onRemove={() => setMailbox('')}
          testId="incidents.chip.mailbox"
        />
      );
    }

    for (const [idx, err] of smartErrors.entries()) {
      chips.push(
        <FilterChip
          key={`err-${idx}`}
          label={err}
          tone="danger"
          onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))}
          testId={`incidents.chip.err.${idx}`}
        />
      );
    }

    return chips;
  }, [assignmentId, codename, filedById, ip, isAdmin, mailboxId, smartErrors, userId, vpsId]);

  const header = (
    <PageHeader
      title={t('incidents.list.title')}
      description={t('incidents.list.description')}
      meta={filtersActive ? <span className="text-xs text-faint">{t('list.meta.filters_active')}</span> : null}
      actions={
        isAdmin ? (
          <Button variant="secondary" size="sm" to={`${basePath}/incidents/new`} testId="incidents.list.new">
            {t('incidents.list.new')}
          </Button>
        ) : null
      }
      testId="incidents.list.header"
    />
  );

  return (
    <ListShell
      header={header}
      filters={
        <>
          <FilterBar testId="incidents.list.filters">
            <SmartFilterInput
              ref={smartInputRef}
              value={smart}
              onChange={setSmart}
              placeholder={t('incidents.search.placeholder')}
              ariaLabel={t('incidents.search.aria')}
              testId="incidents.smart_filter.input"
              suggestions={smartSuggestions}
              onSubmit={() => void applySmartText(smart)}
              suffix={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHelpOpen(true)}
                  ariaLabel={t('filters.help.open')}
                  testId="incidents.smart_filter.help_btn"
                >
                  <CircleHelp className="h-4 w-4" aria-hidden />
                </Button>
              }
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              ariaLabel={t('filters.advanced.open')}
              testId="incidents.filters.advanced"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
            </Button>

            <CopyButton
              text={shareUrl}
              label={t('common.copy_link')}
              size="sm"
              variant="secondary"
              testId="incidents.filters.copy_link"
            />

            {hasFilterState ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="incidents.filters.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          {activeChips.length ? <div className="flex flex-wrap gap-2">{activeChips}</div> : null}

          <SmartInputHelp
            open={helpOpen}
            onClose={() => setHelpOpen(false)}
            title={t('incidents.smart_help.title')}
            intro={t('incidents.smart_help.description')}
            examples={[
              {
                label: t('incidents.smart_help.examples.help.label'),
                value: '?',
                description: t('incidents.smart_help.examples.help.description'),
              },
              {
                label: t('incidents.smart_help.examples.open.label'),
                value: '123',
                description: t('incidents.smart_help.examples.open.description'),
              },
              {
                label: t('incidents.smart_help.examples.vps.label'),
                value: 'vps:123',
                description: t('incidents.smart_help.examples.vps.description'),
              },
              {
                label: t('incidents.smart_help.examples.ip.label'),
                value: 'ip:1.2.3.4',
                description: t('incidents.smart_help.examples.ip.description'),
              },
              {
                label: t('incidents.smart_help.examples.codename.label'),
                value: 'codename:abuse',
                description: t('incidents.smart_help.examples.codename.description'),
              },
            ]}
            keys={[
              { key: 'vps', description: t('incidents.smart_help.keys.vps') },
              ...(isAdmin
                ? [
                    { key: 'user', description: t('incidents.smart_help.keys.user') },
                    { key: 'filed_by', description: t('incidents.smart_help.keys.filed_by') },
                    { key: 'mailbox', description: t('incidents.smart_help.keys.mailbox') },
                  ]
                : []),
              { key: 'assignment', description: t('incidents.smart_help.keys.assignment') },
              { key: 'ip', description: t('incidents.smart_help.keys.ip') },
              { key: 'codename', description: t('incidents.smart_help.keys.codename') },
            ]}
            inferences={[
              t('incidents.smart_help.inferences.exact_only'),
              t('incidents.smart_help.inferences.numeric_open'),
              t('incidents.smart_help.inferences.key_value'),
            ]}
            onInsertKey={(key) => {
              const cur = smartInputRef.current;
              const next = smart.trim() ? `${smart.trim()} ${key}:` : `${key}:`;
              setSmart(next);
              requestAnimationFrame(() => cur?.focus());
            }}
            testId="incidents.smart_help"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            testId="incidents.filters.drawer"
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{t('incidents.filter.vps')}</div>
                <div className="mt-1">
                  <VpsLookupInput
                    value={vpsId ?? null}
                    onChange={(id) => setVps(id ? String(id) : '')}
                    placeholder={t('incidents.filter.vps')}
                    testId="incidents.advanced.vps"
                  />
                </div>
              </div>

              {isAdmin ? (
                <div>
                  <div className="text-sm font-medium">{t('incidents.filter.user')}</div>
                  <div className="mt-1">
                    <UserLookupInput
                      value={user}
                      onChange={setUser}
                      placeholder={t('incidents.filter.user')}
                      loadingLabel={t('common.loading')}
                      noResultsLabel={t('empty.list.no_matches.title')}
                      testId="incidents.advanced.user"
                    />
                  </div>
                </div>
              ) : null}

              {isAdmin ? (
                <div>
                  <div className="text-sm font-medium">{t('incidents.filter.filed_by')}</div>
                  <div className="mt-1">
                    <UserLookupInput
                      value={filedBy}
                      onChange={setFiledBy}
                      placeholder={t('incidents.filter.filed_by')}
                      loadingLabel={t('common.loading')}
                      noResultsLabel={t('empty.list.no_matches.title')}
                      testId="incidents.advanced.filed_by"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-sm font-medium">{t('incidents.filter.ip')}</div>
                <div className="mt-1">
                  <Input
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder={t('incidents.filter.ip')}
                    autoComplete="off"
                    testId="incidents.advanced.ip"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">{t('incidents.filter.assignment')}</div>
                <div className="mt-1">
                  <Input
                    value={assignment}
                    onChange={(e) => setAssignment(e.target.value)}
                    placeholder={t('incidents.filter.assignment')}
                    autoComplete="off"
                    testId="incidents.advanced.assignment"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">{t('incidents.filter.codename')}</div>
                <div className="mt-1">
                  <Input
                    value={codename}
                    onChange={(e) => setCodename(e.target.value)}
                    placeholder={t('incidents.filter.codename')}
                    autoComplete="off"
                    testId="incidents.advanced.codename"
                  />
                </div>
              </div>

              {isAdmin ? (
                <div>
                  <div className="text-sm font-medium">{t('incidents.filter.mailbox')}</div>
                  <div className="mt-1">
                    <Select
                      value={mailbox}
                      onChange={(e) => setMailbox(e.target.value)}
                      options={mailboxOptions}
                      testId="incidents.advanced.mailbox"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              {hasFilterState ? (
                <Button variant="secondary" size="sm" onClick={clearFilters} testId="incidents.advanced.clear">
                  {t('common.clear_filters')}
                </Button>
              ) : null}

              <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)} testId="incidents.advanced.done">
                {t('common.done')}
              </Button>
            </div>
          </Drawer>
        </>
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="incidents.list.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="incidents.list.error"
          title={t('incidents.list.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'incidents.list' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="incidents.list.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('incidents.list.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          <TableCard
            className="hidden xl:block"
            minWidth="xl"
            tableClassName="table-fixed"
            tableTestId="incidents.list.table"
          >
                <colgroup>
                  <col className="w-8" />
                  <col className="w-24" />
                  <col className="w-40" />
                  {isAdmin ? <col className="w-32" /> : null}
                  <col className="w-36" />
                  <col className="w-40" />
                  <col />
                  <col className="w-32" />
                  {isAdmin ? <col className="w-32" /> : null}
                </colgroup>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="w-8 px-2 py-2" aria-label={t('common.state')} />
                    <th className="px-3 py-2">{t('common.id')}</th>
                    <th className="px-3 py-2">{t('incidents.field.detected_at')}</th>
                    {isAdmin ? <th className="px-3 py-2">{t('common.user')}</th> : null}
                    <th className="px-3 py-2">{t('common.vps')}</th>
                    <th className="px-3 py-2">{t('incidents.field.ip')}</th>
                    <th className="px-3 py-2">{t('incidents.field.subject')}</th>
                    <th className="px-3 py-2">{t('incidents.field.codename')}</th>
                    {isAdmin ? <th className="px-3 py-2">{t('incidents.field.filed_by')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const to = `${basePath}/incidents/${r.id}`;
                    const det = formatDateTime(r.detected_at);

                    const vpsHost = (r.vps as any)?.hostname ? String((r.vps as any).hostname) : undefined;
                    const vpsIdRow = (r.vps as any)?.id ? Number((r.vps as any).id) : undefined;

                    const userLogin = (r.user as any)?.login ? String((r.user as any).login) : undefined;
                    const userIdRow = (r.user as any)?.id ? Number((r.user as any).id) : undefined;

                    const filedLogin = (r.filed_by as any)?.login ? String((r.filed_by as any).login) : undefined;
                    const filedId = (r.filed_by as any)?.id ? Number((r.filed_by as any).id) : undefined;

                    const assignmentIp = (r.ip_address_assignment as any)?.ip_addr
                      ? String((r.ip_address_assignment as any).ip_addr)
                      : undefined;
                    const subject = r.subject ? String(r.subject) : '';
                    const codename = r.codename ? String(r.codename) : '';

                    const action = String(r.vps_action ?? 'none');
                    const cpu = typeof r.cpu_limit === 'number' && Number.isFinite(r.cpu_limit) ? Math.floor(r.cpu_limit) : null;
                    const rowVariant = incidentRowVariant(r);
                    const dotVariant = dotVariantFromRowVariant(rowVariant);

                    return (
                      <TableRowLink key={r.id} to={to} variant={rowVariant} testId={`incidents.list.row.${r.id}`}>
                        <td className="px-2 py-2">
                          <StatusDot variant={dotVariant} testId={`incidents.list.row.${r.id}.dot`} />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          <MiniLink data-row-no-nav to={to}>
                            #{r.id}
                          </MiniLink>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">{det}</span>
                            {action !== 'none' ? (
                              <Badge variant={vpsActionVariant(action)} testId={`incidents.list.row.${r.id}.action`}>
                                {t(vpsActionLabelKey(action))}
                              </Badge>
                            ) : null}
                            {cpu !== null ? (
                              <Badge variant="warn" testId={`incidents.list.row.${r.id}.cpu_limit`}>
                                {t('incidents.badge.cpu_limit', { pct: cpu })}
                              </Badge>
                            ) : null}
                          </div>
                        </td>

                        {isAdmin ? (
                          <td className="px-3 py-2">
                            {userIdRow ? (
                              <ChipLink data-row-no-nav to={`${basePath}/users/${userIdRow}`} className="max-w-full">
                                {userLogin || `#${userIdRow}`}
                              </ChipLink>
                            ) : userLogin ? (
                              userLogin
                            ) : (
                              '—'
                            )}
                          </td>
                        ) : null}

                        <td className="px-3 py-2">
                          {vpsIdRow ? (
                            <ChipLink data-row-no-nav to={`${basePath}/vps/${vpsIdRow}`} className="max-w-full">
                              {vpsHost || `#${vpsIdRow}`}
                            </ChipLink>
                          ) : r.raw_vps_id ? (
                            `#${r.raw_vps_id}`
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="px-3 py-2 break-all font-mono text-xs">{assignmentIp || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="min-w-0 truncate text-sm font-medium leading-5" title={subject || undefined}>
                            {subject ? compactText(subject, 72) : '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          <span className="block truncate" title={codename || undefined}>
                            {codename ? compactText(codename, 36) : '—'}
                          </span>
                        </td>

                        {isAdmin ? (
                          <td className="px-3 py-2">
                            {filedId ? (
                              <ChipLink data-row-no-nav to={`${basePath}/users/${filedId}`} className="max-w-full">
                                {filedLogin || `#${filedId}`}
                              </ChipLink>
                            ) : filedLogin ? (
                              filedLogin
                            ) : (
                              '—'
                            )}
                          </td>
                        ) : null}

                      </TableRowLink>
                    );
                  })}
                </tbody>
          </TableCard>

          <div className="xl:hidden" data-testid="incidents.list.cards">
            <div className="space-y-3">
              {rows.map((r) => {
                const to = `${basePath}/incidents/${r.id}`;
                const det = formatDateTime(r.detected_at);

                const vpsHost = (r.vps as any)?.hostname ? String((r.vps as any).hostname) : undefined;
                const vpsIdRow = (r.vps as any)?.id ? Number((r.vps as any).id) : undefined;

                const userLogin = (r.user as any)?.login ? String((r.user as any).login) : undefined;
                const userIdRow = (r.user as any)?.id ? Number((r.user as any).id) : undefined;

                const assignmentIp = (r.ip_address_assignment as any)?.ip_addr
                  ? String((r.ip_address_assignment as any).ip_addr)
                  : undefined;
                const subject = r.subject ? String(r.subject) : '';
                const codename = r.codename ? String(r.codename) : '';

                const action = String(r.vps_action ?? 'none');
                const cpu = typeof r.cpu_limit === 'number' && Number.isFinite(r.cpu_limit) ? Math.floor(r.cpu_limit) : null;
                const rowVariant = incidentRowVariant(r);
                const dotVariant = dotVariantFromRowVariant(rowVariant);

                return (
                  <div
                    key={r.id}
                    className="overflow-hidden rounded-lg border border-border bg-surface"
                    data-testid={`incidents.list.card.${r.id}`}
                  >
                    <div className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusDot variant={dotVariant} testId={`incidents.list.card.${r.id}.dot`} />
                          <MiniLink to={to} className="font-mono text-sm">
                            #{r.id}
                          </MiniLink>
                          <span className="text-sm font-semibold text-text">{det}</span>
                          {action !== 'none' ? (
                            <Badge variant={vpsActionVariant(action)} testId={`incidents.list.card.${r.id}.action`}>
                              {t(vpsActionLabelKey(action))}
                            </Badge>
                          ) : null}
                          {cpu !== null ? (
                            <Badge variant="warn" testId={`incidents.list.card.${r.id}.cpu_limit`}>
                              {t('incidents.badge.cpu_limit', { pct: cpu })}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-1 truncate text-sm font-medium text-text" title={subject || undefined}>
                          {subject ? compactText(subject, 80) : '—'}
                        </div>

                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
                          {isAdmin ? (
                            userIdRow ? (
                              <ChipLink to={`${basePath}/users/${userIdRow}`}>{userLogin || `#${userIdRow}`}</ChipLink>
                            ) : userLogin ? (
                              <span>{userLogin}</span>
                            ) : null
                          ) : null}
                          {vpsIdRow ? (
                            <ChipLink to={`${basePath}/vps/${vpsIdRow}`}>{vpsHost || `#${vpsIdRow}`}</ChipLink>
                          ) : r.raw_vps_id ? (
                            <span>#{r.raw_vps_id}</span>
                          ) : (
                            <span>{t('common.vps')}: —</span>
                          )}
                          {assignmentIp ? (
                            <span className="font-mono text-xs" title={assignmentIp}>
                              {compactText(assignmentIp, 42)}
                            </span>
                          ) : null}
                          {codename ? (
                            <span className="font-mono text-xs" title={codename}>
                              {compactText(codename, 42)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <Button
                          to={to}
                          variant="secondary"
                          size="sm"
                          className="whitespace-nowrap"
                          testId={`incidents.list.card.${r.id}.open`}
                        >
                          {t('incidents.list.open_detail')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4">
            <KeysetPagination
              page={pagination.page}
              pageCount={pagination.stack.length}
              canPrev={pagination.canPrev}
              canNext={pagination.hasForward || rows.length === pagination.limit}
              onPrev={() => pagination.goPrev()}
              onNext={() => pagination.goNext(rows.length > 0 ? (rows[rows.length - 1] as any).id : undefined)}
              onGoToPage={pagination.goToPage}
              limit={pagination.limit}
              allowedLimits={pagination.allowedLimits}
              onLimitChange={(l) => pagination.setLimit(l)}
              testId="incidents.list.pagination"
            />
          </div>
        </>
      )}
    </ListShell>
  );
}
