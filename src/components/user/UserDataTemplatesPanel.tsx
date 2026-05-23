import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';

import {
  createVpsUserData,
  deleteVpsUserData,
  deployVpsUserData,
  fetchVpsUserDataList,
  updateVpsUserData,
  type VpsUserData,
  type VpsUserDataFormat,
} from '../../lib/api/vpsUserData';

import { getMetaActionStateId } from '../../lib/api/haveapi';
import { objectRef } from '../../lib/objectRef';

import { formatErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';

import { useChrome } from '../layout/ChromeContext';
import { FilterBar } from '../layout/FilterBar';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CopyButton } from '../ui/CopyButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FilterChip } from '../ui/FilterChip';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Select, type SelectOption } from '../ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../ui/SmartFilterInput';
import { SmartInputHelp } from '../ui/SmartInputHelp';
import { StatusDot } from '../ui/StatusDot';
import { TableCard } from '../ui/TableCard';
import { Textarea } from '../ui/Textarea';
import { VpsLookupInput } from '../ui/VpsLookupInput';

function isKnownFormat(f: string): f is VpsUserDataFormat {
  return (
    f === 'script' ||
    f === 'cloudinit_config' ||
    f === 'cloudinit_script' ||
    f === 'nixos_configuration' ||
    f === 'nixos_flake_configuration' ||
    f === 'nixos_flake_uri'
  );
}

function formatLabelKey(format: string): string {
  if (!isKnownFormat(format)) return 'user_data.format.unknown';
  return `user_data.format.${format}`;
}

function formatHintKey(format: string): string | null {
  if (!isKnownFormat(format)) return null;
  if (format === 'script') return 'user_data.hint.script';
  if (format === 'cloudinit_config') return 'user_data.hint.cloudinit_config';
  if (format === 'cloudinit_script') return 'user_data.hint.cloudinit_script';
  if (format === 'nixos_configuration') return 'user_data.hint.nixos_configuration';
  if (format === 'nixos_flake_configuration') return 'user_data.hint.nixos_flake_configuration';
  if (format === 'nixos_flake_uri') return 'user_data.hint.nixos_flake_uri';
  return null;
}

function isShebangScript(content: string): boolean {
  const firstLine = content.split(/\r?\n/)[0] ?? '';
  return firstLine.trim().startsWith('#!');
}

function looksLikeNixAttrSet(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  return t.startsWith('{') && t.endsWith('}');
}

function looksLikeFlakeUri(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  return !/\s/.test(t);
}

function safeId(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; item: VpsUserData }
  | { mode: 'deploy'; item: VpsUserData }
  | null;

type FormState = {
  label: string;
  format: string;
  content: string;
};

function initForm(item?: VpsUserData): FormState {
  return {
    label: item ? safeString(item.label) : '',
    format: item ? safeString(item.format) : 'cloudinit_config',
    content: item ? safeString(item.content) : '',
  };
}

const MAX_CONTENT_LEN = 65_536;

