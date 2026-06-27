import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useChrome } from '../../../components/layout/ChromeContext';
import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { PageContainer } from '../../../components/layout/PageContainer';
import { fetchVps, type Vps } from '../../../lib/api/vps';
import { createIncidentReport, fetchIpAddressAssignments, type IpAddressAssignment } from '../../../lib/api/incidents';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { objectRef } from '../../../lib/objectRef';

import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';

function safeNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

export function toIsoOrUndefined(dtLocal: string): string | undefined {
  const t = dtLocal.trim();
  if (!t) return undefined;

  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return undefined;

  return d.toISOString();
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function assignmentLabel(a: IpAddressAssignment): string {
  const ip = a.ip_addr ? String(a.ip_addr) : '';
  const p = typeof a.ip_prefix === 'number' ? `/${a.ip_prefix}` : '';
  if (ip) return `${ip}${p}`;
  return `#${a.id}`;
}

export function IncidentReportNewPage() {
  const { mode, basePath } = useAppMode();
  const { t } = useI18n();
  const chrome = useChrome();
  const { pushToast } = useToasts();
  const nav = useNavigate();

  const [sp] = useSearchParams();

  const [vps, setVps] = useState(() => sp.get('vps') ?? '');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [codename, setCodename] = useState('');
  const [detectedAt, setDetectedAt] = useState(() => nowDatetimeLocal());
  const [cpuLimit, setCpuLimit] = useState('');
  const [vpsAction, setVpsAction] = useState('none');
  const [ipAssignment, setIpAssignment] = useState('');

  useEffect(() => {
    const prefill = sp.get('vps');
    if (prefill) setVps(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const vpsId = useMemo(() => safeNumber(vps), [vps]);

  const vpsQ = useQuery({
    queryKey: ['vps', 'show', vpsId, { scope: basePath }],
    queryFn: async () => (await fetchVps(vpsId as number, { includes: 'node,user' })).data,
    enabled: mode === 'admin' && Boolean(vpsId),
  });

  const assignmentsQ = useQuery({
    queryKey: ['ip_address_assignments', 'index', { vpsId, scope: basePath }],
    queryFn: async () => (await fetchIpAddressAssignments({ vpsId: vpsId as number, active: true, limit: 200 })).data,
    enabled: mode === 'admin' && Boolean(vpsId),
  });

  const assignmentOptions = useMemo(() => {
    const list = assignmentsQ.data ?? [];
    const opts = [{ value: '', label: t('incidents.new.assignment.none') }];
    for (const a of list) {
      opts.push({ value: String(a.id), label: assignmentLabel(a) });
    }
    return opts;
  }, [assignmentsQ.data, t]);

  const vpsSummary = useMemo(() => {
    const v = vpsQ.data as Vps | undefined;
    if (!v) return null;
    const host = (v as LegacyAny).hostname ? String((v as LegacyAny).hostname) : `#${v.id}`;
    const nodeName = (v as LegacyAny)?.node?.domain_name ? String((v as LegacyAny).node.domain_name) : undefined;
    const userLogin = (v as LegacyAny)?.user?.login ? String((v as LegacyAny).user.login) : undefined;

    return (
      <div className="text-sm text-muted">
        <span className="font-medium text-text">{host}</span>
        {userLogin ? (
          <span className="ml-2">
            · {t('common.user')}: {userLogin}
          </span>
        ) : null}
        {nodeName ? (
          <span className="ml-2">
            · {t('common.node')}: {nodeName}
          </span>
        ) : null}
      </div>
    );
  }, [t, vpsQ.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vpsId) throw new Error(t('incidents.new.error.vps_required'));
      if (!subject.trim()) throw new Error(t('incidents.new.error.subject_required'));
      if (!text.trim()) throw new Error(t('incidents.new.error.text_required'));

      const cpu = cpuLimit.trim() ? Number(cpuLimit) : undefined;
      const cpuNumber = cpu !== undefined && Number.isFinite(cpu) ? cpu : undefined;

      const ipAssignId = ipAssignment.trim() ? safeNumber(ipAssignment) : undefined;

      return createIncidentReport({
        vpsId,
        subject: subject.trim(),
        text: text.trim(),
        codename: codename.trim() || undefined,
        detectedAtIso: toIsoOrUndefined(detectedAt),
        ipAddressAssignmentId: ipAssignId,
        cpuLimit: cpuNumber,
        vpsAction,
      });
    },
    onMutate: () => {
      if (!vpsId) return {};
      const ref = objectRef('Vps', vpsId);
      chrome.acquireLocalLock(ref);
      return { lockRef: ref };
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if ((ctx as LegacyAny)?.lockRef) chrome.releaseLocalLock((ctx as LegacyAny).lockRef);
    },
    onSuccess: (res) => {
      const asId = getMetaActionStateId(res.meta);
      if (asId) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.incident_report.create.label',
          objectLabel: vpsId ? `#${vpsId}` : undefined,
          object: vpsId ? objectRef('Vps', vpsId) : undefined,
        });
      }

      pushToast({ variant: 'ok', title: t('incidents.new.success.title'), body: t('incidents.new.success.body') });

      // Back to VPS dossier (parity with legacy UI).
      nav(`${basePath}/vps/${vpsId}`);
    },
    onError: (err) => {
      pushToast({
        variant: 'danger',
        title: t('incidents.new.error.title'),
        body: err instanceof Error ? err.message : t('incidents.new.error.generic'),
      });
    },
  });

  if (mode !== 'admin') {
    return (
      <PageContainer testId="incidents.new.forbidden">
        <ErrorState kindOverride="forbidden" showBack />
      </PageContainer>
    );
  }

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" to={`${basePath}/incidents`}>
        {t('common.back_to_list')}
      </Button>
    </div>
  );

  return (
    <PageContainer testId="incidents.new">
      <ObjectHeader
        kicker={{ label: t('incidents.list.title'), href: `${basePath}/incidents` }}
        title={t('incidents.new.title')}
        meta={vpsSummary}
        actions={actions}
        testId="incidents.new.header"
      />

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Card>
          <CardHeader title={t('incidents.new.form.title')} subtitle={t('incidents.new.form.subtitle')} />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-muted">{t('incidents.new.vps')}</label>
                <Input
                  value={vps}
                  onChange={(e) => setVps(e.target.value)}
                  placeholder={t('incidents.new.vps_placeholder')}
                  autoComplete="off"
                  testId="incidents.new.vps"
                />
                {vpsId && vpsQ.isLoading ? (
                  <div className="mt-2">
                    <LoadingState />
                  </div>
                ) : null}
                {vpsId && vpsQ.isError ? (
                  <div className="mt-2 text-xs text-danger">{t('incidents.new.error.vps_not_found')}</div>
                ) : null}
              </div>

              <div>
                <label className="block text-xs text-muted">{t('incidents.new.assignment')}</label>
                <Select value={ipAssignment} onChange={(e) => setIpAssignment(e.target.value)} options={assignmentOptions} />
                <div className="mt-1 text-xs text-faint">{t('incidents.new.assignment.help')}</div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted">{t('incidents.new.subject')}</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('incidents.new.subject_placeholder')}
                  autoComplete="off"
                  testId="incidents.new.subject"
                />
              </div>

              <div>
                <label className="block text-xs text-muted">{t('incidents.new.codename')}</label>
                <Input
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder={t('incidents.new.codename_placeholder')}
                  autoComplete="off"
                  testId="incidents.new.codename"
                />
                <div className="mt-1 text-xs text-faint">{t('incidents.new.codename.help')}</div>
              </div>

              <div>
                <label className="block text-xs text-muted">{t('incidents.new.detected_at')}</label>
                <Input
                  type="datetime-local"
                  value={detectedAt}
                  onChange={(e) => setDetectedAt(e.target.value)}
                  testId="incidents.new.detected_at"
                />
              </div>

              <div>
                <label className="block text-xs text-muted">{t('incidents.new.cpu_limit')}</label>
                <Input
                  type="number"
                  value={cpuLimit}
                  onChange={(e) => setCpuLimit(e.target.value)}
                  placeholder={t('incidents.new.cpu_limit_placeholder')}
                  testId="incidents.new.cpu_limit"
                />
                <div className="mt-1 text-xs text-faint">{t('incidents.new.cpu_limit.help')}</div>
              </div>

              <div>
                <label className="block text-xs text-muted">{t('incidents.new.vps_action')}</label>
                <Select
                  value={vpsAction}
                  onChange={(e) => setVpsAction(e.target.value)}
                  options={[
                    { value: 'none', label: t('incidents.action.none') },
                    { value: 'stop', label: t('incidents.action.stop') },
                    { value: 'suspend', label: t('incidents.action.suspend') },
                    { value: 'disable_network', label: t('incidents.action.disable_network') },
                  ]}
                />
                <div className="mt-1 text-xs text-faint">{t('incidents.new.vps_action.help')}</div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted">{t('incidents.new.text')}</label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('incidents.new.text_placeholder')}
                  rows={10}
                  testId="incidents.new.text"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} testId="incidents.new.submit">
                {mutation.isPending ? t('common.saving') : t('incidents.new.submit')}
              </Button>
              <Button variant="secondary" disabled={mutation.isPending} to={`${basePath}/incidents`}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
