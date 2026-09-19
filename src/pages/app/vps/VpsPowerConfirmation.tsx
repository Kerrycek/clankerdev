import { useI18n } from '../../../app/i18n';

export function VpsConfirmTarget(props: {
  vpsId: number;
  objectLabel: string;
  testId: string;
}) {
  const { t } = useI18n();
  const idLabel = `#${props.vpsId}`;
  const objectLabel = props.objectLabel.trim() || idLabel;

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3" data-testid={props.testId}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {t('vps.power.confirm.target')}
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="min-w-0 break-all font-medium text-fg">{objectLabel}</span>
        {objectLabel === idLabel ? null : <span className="text-xs text-muted">{idLabel}</span>}
      </div>
    </div>
  );
}

export const VpsPowerConfirmTarget = VpsConfirmTarget;
