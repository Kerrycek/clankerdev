import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ChipLink } from '../ui/ChipLink';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CopyButton } from '../ui/CopyButton';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { TableCard } from '../ui/TableCard';

import { HaveApiError, getMetaTotalCount } from '../../lib/api/haveapi';
import { fetchVpsList } from '../../lib/api/vps';
import {
  createUserNamespaceMapEntry,
  deleteUserNamespaceMap,
  deleteUserNamespaceMapEntry,
  fetchUserNamespaceMap,
  fetchUserNamespaceMapEntries,
  updateUserNamespaceMap,
  updateUserNamespaceMapEntry,
  type UserNamespaceMap,
  type UserNamespaceMapEntry,
  type UserNamespaceEntryKind,
} from '../../lib/api/userNamespaces';

function parseFieldErrors(err: unknown): Record<string, string[]> | null {
  if (err instanceof HaveApiError) {
    const e = err.envelope?.errors;
    if (e && typeof e === 'object' && !Array.isArray(e)) {
      return e as LegacyAny;
    }
  }
  return null;
}

function asInt(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

type LocalRow = {
  id: number;
  kind: UserNamespaceEntryKind;
  vps_id: number;
  ns_id: number;
  count: number;
  original: { vps_id: number; ns_id: number; count: number };
  dirty: boolean;
  saving?: boolean;
  errors?: Record<string, string[]>;
};

function toLocalRow(e: UserNamespaceMapEntry): LocalRow | null {
  if (!e || typeof e.id !== 'number') return null;
  const kindRaw = String(e.kind ?? '').toLowerCase();
  const kind: UserNamespaceEntryKind | null = kindRaw === 'uid' ? 'uid' : kindRaw === 'gid' ? 'gid' : null;
  if (!kind) return null;

  const vps_id = typeof e.vps_id === 'number' ? e.vps_id : Number(e.vps_id);
  const ns_id = typeof e.ns_id === 'number' ? e.ns_id : Number(e.ns_id);
  const count = typeof e.count === 'number' ? e.count : Number(e.count);

  if (!Number.isFinite(vps_id) || !Number.isFinite(ns_id) || !Number.isFinite(count)) return null;

  const o = { vps_id, ns_id, count };

  return {
    id: e.id,
    kind,
    vps_id,
    ns_id,
    count,
    original: o,
    dirty: false,
  };
}

function sortRows(list: LocalRow[]): LocalRow[] {
  return list
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'uid' ? -1 : 1;
      return a.id - b.id;
    });
}

function mapIdLabel(m: UserNamespaceMap | null | undefined): string {
  if (!m) return '';
  const lbl = m.label ? String(m.label) : '';
  return lbl.trim() ? lbl : `#${m.id}`;
}

function namespaceLabel(ns: any, sizeLabel?: string): string {
  if (!ns) return '—';
  const id = typeof ns.id === 'number' ? ns.id : undefined;
  const size = typeof ns.size === 'number' ? ns.size : undefined;
  if (id != null && size != null && sizeLabel) return `#${id} (${sizeLabel} ${size})`;
  if (id != null && size != null) return `#${id} (${size})`;
  if (id != null) return `#${id}`;
  return '—';
}

