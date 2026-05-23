import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { formatErrorMessage } from '../../../../lib/errors';

import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { ObjectHeader } from '../../../../components/ui/ObjectHeader';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { Spinner } from '../../../../components/ui/Spinner';
import { StatCard } from '../../../../components/ui/StatCard';
import { SwitchRow } from '../../../../components/ui/SwitchRow';
import { TableCard } from '../../../../components/ui/TableCard';

import { fetchLocations, type Location } from '../../../../lib/api/infra';
import { parseNonNegativeInt, parsePositiveInt } from '../../../../lib/parse';
import {
  createLocationNetwork,
  deleteLocationNetwork,
  fetchLocationNetworks,
  updateLocationNetwork,
  type LocationNetwork,
} from '../../../../lib/api/locationNetworks';
import { fetchNetwork, type Network } from '../../../../lib/api/networks';

function locLabel(l: Location | null | undefined): string {
  const x: any = l ?? {};
  const label = typeof x.label === 'string' ? x.label.trim() : '';
  return label || (typeof x.id === 'number' ? `#${x.id}` : '—');
}

function netLabel(n: Network, fallbackId: number): string {
  const addr = typeof n.address === 'string' ? n.address : '';
  const prefix = typeof n.prefix === 'number' ? String(n.prefix) : '';
  if (addr && prefix) return `${addr}/${prefix}`;
  if (addr) return addr;
  return `#${fallbackId}`;
}

function roleBadge(t: (k: string) => string, role: unknown): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } {
  const r = String(role ?? '');
  if (r === 'public_access') return { variant: 'ok', label: t('admin.cluster.networks.role.public') };
  if (r === 'private_access') return { variant: 'neutral', label: t('admin.cluster.networks.role.private') };
  return { variant: 'neutral', label: r || '—' };
}

function purposeBadge(t: (k: string) => string, purpose: unknown): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } {
  const p = String(purpose ?? '');
  if (p === 'vps') return { variant: 'ok', label: t('admin.cluster.networks.purpose.vps') };
  if (p === 'export') return { variant: 'warn', label: t('admin.cluster.networks.purpose.export') };
  if (p === 'any') return { variant: 'neutral', label: t('admin.cluster.networks.purpose.any') };
  return { variant: 'neutral', label: p || '—' };
}

function ynBadge(t: (k: string) => string, v: boolean | undefined): { variant: React.ComponentProps<typeof Badge>['variant']; label: string } {
  if (v === true) return { variant: 'ok', label: t('common.yes') };
  if (v === false) return { variant: 'neutral', label: t('common.no') };
  return { variant: 'neutral', label: '—' };
}

type LnEditorState =
  | null
  | {
      mode: 'create' | 'edit';
      ln?: LocationNetwork;
    };

type LnFormState = {
  locationId: string;
  primary: boolean;
  priority: string;
  autopick: boolean;
  userpick: boolean;
};

function initLnForm(ln?: LocationNetwork): LnFormState {
  const x: any = ln ?? {};
  return {
    locationId: typeof x.location?.id === 'number' ? String(x.location.id) : '',
    primary: Boolean(x.primary),
    priority: typeof x.priority === 'number' ? String(x.priority) : '0',
    autopick: Boolean(x.autopick),
    userpick: Boolean(x.userpick),
  };
}

