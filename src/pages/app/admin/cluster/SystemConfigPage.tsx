import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';
import { fetchSystemConfigs, updateSystemConfig, type SystemConfigItem } from '../../../../lib/api/systemConfig';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

import { FilterBar } from '../../../../components/layout/FilterBar';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { SecretField } from '../../../../components/ui/SecretField';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';
import { Textarea } from '../../../../components/ui/Textarea';

function norm(s: unknown): string {
  return typeof s === 'string' ? s : s == null ? '' : String(s);
}

function isSecretConfig(cfg: SystemConfigItem): boolean {
  const cat = norm(cfg.category).toLowerCase();
  const name = norm(cfg.name).toLowerCase();

  if (cat === 'node' && name.includes('private')) return true;
  if (cat === 'core' && name === 'transaction_key') return true;

  // Generic secret-ish names.
  if (name.includes('password')) return true;
  if (name.includes('secret')) return true;
  if (name.includes('private')) return true;

  return false;
}

function valuePreview(cfg: SystemConfigItem): string {
  if (isSecretConfig(cfg)) return '••••••••••••';

  const v = cfg.value;
  if (v === null || v === undefined) return '—';

  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '—';
    const firstLine = s.split('\n')[0] ?? '';
    const short = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
    if (s.includes('\n')) return `${short} …`;
    return short;
  }

  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  try {
    const json = JSON.stringify(v);
    if (!json) return '—';
    return json.length > 80 ? `${json.slice(0, 80)}…` : json;
  } catch {
    return String(v);
  }
}

type EditorState =
  | null
  | {
      cfg: SystemConfigItem;
      original: string;
      value: string;
      revealSecret: boolean;
    };

