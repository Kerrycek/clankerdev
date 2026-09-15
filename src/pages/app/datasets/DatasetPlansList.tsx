import { useI18n } from '../../../app/i18n';
import type { DatasetInPoolPlan } from '../../../lib/api/datasets';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { TableCard } from '../../../components/ui/TableCard';

export type DatasetPlanListItem = {
  plan: DatasetInPoolPlan;
  label: string;
  source: string;
  description: string;
  userCanAdd: boolean;
  userCanRemove: boolean;
  removable: boolean;
};

type Props = {
  items: DatasetPlanListItem[];
  busy: boolean;
  onRemove: (plan: DatasetInPoolPlan) => void;
};

function PermissionBadges({ item }: { item: DatasetPlanListItem }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={item.userCanAdd ? 'ok' : 'neutral'}>
        {t(item.userCanAdd ? 'dataset.plans.permission.user_add' : 'dataset.plans.permission.user_add_off')}
      </Badge>
      <Badge variant={item.userCanRemove ? 'ok' : 'neutral'}>
        {t(item.userCanRemove ? 'dataset.plans.permission.user_remove' : 'dataset.plans.permission.user_remove_off')}
      </Badge>
    </div>
  );
}

export function DatasetPlansList({ items, busy, onRemove }: Props) {
  const { t } = useI18n();

  return (
    <div className="@container" data-testid="dataset.plans.list">
      <div className="space-y-3 @4xl:hidden" data-testid="dataset.plans.cards">
        {items.map((item) => (
          <Card key={item.plan.id} testId={`dataset.plans.card.${item.plan.id}`}>
            <div className="min-w-0 p-4">
              <div className="break-words text-base font-semibold text-fg">{item.label}</div>
              <div
                className="mt-1 break-all text-xs text-faint"
                data-testid={`dataset.plans.card.${item.plan.id}.source`}
              >
                {t('dataset.plans.column.source')}: {item.source}
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium uppercase tracking-wide text-faint">
                  {t('dataset.plans.column.description')}
                </div>
                <div
                  className="mt-1 whitespace-pre-wrap break-words text-sm text-muted"
                  data-testid={`dataset.plans.card.${item.plan.id}.description`}
                >
                  {item.description}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                  {t('dataset.plans.column.permissions')}
                </div>
                <PermissionBadges item={item} />
              </div>

              <div className="mt-4 border-t border-border pt-3">
                {item.removable ? (
                  <Button
                    testId={`dataset.plans.card.${item.plan.id}.remove`}
                    variant="danger"
                    size="lg"
                    className="w-full"
                    ariaLabel={`${t('common.remove')}: ${item.label}`}
                    onClick={() => onRemove(item.plan)}
                    disabled={busy}
                  >
                    {t('common.remove')}
                  </Button>
                ) : (
                  <div
                    className="text-sm text-faint"
                    data-testid={`dataset.plans.card.${item.plan.id}.remove_restricted`}
                  >
                    {t('dataset.plans.remove.not_allowed')}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TableCard className="hidden @4xl:block" testId="dataset.plans.table" minWidth="lg">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint">
              {t('dataset.plans.column.label')}
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint">
              {t('dataset.plans.column.description')}
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint">
              {t('dataset.plans.column.permissions')}
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-faint">
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.plan.id} data-testid={`dataset.plans.row.${item.plan.id}`}>
              <td className="px-3 py-2">
                <div className="font-medium text-fg">{item.label}</div>
                <div
                  className="mt-1 text-xs text-faint"
                  data-testid={`dataset.plans.row.${item.plan.id}.source`}
                >
                  {t('dataset.plans.column.source')}: {item.source}
                </div>
              </td>
              <td
                className="max-w-md whitespace-pre-wrap break-words px-3 py-2 text-sm text-muted"
                data-testid={`dataset.plans.row.${item.plan.id}.description`}
              >
                {item.description}
              </td>
              <td className="px-3 py-2">
                <PermissionBadges item={item} />
              </td>
              <td className="px-3 py-2 text-right">
                {item.removable ? (
                  <Button
                    testId={`dataset.plans.row.${item.plan.id}.remove`}
                    variant="danger"
                    onClick={() => onRemove(item.plan)}
                    disabled={busy}
                  >
                    {t('common.remove')}
                  </Button>
                ) : (
                  <span className="text-xs text-faint">{t('dataset.plans.remove.not_allowed')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