export function UserDataTemplatesPanel(props: {
  /** When provided and the viewer is admin, the list is scoped to this user. */
  userIdForAdmin?: number;

  /** When provided and the viewer is admin, creates templates for this user. */
  createForUserId?: number;

  testIdPrefix: string;
}) {
  const auth = useAuth();
  const isAdmin = auth.role === 'admin';
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  const qRaw = searchParams.get('q') ?? '';
  const qTrim = qRaw.trim();

  const formatRaw = searchParams.get('format') ?? '';
  const formatFilter = formatRaw.trim();

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const filtersActive = Boolean(qTrim) || Boolean(formatFilter) || smartErrors.length > 0;
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

  function setFilters(nextVals: { q?: string; format?: string }) {
    const next = new URLSearchParams(searchParams);
    if (nextVals.q && nextVals.q.trim()) next.set('q', nextVals.q.trim());
    else next.delete('q');
    if (nextVals.format && nextVals.format.trim()) next.set('format', nextVals.format.trim());
    else next.delete('format');
    next.delete('from');
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setFilters({ q: '', format: '' });
    setSmart('');
    setSmartErrors([]);
  }

  function resolveFormat(value: string): string | null {
    const v = value.trim().toLowerCase();
    if (!v) return '';
    const known = [
      'script',
      'cloudinit_config',
      'cloudinit_script',
      'nixos_configuration',
      'nixos_flake_configuration',
      'nixos_flake_uri',
    ];
    const exact = known.find((it) => it === v);
    if (exact) return exact;
    const matches = known.filter((it) => it.startsWith(v));
    return matches.length === 1 ? (matches[0] ?? null) : null;
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
    let nextFormat = formatFilter;
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
          nextQ = value;
          break;
        case 'id': {
          const n = parseNumericToken(value);
          if (n === null) errors.push(t('filters.smart.error.numeric_only', { key, value }));
          else nextQ = String(n);
          break;
        }
        case 'format':
        case 'f': {
          const match = resolveFormat(value);
          if (match === null) errors.push(t('filters.smart.error.option_unresolved', { key, value }));
          else nextFormat = match;
          break;
        }
        default:
          errors.push(t('filters.smart.error.unknown_key', { key }));
      }
    }

    setSmartErrors(errors);
    if (errors.length > 0) return;
    setFilters({ q: nextQ, format: nextFormat });
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
        id: `id-${n}`,
        primary: t('user_data.smart.suggestion.search_id', { id: n }),
        secondary: t('user_data.smart.suggestion.search_hint'),
        onPick: () => applySmart(String(n)),
      }];
    }
    return [{
      id: 'search',
      primary: t('user_data.smart.suggestion.search', { value: needle }),
      secondary: t('user_data.smart.suggestion.search_hint'),
      onPick: () => applySmart(needle),
    }];
  }, [smart, t]);

  // Keep URL clean (trim/normalize).
  React.useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (qTrim) next.set('q', qTrim);
    else next.delete('q');

    if (formatFilter) next.set('format', formatFilter);
    else next.delete('format');

    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [formatFilter, qTrim, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: props.testIdPrefix,
    filterKey: JSON.stringify({ q: qTrim, f: formatFilter, u: props.userIdForAdmin ?? null }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const listQ = useQuery({
    queryKey: [
      'vps_user_data',
      'list',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        q: qTrim,
        format: formatFilter,
        user: isAdmin ? props.userIdForAdmin ?? null : null,
      },
    ],
    queryFn: async () =>
      (
        await fetchVpsUserDataList({
          limit: pagination.limit,
          fromId: pagination.fromId,
          q: qTrim || undefined,
          format: formatFilter || undefined,
          user: isAdmin ? props.userIdForAdmin : undefined,
        })
      ).data,
    staleTime: 10_000,
  });

  const rows = listQ.data ?? [];

  const canNext = rows.length >= pagination.limit;
  const cursor = useMemo(() => cursorFromDescendingPage(rows as any), [rows]);

  const formatOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: t('common.all') },
      { value: 'script', label: t('user_data.format.script') },
      { value: 'cloudinit_config', label: t('user_data.format.cloudinit_config') },
      { value: 'cloudinit_script', label: t('user_data.format.cloudinit_script') },
      { value: 'nixos_configuration', label: t('user_data.format.nixos_configuration') },
      { value: 'nixos_flake_configuration', label: t('user_data.format.nixos_flake_configuration') },
      { value: 'nixos_flake_uri', label: t('user_data.format.nixos_flake_uri') },
    ];
  }, [t]);

  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<FormState>(() => initForm());

  const openCreate = () => {
    setForm(initForm());
    setEditor({ mode: 'create' });
  };

  const openEdit = (item: VpsUserData) => {
    setForm(initForm(item));
    setEditor({ mode: 'edit', item });
  };

  const closeEditor = () => setEditor(null);

  const contentLen = form.content.length;
  const contentOverLimit = contentLen > MAX_CONTENT_LEN;

  const labelOk = form.label.trim().length > 0 && form.label.trim().length <= 255;
  const contentOk = form.content.trim().length > 0 && !contentOverLimit;

  const formatOk = Boolean(form.format.trim());

  const canSave = labelOk && formatOk && contentOk;

  const validationHints = useMemo(() => {
    const fmt = form.format;
    const out: { ok: boolean; label: string }[] = [];

    out.push({
      ok: form.label.trim().length > 0,
      label: t('user_data.validation.label_required'),
    });

    out.push({
      ok: contentLen > 0,
      label: t('user_data.validation.content_required'),
    });

    out.push({
      ok: !contentOverLimit,
      label: t('user_data.validation.content_max', { max: MAX_CONTENT_LEN }),
    });

    if (fmt === 'script' || fmt === 'cloudinit_script') {
      out.push({
        ok: isShebangScript(form.content),
        label: t('user_data.validation.shebang'),
      });
    }

    if (fmt === 'nixos_configuration' || fmt === 'nixos_flake_configuration') {
      out.push({
        ok: looksLikeNixAttrSet(form.content),
        label: t('user_data.validation.nix_attrset'),
      });
    }

    if (fmt === 'nixos_flake_uri') {
      out.push({
        ok: looksLikeFlakeUri(form.content),
        label: t('user_data.validation.flake_uri'),
      });
    }

    return out;
  }, [contentLen, contentOverLimit, form.content, form.format, form.label, t]);

  const createM = useMutation({
    mutationFn: async () => {
      const payload: any = {
        label: form.label.trim(),
        format: form.format.trim(),
        content: form.content,
      };

      if (isAdmin && props.createForUserId) payload.user = props.createForUserId;

      return await createVpsUserData(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vps_user_data'] });
      closeEditor();
      toasts.pushToast({ variant: 'ok', title: t('user_data.toast.created') });
    },
    onError: (e) =>
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e), autoDismissMs: false }),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editor || editor.mode !== 'edit') throw new Error('Missing template');
      const id = safeId(editor.item.id);
      if (!id) throw new Error('Missing template');

      return await updateVpsUserData(id, {
        label: form.label.trim(),
        format: form.format.trim(),
        content: form.content,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vps_user_data'] });
      closeEditor();
      toasts.pushToast({ variant: 'ok', title: t('user_data.toast.saved') });
    },
    onError: (e) =>
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e), autoDismissMs: false }),
  });

  const [deleteTarget, setDeleteTarget] = useState<VpsUserData | null>(null);

  const deleteM = useMutation({
    mutationFn: async (id: number) => deleteVpsUserData(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['vps_user_data'] });
      setDeleteTarget(null);
      toasts.pushToast({ variant: 'ok', title: t('user_data.toast.deleted') });
    },
    onError: (e) =>
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e), autoDismissMs: false }),
  });

  // -----------------
  // Deploy
  // -----------------

  const [deployVpsId, setDeployVpsId] = useState<number | null>(null);

  const openDeploy = (item: VpsUserData) => {
    setDeployVpsId(null);
    setEditor({ mode: 'deploy', item });
  };

  const deployM = useMutation({
    mutationFn: async () => {
      if (!editor || editor.mode !== 'deploy') throw new Error('Missing template');
      const tplId = safeId(editor.item.id);
      if (!tplId) throw new Error('Missing template');
      if (!deployVpsId) throw new Error(t('user_data.deploy.validation.vps_required'));

      return await deployVpsUserData(tplId, deployVpsId);
    },
    onMutate: () => {
      if (!deployVpsId) return {};
      const ref = objectRef('Vps', deployVpsId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as any)?.lockRef) chrome.releaseLocalLock((ctx as any).lockRef);
    },
    onSuccess: (res) => {
      const asId = getMetaActionStateId(res.meta);
      if (asId) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'user_data.deploy.action',
          objectLabel: deployVpsId ? `#${deployVpsId}` : undefined,
          object: deployVpsId ? objectRef('Vps', deployVpsId) : undefined,
          blockUi: true,
          progressTitleKey: 'modal.progress.deploy_user_data.title',
        });
      }

      closeEditor();
      toasts.pushToast({
        variant: 'ok',
        title: t('user_data.deploy.toast.started'),
        action: {
          label: t('common.open_tasks'),
          onClick: () => chrome.openTasks(),
        },
      });
    },
    onError: (e) =>
      toasts.pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e), autoDismissMs: false }),
  });

  const busy = createM.isPending || updateM.isPending || deleteM.isPending || deployM.isPending;

  const hintKey = formatHintKey(form.format);

  const prefix = props.testIdPrefix;

  return (
    <>
      <div className="space-y-4" data-testid={`${prefix}.panel`}>
        <FilterBar testId={`${prefix}.filters`}>
          <div className="min-w-0 flex-1">
            <SmartFilterInput
              ref={smartInputRef}
              testId={`${prefix}.filters.q`}
              ariaLabel={t('user_data.filters.search.placeholder')}
              value={smart}
              onChange={setSmart}
              onSubmit={() => applySmart()}
              suggestions={smartSuggestions}
              placeholder={t('user_data.smart.placeholder')}
              suffix={
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
                  onClick={() => setHelpOpen(true)}
                  aria-label={t('filters.help.open')}
                  title={t('filters.help.open')}
                  data-testid={`${prefix}.smart.help_button`}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdvancedOpen(true)} testId={`${prefix}.filters.advanced`}>
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              {t('filters.advanced.label')}
            </Button>
            <CopyButton text={shareUrl} label={t('common.copy_link')} testId={`${prefix}.filters.copy_link`} />
            {filtersActive ? (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters} testId={`${prefix}.filters.clear`}>
                {t('common.clear_filters')}
              </Button>
            ) : null}
            <Button variant="primary" onClick={openCreate} testId={`${prefix}.create`}>
              {t('user_data.action.create')}
            </Button>
          </div>
        </FilterBar>

        {filtersActive ? (
          <div className="flex flex-wrap gap-2" data-testid={`${prefix}.filters.chips`}>
            {qTrim ? <FilterChip label={qTrim.startsWith('#') || /^\d+$/.test(qTrim) ? `#${qTrim.replace(/^#/, '')}` : qTrim} onRemove={() => setFilters({ q: '', format: formatFilter })} /> : null}
            {formatFilter ? <FilterChip label={`${t('user_data.filters.format')}: ${t(formatLabelKey(formatFilter) as any)}`} onRemove={() => setFilters({ q: qTrim, format: '' })} /> : null}
            {smartErrors.map((err, idx) => <FilterChip key={`${err}-${idx}`} label={err} tone="danger" onRemove={() => setSmartErrors((cur) => cur.filter((_, i) => i !== idx))} />)}
          </div>
        ) : null}

        <Drawer
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          title={t('filters.advanced.title')}
          width="lg"
          testId={`${prefix}.filters.advanced.drawer`}
        >
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted">{t('common.search')}</div>
              <div className="mt-1">
                <Input
                  value={qRaw}
                  onChange={(e) => setFilters({ q: e.target.value, format: formatFilter })}
                  placeholder={t('user_data.filters.search.placeholder')}
                  autoComplete="off"
                  testId={`${prefix}.filters.q.advanced`}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('user_data.filters.format')}</div>
              <div className="mt-1">
                <Select
                  value={formatFilter}
                  onChange={(e) => setFilters({ q: qTrim, format: e.target.value })}
                  options={formatOptions}
                  testId={`${prefix}.filters.format`}
                />
              </div>
            </div>

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
          intro={t('user_data.smart.help.intro')}
          examples={[
            { example: '?', description: t('user_data.smart.help.examples.help') },
            { example: 'nginx', description: t('user_data.smart.help.examples.search') },
            { example: '123', description: t('user_data.smart.help.examples.id') },
            { example: 'format:script', description: t('user_data.smart.help.examples.format') },
          ]}
          topKeys={[
            { key: 'q', description: t('user_data.smart.help.keys.q'), example: 'q:nginx' },
            { key: 'id', description: t('user_data.smart.help.keys.id'), example: 'id:123' },
            { key: 'format', description: t('user_data.smart.help.keys.format'), example: 'format:script' },
          ]}
          inference={[
            t('user_data.smart.help.inference.enter_applies'),
            t('user_data.smart.help.inference.number_searches'),
            t('user_data.smart.help.inference.key_value'),
          ]}
          onInsertKey={insertSmartKey}
          testId={`${prefix}.smart.help`}
        />
        {listQ.isLoading ? (
          <div className="rounded-md border border-border bg-surface-2 p-4 text-sm text-muted" data-testid={`${prefix}.loading`}>
            {t('common.loading')}
          </div>
        ) : listQ.isError ? (
          <Alert variant="danger" title={t('user_data.error.load_failed')}>
            {formatErrorMessage(listQ.error)}
          </Alert>
        ) : rows.length === 0 ? (
          <div
            className="rounded-md border border-border bg-surface-2 p-6 text-center"
            data-testid={`${prefix}.empty`}
          >
            <div className="text-sm font-semibold text-fg">
              {filtersActive ? t('empty.list.no_matches.title') : t('empty.list.empty.title')}
            </div>
            <div className="mt-1 text-sm text-muted">
              {filtersActive ? t('empty.list.no_matches.body') : t('user_data.empty.body')}
            </div>
            {!filtersActive ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={openCreate}>
                  {t('user_data.action.create')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <TableCard
            testId={`${prefix}.table`}
            minWidth="md"
            footer={
              <KeysetPagination
                testId={`${prefix}.pagination`}
                limit={pagination.limit}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={() => pagination.goPrev()}
                onNext={() => pagination.goNext(cursor)}
                onLimitChange={(n) => pagination.setLimit(n)}
              />
            }
          >
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('user_data.fields.label')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('user_data.fields.format')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('user_data.fields.updated')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const id = safeId(item.id);
                const label = safeString(item.label) || `#${id}`;
                const fmt = safeString(item.format);
                const updatedAt = (item as any).updated_at ?? (item as any).created_at;

                return (
                  <tr key={id} data-testid={`${prefix}.row.${id}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">{label}</span>
                        <span className="text-xs text-faint">#{id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusDot variant="neutral" />
                        <Badge variant="neutral">{t(formatLabelKey(fmt) as any)}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {updatedAt ? <span className="text-xs text-muted">{formatDateTime(String(updatedAt))}</span> : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2" data-row-no-nav>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openDeploy(item)}
                          testId={`${prefix}.row.${id}.deploy`}
                        >
                          {t('user_data.action.deploy')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(item)}
                          testId={`${prefix}.row.${id}.edit`}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(item)}
                          testId={`${prefix}.row.${id}.delete`}
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
      </div>

      {/* Create / Edit */}
      <Drawer
        open={Boolean(editor && (editor.mode === 'create' || editor.mode === 'edit'))}
        onClose={closeEditor}
        title={
          editor?.mode === 'edit'
            ? t('user_data.editor.edit.title')
            : t('user_data.editor.create.title')
        }
        width="lg"
        testId={`${prefix}.editor.drawer`}
      >
        <div className="space-y-4">
          {hintKey ? <Alert variant="info" title={t('user_data.hint.title')}>{t(hintKey as any)}</Alert> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('user_data.fields.label')}</div>
              <div className="mt-1">
                <Input
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder={t('user_data.placeholders.label')}
                  autoComplete="off"
                  testId={`${prefix}.editor.label`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('user_data.help.label')}</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('user_data.fields.format')}</div>
              <div className="mt-1">
                <Select
                  value={form.format}
                  onChange={(e) => setForm((p) => ({ ...p, format: e.target.value }))}
                  options={formatOptions.slice(1)}
                  testId={`${prefix}.editor.format`}
                />
              </div>
              <div className="mt-1 text-xs text-faint">{t('user_data.help.format')}</div>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div className="text-xs font-semibold text-muted">{t('user_data.fields.content')}</div>
              <div className={"text-xs " + (contentOverLimit ? 'text-danger' : 'text-faint')}>
                {t('user_data.help.content_len', { n: contentLen, max: MAX_CONTENT_LEN })}
              </div>
            </div>
            <div className="mt-1">
              <Textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder={t('user_data.placeholders.content')}
                testId={`${prefix}.editor.content`}
                className="min-h-56 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted">{t('user_data.validation.title')}</div>
            <div className="mt-2 space-y-1">
              {validationHints.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <StatusDot variant={h.ok ? 'ok' : 'warn'} />
                  <span className={h.ok ? 'text-fg' : 'text-muted'}>{h.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeEditor} disabled={busy}>
              {t('common.cancel')}
            </Button>

            {editor?.mode === 'edit' ? (
              <Button
                variant="primary"
                onClick={() => updateM.mutate()}
                loading={updateM.isPending}
                disabled={!canSave}
                testId={`${prefix}.editor.save`}
              >
                {t('common.save')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => createM.mutate()}
                loading={createM.isPending}
                disabled={!canSave}
                testId={`${prefix}.editor.create`}
              >
                {t('common.create')}
              </Button>
            )}
          </div>
        </div>
      </Drawer>

      {/* Deploy */}
      <Drawer
        open={Boolean(editor && editor.mode === 'deploy')}
        onClose={closeEditor}
        title={t('user_data.deploy.title')}
        width="md"
        testId={`${prefix}.deploy.drawer`}
      >
        <div className="space-y-4">
          {editor?.mode === 'deploy' ? (
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <div className="text-xs font-semibold text-muted">{t('user_data.deploy.fields.template')}</div>
              <div className="mt-1 font-medium text-fg">{safeString(editor.item.label) || `#${safeId(editor.item.id)}`}</div>
              <div className="mt-1 text-xs text-faint">
                #{safeId(editor.item.id)} · {t(formatLabelKey(safeString(editor.item.format)) as any)}
              </div>
            </div>
          ) : null}

          <Alert variant="info" title={t('user_data.deploy.hint.title')}>
            {t('user_data.deploy.hint.body')}
          </Alert>

          <div>
            <div className="text-xs font-semibold text-muted">{t('user_data.deploy.fields.vps')}</div>
            <div className="mt-1">
              <VpsLookupInput
                value={deployVpsId}
                onChange={(id) => setDeployVpsId(id)}
                userId={isAdmin ? props.userIdForAdmin : undefined}
                placeholder={t('user_data.deploy.placeholders.vps')}
                ariaLabel={t('user_data.deploy.fields.vps')}
                testId={`${prefix}.deploy.vps`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('user_data.deploy.help.vps')}</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeEditor} disabled={deployM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => deployM.mutate()}
              loading={deployM.isPending}
              disabled={!deployVpsId}
              testId={`${prefix}.deploy.submit`}
            >
              {t('user_data.action.deploy')}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('user_data.delete.title')}
        description={t('user_data.delete.body')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        confirmLoading={deleteM.isPending}
        onConfirm={() => {
          const id = safeId(deleteTarget?.id);
          if (id) deleteM.mutate(id);
        }}
        onCancel={() => setDeleteTarget(null)}
        testId={`${prefix}.delete.confirm`}
      />
    </>
  );
}