export function SystemConfigPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync local state on navigation.
  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlCat = searchParams.get('category') ?? '';
    if (urlQ !== q) setQ(urlQ);
    if (urlCat !== category) setCategory(urlCat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const catTrim = useMemo(() => category.trim(), [category]);
  const filtersActive = Boolean(qTrim || catTrim || smartErrors.length > 0);
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
    setCategory('');
  }

  // Persist filter state in URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (catTrim) next.set('category', catTrim);
    else next.delete('category');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [catTrim, qTrim, searchParams, setSearchParams]);

  const cfgQ = useQuery({
    queryKey: ['system_configs'],
    queryFn: async () => (await fetchSystemConfigs()).data,
    staleTime: 60_000,
  });

  const configs = cfgQ.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of configs) {
      const k = norm((c as any).category).trim();
      if (k) set.add(k);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [configs]);

  const categoryOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.all') }];
    for (const c of categories) opts.push({ value: c, label: c });
    return opts;
  }, [categories, t]);

  const filtered = useMemo(() => {
    const ql = qTrim.toLowerCase();
    const cat = catTrim;

    return configs.filter((cfg) => {
      if (cat && norm(cfg.category) !== cat) return false;

      if (!ql) return true;

      const hay = [cfg.category, cfg.name, cfg.label, cfg.description]
        .map((x) => norm(x).toLowerCase())
        .join(' ');

      return hay.includes(ql);
    });
  }, [catTrim, configs, qTrim]);

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
    let nextQ = qTrim;
    let nextCategory = catTrim;
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        const n = parseNumericToken(token);
        nextQ = n !== null ? String(n) : unquoteSmartValue(token);
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
        case 'name':
        case 'key':
        case 'description':
          nextQ = value;
          break;
        case 'category':
        case 'cat': {
          if (value === 'all') nextCategory = '';
          else {
            const match = categories.find((c) => c.toLowerCase() === value.toLowerCase() || c.toLowerCase().startsWith(value.toLowerCase()));
            if (!match) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
            else nextCategory = match;
          }
          break;
        }
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
      }
    }

    setSmartErrors(errors);
    if (errors.length > 0) return;
    setQ(nextQ);
    setCategory(nextCategory);
    setSmart('');
  }

  const smartSuggestions = useMemo<SmartFilterSuggestion[]>(() => {
    const needle = smart.trim();
    if (!needle) return [];
    if (needle === '?') {
      return [{ id: 'help', primary: t('admin.cluster.system_config.smart.help.title'), secondary: t('admin.cluster.system_config.smart.help.example_help'), onPick: () => { setHelpOpen(true); setSmart(''); } }];
    }
    const out: SmartFilterSuggestion[] = [
      { id: `search-${needle}`, primary: t('admin.cluster.system_config.smart.suggestion.search', { value: needle }), secondary: t('admin.cluster.system_config.smart.suggestion.search_hint'), onPick: () => applySmart(needle) },
    ];
    return out;
  }, [smart, t]);

  const [editor, setEditor] = useState<EditorState>(null);

  const updateM = useMutation({
    mutationFn: async (vars: { cfg: SystemConfigItem; value: unknown }) => {
      return updateSystemConfig({ category: vars.cfg.category, name: vars.cfg.name, value: vars.value });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['system_configs'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.system_config.toast.saved') });
      setEditor(null);
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  const openEditor = (cfg: SystemConfigItem) => {
    const v = cfg.value;
    const asString = typeof v === 'string' ? v : v == null ? '' : String(v);
    setEditor({ cfg, original: asString, value: asString, revealSecret: !isSecretConfig(cfg) });
  };

  const canSave = useMemo(() => {
    if (!editor) return false;
    return editor.value !== editor.original;
  }, [editor]);

  if (cfgQ.isLoading) {
    return <LoadingState testId="admin.cluster.system_config.loading" />;
  }

  if (cfgQ.isError) {
    return (
      <ErrorState
        title={t('admin.cluster.system_config.error.title')}
        message={t('admin.cluster.system_config.error.body')}
        onRetry={() => cfgQ.refetch()}
        testId="admin.cluster.system_config.error"
      />
    );
  }

  return (
    <div className="mt-4 space-y-4" data-testid="admin.cluster.system_config.page">
      <FilterBar testId="admin.cluster.system_config.filters">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SmartFilterInput
              ref={smartInputRef}
              testId="admin.cluster.system_config.search.input"
              value={smart}
              onChange={setSmart}
              onSubmit={() => applySmart()}
              suggestions={smartSuggestions}
              placeholder={t('admin.cluster.system_config.filter.search_placeholder')}
              ariaLabel={t('admin.cluster.system_config.filter.search_placeholder')}
              className="min-w-0 flex-1"
              suffix={<Button variant="ghost" size="sm" aria-label={t('filters.help.open')} className="px-2" onClick={() => setHelpOpen(true)} testId="admin.cluster.system_config.smart.help_button"><CircleHelp className="h-4 w-4" /></Button>}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setAdvancedOpen(true)} testId="admin.cluster.system_config.advanced.open"><SlidersHorizontal className="mr-2 h-4 w-4" />{t('common.advanced')}</Button>
              <CopyButton text={shareUrl} label={t('common.copy_link')} testId="admin.cluster.system_config.copy_link" />
              <Button variant="secondary" onClick={() => cfgQ.refetch()}>{t('common.refresh')}</Button>
              {filtersActive ? <Button variant="secondary" onClick={clearAllFilters} testId="admin.cluster.system_config.filter.clear">{t('common.clear_filters')}</Button> : null}
            </div>
          </div>
          {filtersActive ? (
            <div className="flex flex-wrap gap-2">
              {qTrim ? <FilterChip label={`q: ${qTrim}`} onRemove={() => setQ('')} /> : null}
              {catTrim ? <FilterChip label={`${t('admin.cluster.system_config.col.category')}: ${catTrim}`} onRemove={() => setCategory('')} /> : null}
              {smartErrors.map((err, idx) => <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, i) => i !== idx))} />)}
            </div>
          ) : null}
        </div>
      </FilterBar>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('admin.cluster.system_config.smart.help.title')}
        intro={t('admin.cluster.system_config.smart.help.intro')}
        examples={[
          { example: '?', description: t('admin.cluster.system_config.smart.help.example_help') },
          { example: 'api', description: t('admin.cluster.system_config.smart.help.example_search') },
          { example: 'category:core', description: t('admin.cluster.system_config.smart.help.example_category') },
        ]}
        topKeys={[
          { key: 'q', description: t('admin.cluster.system_config.smart.key.q'), example: 'q:transaction' },
          { key: 'category', description: t('admin.cluster.system_config.smart.key.category'), example: 'category:core' },
        ]}
        inference={[
          t('admin.cluster.system_config.smart.help.inference.text'),
          t('admin.cluster.system_config.smart.help.inference.keyvalue'),
        ]}
        onInsertKey={insertSmartKey}
      />

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title={t('common.advanced_filters')}
        width="lg"
        testId="admin.cluster.system_config.advanced"
        footer={<div className="flex items-center justify-between gap-2"><Button variant="secondary" onClick={clearAllFilters}>{t('common.clear_filters')}</Button><Button variant="primary" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button></div>}
      >
        <div className="space-y-4">
          <Input testId="admin.cluster.system_config.search.advanced" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.cluster.system_config.filter.search_placeholder')} />
          <Select testId="admin.cluster.system_config.category.select" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} className="w-full" />
        </div>
      </Drawer>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('admin.cluster.system_config.empty.title')}
          message={t('admin.cluster.system_config.empty.body')}
          testId="admin.cluster.system_config.empty"
        />
      ) : (
        <TableCard testId="admin.cluster.system_config.table" minWidth="lg">
          <thead>
            <tr>
              {!catTrim ? <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.category')}</th> : null}
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.name')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.label')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.value')}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.type')}</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((cfg) => {
              const rowId = `${norm(cfg.category)}.${norm(cfg.name)}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
              return (
                <tr key={rowId} data-testid={`admin.cluster.system_config.row.${rowId}`}>
                  {!catTrim ? <td className="whitespace-nowrap px-3 py-2 text-muted">{norm(cfg.category) || '—'}</td> : null}

                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-fg">{norm(cfg.name) || '—'}</td>

                  <td className="px-3 py-2 text-fg">{norm(cfg.label) || '—'}</td>

                  <td className="px-3 py-2 font-mono text-xs text-muted">{valuePreview(cfg)}</td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant="neutral">{norm((cfg as any).type) || '—'}</Badge>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditor(cfg)}
                      testId={`admin.cluster.system_config.row.${rowId}.edit`}
                    >
                      {t('common.edit')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Modal
        open={Boolean(editor)}
        size="lg"
        title={editor ? t('admin.cluster.system_config.edit.title') : ''}
        onClose={() => (updateM.isPending ? null : setEditor(null))}
        testId="admin.cluster.system_config.edit"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={updateM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={updateM.isPending}
              disabled={!editor || !canSave}
              onClick={() => {
                if (!editor) return;
                const tp = norm((editor.cfg as any).type);
                const raw = editor.value;

                // Most sysconfig values are stored as String/Text/YAML. For numeric types, try to coerce.
                let value: unknown = raw;
                if (tp === 'Integer' || tp === 'Fixnum') {
                  const n = Number(raw);
                  if (!Number.isFinite(n) || !Number.isInteger(n)) {
                    pushToast({ variant: 'danger', title: t('common.error'), body: t('admin.cluster.system_config.edit.invalid_integer') });
                    return;
                  }
                  value = n;
                } else if (tp === 'Float') {
                  const n = Number(raw);
                  if (!Number.isFinite(n)) {
                    pushToast({ variant: 'danger', title: t('common.error'), body: t('admin.cluster.system_config.edit.invalid_float') });
                    return;
                  }
                  value = n;
                }

                updateM.mutate({ cfg: editor.cfg, value });
              }}
              testId="admin.cluster.system_config.edit.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {editor ? (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={`${editor.cfg.category}.${editor.cfg.name}`}
                subtitle={norm(editor.cfg.label) || undefined}
              />
              <CardBody>
                {editor.cfg.description ? <p className="text-sm text-muted">{norm(editor.cfg.description)}</p> : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="neutral">{t('common.type')}: {norm((editor.cfg as any).type) || '—'}</Badge>
                  {typeof editor.cfg.min_user_level === 'number' ? (
                    <Badge variant="neutral">{t('admin.cluster.system_config.badge.min_level', { level: editor.cfg.min_user_level })}</Badge>
                  ) : null}
                </div>
              </CardBody>
            </Card>

            {isSecretConfig(editor.cfg) ? (
              <Card>
                <CardHeader title={t('admin.cluster.system_config.edit.secret.title')} subtitle={t('admin.cluster.system_config.edit.secret.subtitle')} />
                <CardBody>
                  {!editor.revealSecret ? (
                    <div className="space-y-3">
                      <SecretField value={editor.value} multiline rows={4} testId="admin.cluster.system_config.edit.secret" />
                      <Button
                        variant="secondary"
                        onClick={() => setEditor((prev) => (prev ? { ...prev, revealSecret: true } : prev))}
                        testId="admin.cluster.system_config.edit.secret.reveal"
                      >
                        {t('admin.cluster.system_config.edit.secret.edit_button')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        testId="admin.cluster.system_config.edit.value"
                        value={editor.value}
                        onChange={(e) => setEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                        rows={6}
                        className="font-mono text-xs tabular-nums"
                      />

                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-faint">{t('admin.cluster.system_config.edit.secret.hint')}</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditor((prev) => (prev ? { ...prev, value: prev.original } : prev))}
                            disabled={!canSave}
                            testId="admin.cluster.system_config.edit.reset"
                          >
                            {t('common.reset')}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditor((prev) => (prev ? { ...prev, revealSecret: false } : prev))}
                            testId="admin.cluster.system_config.edit.secret.hide"
                          >
                            {t('common.hide')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader title={t('admin.cluster.system_config.edit.value.title')} subtitle={t('admin.cluster.system_config.edit.value.subtitle')} />
                <CardBody>
                  {norm((editor.cfg as any).type) === 'Text' || norm((editor.cfg as any).type) === 'Array' || norm((editor.cfg as any).type) === 'Hash' ? (
                    <Textarea
                      testId="admin.cluster.system_config.edit.value"
                      value={editor.value}
                      onChange={(e) => setEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                      rows={8}
                      className="font-mono text-xs tabular-nums"
                    />
                  ) : (
                    <Input
                      testId="admin.cluster.system_config.edit.value"
                      value={editor.value}
                      onChange={(e) => setEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                      className="font-mono text-xs tabular-nums"
                    />
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-faint">{t('admin.cluster.system_config.edit.value.hint')}</div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditor((prev) => (prev ? { ...prev, value: prev.original } : prev))}
                      disabled={!canSave}
                      testId="admin.cluster.system_config.edit.reset"
                    >
                      {t('common.reset')}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {updateM.isError ? (
              <Alert variant="danger" title={t('common.action_failed')}>
                {formatErrorMessage(updateM.error)}
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
