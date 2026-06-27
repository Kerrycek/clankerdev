import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { PageContainer } from '../../../components/layout/PageContainer';
import { fetchVps } from '../../../lib/api/vps';
import {
  createOomReportRule,
  deleteOomReportRule,
  fetchOomReportRules,
  updateOomReportRule,
  type OomReportRule,
} from '../../../lib/api/oom';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';
import { Select } from '../../../components/ui/Select';

function safeNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

function ruleVariant(action?: string): 'neutral' | 'warn' {
  if (action === 'ignore') return 'neutral';
  return 'warn';
}

function ruleLabelKey(action?: string): string {
  if (action === 'ignore') return 'oom.rule.ignore';
  if (action === 'notify') return 'oom.rule.notify';
  return 'oom.rule.implicit';
}

export function OomReportRulesPage() {
  const { vpsId: vpsIdParam } = useParams();
  const vpsId = safeNumber(vpsIdParam ?? '') as number | undefined;

  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();

  const [createAction, setCreateAction] = useState<'notify' | 'ignore'>('notify');
  const [createPattern, setCreatePattern] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAction, setEditAction] = useState<'notify' | 'ignore'>('notify');
  const [editPattern, setEditPattern] = useState('');

  const [deleteCandidate, setDeleteCandidate] = useState<OomReportRule | null>(null);

  const vpsQ = useQuery({
    queryKey: ['vps', 'show', vpsId, { scope: basePath }],
    queryFn: async () => (await fetchVps(vpsId as number, { includes: 'user,node' })).data,
    enabled: Boolean(vpsId),
  });

  const rulesQ = useQuery({
    queryKey: ['oom_report_rules', 'index', { vpsId, scope: basePath }],
    queryFn: async () => (await fetchOomReportRules({ vpsId: vpsId as number, limit: 200 })).data,
    enabled: Boolean(vpsId),
  });

  const createM = useMutation({
    mutationFn: async () => {
      if (!vpsId) throw new Error(t('oom.rules.invalid_id'));
      const pat = createPattern.trim();
      if (!pat) throw new Error(t('oom.rules.error.pattern_required'));
      return createOomReportRule({ vpsId, action: createAction, cgroupPattern: pat });
    },
    onSuccess: async () => {
      setCreatePattern('');
      await qc.invalidateQueries({ queryKey: ['oom_report_rules', 'index'] });
      pushToast({ variant: 'ok', title: t('oom.rules.create.success.title'), body: t('oom.rules.create.success.body') });
    },
    onError: (err) => {
      pushToast({
        variant: 'danger',
        title: t('oom.rules.create.error.title'),
        body: err instanceof Error ? err.message : t('oom.rules.create.error.generic'),
      });
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error(t('oom.rules.invalid_id'));
      const pat = editPattern.trim();
      if (!pat) throw new Error(t('oom.rules.error.pattern_required'));
      return updateOomReportRule(editingId, { action: editAction, cgroupPattern: pat });
    },
    onSuccess: async () => {
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['oom_report_rules', 'index'] });
      pushToast({ variant: 'ok', title: t('oom.rules.update.success.title'), body: t('oom.rules.update.success.body') });
    },
    onError: (err) => {
      pushToast({
        variant: 'danger',
        title: t('oom.rules.update.error.title'),
        body: err instanceof Error ? err.message : t('oom.rules.update.error.generic'),
      });
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      if (!deleteCandidate) throw new Error(t('oom.rules.invalid_id'));
      await deleteOomReportRule(deleteCandidate.id);
    },
    onSuccess: async () => {
      setDeleteCandidate(null);
      await qc.invalidateQueries({ queryKey: ['oom_report_rules', 'index'] });
      pushToast({ variant: 'ok', title: t('oom.rules.delete.success.title'), body: t('oom.rules.delete.success.body') });
    },
    onError: (err) => {
      pushToast({
        variant: 'danger',
        title: t('oom.rules.delete.error.title'),
        body: err instanceof Error ? err.message : t('oom.rules.delete.error.generic'),
      });
    },
  });

  const vpsHost = useMemo(() => {
    const v = vpsQ.data as LegacyAny;
    if (!v) return undefined;
    return v.hostname ? String(v.hostname) : `#${v.id}`;
  }, [vpsQ.data]);

  if (!vpsId) {
    return (
      <PageContainer testId="oom.rules.invalid">
        <ErrorState title={t('oom.rules.invalid_id')} body={t('error.not_found.body')} showBack />
      </PageContainer>
    );
  }

  if (vpsQ.isLoading || rulesQ.isLoading) {
    return (
      <PageContainer testId="oom.rules.loading">
        <LoadingState />
      </PageContainer>
    );
  }

  if (vpsQ.isError || rulesQ.isError) {
    return (
      <PageContainer testId="oom.rules.error">
        <ErrorState
          title={t('oom.rules.load_error')}
          error={vpsQ.error || rulesQ.error}
          onRetry={() => {
            void vpsQ.refetch();
            void rulesQ.refetch();
          }}
          showBack
        />
      </PageContainer>
    );
  }

  const rules = rulesQ.data ?? [];

  return (
    <PageContainer testId="oom.rules">
      <ObjectHeader
        kicker={{ label: t('oom.list.title'), href: `${basePath}/oom-reports` }}
        title={t('oom.rules.title', { vps: vpsHost ?? `#${vpsId}` })}
        actions={
          <Button variant="secondary" size="sm" to={`${basePath}/vps/${vpsId}`}>
            {t('common.open_vps')}
          </Button>
        }
        testId="oom.rules.header"
      />

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Card testId="oom.rules.create">
          <CardHeader title={t('oom.rules.create.title')} subtitle={t('oom.rules.create.subtitle')} />
          <CardBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs text-muted">{t('oom.rules.field.action')}</label>
                <Select
                  value={createAction}
                  onChange={(e) => setCreateAction(e.target.value as LegacyAny)}
                  options={[
                    { value: 'notify', label: t(ruleLabelKey('notify')) },
                    { value: 'ignore', label: t(ruleLabelKey('ignore')) },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted">{t('oom.rules.field.cgroup_pattern')}</label>
                <Input
                  value={createPattern}
                  onChange={(e) => setCreatePattern(e.target.value)}
                  placeholder={t('oom.rules.field.cgroup_pattern_placeholder')}
                  autoComplete="off"
                />
                <div className="mt-1 text-xs text-faint">{t('oom.rules.field.cgroup_pattern_help')}</div>
              </div>
            </div>

            <div className="mt-4">
              <Button disabled={createM.isPending} onClick={() => createM.mutate()} testId="oom.rules.create.submit">
                {createM.isPending ? t('common.saving') : t('oom.rules.create.submit')}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card testId="oom.rules.list">
          <CardHeader title={t('oom.rules.list.title')} subtitle={t('oom.rules.list.subtitle')} />
          <CardBody>
            {rules.length === 0 ? (
              <div className="text-sm text-muted">{t('oom.rules.list.empty')}</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="min-w-full text-sm" data-testid="oom.rules.table">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('common.id')}</th>
                      <th className="px-4 py-2">{t('oom.rules.field.action')}</th>
                      <th className="px-4 py-2">{t('oom.rules.field.cgroup_pattern')}</th>
                      <th className="px-4 py-2">{t('oom.rules.field.hit_count')}</th>
                      <th className="px-4 py-2 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => {
                      const action = rule.action ? String(rule.action) : undefined;
                      const isEditing = editingId === rule.id;

                      return (
                        <tr key={rule.id} className="border-b border-border/50 last:border-b-0">
                          <td className="px-4 py-2 font-mono text-xs">{rule.id}</td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <Select
                                value={editAction}
                                onChange={(e) => setEditAction(e.target.value as LegacyAny)}
                                options={[
                                  { value: 'notify', label: t(ruleLabelKey('notify')) },
                                  { value: 'ignore', label: t(ruleLabelKey('ignore')) },
                                ]}
                              />
                            ) : (
                              <Badge variant={ruleVariant(action)}>{t(ruleLabelKey(action))}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <Input value={editPattern} onChange={(e) => setEditPattern(e.target.value)} />
                            ) : (
                              <span className="font-mono text-xs">{rule.cgroup_pattern ? String(rule.cgroup_pattern) : '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{typeof rule.hit_count === 'number' ? rule.hit_count : '—'}</td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  disabled={updateM.isPending}
                                  onClick={() => updateM.mutate()}
                                  testId={`oom.rules.row.${rule.id}.save`}
                                >
                                  {t('common.save')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={updateM.isPending}
                                  onClick={() => setEditingId(null)}
                                  testId={`oom.rules.row.${rule.id}.cancel`}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(rule.id);
                                    setEditAction((rule.action as LegacyAny) || 'notify');
                                    setEditPattern(rule.cgroup_pattern ? String(rule.cgroup_pattern) : '');
                                  }}
                                  testId={`oom.rules.row.${rule.id}.edit`}
                                >
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => setDeleteCandidate(rule)}
                                  testId={`oom.rules.row.${rule.id}.delete`}
                                >
                                  {t('common.delete')}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        title={t('oom.rules.delete.title')}
        open={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        testId="oom.rules.delete.modal"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('oom.rules.delete.body')}</p>

          {deleteCandidate ? (
            <div className="rounded-md bg-surface-2 p-3 text-sm">
              <div className="font-mono text-xs">#{deleteCandidate.id}</div>
              <div className="mt-1">
                <Badge variant={ruleVariant(deleteCandidate.action)}>{t(ruleLabelKey(deleteCandidate.action))}</Badge>
              </div>
              <div className="mt-1 font-mono text-xs">{deleteCandidate.cgroup_pattern ? String(deleteCandidate.cgroup_pattern) : '—'}</div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteCandidate(null)} disabled={deleteM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => deleteM.mutate()} disabled={deleteM.isPending}>
              {deleteM.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
