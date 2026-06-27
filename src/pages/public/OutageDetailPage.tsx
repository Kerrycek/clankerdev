import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import {
  fetchOutage,
  fetchOutageEntities,
  fetchOutageHandlers,
  fetchOutageUpdates,
} from '../../lib/api/public';
import type { OutageUpdate } from '../../lib/api/public';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { clsx } from '../../components/ui/clsx';
import { StatusDot } from '../../components/ui/StatusDot';
import { Spinner } from '../../components/ui/Spinner';
import { outageBadges, outageUpdateBadges } from '../../lib/outageBadges';
import { dotVariantFromBadgeVariant } from '../../lib/variantMap';
import { formatDateTime, formatDurationMinutes } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';
import { useI18n } from '../../app/i18n';

export function OutageDetailPage() {
  const i18n = useI18n();
  const params = useParams();
  const outageId = Number(params['outageId']);

  const outageQ = useQuery({
    queryKey: ['outages', 'show', outageId],
    queryFn: async () => (await fetchOutage(outageId)).data,
    enabled: Number.isFinite(outageId) && outageId > 0,
  });

  const entitiesQ = useQuery({
    queryKey: ['outages', outageId, 'entities'],
    queryFn: async () => (await fetchOutageEntities(outageId)).data,
    enabled: Number.isFinite(outageId) && outageId > 0,
  });

  const handlersQ = useQuery({
    queryKey: ['outages', outageId, 'handlers'],
    queryFn: async () => (await fetchOutageHandlers(outageId)).data,
    enabled: Number.isFinite(outageId) && outageId > 0,
  });

  const updatesQ = useQuery({
    queryKey: ['outage_updates', 'index', outageId],
    queryFn: async () => (await fetchOutageUpdates(outageId)).data,
    enabled: Number.isFinite(outageId) && outageId > 0,
  });

  const langs = i18n.preferredLanguageCodes;

  const updates = useMemo(() => {
    const list = (updatesQ.data ?? []).slice();
    list.sort((a: OutageUpdate, b: OutageUpdate) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
    return list;
  }, [updatesQ.data]);

  if (!Number.isFinite(outageId) || outageId <= 0) {
    return (
      <Alert title={i18n.t('public.outage_detail.invalid_id.title')} variant="danger">
        {i18n.t('public.outage_detail.invalid_id.body')}
      </Alert>
    );
  }

  if (outageQ.isLoading) {
    return <Spinner label={i18n.t('public.outage_detail.loading')} />;
  }

  if (outageQ.isError) {
    return <Alert title={i18n.t('public.outage_detail.error')} variant="danger" />;
  }

  const outage = outageQ.data;
  if (!outage) {
    return <Alert title={i18n.t('public.outage_detail.not_found')} variant="danger" />;
  }

  const summary =
    pickTranslation(outage as LegacyAny, 'summary', langs) ??
    i18n.t('public.outage.fallback_title', { id: outage.id });
  const description = pickTranslation(outage as LegacyAny, 'description', langs);
  const now = new Date();
  const badges = outageBadges(outage, i18n.t, now);
  const dotVariant = dotVariantFromBadgeVariant(badges.primaryVariant);

  return (
    <div className="space-y-6" data-testid="public.outage_detail.page">
      <div className="space-y-2">
        <div className="text-sm">
          <Link to="/outages" className="underline">← {i18n.t('public.outage_detail.back_to_outages')}</Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{summary}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusDot variant={dotVariant} ariaLabel={badges.lifecycle.label} />
          <Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge>
          {badges.impact ? <Badge variant={badges.impact.variant}>{badges.impact.label}</Badge> : null}
          {badges.type ? <Badge variant={badges.type.variant}>{badges.type.label}</Badge> : null}
          {outage.auto_resolve ? <Badge variant="neutral">{i18n.t('public.outage_detail.badge.auto_resolve')}</Badge> : null}
        </div>
        <div className="text-sm text-muted">
          {i18n.t('public.outage.field.begins')}: {formatDateTime(outage.begins_at)}
          {outage.duration != null
            ? ` · ${i18n.t('public.outage.field.duration')}: ${formatDurationMinutes(outage.duration as LegacyAny)}`
            : ''}
          {outage.finished_at
            ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(outage.finished_at as LegacyAny)}`
            : ''}
        </div>
      </div>

      {description ? (
        <Card>
          <CardHeader title={i18n.t('public.outage_detail.section.description')} />
          <CardBody>
            <div className="whitespace-pre-wrap text-sm">{description}</div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={i18n.t('public.outage_detail.section.affected_systems')}
            subtitle={i18n.t('public.outage_detail.section.affected_systems.subtitle')}
          />
          <CardBody>
            {entitiesQ.isLoading ? (
              <Spinner label={i18n.t('public.outage_detail.entities.loading')} />
            ) : entitiesQ.isError ? (
              <Alert title={i18n.t('public.outage_detail.entities.error')} variant="danger" />
            ) : (entitiesQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.outage_detail.entities.empty')}</div>
            ) : (
              <div className="space-y-2">
                {entitiesQ.data?.map((e) => (
                  <div key={e.id} className="text-sm">
                    <span className="font-medium">{e.name}</span>
                    {e.label ? <span className="text-muted"> · {e.label}</span> : null}
                    {e.entity_id != null ? (
                      <span className="text-muted"> · {i18n.t('public.outage_detail.entities.id', { id: String(e.entity_id) })}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={i18n.t('public.outage_detail.section.handlers')}
            subtitle={i18n.t('public.outage_detail.section.handlers.subtitle')}
          />
          <CardBody>
            {handlersQ.isLoading ? (
              <Spinner label={i18n.t('public.outage_detail.handlers.loading')} />
            ) : handlersQ.isError ? (
              <Alert title={i18n.t('public.outage_detail.handlers.error')} variant="danger" />
            ) : (handlersQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.outage_detail.handlers.empty')}</div>
            ) : (
              <div className="space-y-2">
                {handlersQ.data?.map((h) => (
                  <div key={h.id} className="text-sm">
                    <div className="font-medium">
                      {h.full_name ?? h.reporter_name ?? i18n.t('public.outage_detail.handlers.fallback', { id: h.id })}
                    </div>
                    {h.note ? <div className="text-muted">{h.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={i18n.t('public.outage_detail.section.updates')}
          subtitle={i18n.t('public.outage_detail.section.updates.subtitle')}
        />
        <CardBody>
          {updatesQ.isLoading ? (
            <Spinner label={i18n.t('public.outage_detail.updates.loading')} />
          ) : updatesQ.isError ? (
            <Alert title={i18n.t('public.outage_detail.updates.error')} variant="danger" />
          ) : updates.length === 0 ? (
            <div className="text-sm text-muted">{i18n.t('public.outage_detail.updates.empty')}</div>
          ) : (
            <div className="space-y-4">
              {updates.map((u) => {
                const uSummary = pickTranslation(u as LegacyAny, 'summary', langs);
                const uDescription = pickTranslation(u as LegacyAny, 'description', langs);

                const ub = outageUpdateBadges(u, i18n.t, now);
                const uDotVariant = dotVariantFromBadgeVariant(ub.primaryVariant);

                const tone =
                  ub.primaryVariant === 'danger'
                    ? 'border-danger-border bg-danger-row'
                    : ub.primaryVariant === 'warn'
                      ? 'border-warn-border bg-warn-row'
                      : ub.primaryVariant === 'ok'
                        ? 'border-ok-border bg-ok-row'
                        : ub.primaryVariant === 'info'
                          ? 'border-info-border bg-info-row'
                          : 'border-border bg-surface';

                return (
                  <div key={u.id} className={clsx('rounded-lg border border-l-4 p-3', tone)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusDot variant={uDotVariant} ariaLabel={ub.lifecycle.label} />
                      <div className="font-medium">
                        {uSummary ?? i18n.t('public.outage_detail.updates.update_fallback', { id: u.id })}
                      </div>
                      {u.state ? <Badge variant={ub.lifecycle.variant}>{ub.lifecycle.label}</Badge> : null}
                      {u.impact && ub.impact ? <Badge variant={ub.impact.variant}>{ub.impact.label}</Badge> : null}
                      {u.type && ub.type ? <Badge variant={ub.type.variant}>{ub.type.label}</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {i18n.t('public.outage_detail.updates.reported')}: {formatDateTime(u.created_at)}
                      {u.begins_at ? ` · ${i18n.t('public.outage.field.begins')}: ${formatDateTime(u.begins_at)}` : ''}
                      {u.duration != null
                        ? ` · ${i18n.t('public.outage.field.duration')}: ${formatDurationMinutes(u.duration as LegacyAny)}`
                        : ''}
                      {u.finished_at
                        ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(u.finished_at as LegacyAny)}`
                        : ''}
                    </div>
                    {uDescription ? (
                      <div className="mt-2 text-sm whitespace-pre-wrap">{uDescription}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
