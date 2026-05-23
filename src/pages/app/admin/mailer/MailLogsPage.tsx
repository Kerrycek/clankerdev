import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { FilterBar } from '../../../../components/layout/FilterBar';
import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';

import { searchUsers } from '../../../../lib/api/users';
import { fetchMailLogs, fetchMailTemplates, type MailLog, type MailTemplate } from '../../../../lib/api/mailer';
import { isoToLocalInput, localInputToIso } from '../../../../lib/datetimeLocal';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { resourceId, refLabel } from '../../../../lib/resources';
import { useDebouncedValue } from '../../../../lib/hooks/useDebouncedValue';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';
import { TableRowLink } from '../../../../components/ui/TableRowLink';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';

import { MailerTabs } from './MailerTabs';

function templateLabel(tpl: MailTemplate): string {
  const label = tpl.label ? String(tpl.label) : '';
  const name = tpl.name ? String(tpl.name) : '';
  if (label && name && label !== name) return `${label} (${name})`;
  return label || name || `#${tpl.id}`;
}

type SmartKey = 'id' | 'q' | 'user' | 'template' | 'after' | 'before';

function canonicalKey(raw: string): SmartKey | null {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!k) return null;

  if (['id', '#', 'log'].includes(k)) return 'id';

  if (
    [
      'q',
      'search',
      's',
      'text',
      'subject',
      'to',
      'from',
      'message',
      'msg',
      'message_id',
      'mid',
    ].includes(k)
  ) {
    return 'q';
  }

  if (['user', 'u', 'owner'].includes(k)) return 'user';
  if (['template', 'tpl', 't', 'mail_template'].includes(k)) return 'template';
  if (['after', 'since', 'from_time', 'from_at'].includes(k)) return 'after';
  if (['before', 'until', 'to_time', 'to_at'].includes(k)) return 'before';

  return null;
}

function parseDateTimeLocalValue(raw: string, endOfDay: boolean): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return '';

  // Date-only: yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${v}T${endOfDay ? '23:59' : '00:00'}`;
  }

  // datetime-local: yyyy-mm-ddThh:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
    return v;
  }

  // ISO-ish input: parse and normalize to datetime-local.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;

  return isoToLocalInput(d.toISOString());
}

function resolveTemplateId(
  templates: MailTemplate[] | undefined,
  value: string
): { id: number } | { err: 'none' | 'ambiguous' } {
  const needle = value.trim().toLowerCase();
  if (!needle) return { err: 'none' };
  const list = templates ?? [];

  const exact = list.filter((tpl) => {
    const label = String((tpl as any).label ?? '').trim().toLowerCase();
    const name = String((tpl as any).name ?? '').trim().toLowerCase();
    const templateId = String((tpl as any).template_id ?? '').trim().toLowerCase();
    return label === needle || name === needle || templateId === needle;
  });

  if (exact.length === 1) return { id: Number((exact[0] as any).id) };

  const partial = list.filter((tpl) => {
    const label = String((tpl as any).label ?? '').trim().toLowerCase();
    const name = String((tpl as any).name ?? '').trim().toLowerCase();
    const templateId = String((tpl as any).template_id ?? '').trim().toLowerCase();
    return label.includes(needle) || name.includes(needle) || templateId.includes(needle);
  });

  if (partial.length === 1) return { id: Number((partial[0] as any).id) };
  if (partial.length === 0 && exact.length === 0) return { err: 'none' };
  return { err: 'ambiguous' };
}

