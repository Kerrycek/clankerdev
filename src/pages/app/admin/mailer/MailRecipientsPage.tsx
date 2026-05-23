import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';

import {
  createMailRecipient,
  deleteMailRecipient,
  fetchMailRecipients,
  updateMailRecipient,
  type MailRecipient,
} from '../../../../lib/api/mailer';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';

import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { FilterBar } from '../../../../components/layout/FilterBar';

import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { Drawer } from '../../../../components/ui/Drawer';
import { FilterChip } from '../../../../components/ui/FilterChip';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../../components/ui/SmartInputHelp';
import { TableCard } from '../../../../components/ui/TableCard';

import { MailerTabs } from './MailerTabs';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../../lib/smartFilter';

export function MailRecipientsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [labelFilter, setLabelFilter] = useState(() => searchParams.get('label') ?? '');
  const [toFilter, setToFilter] = useState(() => searchParams.get('to') ?? '');
  const [ccFilter, setCcFilter] = useState(() => searchParams.get('cc') ?? '');
  const [bccFilter, setBccFilter] = useState(() => searchParams.get('bcc') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlLabel = searchParams.get('label') ?? '';
    const urlTo = searchParams.get('to') ?? '';
    const urlCc = searchParams.get('cc') ?? '';
    const urlBcc = searchParams.get('bcc') ?? '';
    if (urlQ !== q) setQ(urlQ);
    if (urlLabel !== labelFilter) setLabelFilter(urlLabel);
    if (urlTo !== toFilter) setToFilter(urlTo);
    if (urlCc !== ccFilter) setCcFilter(urlCc);
    if (urlBcc !== bccFilter) setBccFilter(urlBcc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const qTrim = useMemo(() => q.trim(), [q]);
  const labelTrim = useMemo(() => labelFilter.trim(), [labelFilter]);
  const toTrim = useMemo(() => toFilter.trim(), [toFilter]);
  const ccTrim = useMemo(() => ccFilter.trim(), [ccFilter]);
  const bccTrim = useMemo(() => bccFilter.trim(), [bccFilter]);
  const smartNeedle = useMemo(() => smart.trim(), [smart]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (qTrim) next.set('q', qTrim); else next.delete('q');
    if (labelTrim) next.set('label', labelTrim); else next.delete('label');
    if (toTrim) next.set('to', toTrim); else next.delete('to');
    if (ccTrim) next.set('cc', ccTrim); else next.delete('cc');
    if (bccTrim) next.set('bcc', bccTrim); else next.delete('bcc');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [bccTrim, ccTrim, labelTrim, qTrim, searchParams, setSearchParams, toTrim]);

  const pagination = useKeysetPagination({
    id: 'admin.mailer.recipients.list',
    filterKey: JSON.stringify({ q: qTrim, label: labelTrim, to: toTrim, cc: ccTrim, bcc: bccTrim }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['mailer', 'mail_recipients', 'index', { limit: pagination.limit, fromId: pagination.fromId, q: qTrim, label: labelTrim, to: toTrim, cc: ccTrim, bcc: bccTrim }],
    queryFn: async () => (await fetchMailRecipients({ limit: pagination.limit, fromId: pagination.fromId, q: qTrim, label: labelTrim, to: toTrim, cc: ccTrim, bcc: bccTrim })).data,
    staleTime: 10_000,
  });

  const rows: MailRecipient[] = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(rows as any), [rows]);
  const hasMore = rows.length >= pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;

  const filtersActive = Boolean(qTrim || labelTrim || toTrim || ccTrim || bccTrim || smartErrors.length);

  function clearFilters() {
    setQ('');
    setLabelFilter('');
    setToFilter('');
    setCcFilter('');
    setBccFilter('');
    setSmart('');
    setSmartErrors([]);
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
    let nextLabel = labelTrim;
    let nextTo = toTrim;
    let nextCc = ccTrim;
    let nextBcc = bccTrim;

    if (tokens.length === 1) {
      const firstToken = tokens[0];
      const id = firstToken ? parseNumericToken(firstToken) : null;
      if (id !== null) {
        const exact = rows.find((r) => Number((r as any).id) === id);
        if (exact) {
          openEdit(exact);
          setSmart('');
          setSmartErrors([]);
          return;
        }
        nextQ = String(id);
        setQ(nextQ);
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
        nextErrors.push(t('mailer.recipients.smart.error.empty_value', { key }));
        continue;
      }
      if (['q', 'search'].includes(key)) nextQ = value;
      else if (key === 'label') nextLabel = value;
      else if (key === 'to') nextTo = value;
      else if (key === 'cc') nextCc = value;
      else if (key === 'bcc') nextBcc = value;
      else if (key === 'id') {
        const id = parseNumericToken(value);
        if (id === null) nextErrors.push(t('mailer.recipients.smart.error.id_numeric_only', { value }));
        else {
          const exact = rows.find((r) => Number((r as any).id) === id);
          if (exact) {
            openEdit(exact);
            setSmart('');
            setSmartErrors([]);
            return;
          }
          nextQ = String(id);
        }
      } else {
        nextErrors.push(t('mailer.recipients.smart.error.unknown_key', { key }));
      }
    }

    const free = freeText.join(' ').trim();
    if (free) nextQ = free;

    setQ(nextQ);
    setLabelFilter(nextLabel);
    setToFilter(nextTo);
    setCcFilter(nextCc);
    setBccFilter(nextBcc);
    setSmart('');
    setSmartErrors(nextErrors);
  }

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const s: SmartFilterSuggestion[] = [];
    if (!smartNeedle) return s;
    if (smartNeedle === '?') {
      s.push({
        id: 'help',
        primary: t('filters.help.open'),
        secondary: t('mailer.recipients.smart.help.hint'),
        onPick: () => setHelpOpen(true),
        testId: 'admin.mailer.recipients.smart_filter.suggest.help',
      });
      return s;
    }
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      const exact = rows.find((r) => Number((r as any).id) === numeric);
      if (exact) {
        s.push({
          id: 'edit',
          primary: t('mailer.recipients.smart.suggest.edit', { id: String(numeric) }),
          secondary: t('mailer.recipients.smart.suggest.edit.secondary'),
          onPick: () => openEdit(exact),
          testId: 'admin.mailer.recipients.smart_filter.suggest.edit',
        });
      }
      s.push({
        id: 'search-id',
        primary: t('mailer.recipients.smart.suggest.search_id', { id: String(numeric) }),
        secondary: t('mailer.recipients.smart.suggest.search_id.secondary'),
        onPick: () => applySmartText(String(numeric)),
        testId: 'admin.mailer.recipients.smart_filter.suggest.search_id',
      });
      return s;
    }
    const kv = splitKeyValueToken(smartNeedle);
    if (kv) {
      s.push({
        id: 'apply',
        primary: t('mailer.recipients.smart.suggest.apply', { value: smartNeedle }),
        secondary: t('mailer.recipients.smart.suggest.apply.secondary'),
        onPick: () => applySmartText(smartNeedle),
        testId: 'admin.mailer.recipients.smart_filter.suggest.apply',
      });
      return s;
    }
    s.push({
      id: 'search',
      primary: t('mailer.recipients.smart.suggest.search', { value: smartNeedle }),
      secondary: t('mailer.recipients.smart.suggest.search.secondary'),
      onPick: () => applySmartText(smartNeedle),
      testId: 'admin.mailer.recipients.smart_filter.suggest.search',
    });
    return s;
  }, [rows, smartNeedle, t]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    if (qTrim) chips.push(<FilterChip key='q' label={`q:${qTrim}`} onRemove={() => setQ('')} testId='admin.mailer.recipients.chip.q' />);
    if (labelTrim) chips.push(<FilterChip key='label' label={`label:${labelTrim}`} onRemove={() => setLabelFilter('')} testId='admin.mailer.recipients.chip.label' />);
    if (toTrim) chips.push(<FilterChip key='to' label={`to:${toTrim}`} onRemove={() => setToFilter('')} testId='admin.mailer.recipients.chip.to' />);
    if (ccTrim) chips.push(<FilterChip key='cc' label={`cc:${ccTrim}`} onRemove={() => setCcFilter('')} testId='admin.mailer.recipients.chip.cc' />);
    if (bccTrim) chips.push(<FilterChip key='bcc' label={`bcc:${bccTrim}`} onRemove={() => setBccFilter('')} testId='admin.mailer.recipients.chip.bcc' />);
    smartErrors.forEach((e, idx) => chips.push(<FilterChip key={`err.${idx}`} label={e} tone='danger' onRemove={() => setSmartErrors([])} testId={`admin.mailer.recipients.chip.error.${idx}`} />));
    return chips;
  }, [bccTrim, ccTrim, labelTrim, qTrim, smartErrors, toTrim]);

  // --- editor modal ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MailRecipient | null>(null);
  const [form, setForm] = useState({ label: '', to: '', cc: '', bcc: '' });

  const openCreate = () => {
    setEditing(null);
    setForm({ label: '', to: '', cc: '', bcc: '' });
    setEditorOpen(true);
  };

  const openEdit = (r: MailRecipient) => {
    setEditing(r);
    setForm({
      label: String((r as any).label ?? ''),
      to: String((r as any).to ?? ''),
      cc: String((r as any).cc ?? ''),
      bcc: String((r as any).bcc ?? ''),
    });
    setEditorOpen(true);
  };

  const createM = useMutation({
    mutationFn: async () =>
      (await createMailRecipient({
        label: form.label.trim() || undefined,
        to: form.to.trim() || undefined,
        cc: form.cc.trim() || undefined,
        bcc: form.bcc.trim() || undefined,
      })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_recipients', 'index'] });
      setEditorOpen(false);
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('no recipient');
      const id = Number((editing as any).id);
      return (
        await updateMailRecipient(id, {
          label: form.label.trim() || undefined,
          to: form.to.trim() || undefined,
          cc: form.cc.trim() || undefined,
          bcc: form.bcc.trim() || undefined,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_recipients', 'index'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'recipients'] });
      setEditorOpen(false);
    },
  });

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteM = useMutation({
    mutationFn: async () => {
      if (!deleteId) throw new Error('no id');
      return await deleteMailRecipient(deleteId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_recipients', 'index'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'recipients'] });
      setDeleteId(null);
    },
  });

  const saveDisabled = !form.to.trim() && !form.cc.trim() && !form.bcc.trim();

  return (
    <ListShell
      testId="admin.mailer.recipients.page"
      header={
        <div className="space-y-3">
          <PageHeader
            title={t('mailer.tabs.recipients')}
            description={t('mailer.recipients.list.description')}
            meta={filtersActive ? <span className="text-xs text-faint">{t('list.meta.filters_active')}</span> : null}
            actions={
              <Button variant="primary" onClick={openCreate} testId="admin.mailer.recipients.create">
                {t('mailer.recipients.create')}
              </Button>
            }
            testId="admin.mailer.recipients.header"
          />
          <MailerTabs />
        </div>
      }
      filters={
        <>
          <FilterBar testId="admin.mailer.recipients.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('mailer.recipients.filters.search.placeholder')}
                ariaLabel={t('mailer.recipients.filters.search.placeholder')}
                testId="admin.mailer.recipients.search.input"
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
                    testId="admin.mailer.recipients.smart_filter.help_btn"
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />
              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.mailer.recipients.active_filters">
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
              testId="admin.mailer.recipients.advanced.open"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={typeof window !== 'undefined' ? window.location.href : ''}
              testId="admin.mailer.recipients.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters} testId="admin.mailer.recipients.filter.clear">
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              if (smartNeedle === '?') setSmart('');
            }}
            title={t('filters.help.title')}
            intro={t('mailer.recipients.smart.help.intro')}
            examples={[
              { example: '?', description: t('mailer.recipients.smart.help.examples.help') },
              { example: 'support', description: t('mailer.recipients.smart.help.examples.search') },
              { example: 'label:Support', description: t('mailer.recipients.smart.help.examples.label') },
              { example: 'to:support@example.test', description: t('mailer.recipients.smart.help.examples.to') },
              { example: 'id:10', description: t('mailer.recipients.smart.help.examples.id') },
            ]}
            topKeys={[
              { key: 'q', description: t('mailer.recipients.smart.help.keys.q'), example: 'q:support' },
              { key: 'label', description: t('mailer.recipients.smart.help.keys.label'), example: 'label:Support' },
              { key: 'to', description: t('mailer.recipients.smart.help.keys.to'), example: 'to:support@example.test' },
              { key: 'cc', description: t('mailer.recipients.smart.help.keys.cc'), example: 'cc:team@example.test' },
              { key: 'bcc', description: t('mailer.recipients.smart.help.keys.bcc'), example: 'bcc:audit@example.test' },
              { key: 'id', description: t('mailer.recipients.smart.help.keys.id'), example: 'id:10' },
            ]}
            inference={[
              t('mailer.recipients.smart.help.inference.free_text'),
              t('mailer.recipients.smart.help.inference.numeric'),
              t('mailer.recipients.smart.help.inference.advanced'),
            ]}
            onInsertKey={(key) => {
              setSmart(`${key}:`);
              setHelpOpen(false);
              window.setTimeout(() => smartInputRef.current?.focus(), 50);
            }}
            actions={[
              { label: t('filters.advanced.open'), onClick: () => { setHelpOpen(false); setAdvancedOpen(true); }, variant: 'secondary' },
            ]}
            testId="admin.mailer.recipients.smart_help"
            keyRowTestIdPrefix="admin.mailer.recipients.smart_help.key"
          />

          <Drawer
            open={advancedOpen}
            onClose={() => setAdvancedOpen(false)}
            title={t('filters.advanced.title')}
            width="lg"
            testId="admin.mailer.recipients.advanced"
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">{t('common.search')}</div>
                <div className="mt-1">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mailer.recipients.filters.search.placeholder')} autoComplete="off" testId="admin.mailer.recipients.advanced.q" />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.recipients.fields.label')}</div>
                <div className="mt-1">
                  <Input value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} placeholder={t('mailer.recipients.fields.label')} autoComplete="off" testId="admin.mailer.recipients.advanced.label" />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.recipients.fields.to')}</div>
                <div className="mt-1">
                  <Input value={toFilter} onChange={(e) => setToFilter(e.target.value)} placeholder={t('mailer.recipients.fields.to')} autoComplete="off" testId="admin.mailer.recipients.advanced.to" />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.recipients.fields.cc')}</div>
                <div className="mt-1">
                  <Input value={ccFilter} onChange={(e) => setCcFilter(e.target.value)} placeholder={t('mailer.recipients.fields.cc')} autoComplete="off" testId="admin.mailer.recipients.advanced.cc" />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">{t('mailer.recipients.fields.bcc')}</div>
                <div className="mt-1">
                  <Input value={bccFilter} onChange={(e) => setBccFilter(e.target.value)} placeholder={t('mailer.recipients.fields.bcc')} autoComplete="off" testId="admin.mailer.recipients.advanced.bcc" />
                </div>
              </div>
            </div>
          </Drawer>
        </>
      }
    >
      {listQ.isLoading ? (
        <LoadingState testId="admin.mailer.recipients.loading" />
      ) : listQ.isError ? (
        <ErrorState
          testId="admin.mailer.recipients.error"
          title={t('mailer.recipients.list.load_error')}
          error={listQ.error}
          onRetry={() => void listQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.recipients.list' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="admin.mailer.recipients.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('empty.list.empty.title')}
          body={filtersActive ? t('empty.list.no_matches.body') : t('empty.list.empty.body')}
        />
      ) : (
        <>
          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {rows.map((r) => {
              const id = Number((r as any).id);
              const label = String((r as any).label ?? `#${id}`);
              const to = String((r as any).to ?? '');
              const cc = String((r as any).cc ?? '');
              const bcc = String((r as any).bcc ?? '');

              return (
                <Card key={id} className="p-4" testId={`admin.mailer.recipients.card.${id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="mt-2 grid gap-1 text-xs text-muted">
                        <div className="truncate" title={to}>
                          <span className="font-medium">{t('mailer.recipients.fields.to')}:</span> {to || t('common.na')}
                        </div>
                        <div className="truncate" title={cc}>
                          <span className="font-medium">{t('mailer.recipients.fields.cc')}:</span> {cc || t('common.na')}
                        </div>
                        <div className="truncate" title={bcc}>
                          <span className="font-medium">{t('mailer.recipients.fields.bcc')}:</span> {bcc || t('common.na')}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(r)} testId={`admin.mailer.recipients.edit.${id}`}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteId(id)} testId={`admin.mailer.recipients.delete.${id}`}>
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-faint">{formatDateTime((r as any).updated_at)}</div>
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
                  testId="admin.mailer.recipients.pagination.mobile"
                />
              </Card>
            ) : null}
          </div>

          {/* Desktop */}
          <TableCard
            className="hidden md:block"
            minWidth="xl"
            tableTestId="admin.mailer.recipients.table"
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
                  testId="admin.mailer.recipients.pagination.desktop"
                />
              ) : null
            }
          >
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2">{t('common.label')}</th>
                <th className="px-4 py-2">{t('mailer.recipients.fields.to')}</th>
                <th className="px-4 py-2">{t('mailer.recipients.fields.cc')}</th>
                <th className="px-4 py-2">{t('mailer.recipients.fields.bcc')}</th>
                <th className="px-4 py-2">{t('common.updated')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = Number((r as any).id);
                const label = String((r as any).label ?? `#${id}`);
                const to = String((r as any).to ?? '');
                const cc = String((r as any).cc ?? '');
                const bcc = String((r as any).bcc ?? '');

                return (
                  <tr key={id} className="border-b border-border" data-testid={`admin.mailer.recipients.row.${id}`}>
                    <td className="px-4 py-2 text-sm font-medium">{label}</td>
                    <td className="max-w-sm truncate px-4 py-2 text-sm font-mono" title={to}>
                      {to || <span className="text-muted">{t('common.na')}</span>}
                    </td>
                    <td className="max-w-sm truncate px-4 py-2 text-sm font-mono" title={cc}>
                      {cc || <span className="text-muted">{t('common.na')}</span>}
                    </td>
                    <td className="max-w-sm truncate px-4 py-2 text-sm font-mono" title={bcc}>
                      {bcc || <span className="text-muted">{t('common.na')}</span>}
                    </td>
                    <td className="px-4 py-2 text-sm">{formatDateTime((r as any).updated_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(r)} testId={`admin.mailer.recipients.edit.${id}`}>
                          {t('common.edit')}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteId(id)} testId={`admin.mailer.recipients.delete.${id}`}>
                          {t('common.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableCard>
        </>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? t('mailer.recipients.edit.title') : t('mailer.recipients.create.title')}
        size="lg"
        testId="admin.mailer.recipients.editor"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div />
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setEditorOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                loading={createM.isPending || updateM.isPending}
                disabled={saveDisabled}
                onClick={() => (editing ? updateM.mutate() : createM.mutate())}
                testId="admin.mailer.recipients.editor.save"
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-xs font-medium text-muted">{t('common.label')}</div>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t('mailer.recipients.create.label_placeholder')} />
          </div>
          <div>
            <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.to')}</div>
            <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
          </div>
          <div>
            <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.cc')}</div>
            <Input value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
          </div>
          <div>
            <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.bcc')}</div>
            <Input value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
          </div>

          {(createM.isError || updateM.isError) ? (
            <Alert variant="danger" title={t('mailer.recipients.editor.save_error')}>
              {String(((createM.error || updateM.error) as any)?.message ?? createM.error ?? updateM.error)}
            </Alert>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t('mailer.recipients.delete_confirm.title')}
        description={t('mailer.recipients.delete_confirm.description')}
        danger
        confirmLabel={t('common.delete')}
        confirmLoading={deleteM.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteM.mutate()}
        testId="admin.mailer.recipients.delete_confirm"
      />
    </ListShell>
  );
}
