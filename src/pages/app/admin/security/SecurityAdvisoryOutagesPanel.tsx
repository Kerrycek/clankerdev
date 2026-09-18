import { Link2 } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { TableCard } from '../../../../components/ui/TableCard';
import type { SecurityAdvisoryOutageLink } from '../../../../lib/api/securityAdvisories';
import { formatErrorMessage } from '../../../../lib/errors';
import { formatDateTime } from '../../../../lib/format';
import { pickLocalizedField } from '../../../../lib/translations';
import { resourceId, resourceLabel } from './securityAdvisoryAdminModel';
import { securityAdvisoryOutageObject } from './securityAdvisoryDetailViewModel';

function MobileCellLabel(props: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-faint @4xl:hidden">{props.children}</span>;
}

export function SecurityAdvisoryOutagesPanel(props: {
  links: SecurityAdvisoryOutageLink[];
  outageId: string;
  loading: boolean;
  linking: boolean;
  error?: unknown;
  onOutageIdChange: (value: string) => void;
  onLink: () => void;
  onUnlink: (link: SecurityAdvisoryOutageLink) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <div className="space-y-4">
      <Card className="@container">
        <CardHeader
          title={t('admin.security_advisories.outages.link_title')}
          subtitle={t('admin.security_advisories.outages.link_subtitle')}
        />
        <CardBody>
          <div className="flex max-w-lg flex-col gap-2 sm:flex-row">
            <Input
              value={props.outageId}
              onChange={(event) => props.onOutageIdChange(event.target.value)}
              inputMode="numeric"
              placeholder={t('admin.security_advisories.outages.id_placeholder')}
              testId="admin.security_advisory.outages.id"
            />
            <Button
              variant="primary"
              className="min-h-11 whitespace-nowrap @4xl:min-h-9"
              onClick={props.onLink}
              loading={props.linking}
              disabled={!props.outageId.trim()}
            >
              <Link2 size={16} /> {t('admin.security_advisories.action.link_outage')}
            </Button>
          </div>
        </CardBody>
      </Card>

      {props.loading ? <LoadingState /> : props.error ? (
        <Alert variant="danger" title={t('common.error')}>{formatErrorMessage(props.error)}</Alert>
      ) : props.links.length === 0 ? (
        <Alert variant="neutral" title={t('admin.security_advisories.outages.empty')} />
      ) : (
        <TableCard
          className="@container"
          testId="admin.security_advisories.outages.table"
          tableClassName="block @4xl:table @4xl:min-w-table-lg"
        >
          <thead className="hidden @4xl:table-header-group">
            <tr>
              <th>{t('admin.security_advisories.outages.outage')}</th>
              <th>{t('admin.security_advisories.outages.begins_at')}</th>
              <th>{t('admin.security_advisories.outages.summary')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="block @4xl:table-row-group">
            {props.links.map((link) => {
              const outage = securityAdvisoryOutageObject(link);
              const id = resourceId(link.outage, link.outage_id);
              const summary = outage
                ? pickLocalizedField(outage, 'summary', i18n.preferredLanguageCodes)
                : undefined;
              return (
                <tr
                  key={link.id}
                  className="table-row-tone block border-b border-border last:border-b-0 @4xl:table-row @4xl:border-0"
                  data-testid={`admin.security_advisories.outages.row.${link.id}`}
                >
                  <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:p-0">
                    <MobileCellLabel>{t('admin.security_advisories.outages.outage')}</MobileCellLabel>
                    {id ? (
                      <Link
                        to={`/admin/outages/${id}`}
                        className="inline-flex min-h-11 min-w-0 items-center break-words font-medium text-accent hover:underline @4xl:min-h-0"
                      >
                        #{id}
                      </Link>
                    ) : (
                      <span className="min-w-0 break-words">{resourceLabel(link.outage)}</span>
                    )}
                  </td>
                  <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:p-0">
                    <MobileCellLabel>{t('admin.security_advisories.outages.begins_at')}</MobileCellLabel>
                    <span className="min-w-0 break-words">
                      {outage?.['begins_at'] ? formatDateTime(String(outage['begins_at'])) : '—'}
                    </span>
                  </td>
                  <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:p-0">
                    <MobileCellLabel>{t('admin.security_advisories.outages.summary')}</MobileCellLabel>
                    <span className="min-w-0 break-words">{summary ?? '—'}</span>
                  </td>
                  <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:p-0 @4xl:text-right">
                    <MobileCellLabel>{t('common.actions')}</MobileCellLabel>
                    <Button
                      size="sm"
                      variant="danger"
                      className="min-h-11 w-full whitespace-nowrap @4xl:min-h-8 @4xl:w-auto"
                      onClick={() => props.onUnlink(link)}
                      testId={`admin.security_advisories.outages.row.${link.id}.unlink`}
                    >
                      {t('admin.security_advisories.action.unlink')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
