import React from 'react';

import { useI18n } from '../../app/i18n';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { StackedBar } from '../../components/ui/StackedBar';
import { Table } from '../../components/ui/Table';
import type { PublicNodeLocationGroup, PublicNodeSummary } from './OverviewModel';

function NodeStatusBadge(props: { up: boolean }) {
  const i18n = useI18n();
  return props.up ? <Badge variant="ok">{i18n.t('state.up')}</Badge> : <Badge variant="danger">{i18n.t('state.down')}</Badge>;
}

function NodeGroupHeader(props: { group: PublicNodeLocationGroup }) {
  const i18n = useI18n();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="font-medium">{props.group.location}</div>
      <div className="flex items-center gap-3">
        <div className="w-24">
          <StackedBar
            ariaLabel={i18n.t('public.overview.nodes.location_bar_aria', { location: props.group.location })}
            segments={[
              { value: props.group.ok, variant: 'ok', title: i18n.t('state.up') },
              { value: props.group.down, variant: 'danger', title: i18n.t('state.down') },
            ]}
          />
        </div>
        <div className="text-xs text-muted">
          {i18n.t('public.overview.nodes.location_summary', {
            ok: props.group.ok,
            down: props.group.down,
            total: props.group.total,
          })}
        </div>
      </div>
    </div>
  );
}

function NodeMobileCards(props: { group: PublicNodeLocationGroup; open: boolean }) {
  const i18n = useI18n();

  return (
    <details className="rounded-lg border border-border bg-surface md:hidden" open={props.open}>
      <summary className="cursor-pointer select-none px-3 py-2"><NodeGroupHeader group={props.group} /></summary>
      <div className="space-y-2 p-3 pt-0">
        {props.group.nodes.map((node) => (
          <div key={node.name} className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{node.name}</div>
              <NodeStatusBadge up={node.status} />
            </div>
            <div className="mt-2 text-xs text-muted">
              {i18n.t('public.overview.nodes.vps')}: {typeof node.vps_count === 'number' ? node.vps_count : '—'}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function NodeDesktopTable(props: { group: PublicNodeLocationGroup }) {
  const i18n = useI18n();

  return (
    <div className="hidden space-y-2 md:block">
      <NodeGroupHeader group={props.group} />
      <div className="overflow-auto rounded-lg border border-border">
        <Table minWidth="md" testId={`public.nodes.table.${props.group.location}`}>
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.node')}</th>
              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.status')}</th>
              <th className="px-3 py-2 font-medium">{i18n.t('public.overview.nodes.table.vps')}</th>
            </tr>
          </thead>
          <tbody>
            {props.group.nodes.map((node) => (
              <tr key={node.name} className="border-t border-border" data-row-variant={node.status ? undefined : 'danger'}>
                <td className="px-3 py-2 font-medium">{node.name}</td>
                <td className="px-3 py-2"><NodeStatusBadge up={node.status} /></td>
                <td className="px-3 py-2 text-muted">
                  {typeof node.vps_count === 'number' ? node.vps_count : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export function OverviewNodesSection(props: {
  groups: PublicNodeLocationGroup[];
  summary: PublicNodeSummary;
  loading: boolean;
  error: boolean;
}) {
  const i18n = useI18n();

  return (
    <div data-testid="public.nodes.section">
      <Card>
        <CardHeader title={i18n.t('public.overview.nodes.title')} subtitle={i18n.t('public.overview.nodes.subtitle')} />
        <CardBody>
          {props.loading ? (
            <Spinner label={i18n.t('public.overview.nodes.loading')} />
          ) : props.error ? (
            <Alert title={i18n.t('public.overview.nodes.error')} variant="danger" />
          ) : props.groups.length === 0 ? (
            <div className="text-sm text-muted">{i18n.t('public.overview.nodes.empty')}</div>
          ) : (
            <div className="space-y-6">
              {props.groups.map((group, index) => {
                const openMobile = group.down > 0 || (props.summary.down === 0 && index === 0);
                return (
                  <div key={group.location} className="space-y-2">
                    <NodeMobileCards group={group} open={openMobile} />
                    <NodeDesktopTable group={group} />
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