export function MailLogsPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [templateId, setTemplateId] = useState(() => searchParams.get('template') ?? '');
  const [userRaw, setUserRaw] = useState(() => searchParams.get('user') ?? '');
  const [after, setAfter] = useState(() => searchParams.get('after') ?? '');
  const [before, setBefore] = useState(() => searchParams.get('before') ?? '');

  // Smart filter input (unapplied text).
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const smartNeedle = smart.trim();
  const debouncedSmartNeedle = useDebouncedValue(smartNeedle, 150);

  const smartInputRef = useRef<HTMLInputElement>(null);

  // Sync local state on browser navigation.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlTemplate = searchParams.get('template') ?? '';
    const urlUser = searchParams.get('user') ?? '';
    const urlAfter = searchParams.get('after') ?? '';
    const urlBefore = searchParams.get('before') ?? '';

    if (urlQ !== q) setQ(urlQ);
    if (urlTemplate !== templateId) setTemplateId(urlTemplate);
    if (urlUser !== userRaw) setUserRaw(urlUser);
    if (urlAfter !== after) setAfter(urlAfter);
    if (urlBefore !== before) setBefore(urlBefore);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const templateIdNum = useMemo(() => parseNumericToken(templateId) ?? undefined, [templateId]);
  const userIdNum = useMemo(() => parseNumericToken(userRaw) ?? undefined, [userRaw]);

  const afterIso = useMemo(() => {
    const r = localInputToIso(after);
    if (!r.valid) return undefined;
    return r.iso ?? undefined;
  }, [after]);

  const beforeIso = useMemo(() => {
    const r = localInputToIso(before);
    if (!r.valid) return undefined;
    return r.iso ?? undefined;
  }, [before]);

  // Persist filters in URL (shareable) while preserving pagination params.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (templateIdNum) next.set('template', String(templateIdNum));
    else next.delete('template');

    // Store user only when numeric (we allow typing names for lookup without polluting the URL).
    if (userIdNum) next.set('user', String(userIdNum));
    else if (!userRaw.trim()) next.delete('user');

    if (after.trim()) next.set('after', after.trim());
    else next.delete('after');

    if (before.trim()) next.set('before', before.trim());
    else next.delete('before');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [after, before, qTrim, searchParams, setSearchParams, templateIdNum, userIdNum, userRaw]);

  const pagination = useKeysetPagination({
    id: 'admin.mailer.log.list',
    filterKey: JSON.stringify({
      q: qTrim,
      templateId: templateIdNum,
      userId: userIdNum,
      after: afterIso,
      before: beforeIso,
    }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const templatesQ = useQuery({
    queryKey: ['mailer', 'templates', 'index', { limit: 500 }],
    queryFn: async () => (await fetchMailTemplates({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: [
      'mailer',
      'mail_logs',
      'index',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qTrim,
        templateId: templateIdNum,
        userId: userIdNum,
        after: afterIso,
        before: beforeIso,
      },
    ],
    queryFn: async () =>
      (
        await fetchMailLogs({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qTrim,
          templateId: templateIdNum,
          userId: userIdNum,
          createdAfter: afterIso,
          createdBefore: beforeIso,
        })
      ).data,
    staleTime: 10_000,
  });

  const rows: MailLog[] = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(rows as any), [rows]);

  const hasMore = rows.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;

  const filtersActive = Boolean(qTrim || templateIdNum || userIdNum || after.trim() || before.trim() || smartErrors.length);

  function clearFilters() {
    setQ('');
    setTemplateId('');
    setUserRaw('');
    setAfter('');
    setBefore('');
    setSmart('');
    setSmartErrors([]);
  }

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedSmartNeedle }],
    enabled:
      debouncedSmartNeedle.length >= 2 &&
      debouncedSmartNeedle !== '?' &&
      !debouncedSmartNeedle.includes(':') &&
      !debouncedSmartNeedle.includes(' ') &&
      parseNumericToken(debouncedSmartNeedle) === null,
    queryFn: async () => (await searchUsers({ q: debouncedSmartNeedle, limit: 6 })).data,
    staleTime: 10_000,
  });

  async function applySmartText(raw: string) {
    const input = raw.trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input)
      .map((t) => t.trim())
      .filter(Boolean);

    // Pure numeric → open mail log by default.
    const firstToken = tokens[0];
    const numericOnly = tokens.length === 1 && firstToken ? parseNumericToken(firstToken) : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      navigate(`${basePath}/mailer/log/${numericOnly}`);
      return;
    }

    let nextQ = q;
    let nextTemplateId = templateId;
    let nextUserRaw = userRaw;
    let nextAfter = after;
    let nextBefore = before;

    const free: string[] = [];
    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const key = canonicalKey(kv.rawKey);
        const value = unquoteSmartValue(kv.rawValue);

        if (!key) {
          errs.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
          continue;
        }

        if (!value.trim()) {
          errs.push(t('filters.smart.error.missing_value', { key: kv.rawKey.trim() }));
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n === null) {
            errs.push(t('mailer.log.smart.error.id_numeric_only', { value }));
          } else {
            setSmart('');
            setSmartErrors([]);
            navigate(`${basePath}/mailer/log/${n}`);
            return;
          }
          continue;
        }

        if (key === 'q') {
          nextQ = value;
          continue;
        }

        if (key === 'user') {
          const n = parseNumericToken(value);
          if (n !== null) {
            nextUserRaw = String(n);
            continue;
          }

          try {
            const users = (await searchUsers({ q: value, limit: 10 })).data;
            const exact = users.filter((u) => u.login.toLowerCase() === value.trim().toLowerCase());
            const firstExact = exact[0];
            if (exact.length === 1 && firstExact) {
              nextUserRaw = String(firstExact.id);
            } else {
              errs.push(t('filters.smart.error.user_unresolved', { value }));
            }
          } catch {
            errs.push(t('filters.smart.error.user_unresolved', { value }));
          }
          continue;
        }

        if (key === 'template') {
          const n = parseNumericToken(value);
          if (n !== null) {
            nextTemplateId = String(n);
            continue;
          }

          const resolved = resolveTemplateId(templatesQ.data, value);
          if ('id' in resolved) {
            nextTemplateId = String(resolved.id);
          } else if (resolved.err === 'ambiguous') {
            errs.push(t('mailer.log.smart.error.template_ambiguous', { value }));
          } else {
            errs.push(t('mailer.log.smart.error.template_unresolved', { value }));
          }
          continue;
        }

        if (key === 'after') {
          const dt = parseDateTimeLocalValue(value, false);
          if (dt === null) errs.push(t('mailer.log.smart.error.invalid_datetime', { value }));
          else nextAfter = dt;
          continue;
        }

        if (key === 'before') {
          const dt = parseDateTimeLocalValue(value, true);
          if (dt === null) errs.push(t('mailer.log.smart.error.invalid_datetime', { value }));
          else nextBefore = dt;
          continue;
        }

        errs.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
        continue;
      }

      free.push(unquoteSmartValue(token));
    }

    if (free.length > 0) nextQ = free.join(' ');

    if (errs.length > 0) {
      setSmartErrors(errs);
      toasts.pushToast({ variant: 'danger', title: errs[0] ?? t('common.unknown_error') });
      return;
    }

    setQ(nextQ);
    setTemplateId(nextTemplateId);
    setUserRaw(nextUserRaw);
    setAfter(nextAfter);
    setBefore(nextBefore);
    setSmart('');
    setSmartErrors([]);
  }

  const templateOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.all') }];
    const templates = [...(templatesQ.data ?? [])].sort((a, b) =>
      templateLabel(a as any).localeCompare(templateLabel(b as any))
    );
    for (const tpl of templates) {
      const id = Number((tpl as any).id);
      if (!Number.isFinite(id) || id <= 0) continue;
      opts.push({ value: String(id), label: templateLabel(tpl as any) });
    }
    return opts;
  }, [t, templatesQ.data]);

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

    // Suggestions are intentionally single-token only.
    if (needle.includes(' ')) return [];

    const suggestions: SmartFilterSuggestion[] = [];

    const numeric = parseNumericToken(needle);
    if (numeric !== null) {
      const id = String(numeric);
      suggestions.push({
        id: `open:${id}`,
        primary: t('mailer.log.smart.suggest.open', { id }),
        secondary: t('mailer.log.smart.suggest.open.secondary'),
        onPick: () => {
          setSmart('');
          setSmartErrors([]);
          navigate(`${basePath}/mailer/log/${numeric}`);
        },
      });

      suggestions.push({
        id: `search:${id}`,
        primary: t('mailer.log.smart.suggest.search', { value: id }),
        secondary: t('mailer.log.smart.suggest.search.secondary'),
        onPick: () => {
          setQ(id);
          setSmart('');
          setSmartErrors([]);
        },
      });

      suggestions.push({
        id: `user:${id}`,
        primary: t('mailer.log.smart.suggest.user', { id }),
        secondary: t('mailer.log.smart.suggest.user.secondary'),
        onPick: () => {
          setUserRaw(id);
          setSmart('');
          setSmartErrors([]);
        },
      });

      suggestions.push({
        id: `template:${id}`,
        primary: t('mailer.log.smart.suggest.template', { id }),
        secondary: t('mailer.log.smart.suggest.template.secondary'),
        onPick: () => {
          setTemplateId(id);
          setSmart('');
          setSmartErrors([]);
        },
      });

      return suggestions;
    }

    // Default: server-side search.
    suggestions.push({
      id: `search:${needle}`,
      primary: t('mailer.log.smart.suggest.search', { value: needle }),
      secondary: t('mailer.log.smart.suggest.search.secondary'),
      onPick: () => {
        setQ(needle);
        setSmart('');
        setSmartErrors([]);
      },
    });

    // Template match suggestions.
    const templates = templatesQ.data ?? [];
    const tplNeedle = needle.trim().toLowerCase();
    if (tplNeedle.length >= 2 && templates.length > 0) {
      const matches = templates
        .filter((tpl) => {
          const label = templateLabel(tpl as any).toLowerCase();
          const name = String((tpl as any).name ?? '').toLowerCase();
          const templateId = String((tpl as any).template_id ?? '').toLowerCase();
          return label.includes(tplNeedle) || name.includes(tplNeedle) || templateId.includes(tplNeedle);
        })
        .slice(0, 4);

      for (const tpl of matches) {
        const id = Number((tpl as any).id);
        if (!Number.isFinite(id) || id <= 0) continue;
        suggestions.push({
          id: `tpl:${id}`,
          primary: t('mailer.log.smart.suggest.template_match', { label: templateLabel(tpl as any) }),
          secondary: t('mailer.log.smart.suggest.template_match.secondary'),
          onPick: () => {
            setTemplateId(String(id));
            setSmart('');
            setSmartErrors([]);
          },
        });
      }
    }

    // User lookup suggestions.
    if ((userSuggestQuery.data ?? []).length > 0) {
      for (const u of userSuggestQuery.data ?? []) {
        suggestions.push({
          id: `user:${u.id}`,
          primary: t('mailer.log.smart.suggest.user_match', { login: u.login, id: String(u.id) }),
          secondary: t('mailer.log.smart.suggest.user_match.secondary'),
          onPick: () => {
            setUserRaw(String(u.id));
            setSmart('');
            setSmartErrors([]);
          },
          testId: `admin.mailer.log.smart_filter.suggest.user.${u.id}`,
        });
      }
    }

    return suggestions;
  }, [basePath, navigate, smartNeedle, t, templatesQ.data, userSuggestQuery.data]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (qTrim) {
      chips.push(
        <FilterChip key="q" label={`q:${qTrim}`} onRemove={() => setQ('')} testId="admin.mailer.log.chip.q" />
      );
    }

    if (templateIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="template"
          label={`template:${templateIdNum}`}
          onRemove={() => setTemplateId('')}
          testId="admin.mailer.log.chip.template"
        />
      );
    }

    if (userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:${userIdNum}`}
          onRemove={() => setUserRaw('')}
          testId="admin.mailer.log.chip.user"
        />
      );
    }

    if (after.trim()) {
      chips.push(
        <FilterChip
          key="after"
          label={`after:${after.trim()}`}
          onRemove={() => setAfter('')}
          testId="admin.mailer.log.chip.after"
        />
      );
    }

    if (before.trim()) {
      chips.push(
        <FilterChip
          key="before"
          label={`before:${before.trim()}`}
          onRemove={() => setBefore('')}
          testId="admin.mailer.log.chip.before"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`admin.mailer.log.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [after, before, qTrim, smartErrors, templateIdNum, userIdNum]);

  return (
    <ListShell
      testId="admin.mailer.log.page"
      header={
        <div className="space-y-3">
          <PageHeader
            title={t('mailer.log.list.title')}
            description={t('mailer.log.list.description')}
            meta={filtersActive ? <span className="text-xs text-faint">{t('list.meta.filters_active')}</span> : null}
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

              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.mailer.log.active_filters">
                  {activeFilterChips}
                </div>
              ) : null}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              aria-label={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
              testId="admin.mailer.log.advanced.open"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={typeof window !== 'undefined' ? window.location.href : ''}
              testId="admin.mailer.log.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.mailer.log.filters.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}

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
              { example: 'invoice', description: t('mailer.log.smart_help.examples.search') },
              { example: 'template:welcome', description: t('mailer.log.smart_help.examples.template') },
              { example: 'user:alice', description: t('mailer.log.smart_help.examples.user') },
              { example: 'after:2025-01-01', description: t('mailer.log.smart_help.examples.after') },
            ]}
            topKeys={[
              { key: 'q', description: t('mailer.log.smart_help.keys.q'), example: 'q:invoice' },
              { key: 'template', description: t('mailer.log.smart_help.keys.template'), example: 'template:welcome' },
              { key: 'user', description: t('mailer.log.smart_help.keys.user'), example: 'user:alice' },
              { key: 'after', description: t('mailer.log.smart_help.keys.after'), example: 'after:2025-01-01' },
              { key: 'before', description: t('mailer.log.smart_help.keys.before'), example: 'before:2025-01-31' },
              { key: 'id', description: t('mailer.log.smart_help.keys.id'), example: 'id:123' },
            ]}
            inference={[
              t('mailer.log.smart_help.inference.typed'),
              t('mailer.log.smart_help.inference.enter'),
              t('mailer.log.smart_help.inference.advanced'),
            ]}
            onInsertKey={(key) => {
              setSmart(`${key}:`);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 50);
            }}
            actions={[
              {
                label: t('filters.advanced.open'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
                variant: 'secondary',
              },
            ]}
            testId="admin.mailer.log.smart_help"
            keyRowTestIdPrefix="admin.mailer.log.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.mailer.log.advanced"
            footer={
              <div className="flex items-center justify-end gap-2">
                {filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('common.clear_filters')}
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)}>
                  {t('common.close')}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{t('common.search')}</div>
                <div className="mt-1">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('mailer.log.list.search.placeholder')}
                    testId="admin.mailer.log.advanced.q"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">{t('mailer.log.row.template')}</div>
                <div className="mt-1">
                  <Select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    options={templateOptions}
                    testId="admin.mailer.log.advanced.template"
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">{t('common.user')}</div>
                <div className="mt-1">
                  <UserLookupInput
                    value={userRaw}
                    onChange={setUserRaw}
                    placeholder={t('mailer.log.list.user.placeholder')}
                    loadingLabel={t('common.loading')}
                    noResultsLabel={t('empty.list.no_matches.title')}
                    testId="admin.mailer.log.advanced.user"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">{t('mailer.log.list.after')}</div>
                  <div className="mt-1">
                    <Input
                      type="datetime-local"
                      value={after}
                      onChange={(e) => setAfter(e.target.value)}
                      testId="admin.mailer.log.advanced.after"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('mailer.log.list.before')}</div>
                  <div className="mt-1">
                    <Input
                      type="datetime-local"
                      value={before}
                      onChange={(e) => setBefore(e.target.value)}
                      testId="admin.mailer.log.advanced.before"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
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
          title={filtersActive ? t('empty.list.no_matches.title') : t('mailer.log.list.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? () => clearFilters() : undefined}
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
