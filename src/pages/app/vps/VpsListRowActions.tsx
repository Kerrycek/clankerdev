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
  showLabels?: boolean;
}

const iconOnlyButtonClass = 'h-10 min-w-10 px-0';
const labeledButtonClass = 'min-h-11 px-3';
const iconClass = 'h-[18px] w-[18px] shrink-0';

function IconLabel(props: { children: React.ReactNode; visible?: boolean }) {
  return <span className={props.visible ? 'text-sm' : 'sr-only'}>{props.children}</span>;
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
  showLabels = false,
}: VpsListRowActionsProps) {
  const { vps } = row;
  const detailPath = `${basePath}/vps/${vps.id}`;
  const consolePath = `${detailPath}/console`;
  const buttonClass = showLabels ? labeledButtonClass : iconOnlyButtonClass;

  return (
    <div
      className={showLabels ? 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap' : 'flex flex-wrap items-center justify-end gap-2'}
      data-row-no-nav
    >
      {row.primaryAction === 'start' ? (
        <ActionButton
          variant="primary"
          size="sm"
          className={buttonClass}
          testId={`${testIdPrefix}.action.start`}
          disabled={!row.startGate.allowed}
          disabledReason={!row.startGate.allowed ? row.startGate.reason : undefined}
          loading={row.inFlightKind === 'start'}
          ariaLabel={t('vps.power.aria.start')}
          title={t('action.vps.start.label')}
          onClick={() => onStart(row)}
        >
          <Play className={iconClass} aria-hidden="true" />
          <IconLabel visible={showLabels}>{t('action.vps.start.label')}</IconLabel>
        </ActionButton>
      ) : row.primaryAction === 'console' ? (
        <Button
          to={consolePath}
          variant="primary"
          size="sm"
          className={buttonClass}
          testId={`${testIdPrefix}.action.console`}
          title={t('vps.tabs.console')}
          ariaLabel={t('vps.tabs.console')}
        >
          <Terminal className={iconClass} aria-hidden="true" />
          <IconLabel visible={showLabels}>{t('vps.tabs.console')}</IconLabel>
        </Button>
      ) : null}

      {row.vps.is_running === true ? (
        <ActionButton
          variant="secondary"
          size="sm"
          className={buttonClass}
          testId={`${testIdPrefix}.action.restart`}
          disabled={!row.restartGate.allowed}
          disabledReason={!row.restartGate.allowed ? row.restartGate.reason : undefined}
          loading={row.inFlightKind === 'restart'}
          ariaLabel={t('vps.power.aria.restart')}
          title={t('action.vps.restart.label')}
          onClick={() => onRequestRestart(row)}
        >
          <RotateCw className={iconClass} aria-hidden="true" />
          <IconLabel visible={showLabels}>{t('action.vps.restart.label')}</IconLabel>
        </ActionButton>
      ) : null}

      {row.vps.is_running === true ? (
        <ActionButton
          variant="secondary"
          size="sm"
          className={buttonClass}
          testId={`${testIdPrefix}.action.stop`}
          disabled={!row.stopGate.allowed}
          disabledReason={!row.stopGate.allowed ? row.stopGate.reason : undefined}
          loading={row.inFlightKind === 'stop'}
          ariaLabel={t('vps.power.aria.stop')}
          title={t('action.vps.stop.label')}
          onClick={() => onRequestStop(row)}
        >
          <Square className={iconClass} aria-hidden="true" />
          <IconLabel visible={showLabels}>{t('action.vps.stop.label')}</IconLabel>
        </ActionButton>
      ) : null}

      <Button
        to={detailPath}
        variant="secondary"
        size="sm"
        className={buttonClass}
        testId={`${testIdPrefix}.action.details`}
        title={t('common.detail')}
        ariaLabel={t('common.detail')}
      >
        <ExternalLink className={iconClass} aria-hidden="true" />
        <IconLabel visible={showLabels}>{t('common.detail')}</IconLabel>
      </Button>

      <ActionButton
        variant="danger"
        size="sm"
        className={buttonClass}
        testId={`${testIdPrefix}.action.delete`}
        disabled={!row.deleteGate.allowed}
        disabledReason={!row.deleteGate.allowed ? row.deleteGate.reason : undefined}
        loading={row.inFlightKind === 'delete'}
        ariaLabel={t('action.vps.delete.label')}
        title={t('action.vps.delete.label')}
        onClick={() => onRequestDelete(row)}
      >
        <Trash2 className={iconClass} aria-hidden="true" />
        <IconLabel visible={showLabels}>{t('action.vps.delete.label')}</IconLabel>
      </ActionButton>
    </div>
  );
}