export function UserNamespaceMapDetail(props: {
  mapId: number;
  backTo: string;
  testIdPrefix: string;
  /** Optional: show an additional note/link specific to the host page. */
  headerNote?: React.ReactNode;
}) {
  const { basePath, mode } = useAppMode();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mapQ = useQuery({
    queryKey: ['user_namespace_map', props.mapId],
    queryFn: async () => (await fetchUserNamespaceMap(props.mapId)).data,
    enabled: Number.isFinite(props.mapId) && props.mapId > 0,
    staleTime: 30_000,
  });

  const entriesQ = useQuery({
    queryKey: ['user_namespace_map', props.mapId, 'entries'],
    queryFn: async () => (await fetchUserNamespaceMapEntries(props.mapId, { limit: 200 })).data,
    enabled: Number.isFinite(props.mapId) && props.mapId > 0,
    staleTime: 15_000,
  });

  // Used by VPS count (optional, but shown as a chip when available).
  const usedByQ = useQuery({
    queryKey: ['vps', 'count', { user_namespace_map: props.mapId }],
    queryFn: async () => {
      const res = await fetchVpsList({ limit: 1, userNamespaceMap: props.mapId });
      return getMetaTotalCount(res.meta) ?? res.data.length;
    },
    enabled: Number.isFinite(props.mapId) && props.mapId > 0,
    staleTime: 30_000,
  });

  const map = mapQ.data ?? null;
  const ns = (map as LegacyAny)?.user_namespace;

  const [labelDraft, setLabelDraft] = useState('');
  const [labelOriginal, setLabelOriginal] = useState('');

  useEffect(() => {
    const lbl = map?.label ? String(map.label) : '';
    setLabelDraft(lbl);
    setLabelOriginal(lbl);
  }, [map?.id]);

  const labelDirty = labelDraft.trim() !== labelOriginal.trim();

  const [rows, setRows] = useState<LocalRow[] | null>(null);
  const anyDirty = useMemo(() => (rows ?? []).some((r) => r.dirty), [rows]);

  useEffect(() => {
    const list = entriesQ.data;
    if (!list) return;
    // Do not clobber local unsaved edits.
    if (anyDirty) return;

    const next = sortRows(
      list
        .map(toLocalRow)
        .filter((x): x is LocalRow => Boolean(x))
    );
    setRows(next);
  }, [anyDirty, entriesQ.data]);

  const entryCount = (rows ?? entriesQ.data ?? []).length;
  const usedByCount = usedByQ.data;

  const nsSize = typeof (ns as LegacyAny)?.size === 'number' ? (ns as LegacyAny).size : null;
  const nsId: number | null = typeof (ns as LegacyAny)?.id === 'number' ? (ns as LegacyAny).id : null;

  const renameM = useMutation({
    mutationFn: async () => {
      if (!nsId) {
        throw new Error('Missing namespace reference for this map');
      }

      return updateUserNamespaceMap(props.mapId, { label: labelDraft.trim(), userNamespaceId: nsId });
    },
    onSuccess: (res) => {
      setLabelOriginal(String(res.data?.label ?? ''));
      qc.invalidateQueries({ queryKey: ['user_namespace_map', props.mapId] });
      qc.invalidateQueries({ queryKey: ['user_namespace_map', 'list'] });
    },
  });

  const [globalError, setGlobalError] = useState<string | null>(null);

  const saveEntriesM = useMutation({
    mutationFn: async () => {
      setGlobalError(null);

      const list = rows ?? [];
      const dirty = list.filter((r) => r.dirty);
      const results: { id: number; ok: boolean; err?: unknown }[] = [];

      for (const r of dirty) {
        // Guard: bounds (best-effort; backend validates too).
        if (nsSize != null && r.ns_id + r.count > nsSize) {
          results.push({
            id: r.id,
            ok: false,
            err: new HaveApiError({ status: false, message: 'Out of bounds', errors: { ns_id: ['out of bounds'] } }),
          });
          continue;
        }

        setRows((prev) => {
          const p = prev ?? [];
          return p.map((x) => (x.id === r.id ? { ...x, saving: true, errors: undefined } : x));
        });

        try {
          await updateUserNamespaceMapEntry(props.mapId, r.id, {
            vps_id: r.vps_id,
            ns_id: r.ns_id,
            count: r.count,
          });
          results.push({ id: r.id, ok: true });

          setRows((prev) => {
            const p = prev ?? [];
            return p.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    original: { vps_id: x.vps_id, ns_id: x.ns_id, count: x.count },
                    dirty: false,
                    saving: false,
                    errors: undefined,
                  }
                : x
            );
          });
        } catch (e) {
          results.push({ id: r.id, ok: false, err: e });
          const fieldErrors = parseFieldErrors(e) ?? { _base: [String((e as LegacyAny)?.message ?? e)] };

          setRows((prev) => {
            const p = prev ?? [];
            return p.map((x) => (x.id === r.id ? { ...x, saving: false, errors: fieldErrors } : x));
          });
        }
      }

      return results;
    },
  });

  const [deleteMapConfirm, setDeleteMapConfirm] = useState(false);

  const deleteMapM = useMutation({
    mutationFn: async () => deleteUserNamespaceMap(props.mapId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user_namespace_map', 'list'] });
      navigate(props.backTo, { replace: true });
    },
    onError: (e: any) => {
      setGlobalError(String(e?.message ?? e));
    },
  });

  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState<null | { entryId: number }>(null);

  const deleteEntryM = useMutation({
    mutationFn: async (entryId: number) => deleteUserNamespaceMapEntry(props.mapId, entryId),
    onSuccess: (_r, entryId) => {
      setRows((prev) => {
        const p = prev ?? [];
        return p.filter((x) => x.id !== entryId);
      });
    },
    onError: (e: any) => {
      setGlobalError(String(e?.message ?? e));
    },
  });

  // Add entry form (legacy convenience supports UID&GID).
  const [addKind, setAddKind] = useState<'both' | UserNamespaceEntryKind>('both');
  const [addVpsId, setAddVpsId] = useState('');
  const [addNsId, setAddNsId] = useState('');
  const [addCount, setAddCount] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string[]> | null>(null);

  const addM = useMutation({
    mutationFn: async () => {
      setGlobalError(null);
      setAddErrors(null);

      const vps_id = asInt(addVpsId);
      const ns_id = asInt(addNsId);
      const count = asInt(addCount);

      const errs: Record<string, string[]> = {};
      if (vps_id == null || vps_id < 0) errs['vps_id'] = [t('userns.validation.integer_non_negative')];
      if (ns_id == null || ns_id < 0) errs['ns_id'] = [t('userns.validation.integer_non_negative')];
      if (count == null || count <= 0) errs['count'] = [t('userns.validation.count_positive')];

      if (nsSize != null && ns_id != null && count != null && ns_id + count > nsSize) {
        errs['ns_id'] = [
          t('userns.entry.out_of_bounds', {
            start: ns_id,
            end: ns_id + count - 1,
            size: nsSize,
          }),
        ];
      }

      if (Object.keys(errs).length > 0) {
        setAddErrors(errs);
        return [] as UserNamespaceMapEntry[];
      }

      const kinds: UserNamespaceEntryKind[] = addKind === 'both' ? ['uid', 'gid'] : [addKind];
      const created: UserNamespaceMapEntry[] = [];

      for (const k of kinds) {
        const res = await createUserNamespaceMapEntry(props.mapId, { kind: k, vps_id: vps_id!, ns_id: ns_id!, count: count! });
        created.push(res.data);
      }

      return created;
    },
    onSuccess: (created) => {
      if (!created || created.length === 0) return;

      setRows((prev) => {
        const p = prev ?? [];
        const appended = [...p];
        for (const e of created) {
          const lr = toLocalRow(e);
          if (lr) appended.push(lr);
        }
        return sortRows(appended);
      });

      setAddVpsId('');
      setAddNsId('');
      setAddCount('');
      setAddErrors(null);
    },
    onError: (e: any) => {
      const fe = parseFieldErrors(e);
      if (fe) {
        setAddErrors(fe);
      } else {
        setGlobalError(String(e?.message ?? e));
      }
    },
  });

  const headerTitle = map ? `${t('userns.map.title')} #${map.id}` : t('userns.map.title');

  const headerSubtitle = map
    ? `${mapIdLabel(map)} · ${t('userns.map.namespace')}: ${namespaceLabel(ns, t('userns.namespace.size'))}`
    : t('common.loading');

  const entriesLink = `${basePath}/vps?user_namespace_map=${props.mapId}`;

  const canInteract = !mapQ.isLoading && !entriesQ.isLoading && Boolean(map);

  return (
    <div className="space-y-4" data-testid={`${props.testIdPrefix}.panel`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-document-title-root data-document-title-kind="object">
          <div className="text-lg font-semibold text-fg" data-testid={`${props.testIdPrefix}.title`} data-document-title-heading>{headerTitle}</div>
          <div className="text-sm text-muted" data-testid={`${props.testIdPrefix}.subtitle`}>{headerSubtitle}</div>
          {props.headerNote ? <div className="mt-1 text-xs text-faint">{props.headerNote}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ChipLink to={props.backTo} title={t('common.back')}>
            {t('common.back')}
          </ChipLink>

          <Badge variant="neutral">{t('userns.map.entries', { n: entryCount })}</Badge>

          <ChipLink to={entriesLink} title={t('userns.map.used_by_vps_link')}>
            {t('userns.map.used_by_vps', { n: usedByCount ?? '—' })}
          </ChipLink>

          <Button
            testId={`${props.testIdPrefix}.delete`}
            variant="danger"
            size="sm"
            disabled={!canInteract || deleteMapM.isPending}
            onClick={() => setDeleteMapConfirm(true)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {mapQ.isLoading || entriesQ.isLoading ? (
        <Card>
          <CardBody>
            <Spinner label={t('common.loading')} />
          </CardBody>
        </Card>
      ) : mapQ.isError ? (
        <Alert title={t('userns.map.load_error')} variant="danger">
          {String((mapQ.error as LegacyAny)?.message ?? mapQ.error)}
        </Alert>
      ) : !map ? (
        <Alert title={t('userns.map.not_found')} variant="danger">
          {t('error.not_found.body')}
        </Alert>
      ) : null}

      {globalError ? (
        <Alert title={t('common.error')} variant="danger">
          {globalError}
        </Alert>
      ) : null}

      {/* Rename */}
      <Card testId={`${props.testIdPrefix}.rename.card`}>
        <CardHeader
          title={t('userns.map.rename.title')}
          subtitle={t('userns.map.rename.body')}
          actions={
            <Button
              testId={`${props.testIdPrefix}.rename.save`}
              variant={labelDirty ? 'primary' : 'secondary'}
              size="sm"
              disabled={!labelDirty || renameM.isPending || !canInteract}
              onClick={() => renameM.mutate()}
            >
              {renameM.isPending ? t('common.saving') : t('common.save')}
            </Button>
          }
        />
        <CardBody>
          <div className="max-w-xl">
            <Input
              testId={`${props.testIdPrefix}.rename.input`}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder={t('userns.map.rename.placeholder')}
            />
          </div>
          {renameM.error ? (
            <Alert title={t('userns.map.rename.error')} variant="danger" className="mt-3">
              {String((renameM.error as LegacyAny)?.message ?? renameM.error)}
            </Alert>
          ) : null}
        </CardBody>
      </Card>

      {/* Entries */}
      <Card testId={`${props.testIdPrefix}.entries.card`}>
        <CardHeader
          title={t('userns.entry.title')}
          subtitle={t('userns.entry.subtitle')}
          actions={
            <Button
              testId={`${props.testIdPrefix}.entries.save`}
              variant={anyDirty ? 'primary' : 'secondary'}
              size="sm"
              disabled={!anyDirty || saveEntriesM.isPending || !canInteract}
              onClick={() => saveEntriesM.mutate()}
            >
              {saveEntriesM.isPending ? t('common.saving') : t('common.save')}
            </Button>
          }
        />
        <CardBody>
          <ul className="text-xs text-faint list-disc pl-4">
            <li>{t('userns.entry.help_line1')}</li>
            <li>{t('userns.entry.help_line2')}</li>
          </ul>

          {/* Add row */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6" data-testid={`${props.testIdPrefix}.add.grid`}>
            <div className="sm:col-span-1">
              <label className="text-xs text-muted">{t('userns.entry.grid.kind')}</label>
              <select
                data-testid={`${props.testIdPrefix}.add.kind`}
                className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg"
                value={addKind}
                onChange={(e) => setAddKind(e.target.value as LegacyAny)}
                disabled={addM.isPending || !canInteract}
              >
                <option value="both">{t('userns.entry.kind.both')}</option>
                <option value="uid">{t('userns.entry.kind.uid')}</option>
                <option value="gid">{t('userns.entry.kind.gid')}</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="text-xs text-muted">{t('userns.entry.grid.vps_id')}</label>
              <Input
                testId={`${props.testIdPrefix}.add.vps_id`}
                className="mt-1"
                value={addVpsId}
                onChange={(e) => setAddVpsId(e.target.value)}
                placeholder="0"
              />
              {addErrors?.['vps_id'] ? <div className="mt-1 text-xs text-danger">{addErrors['vps_id'].join(', ')}</div> : null}
            </div>

            <div className="sm:col-span-1">
              <label className="text-xs text-muted">{t('userns.entry.grid.ns_id')}</label>
              <Input
                testId={`${props.testIdPrefix}.add.ns_id`}
                className="mt-1"
                value={addNsId}
                onChange={(e) => setAddNsId(e.target.value)}
                placeholder="0"
              />
              {addErrors?.['ns_id'] ? <div className="mt-1 text-xs text-danger">{addErrors['ns_id'].join(', ')}</div> : null}
            </div>

            <div className="sm:col-span-1">
              <label className="text-xs text-muted">{t('userns.entry.grid.count')}</label>
              <Input
                testId={`${props.testIdPrefix}.add.count`}
                className="mt-1"
                value={addCount}
                onChange={(e) => setAddCount(e.target.value)}
                placeholder="1"
              />
              {addErrors?.['count'] ? <div className="mt-1 text-xs text-danger">{addErrors['count'].join(', ')}</div> : null}
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                testId={`${props.testIdPrefix}.add.submit`}
                variant="secondary"
                className="mt-1"
                disabled={addM.isPending || !canInteract}
                onClick={() => addM.mutate()}
              >
                {addM.isPending ? t('common.creating') : t('userns.entry.add')}
              </Button>
            </div>
          </div>

          {addM.error && !addErrors ? (
            <Alert title={t('userns.entry.create_error')} variant="danger" className="mt-3">
              {String((addM.error as LegacyAny)?.message ?? addM.error)}
            </Alert>
          ) : null}

          <div className="mt-4">
            <TableCard testId={`${props.testIdPrefix}.entries.table`} minWidth="lg">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2">{t('userns.entry.grid.kind')}</th>
                  <th className="px-4 py-2">{t('userns.entry.grid.vps_id')}</th>
                  <th className="px-4 py-2">{t('userns.entry.grid.ns_id')}</th>
                  <th className="px-4 py-2">{t('userns.entry.grid.count')}</th>
                  <th className="px-4 py-2">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-muted">
                      {t('userns.entry.empty')}
                    </td>
                  </tr>
                ) : (
                  (rows ?? []).map((r) => {
                    const rowDirty = r.dirty;
                    const rowErr = r.errors;
                    const hasErrors = Object.values(rowErr ?? {}).some((v) => (v ?? []).length > 0);
                    const rowVariant: string | undefined = hasErrors ? 'danger' : rowDirty ? 'warn' : undefined;

                    const fieldErr = (k: string) => (rowErr && rowErr[k] ? rowErr[k].join(', ') : null);

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border"
                        data-row-variant={rowVariant}
                        data-testid={`${props.testIdPrefix}.entry.row.${r.id}`}
                      >
                        <td className="px-4 py-2 text-sm">
                          <Badge variant={r.kind === 'uid' ? 'neutral' : 'neutral'}>{r.kind.toUpperCase()}</Badge>
                          <span className="ml-2 text-xs text-faint">#{r.id}</span>
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            testId={`${props.testIdPrefix}.entry.${r.id}.vps_id`}
                            value={String(r.vps_id)}
                            onChange={(e) => {
                              const n = asInt(e.target.value);
                              if (n == null) {
                                setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, vps_id: 0, dirty: true } : x)));
                                return;
                              }
                              setRows((prev) => {
                                const p = prev ?? [];
                                return p.map((x) => {
                                  if (x.id !== r.id) return x;
                                  const next = { ...x, vps_id: n };
                                  next.dirty = next.vps_id !== next.original.vps_id || next.ns_id !== next.original.ns_id || next.count !== next.original.count;
                                  return next;
                                });
                              });
                            }}
                          />
                          {fieldErr('vps_id') ? <div className="mt-1 text-xs text-danger">{fieldErr('vps_id')}</div> : null}
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            testId={`${props.testIdPrefix}.entry.${r.id}.ns_id`}
                            value={String(r.ns_id)}
                            onChange={(e) => {
                              const n = asInt(e.target.value);
                              if (n == null) {
                                setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, ns_id: 0, dirty: true } : x)));
                                return;
                              }
                              setRows((prev) => {
                                const p = prev ?? [];
                                return p.map((x) => {
                                  if (x.id !== r.id) return x;
                                  const next = { ...x, ns_id: n };
                                  next.dirty = next.vps_id !== next.original.vps_id || next.ns_id !== next.original.ns_id || next.count !== next.original.count;
                                  return next;
                                });
                              });
                            }}
                          />
                          {fieldErr('ns_id') ? <div className="mt-1 text-xs text-danger">{fieldErr('ns_id')}</div> : null}
                        </td>

                        <td className="px-4 py-2">
                          <Input
                            testId={`${props.testIdPrefix}.entry.${r.id}.count`}
                            value={String(r.count)}
                            onChange={(e) => {
                              const n = asInt(e.target.value);
                              if (n == null) {
                                setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, count: 0, dirty: true } : x)));
                                return;
                              }
                              setRows((prev) => {
                                const p = prev ?? [];
                                return p.map((x) => {
                                  if (x.id !== r.id) return x;
                                  const next = { ...x, count: n };
                                  next.dirty = next.vps_id !== next.original.vps_id || next.ns_id !== next.original.ns_id || next.count !== next.original.count;
                                  return next;
                                });
                              });
                            }}
                          />
                          {fieldErr('count') ? <div className="mt-1 text-xs text-danger">{fieldErr('count')}</div> : null}
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              testId={`${props.testIdPrefix}.entry.${r.id}.delete`}
                              variant="secondary"
                              size="sm"
                              disabled={deleteEntryM.isPending}
                              onClick={() => setDeleteEntryConfirm({ entryId: r.id })}
                            >
                              {t('common.delete')}
                            </Button>
                            {r.saving ? <span className="text-xs text-muted">{t('common.saving')}</span> : null}
                            {rowErr && rowErr['_base'] ? (
                              <span className="text-xs text-danger">{rowErr['_base'].join(', ')}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TableCard>
          </div>

          {saveEntriesM.data ? (
            <div className="mt-3 text-xs text-muted" data-testid={`${props.testIdPrefix}.entries.save.result`}>
              {t('userns.entry.save_summary', {
                ok: saveEntriesM.data.filter((x) => x.ok).length,
                fail: saveEntriesM.data.filter((x) => !x.ok).length,
              })}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <ConfirmDialog
        testId={`${props.testIdPrefix}.delete_map.confirm`}
        open={deleteMapConfirm}
        title={t('userns.map.delete.title')}
        description={t('userns.map.delete.desc')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteMapM.isPending}
        onCancel={() => setDeleteMapConfirm(false)}
        onConfirm={() => deleteMapM.mutate()}
      />

      <ConfirmDialog
        testId={`${props.testIdPrefix}.delete_entry.confirm`}
        open={Boolean(deleteEntryConfirm)}
        title={t('userns.entry.delete.title')}
        description={t('userns.entry.delete.desc')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteEntryM.isPending}
        onCancel={() => setDeleteEntryConfirm(null)}
        onConfirm={() => {
          if (deleteEntryConfirm) {
            deleteEntryM.mutate(deleteEntryConfirm.entryId);
            setDeleteEntryConfirm(null);
          }
        }}
      />

      {/* Quick deep link for operators */}
      {mode === 'admin' && typeof window !== 'undefined' ? (
        <div className="flex items-center gap-2 text-xs text-faint">
          <div>{t('userns.map.deep_link_hint')}</div>
          <CopyButton text={window.location.href} label={t('common.copy_link')} />
        </div>
      ) : null}
    </div>
  );
}