export function NetworkDetailPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const params = useParams();

  const id = useMemo(() => parsePositiveInt(params['networkId']), [params]);

  const netQ = useQuery({
    queryKey: ['network', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id');
      return (await fetchNetwork(id)).data;
    },
    enabled: Boolean(id),
    staleTime: 5_000,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: async () => (await fetchLocations({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const lnQ = useQuery({
    queryKey: ['location_networks', 'network', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing id');
      return (await fetchLocationNetworks({ networkId: id, limit: 500 })).data;
    },
    enabled: Boolean(id),
    staleTime: 5_000,
  });

  const net = netQ.data;
  const lns = lnQ.data ?? [];
  const locs = locationsQ.data ?? [];

  const sortedLns = useMemo(() => {
    const list = [...lns];
    list.sort((a, b) => {
      const ap = Boolean(a.primary);
      const bp = Boolean(b.primary);
      if (ap !== bp) return ap ? -1 : 1;

      const apr = typeof a.priority === 'number' ? a.priority : 0;
      const bpr = typeof b.priority === 'number' ? b.priority : 0;
      if (apr !== bpr) return apr - bpr;

      const al = locLabel((a as any).location ?? null);
      const bl = locLabel((b as any).location ?? null);
      return al.localeCompare(bl);
    });
    return list;
  }, [lns]);

  const locationOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.select') }];
    for (const l of locs) opts.push({ value: String(l.id), label: locLabel(l) });
    return opts;
  }, [locs, t]);

  const [editor, setEditor] = useState<LnEditorState>(null);
  const [form, setForm] = useState<LnFormState>(() => initLnForm());
  const [deleteState, setDeleteState] = useState<{ open: boolean; ln?: LocationNetwork }>(() => ({ open: false }));

  const openCreate = () => {
    setForm(initLnForm());
    setEditor({ mode: 'create' });
  };

  const openEdit = (ln: LocationNetwork) => {
    setForm(initLnForm(ln));
    setEditor({ mode: 'edit', ln });
  };

  const createM = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing id');
      const locationId = parsePositiveInt(form.locationId);
      const priority = parseNonNegativeInt(form.priority) ?? 0;
      if (!locationId) throw new Error('Missing location');

      return createLocationNetwork({
        locationId,
        networkId: id,
        primary: form.primary,
        priority,
        autopick: form.autopick,
        userpick: form.userpick,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['location_networks', 'network', id] });
      await qc.invalidateQueries({ queryKey: ['network', id] });
      await qc.invalidateQueries({ queryKey: ['networks'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.network_detail.toast.added') });
      setEditor(null);
    },
    onError: (e) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e) }),
  });

  const updateM = useMutation({
    mutationFn: async () => {
      const ln = editor?.ln;
      if (!ln) throw new Error('Missing location network');

      const priority = parseNonNegativeInt(form.priority) ?? 0;

      return updateLocationNetwork({
        id: ln.id,
        primary: form.primary,
        priority,
        autopick: form.autopick,
        userpick: form.userpick,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['location_networks', 'network', id] });
      await qc.invalidateQueries({ queryKey: ['network', id] });
      await qc.invalidateQueries({ queryKey: ['networks'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.network_detail.toast.saved') });
      setEditor(null);
    },
    onError: (e) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e) }),
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      const ln = deleteState.ln;
      if (!ln) throw new Error('Missing location network');
      return deleteLocationNetwork({ id: ln.id });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['location_networks', 'network', id] });
      await qc.invalidateQueries({ queryKey: ['network', id] });
      await qc.invalidateQueries({ queryKey: ['networks'] });
      pushToast({ variant: 'ok', title: t('admin.cluster.network_detail.toast.removed') });
      setDeleteState({ open: false });
    },
    onError: (e) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(e) }),
  });

  const busy = createM.isPending || updateM.isPending;

  if (!id) {
    return (
      <ErrorState
        title={t('admin.cluster.network_detail.invalid_title')}
        message={t('admin.cluster.network_detail.invalid_body')}
        testId="admin.cluster.network_detail.bad_id"
      />
    );
  }

  if (netQ.isLoading) {
    return <LoadingState testId="admin.cluster.network_detail.loading" />;
  }

  if (netQ.isError || !net) {
    return (
      <ErrorState
        title={t('admin.cluster.network_detail.error.title')}
        message={t('admin.cluster.network_detail.error.body')}
        onRetry={() => netQ.refetch()}
        testId="admin.cluster.network_detail.error"
      />
    );
  }

  const title = netLabel(net, id);
  const role = roleBadge(t, net.role);
  const purpose = purposeBadge(t, net.purpose);
  const managed = Boolean(net.managed);

  const size = typeof net.size === 'number' ? net.size : null;
  const used = typeof net.used === 'number' ? net.used : null;
  const assigned = typeof net.assigned === 'number' ? net.assigned : null;
  const owned = typeof net.owned === 'number' ? net.owned : null;
  const taken = typeof net.taken === 'number' ? net.taken : null;
  const free = size !== null && taken !== null ? Math.max(0, size - taken) : null;

  const canSaveLn = Boolean(parsePositiveInt(form.locationId) || editor?.mode === 'edit') && parseNonNegativeInt(form.priority) !== undefined;

  return (
    <div className="mt-4 space-y-6" data-testid="admin.cluster.network_detail.page">
      <ObjectHeader
        boxed
        testId="admin.cluster.network_detail.header"
        kicker={
          <span>
            <Link className="hover:underline" to="/admin/cluster/networks">
              {t('admin.cluster.networks.title')}
            </Link>
            {` · #${id}`}
          </span>
        }
        title={<span className="font-mono tabular-nums">{title}</span>}
        badges={
          <>
            <Badge variant={role.variant}>{role.label}</Badge>
            <Badge variant={purpose.variant}>{purpose.label}</Badge>
            <Badge variant={managed ? 'ok' : 'neutral'}>
              {managed ? t('admin.cluster.networks.managed.true') : t('admin.cluster.networks.managed.false')}
            </Badge>
          </>
        }
        meta={
          <span>
            {typeof net.label === 'string' && net.label.trim() ? (
              <span className="text-fg">{net.label.trim()}</span>
            ) : (
              <span className="text-muted">{t('admin.cluster.network_detail.meta.no_label')}</span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => lnQ.refetch()}>
              {t('common.refresh')}
            </Button>
            <Button variant="primary" onClick={openCreate} testId="admin.cluster.network_detail.add_location">
              {t('admin.cluster.network_detail.add_location')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <StatCard testId="admin.cluster.network_detail.stat.size" title={t('admin.cluster.network_detail.stat.size')} value={size ?? '—'} />
        <StatCard testId="admin.cluster.network_detail.stat.used" title={t('admin.cluster.network_detail.stat.used')} value={used ?? '—'} />
        <StatCard
          testId="admin.cluster.network_detail.stat.assigned"
          title={t('admin.cluster.network_detail.stat.assigned')}
          value={assigned ?? '—'}
        />
        <StatCard testId="admin.cluster.network_detail.stat.owned" title={t('admin.cluster.network_detail.stat.owned')} value={owned ?? '—'} />
        <StatCard testId="admin.cluster.network_detail.stat.taken" title={t('admin.cluster.network_detail.stat.taken')} value={taken ?? '—'} />
        <StatCard testId="admin.cluster.network_detail.stat.free" title={t('admin.cluster.network_detail.stat.free')} value={free ?? '—'} />
      </div>

      <Card testId="admin.cluster.network_detail.props">
        <CardHeader title={t('admin.cluster.network_detail.properties')} />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted">{t('admin.cluster.network_detail.field.ip_version')}</dt>
              <dd className="mt-1 font-mono text-xs text-fg tabular-nums">{String(net.ip_version ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">{t('admin.cluster.network_detail.field.split_prefix')}</dt>
              <dd className="mt-1 font-mono text-xs text-fg tabular-nums">{String(net.split_prefix ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">{t('admin.cluster.network_detail.field.split_access')}</dt>
              <dd className="mt-1 text-fg">{String(net.split_access ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">{t('admin.cluster.network_detail.field.primary_location')}</dt>
              <dd className="mt-1 text-fg">{locLabel((net as any).primary_location ?? null)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card testId="admin.cluster.network_detail.availability">
        <CardHeader title={t('admin.cluster.network_detail.availability.title')} subtitle={t('admin.cluster.network_detail.availability.subtitle')} />
        <CardBody className="space-y-3">
          {lnQ.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner label={t('common.loading')} />
            </div>
          ) : lnQ.isError ? (
            <ErrorState
              title={t('admin.cluster.network_detail.availability.error.title')}
              message={t('admin.cluster.network_detail.availability.error.body')}
              onRetry={() => lnQ.refetch()}
              testId="admin.cluster.network_detail.availability.error"
            />
          ) : sortedLns.length === 0 ? (
            <EmptyState
              title={t('admin.cluster.network_detail.availability.empty.title')}
              message={t('admin.cluster.network_detail.availability.empty.body')}
              testId="admin.cluster.network_detail.availability.empty"
            />
          ) : (
            <TableCard testId="admin.cluster.network_detail.availability.table" minWidth="lg">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.location')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.network_detail.col.primary')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('admin.cluster.network_detail.col.priority')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.network_detail.col.autopick')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.network_detail.col.userpick')}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedLns.map((ln) => {
                  const primary = Boolean(ln.primary);
                  const priority = typeof ln.priority === 'number' ? ln.priority : null;
                  const autopick = typeof ln.autopick === 'boolean' ? ln.autopick : undefined;
                  const userpick = typeof ln.userpick === 'boolean' ? ln.userpick : undefined;
                  const autoB = ynBadge(t, autopick);
                  const userB = ynBadge(t, userpick);

                  return (
                    <tr key={ln.id} data-testid={`admin.cluster.network_detail.ln.${ln.id}`}
                    >
                      <td className="px-3 py-2 text-fg">{locLabel((ln as any).location ?? null)}</td>
                      <td className="px-3 py-2">
                        {primary ? <Badge variant="ok">{t('admin.cluster.network_detail.badge.primary')}</Badge> : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted tabular-nums">{priority ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={autoB.variant}>{autoB.label}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={userB.variant}>{userB.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(ln)}
                            testId={`admin.cluster.network_detail.ln.${ln.id}.edit`}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteState({ open: true, ln })}
                            testId={`admin.cluster.network_detail.ln.${ln.id}.remove`}
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(editor)}
        title={editor?.mode === 'edit' ? t('admin.cluster.network_detail.editor.edit_title') : t('admin.cluster.network_detail.editor.add_title')}
        onClose={() => (busy ? null : setEditor(null))}
        testId="admin.cluster.network_detail.editor"
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
              disabled={!canSaveLn}
              testId="admin.cluster.network_detail.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {editor?.mode === 'create' ? (
            <div>
              <div className="text-xs font-semibold text-muted">{t('common.location')}</div>
              <div className="mt-1">
                <Select
                  testId="admin.cluster.network_detail.editor.location"
                  value={form.locationId}
                  onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                  options={locationOptions}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-semibold text-muted">{t('common.location')}</div>
              <div className="mt-1 text-fg">{locLabel((editor?.ln as any)?.location ?? null)}</div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-muted">{t('admin.cluster.network_detail.field.priority')}</div>
            <div className="mt-1 text-xs text-muted">{t('admin.cluster.network_detail.field.priority_desc')}</div>
            <div className="mt-2">
              <Input
                testId="admin.cluster.network_detail.editor.priority"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                inputMode="numeric"
                className="font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <SwitchRow
            testId="admin.cluster.network_detail.editor.primary"
            checked={form.primary}
            onChange={(v) => setForm((p) => ({ ...p, primary: v }))}
            label={t('admin.cluster.network_detail.field.primary')}
            description={t('admin.cluster.network_detail.field.primary_desc')}
          />

          <SwitchRow
            testId="admin.cluster.network_detail.editor.autopick"
            checked={form.autopick}
            onChange={(v) => setForm((p) => ({ ...p, autopick: v }))}
            label={t('admin.cluster.network_detail.field.autopick')}
            description={t('admin.cluster.network_detail.field.autopick_desc')}
          />

          <SwitchRow
            testId="admin.cluster.network_detail.editor.userpick"
            checked={form.userpick}
            onChange={(v) => setForm((p) => ({ ...p, userpick: v }))}
            label={t('admin.cluster.network_detail.field.userpick')}
            description={t('admin.cluster.network_detail.field.userpick_desc')}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteState.open}
        title={t('admin.cluster.network_detail.remove.title')}
        message={t('admin.cluster.network_detail.remove.body', {
          location: locLabel((deleteState.ln as any)?.location ?? null),
        })}
        onClose={() => (deleteM.isPending ? null : setDeleteState({ open: false }))}
        confirmLabel={t('common.remove')}
        onConfirm={() => deleteM.mutate()}
        loading={deleteM.isPending}
        testId="admin.cluster.network_detail.remove.confirm"
      />
    </div>
  );
}
