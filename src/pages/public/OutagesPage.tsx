import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { fetchOutages } from '../../lib/api/public';
import type { Outage } from '../../lib/api/public';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { clsx } from '../../components/ui/clsx';
import { StatusDot } from '../../components/ui/StatusDot';
import { categorizeOutage, sortOutagesNewestFirst } from '../../lib/outage';
import { outageBadges } from '../../lib/outageBadges';
import { dotVariantFromBadgeVariant } from '../../lib/variantMap';
import { formatDateTime, formatDurationMinutes } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';
import { useI18n } from '../../app/i18n';

const PUBLIC_OUTAGES_LIST_LIMIT = 100;

function OutageRow(props: { outage: Outage }) {
  const i18n = useI18n();
  const summary = pickTranslation(props.outage as any, 'summary', i18n.preferredLanguageCodes);
  const badges = outageBadges(props.outage, i18n.t);

  const dotVariant = dotVariantFromBadgeVariant(badges.primaryVariant);

  const tone =
    badges.primaryVariant === 'danger'
      ? 'border-danger-border bg-danger-row hover:ring-danger-border'
      : badges.primaryVariant === 'warn'
        ? 'border-warn-border bg-warn-row hover:ring-warn-border'
        : badges.primaryVariant === 'ok'
          ? 'border-ok-border bg-ok-row hover:ring-ok-border'
          : badges.primaryVariant === 'info'
            ? 'border-info-border bg-info-row hover:ring-info-border'
            : 'border-border bg-surface hover:bg-surface-2 hover:ring-border';

  return (
    <Link
      to={`/outages/${props.outage.id}`}
      className={clsx(
        'block rounded-lg border border-l-4 p-3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35',
        // For colored rows keep the RowTone background and add a subtle ring on hover.
        'hover:ring-1',
        tone
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot variant={dotVariant} ariaLabel={badges.lifecycle.label} />
            <div className="min-w-0 font-medium text-fg">
              {summary ?? i18n.t('public.outage.fallback_title', { id: props.outage.id })}
            </div>
          </div>

          <div className="mt-2 text-xs text-muted">
            {i18n.t('public.outage.field.begins')}: {formatDateTime(props.outage.begins_at)}
            {props.outage.duration != null
              ? ` · ${i18n.t('public.outage.field.duration')}: ${formatDurationMinutes(props.outage.duration as any)}`
              : ''}
            {props.outage.finished_at
              ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(props.outage.finished_at as any)}`
              : ''}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge>
          {badges.impact ? <Badge variant={badges.impact.variant}>{badges.impact.label}</Badge> : null}
          {badges.type ? <Badge variant={badges.type.variant}>{badges.type.label}</Badge> : null}
        </div>
      </div>
    </Link>
  );
}

export function OutagesPage() {
  const i18n = useI18n();
  const outagesQ = useQuery({
    queryKey: ['outages', 'index', { limit: PUBLIC_OUTAGES_LIST_LIMIT }],
    queryFn: async () => (await fetchOutages({ limit: PUBLIC_OUTAGES_LIST_LIMIT })).data,
  });

  const grouped = useMemo(() => {
    const list = (outagesQ.data ?? []).slice().sort(sortOutagesNewestFirst);
    const now = new Date();

    const current: Outage[] = [];
    const planned: Outage[] = [];
    const resolved: Outage[] = [];
    const unknown: Outage[] = [];

    for (const o of list) {
      switch (categorizeOutage(o, now)) {
        case 'current':
          current.push(o);
          break;
        case 'planned':
          planned.push(o);
          break;
        case 'resolved':
          resolved.push(o);
          break;
        default:
          unknown.push(o);
      }
    }

    return { current, planned, resolved, unknown };
  }, [outagesQ.data]);

  return (
    <div className="space-y-6" data-testid="public.outages.page">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('public.outages.title')}</h1>
        <p className="text-sm text-muted">{i18n.t('public.outages.subtitle')}</p>
      </div>

      {outagesQ.isLoading ? (
        <Spinner label={i18n.t('public.outages.loading')} />
      ) : outagesQ.isError ? (
        <Alert title={i18n.t('public.outages.error')} variant="danger" />
      ) : (outagesQ.data?.length ?? 0) === 0 ? (
        <Alert title={i18n.t('public.outages.empty.title')} variant="info">
          {i18n.t('public.outages.empty.body')}
        </Alert>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={i18n.t('public.outages.section.ongoing')}
              subtitle={i18n.tc('public.outages.section.count', grouped.current.length)}
            />
            <CardBody>
              {grouped.current.length === 0 ? (
                <div className="text-sm text-muted">{i18n.t('public.outages.section.none')}</div>
              ) : (
                <div className="space-y-2">
                  {grouped.current.map((o) => (
                    <OutageRow key={o.id} outage={o} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={i18n.t('public.outages.section.planned')}
              subtitle={i18n.tc('public.outages.section.count', grouped.planned.length)}
            />
            <CardBody>
              {grouped.planned.length === 0 ? (
                <div className="text-sm text-muted">{i18n.t('public.outages.section.none')}</div>
              ) : (
                <div className="space-y-2">
                  {grouped.planned.map((o) => (
                    <OutageRow key={o.id} outage={o} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={i18n.t('public.outages.section.resolved')}
              subtitle={i18n.tc('public.outages.section.count', grouped.resolved.length)}
            />
            <CardBody>
              {grouped.resolved.length === 0 ? (
                <div className="text-sm text-muted">{i18n.t('public.outages.section.none')}</div>
              ) : (
                <div className="space-y-2">
                  {grouped.resolved.map((o) => (
                    <OutageRow key={o.id} outage={o} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {grouped.unknown.length > 0 ? (
            <Card>
              <CardHeader
                title={i18n.t('public.outages.section.other')}
                subtitle={i18n.tc('public.outages.section.count', grouped.unknown.length)}
              />
              <CardBody>
                <div className="space-y-2">
                  {grouped.unknown.map((o) => (
                    <OutageRow key={o.id} outage={o} />
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}

      <div className="text-xs text-muted">
        {i18n.t('public.outages.footer.admin_hint')}
      </div>
    </div>
  );
}
