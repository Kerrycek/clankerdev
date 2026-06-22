import React from 'react';
import { ExternalLink, Play, RotateCw, Square, Terminal, Trash2 } from 'lucide-react';

import { ActionButton } from '../../../components/ui/ActionButton';
import { Button } from '../../../components/ui/Button';

import type { VpsListRecord, VpsListTranslator } from './vpsListSemantics';

interface VpsListRowActionsProps {
  row: VpsListRecord;
  basePath: string;
  t: VpsListTranslator;
  testIdPrefix: string;
  onStart: (row: VpsListRecord) => void;
  onRequestStop: (row: VpsListRecord) => void;
  onRequestRestart: (row: VpsListRecord) => void;
  onRequestDelete: (row: VpsListRecord) => void;
}

const iconButtonClass = 'h-8 w-8 px-0';
const iconClass = 'h-4 w-4';

function IconLabel(props: { children: React.ReactNode }) {
  return <span className="sr-only">{props.children}</span>;
}

export function VpsListRowActions({
  row,
  basePath,
  t,
  testIdPrefix,
  onStart,
  onRequestStop,
  onRequestRestart,
  onRequestDelete,
}: VpsListRowActionsProps) {
  const { vps } = row;
  const detailPath = `${basePath}/vps/${vps.id}`;
  const consolePath = `${detailPath}/console`;

  return (
    <div className="flex flex-nowrap items-center gap-1" data-row-no-nav>
      {row.primaryAction === 'start' ? (
        <ActionButton
          variant="primary"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.action.start`}
          disabled={!row.startGate.allowed}
          disabledReason={!row.startGate.allowed ? row.startGate.reason : undefined}
          loading={row.inFlightKind === 'start'}
          ariaLabel={t('vps.power.aria.start')}
          title={t('action.vps.start.label')}
          onClick={() => onStart(row)}
        >
          <Play className={iconClass} aria-hidden="true" />
          <IconLabel>{t('action.vps.start.label')}</IconLabel>
        </ActionButton>
      ) : row.primaryAction === 'console' ? (
        <Button
          to={consolePath}
          variant="primary"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.action.console`}
          title={t('vps.tabs.console')}
          ariaLabel={t('vps.tabs.console')}
        >
          <Terminal className={iconClass} aria-hidden="true" />
          <IconLabel>{t('vps.tabs.console')}</IconLabel>
        </Button>
      ) : null}

      {row.vps.is_running === true ? (
        <ActionButton
          variant="secondary"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.action.restart`}
          disabled={!row.restartGate.allowed}
          disabledReason={!row.restartGate.allowed ? row.restartGate.reason : undefined}
          loading={row.inFlightKind === 'restart'}
          ariaLabel={t('vps.power.aria.restart')}
          title={t('action.vps.restart.label')}
          onClick={() => onRequestRestart(row)}
        >
          <RotateCw className={iconClass} aria-hidden="true" />
          <IconLabel>{t('action.vps.restart.label')}</IconLabel>
        </ActionButton>
      ) : null}

      {row.vps.is_running === true ? (
        <ActionButton
          variant="secondary"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.action.stop`}
          disabled={!row.stopGate.allowed}
          disabledReason={!row.stopGate.allowed ? row.stopGate.reason : undefined}
          loading={row.inFlightKind === 'stop'}
          ariaLabel={t('vps.power.aria.stop')}
          title={t('action.vps.stop.label')}
          onClick={() => onRequestStop(row)}
        >
          <Square className={iconClass} aria-hidden="true" />
          <IconLabel>{t('action.vps.stop.label')}</IconLabel>
        </ActionButton>
      ) : null}

      <Button
        to={detailPath}
        variant="secondary"
        size="sm"
        className={iconButtonClass}
        testId={`${testIdPrefix}.action.details`}
        title={t('common.detail')}
        ariaLabel={t('common.detail')}
      >
        <ExternalLink className={iconClass} aria-hidden="true" />
        <IconLabel>{t('common.detail')}</IconLabel>
      </Button>

      <ActionButton
        variant="danger"
        size="sm"
        className={iconButtonClass}
        testId={`${testIdPrefix}.action.delete`}
        disabled={!row.deleteGate.allowed}
        disabledReason={!row.deleteGate.allowed ? row.deleteGate.reason : undefined}
        loading={row.inFlightKind === 'delete'}
        ariaLabel={t('action.vps.delete.label')}
        title={t('action.vps.delete.label')}
        onClick={() => onRequestDelete(row)}
      >
        <Trash2 className={iconClass} aria-hidden="true" />
        <IconLabel>{t('action.vps.delete.label')}</IconLabel>
      </ActionButton>
    </div>
  );
}
