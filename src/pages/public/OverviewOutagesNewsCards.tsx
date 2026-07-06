import React from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../../app/i18n';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { StackedBar } from '../../components/ui/StackedBar';
import { StatusDot } from '../../components/ui/StatusDot';
import type { NewsLog, Outage } from '../../lib/api/public';
import { outageBadges } from '../../lib/outageBadges';
import { formatDateTime } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';
import { dotVariantFromBadgeVariant } from '../../lib/variantMap';
import type { PublicOutagesByCategory } from './OverviewModel';

function OutageSummary(props: { outage: Outage }) {
  const i18n = useI18n();
  const summary = pickTranslation(props.outage, 'summary', i18n.preferredLanguageCodes);
  const badges = outageBadges(props.outage, i18n.t);
  const dotVariant = dotVariantFromBadgeVariant(badges.primaryVariant);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <StatusDot variant={dotVariant} ariaLabel={badges.lifecycle.label} />
        <div className="font-medium">
          <Link to={`/outages/${props.outage.id}`} className="hover:underline">
            {summary ?? i18n.t('public.outage.fallback_title', { id: props.outage.id })}
          </Link>
        </div>
        <Badge variant={badges.lifecycle.variant}>{badges.lifecycle.label}</Badge>
      </div>
      <div className="text-xs text-muted">
        {i18n.t('public.outage.field.begins')}: {formatDateTime(props.outage.begins_at)}
        {props.outage.finished_at ? ` · ${i18n.t('public.outage.field.finished')}: ${formatDateTime(props.outage.finished_at)}` : null}
      </div>
    </div>
  );
}

function visibleOutages(groups: PublicOutagesByCategory): Outage[] {
  if (groups.current.length > 0) return groups.current.slice(0, 3);
  if (groups.planned.length > 0) return groups.planned.slice(0, 3);
  return groups.resolved.slice(0, 3);
}

export function OverviewOutagesNewsCards(props: {
  outages?: Outage[];
  outagesByCategory: PublicOutagesByCategory;
  outagesLoading: boolean;
  outagesError: boolean;
  news?: NewsLog[];
  newsLoading: boolean;
  newsError: boolean;
}) {
  const i18n = useI18n();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div data-testid="public.outages.card">
        <Card>
          <CardHeader
            title={i18n.t('public.overview.outages.title')}
            subtitle={i18n.t('public.overview.outages.subtitle', {
              current: props.outagesByCategory.current.length,
              planned: props.outagesByCategory.planned.length,
              resolved: props.outagesByCategory.resolved.length,
            })}
            actions={<Link to="/outages" className="text-sm underline">{i18n.t('public.overview.outages.all')}</Link>}
          />
          <CardBody>
            {props.outagesLoading ? (
              <Spinner label={i18n.t('public.overview.outages.loading')} />
            ) : props.outagesError ? (
              <Alert title={i18n.t('public.overview.outages.error')} variant="danger" />
            ) : (props.outages?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.overview.outages.empty')}</div>
            ) : (
              <div className="space-y-4">
                <StackedBar
                  ariaLabel={i18n.t('public.overview.outages.distribution_aria')}
                  segments={[
                    { value: props.outagesByCategory.current.length, variant: 'danger', title: i18n.t('public.overview.outages.segment.ongoing') },
                    { value: props.outagesByCategory.planned.length, variant: 'warn', title: i18n.t('public.overview.outages.segment.planned') },
                    { value: props.outagesByCategory.resolved.length, variant: 'ok', title: i18n.t('public.overview.outages.segment.resolved') },
                    { value: props.outagesByCategory.unknown.length, variant: 'neutral', title: i18n.t('public.overview.outages.segment.other') },
                  ]}
                />
                {visibleOutages(props.outagesByCategory).map((outage) => <OutageSummary key={outage.id} outage={outage} />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div data-testid="public.news.card">
        <Card>
          <CardHeader
            title={i18n.t('public.overview.news.title')}
            subtitle={i18n.t('public.overview.news.subtitle')}
            actions={<Link to="/news" className="text-sm underline">{i18n.t('public.overview.news.all')}</Link>}
          />
          <CardBody>
            {props.newsLoading ? (
              <Spinner label={i18n.t('public.overview.news.loading')} />
            ) : props.newsError ? (
              <Alert title={i18n.t('public.overview.news.error')} variant="danger" />
            ) : (props.news?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted">{i18n.t('public.overview.news.empty')}</div>
            ) : (
              <div className="space-y-3">
                {props.news?.slice(0, 5).map((news) => (
                  <div key={news.id} className="space-y-1">
                    <div className="text-xs text-muted">{formatDateTime(news.published_at)}</div>
                    <div className="whitespace-pre-wrap text-sm">{news.message}</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
