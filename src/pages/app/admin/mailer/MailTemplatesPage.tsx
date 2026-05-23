import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import { fetchMailTemplates, type MailTemplate } from '../../../../lib/api/mailer';
import { fetchLanguages } from '../../../../lib/api/languages';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { useTierSlowIntervalMs } from '../../../../lib/refreshTiers';

import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { FilterBar } from '../../../../components/layout/FilterBar';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';
import { TableRowLink } from '../../../../components/ui/TableRowLink';

import { MailerTabs } from './MailerTabs';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

function parsePositiveInt(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseBoolParam(v: string): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return undefined;
}

function visibilityBadgeVariant(uv: string | undefined): 'neutral' | 'info' | 'warn' {
  const v = String(uv ?? '').toLowerCase();
  if (v === 'visible') return 'info';
  if (v === 'invisible') return 'warn';
  return 'neutral';
}

function visibilityLabelKey(uv: string | undefined): string {
  const v = String(uv ?? '').toLowerCase();
  if (v === 'visible') return 'mailer.templates.visibility.visible';
  if (v === 'invisible') return 'mailer.templates.visibility.invisible';
  return 'mailer.templates.visibility.default';
}

function uniqSorted(arr: string[]) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

export function MailTemplatesPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const navigate = useNavigate();

  const tierSlowRefetchMs = useTierSlowIntervalMs();

  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [templateId, setTemplateId] = useState(() => searchParams.get('template_id') ?? '');
  const [userVisibility, setUserVisibility] = useState(() => searchParams.get('user_visibility') ?? '');
  const [role, setRole] = useState(() => searchParams.get('role') ?? '');
  const [publicFlag, setPublicFlag] = useState(() => searchParams.get('public') ?? '');
  const [language, setLanguage] = useState(() => searchParams.get('language') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync local state on browser navigation.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlTpl = searchParams.get('template_id') ?? '';
    const urlUv = searchParams.get('user_visibility') ?? '';
    const urlRole = searchParams.get('role') ?? '';
    const urlPublic = searchParams.get('public') ?? '';
    const urlLang = searchParams.get('language') ?? '';

    if (urlQ !== q) setQ(urlQ);
    if (urlTpl !== templateId) setTemplateId(urlTpl);
    if (urlUv !== userVisibility) setUserVisibility(urlUv);
    if (urlRole !== role) setRole(urlRole);
    if (urlPublic !== publicFlag) setPublicFlag(urlPublic);
    if (urlLang !== language) setLanguage(urlLang);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const templateIdTrim = useMemo(() => templateId.trim(), [templateId]);
  const uvTrim = useMemo(() => userVisibility.trim(), [userVisibility]);
  const roleTrim = useMemo(() => role.trim(), [role]);
  const publicBool = useMemo(() => parseBoolParam(publicFlag), [publicFlag]);
  const languageId = useMemo(() => parsePositiveInt(language), [language]);

  // Persist filters in URL (shareable) while preserving pagination params.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (templateIdTrim) next.set('template_id', templateIdTrim);
    else next.delete('template_id');

    if (uvTrim) next.set('user_visibility', uvTrim);
    else next.delete('user_visibility');

    if (roleTrim) next.set('role', roleTrim);
    else next.delete('role');

    if (publicBool === true) next.set('public', 'true');
    else if (publicBool === false) next.set('public', 'false');
    else next.delete('public');

    if (languageId) next.set('language', String(languageId));
    else if (!language.trim()) next.delete('language');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [language, languageId, publicBool, qTrim, roleTrim, searchParams, setSearchParams, templateIdTrim, uvTrim]);

  const pagination = useKeysetPagination({
    id: 'admin.mailer.templates.list',
    filterKey: JSON.stringify({ q: qTrim, templateId: templateIdTrim, uv: uvTrim, role: roleTrim, public: publicBool, languageId }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const languagesQ = useQuery({
    queryKey: ['languages', 'index', { limit: 500 }],
    queryFn: async () => (await fetchLanguages({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: [
      'mailer',
      'mail_templates',
      'index',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qTrim,
        templateId: templateIdTrim,
        uv: uvTrim,
        role: roleTrim,
        public: publicBool,
        languageId,
      },
    ],
    queryFn: async () =>
      (
        await fetchMailTemplates({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qTrim,
          templateId: templateIdTrim,
          userVisibility: uvTrim,
          role: roleTrim,
          public: publicBool,
          languageId,
        })
      ).data,
    staleTime: 15_000,
    refetchInterval: tierSlowRefetchMs,
  });

  const rows: MailTemplate[] = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(rows as any), [rows]);
  const hasMore = rows.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;

  const roleOptions: SelectOption[] = useMemo(() => {
    const roles: string[] = ['account', 'admin'];
    if (roleTrim) roles.push(roleTrim);
    for (const tpl of rows) {
      const s = String((tpl as any).registry_roles ?? '').trim();
      if (!s) continue;
      for (const r of s.split(',')) {
        const rr = r.trim();
        if (rr) roles.push(rr);
      }
    }

    const opts: SelectOption[] = [{ value: '', label: t('common.all') }];
    for (const r of uniqSorted(roles)) {
      opts.push({ value: r, label: r });
    }
    return opts;
  }, [roleTrim, rows, t]);

  const languageOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.all') }];
    const langs = languagesQ.data ?? [];
    for (const l of langs) {
      const id = Number((l as any).id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const label = String((l as any).label ?? (l as any).code ?? `#${id}`);
      opts.push({ value: String(id), label });
    }
    return opts;
  }, [languagesQ.data, t]);

  const visibilityOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'default', label: t('mailer.templates.visibility.default') },
      { value: 'visible', label: t('mailer.templates.visibility.visible') },
      { value: 'invisible', label: t('mailer.templates.visibility.invisible') },
    ],
    [t]
  );

  const publicOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: t('common.all') },
      { value: 'true', label: t('mailer.templates.filters.public_only') },
      { value: 'false', label: t('mailer.templates.filters.internal_only') },
    ],
    [t]
  );

  const filtersActive = Boolean(qTrim || templateIdTrim || uvTrim || roleTrim || publicBool !== undefined || languageId || smartErrors.length);
  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const knownRoles = useMemo(() => uniqSorted(['account', 'admin', roleTrim, ...rows.flatMap((tpl) => String((tpl as any).registry_roles ?? '').split(',').map((x) => x.trim()).filter(Boolean))].filter(Boolean) as string[]), [roleTrim, rows]);

  function clearFilters() {
    setQ('');
    setTemplateId('');
    setUserVisibility('');
    setRole('');
    setPublicFlag('');
    setLanguage('');
    setSmart('');
    setSmartErrors([]);
  }

  function resolveVisibility(value: string): string | null {
    const needle = value.trim().toLowerCase();
    if (!needle) return null;
    const options = ['default', 'visible', 'invisible'].filter((v) => v.startsWith(needle));
    return options.length === 1 ? (options[0] ?? null) : null;
  }

  function resolveRole(value: string): string | null {
    const needle = value.trim().toLowerCase();
    if (!needle) return null;
    const options = knownRoles.filter((v) => v.toLowerCase().startsWith(needle));
    return options.length === 1 ? (options[0] ?? null) : null;
  }

  function resolveLanguage(value: string): string | null {
    const needle = value.trim().toLowerCase();
    if (!needle) return null;
    const numeric = parsePositiveInt(needle);
    if (numeric) return String(numeric);
    const langs = languagesQ.data ?? [];
    const matches = langs.filter((l) => {
      const code = String((l as any).code ?? '').toLowerCase();
      const label = String((l as any).label ?? '').toLowerCase();
      return code === needle || label === needle || code.startsWith(needle) || label.startsWith(needle);
    });
    if (matches.length === 1) return String((matches[0] as any).id);
    return null;
  }

  function applySmartText(raw: string) {
    const needle = String(raw ?? '').trim();
    if (!needle) {
      setSmart('');
      setSmartErrors([]);
      return;
    }
    if (needle === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(needle);
    const nextErrors: string[] = [];
    const freeText: string[] = [];
    let nextQ = qTrim;
    let nextTemplateId = templateIdTrim;
    let nextVisibility = uvTrim;
    let nextRole = roleTrim;
    let nextPublic = publicFlag;
    let nextLanguage = language;

    if (tokens.length === 1) {
      const firstToken = tokens[0];
      const id = firstToken ? parseNumericToken(firstToken) : null;
      if (id !== null) {
        navigate(`${basePath}/mailer/templates/${id}`);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        freeText.push(unquoteSmartValue(token));
        continue;
      }
      const key = kv.rawKey.trim().toLowerCase();
      const value = unquoteSmartValue(kv.rawValue);
      if (!value) {
        nextErrors.push(t('mailer.templates.smart.error.empty_value', { key }));
        continue;
      }
      if (['q', 'search', 'name', 'label'].includes(key)) nextQ = value;
      else if (['template', 'template_id', 'tpl'].includes(key)) nextTemplateId = value;
      else if (['visibility', 'user_visibility', 'uv'].includes(key)) {
        const resolved = resolveVisibility(value);
        if (!resolved) nextErrors.push(t('mailer.templates.smart.error.visibility_unresolved', { value }));
        else nextVisibility = resolved;
      } else if (key === 'role') {
        const resolved = resolveRole(value);
        if (!resolved) nextErrors.push(t('mailer.templates.smart.error.role_unresolved', { value }));
        else nextRole = resolved;
      } else if (key === 'public') {
        const lower = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(lower)) nextPublic = 'true';
        else if (['0', 'false', 'no', 'off'].includes(lower)) nextPublic = 'false';
        else nextErrors.push(t('mailer.templates.smart.error.invalid_public', { value }));
      } else if (['language', 'lang'].includes(key)) {
        const resolved = resolveLanguage(value);
        if (!resolved) nextErrors.push(t('mailer.templates.smart.error.language_unresolved', { value }));
        else nextLanguage = resolved;
      } else if (key === 'id') {
        const id = parseNumericToken(value);
        if (id === null) nextErrors.push(t('mailer.templates.smart.error.id_numeric_only', { value }));
        else {
          navigate(`${basePath}/mailer/templates/${id}`);
          setSmart('');
          setSmartErrors([]);
          return;
        }
      } else {
        nextErrors.push(t('mailer.templates.smart.error.unknown_key', { key }));
      }
    }

    const free = freeText.join(' ').trim();
    if (free) nextQ = free;

    setQ(nextQ);
    setTemplateId(nextTemplateId);
    setUserVisibility(nextVisibility);
    setRole(nextRole);
    setPublicFlag(nextPublic);
    setLanguage(nextLanguage);
    setSmart('');
    setSmartErrors(nextErrors);
  }

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const suggestions: SmartFilterSuggestion[] = [];
    if (!smartNeedle) return suggestions;
    if (smartNeedle === '?') {
      suggestions.push({ id: 'help', primary: t('filters.help.open'), secondary: t('mailer.templates.smart.help.hint'), onPick: () => setHelpOpen(true), testId: 'admin.mailer.templates.smart_filter.suggest.help' });
      return suggestions;
    }
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      suggestions.push({ id: 'open', primary: t('mailer.templates.smart.suggest.open', { id: String(numeric) }), secondary: t('mailer.templates.smart.suggest.open.secondary'), onPick: () => navigate(`${basePath}/mailer/templates/${numeric}`), testId: 'admin.mailer.templates.smart_filter.suggest.open' });
      suggestions.push({ id: 'search', primary: t('mailer.templates.smart.suggest.search', { value: String(numeric) }), secondary: t('mailer.templates.smart.suggest.search.secondary'), onPick: () => applySmartText(String(numeric)), testId: 'admin.mailer.templates.smart_filter.suggest.search' });
      return suggestions;
    }
    const kv = splitKeyValueToken(smartNeedle);
    if (kv) {
      suggestions.push({ id: 'apply', primary: t('mailer.templates.smart.suggest.apply', { value: smartNeedle }), secondary: t('mailer.templates.smart.suggest.apply.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'admin.mailer.templates.smart_filter.suggest.apply' });
      return suggestions;
    }
    suggestions.push({ id: 'search', primary: t('mailer.templates.smart.suggest.search', { value: smartNeedle }), secondary: t('mailer.templates.smart.suggest.search.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'admin.mailer.templates.smart_filter.suggest.search' });
    return suggestions;
  }, [basePath, navigate, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    if (qTrim) chips.push(<FilterChip key='q' label={`q:${qTrim}`} onRemove={() => setQ('')} testId='admin.mailer.templates.chip.q' />);
    if (templateIdTrim) chips.push(<FilterChip key='template' label={`template:${templateIdTrim}`} onRemove={() => setTemplateId('')} testId='admin.mailer.templates.chip.template' />);
    if (uvTrim) chips.push(<FilterChip key='visibility' label={`visibility:${uvTrim}`} onRemove={() => setUserVisibility('')} testId='admin.mailer.templates.chip.visibility' />);
    if (roleTrim) chips.push(<FilterChip key='role' label={`role:${roleTrim}`} onRemove={() => setRole('')} testId='admin.mailer.templates.chip.role' />);
    if (publicBool !== undefined) chips.push(<FilterChip key='public' label={`public:${publicBool ? 'true' : 'false'}`} onRemove={() => setPublicFlag('')} testId='admin.mailer.templates.chip.public' />);
    if (languageId) chips.push(<FilterChip key='language' label={`language:${languageId}`} onRemove={() => setLanguage('')} testId='admin.mailer.templates.chip.language' />);
    smartErrors.forEach((e, idx) => chips.push(<FilterChip key={`err.${idx}`} label={e} tone='danger' onRemove={() => setSmartErrors([])} testId={`admin.mailer.templates.chip.error.${idx}`} />));
    return chips;
  }, [languageId, publicBool, qTrim, roleTrim, smartErrors, templateIdTrim, uvTrim]);

  return (
    <ListShell
      testId="admin.mailer.templates.page"
      header={
        <div className="space-y-3">
          <PageHeader
            title={t('mailer.templates.list.title')}
            description={t('mailer.templates.list.description')}
            meta={filtersActive ? <span className="text-xs text-faint">{t('list.meta.filters_active')}</span> : null}
            testId="admin.mailer.templates.header"
          />
          <MailerTabs />
        </div>
      }
      filters={
        <>
          <FilterBar testId="admin.mailer.templates.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('mailer.templates.filters.search.placeholder')}
                ariaLabel={t('mailer.templates.filters.search.placeholder')}
                testId="admin.mailer.templates.search.input"
                suggestions={smartSuggestions}
                onSubmit={() => applySmartText(smart)}
                suffix={
                  <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={() => setHelpOpen(true)} aria-label={t('filters.help.open')} title={t('filters.help.open')} testId="admin.mailer.templates.smart_filter.help_btn">
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />
              {activeFilterChips.length > 0 ? <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.mailer.templates.active_filters">{activeFilterChips}</div> : null}
            </div>

            <Button variant="secondary" size="sm" onClick={() => setAdvancedOpen(true)} aria-label={t('filters.advanced.open')} title={t('filters.advanced.open')} testId="admin.mailer.templates.advanced.open">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>
            <CopyButton size="sm" variant="secondary" label={t('common.copy_link')} text={typeof window !== 'undefined' ? window.location.href : ''} testId="admin.mailer.templates.copy_link" />
            {filtersActive ? <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.mailer.templates.filter.clear">{t('common.clear_filters')}</Button> : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => { setHelpOpen(false); if (smartNeedle === '?') setSmart(''); }}
            title={t('filters.help.title')}
            intro={t('mailer.templates.smart.help.intro')}
            examples={[
              { example: '?', description: t('mailer.templates.smart.help.examples.help') },
              { example: '123', description: t('mailer.templates.smart.help.examples.id') },
              { example: 'welcome', description: t('mailer.templates.smart.help.examples.search') },
              { example: 'template:invoice', description: t('mailer.templates.smart.help.examples.template') },
              { example: 'visibility:visible', description: t('mailer.templates.smart.help.examples.visibility') },
              { example: 'language:en', description: t('mailer.templates.smart.help.examples.language') },
            ]}
            topKeys={[
              { key: 'q', description: t('mailer.templates.smart.help.keys.q'), example: 'q:welcome' },
              { key: 'template', description: t('mailer.templates.smart.help.keys.template'), example: 'template:invoice' },
              { key: 'visibility', description: t('mailer.templates.smart.help.keys.visibility'), example: 'visibility:visible' },
              { key: 'role', description: t('mailer.templates.smart.help.keys.role'), example: 'role:account' },
              { key: 'public', description: t('mailer.templates.smart.help.keys.public'), example: 'public:true' },
              { key: 'language', description: t('mailer.templates.smart.help.keys.language'), example: 'language:en' },
              { key: 'id', description: t('mailer.templates.smart.help.keys.id'), example: 'id:1' },
            ]}
            inference={[
              t('mailer.templates.smart.help.inference.free_text'),
              t('mailer.templates.smart.help.inference.numeric'),
              t('mailer.templates.smart.help.inference.advanced'),
            ]}
            onInsertKey={(key) => { setSmart(`${key}:`); setHelpOpen(false); window.setTimeout(() => smartInputRef.current?.focus(), 50); }}
            actions={[{ label: t('filters.advanced.open'), onClick: () => { setHelpOpen(false); setAdvancedOpen(true); }, variant: 'secondary' }]}
            testId="admin.mailer.templates.smart_help"
            keyRowTestIdPrefix="admin.mailer.templates.smart_help.key"
          />

          <Drawer open={advancedOpen} onClose={() => setAdvancedOpen(false)} title={t('filters.advanced.title')} width="lg" testId="admin.mailer.templates.advanced" footer={<div className='flex items-center justify-end gap-2'>{filtersActive ? <Button variant='secondary' size='sm' onClick={clearFilters}>{t('common.clear_filters')}</Button> : null}<Button variant='primary' size='sm' onClick={() => setAdvancedOpen(false)}>{t('common.close')}</Button></div>}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">{t('common.search')}</div>
                <div className="mt-1"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mailer.templates.filters.search.placeholder')} autoComplete="off" testId="admin.mailer.templates.advanced.q" /></div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.templates.columns.template_id')}</div>
                <div className="mt-1"><Input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder={t('mailer.templates.filters.template_id.placeholder')} autoComplete="off" testId="admin.mailer.templates.template_id.input" /></div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.templates.columns.visibility')}</div>
                <div className="mt-1"><Select value={userVisibility} onChange={(e) => setUserVisibility(e.target.value)} options={visibilityOptions} testId="admin.mailer.templates.visibility.select" /></div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.templates.columns.roles')}</div>
                <div className="mt-1"><Select value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} testId="admin.mailer.templates.role.select" /></div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.templates.badge.public')}</div>
                <div className="mt-1"><Select value={publicFlag} onChange={(e) => setPublicFlag(e.target.value)} options={publicOptions} testId="admin.mailer.templates.public.select" /></div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('common.language')}</div>
                <div className="mt-1"><Select value={language} onChange={(e) => setLanguage(e.target.value)} options={languageOptions} testId="admin.mailer.templates.language.select" /></div>
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="admin.mailer.templates.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.mailer.templates.error"
          title={t('mailer.templates.list.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.templates.list' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="admin.mailer.templates.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('empty.list.empty.title')}
          body={filtersActive ? t('empty.list.no_matches.body') : t('empty.list.empty.body')}
        />
      ) : (
        <>
          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {rows.map((tpl) => {
              const id = Number((tpl as any).id);
              const label = String((tpl as any).label ?? (tpl as any).name ?? '').trim() || `#${id}`;
              const tplId = String((tpl as any).template_id ?? '').trim();
              const uv = String((tpl as any).user_visibility ?? '').trim();
              const roles = String((tpl as any).registry_roles ?? '').split(',').map((x) => x.trim()).filter(Boolean);
              const isPublic = Boolean((tpl as any).registry_public);
              const trCount = Number((tpl as any).translations_count ?? 0);
              const rcCount = Number((tpl as any).recipients_count ?? 0);

              return (
                <Card key={id} className="p-4" testId={`admin.mailer.templates.card.${id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link className="text-sm font-semibold text-accent hover:underline" to={`${basePath}/mailer/templates/${id}`}>
                        {label}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                        {tplId ? <span className="font-mono">{tplId}</span> : null}
                        <Badge variant={visibilityBadgeVariant(uv)}>{t(visibilityLabelKey(uv))}</Badge>
                        {isPublic ? <Badge variant="info">{t('mailer.templates.badge.public')}</Badge> : null}
                      </div>
                      {roles.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {roles.slice(0, 6).map((r) => (
                            <Badge key={r} variant="neutral">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted">
                      <div>
                        <span className="tabular-nums">{trCount}</span> {t('mailer.templates.count.translations')}
                      </div>
                      <div>
                        <span className="tabular-nums">{rcCount}</span> {t('mailer.templates.count.recipients')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-faint">{formatDateTime((tpl as any).updated_at)}</div>
                </Card>
              );
            })}

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
                  testId="admin.mailer.templates.pagination.mobile"
                />
              </Card>
            ) : null}
          </div>

          {/* Desktop */}
          <TableCard
            className="hidden md:block"
            minWidth="lg"
            tableTestId="admin.mailer.templates.table"
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
                  testId="admin.mailer.templates.pagination.desktop"
                />
              ) : null
            }
          >
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2">{t('mailer.templates.columns.template')}</th>
                <th className="px-4 py-2">{t('mailer.templates.columns.template_id')}</th>
                <th className="px-4 py-2">{t('mailer.templates.columns.visibility')}</th>
                <th className="px-4 py-2">{t('mailer.templates.columns.roles')}</th>
                <th className="px-4 py-2">{t('mailer.templates.columns.translations')}</th>
                <th className="px-4 py-2">{t('mailer.templates.columns.recipients')}</th>
                <th className="px-4 py-2">{t('common.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tpl) => {
                const id = Number((tpl as any).id);
                const name = String((tpl as any).name ?? '').trim();
                const label = String((tpl as any).label ?? '').trim();
                const tplId = String((tpl as any).template_id ?? '').trim();
                const uv = String((tpl as any).user_visibility ?? '').trim();
                const roles = String((tpl as any).registry_roles ?? '').split(',').map((x) => x.trim()).filter(Boolean);
                const isPublic = Boolean((tpl as any).registry_public);
                const trCount = Number((tpl as any).translations_count ?? 0);
                const rcCount = Number((tpl as any).recipients_count ?? 0);

                return (
                  <TableRowLink key={id} to={`${basePath}/mailer/templates/${id}`} testId={`admin.mailer.templates.row.${id}`}>
                    <td className="px-4 py-2 align-top text-sm">
                      <div className="font-medium">{label || name || `#${id}`}</div>
                      {label && name ? <div className="mt-0.5 text-xs text-muted">{name}</div> : null}
                      {isPublic ? <Badge variant="info" className="mt-1">{t('mailer.templates.badge.public')}</Badge> : null}
                    </td>
                    <td className="px-4 py-2 align-top text-sm font-mono">{tplId || <span className="text-muted">{t('common.na')}</span>}</td>
                    <td className="px-4 py-2 align-top text-sm">
                      <Badge variant={visibilityBadgeVariant(uv)}>{t(visibilityLabelKey(uv))}</Badge>
                    </td>
                    <td className="px-4 py-2 align-top text-sm">
                      <div className="flex flex-wrap gap-2">
                        {roles.length ? roles.slice(0, 8).map((r) => (
                          <Badge key={r} variant="neutral">
                            {r}
                          </Badge>
                        )) : <span className="text-muted">{t('common.na')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-sm tabular-nums">{trCount}</td>
                    <td className="px-4 py-2 align-top text-sm tabular-nums">{rcCount}</td>
                    <td className="px-4 py-2 align-top text-sm">{formatDateTime((tpl as any).updated_at)}</td>
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
