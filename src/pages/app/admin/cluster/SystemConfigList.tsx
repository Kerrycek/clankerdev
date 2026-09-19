import { useI18n } from '../../../../app/i18n';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { TableCard } from '../../../../components/ui/TableCard';
import type { SystemConfigItem } from '../../../../lib/api/systemConfig';

type Props = {
  configs: readonly SystemConfigItem[];
  showCategory: boolean;
  valuePreview: (config: SystemConfigItem) => string;
  onEdit: (config: SystemConfigItem) => void;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function rowId(config: SystemConfigItem): string {
  return `${text(config.category)}.${text(config.name)}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export function SystemConfigList({ configs, showCategory, valuePreview, onEdit }: Props) {
  const { t } = useI18n();

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="admin.cluster.system_config.cards">
        {configs.map((config) => {
          const id = rowId(config);
          const label = text(config.label) || text(config.name) || '—';

          return (
            <Card key={id} testId={`admin.cluster.system_config.card.${id}`}>
              <div className="min-w-0 p-4">
                <div className="break-words text-base font-semibold text-fg">{label}</div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.system_config.col.category')}</dt>
                    <dd className="min-w-0 break-all text-right text-fg">{text(config.category) || '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.system_config.col.name')}</dt>
                    <dd className="min-w-0 break-all text-right font-mono text-xs text-fg">{text(config.name) || '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.system_config.col.value')}</dt>
                    <dd className="min-w-0 break-all text-right font-mono text-xs text-muted">{valuePreview(config)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('common.type')}</dt>
                    <dd className="min-w-0 text-right">
                      <Badge variant="neutral">{text(config.type) || '—'}</Badge>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-border pt-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full min-w-0"
                    ariaLabel={`${t('common.edit')}: ${label}`}
                    onClick={() => onEdit(config)}
                    testId={`admin.cluster.system_config.card.${id}.edit`}
                  >
                    {t('common.edit')}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <TableCard className="hidden md:block" testId="admin.cluster.system_config.table" minWidth="lg">
        <thead>
          <tr>
            {showCategory ? <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.category')}</th> : null}
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.name')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.label')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.system_config.col.value')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.type')}</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
          </tr>
        </thead>

        <tbody>
          {configs.map((config) => {
            const id = rowId(config);

            return (
              <tr key={id} data-testid={`admin.cluster.system_config.row.${id}`}>
                {showCategory ? <td className="whitespace-nowrap px-3 py-2 text-muted">{text(config.category) || '—'}</td> : null}
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-fg">{text(config.name) || '—'}</td>
                <td className="px-3 py-2 text-fg">{text(config.label) || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{valuePreview(config)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Badge variant="neutral">{text(config.type) || '—'}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onEdit(config)}
                    testId={`admin.cluster.system_config.row.${id}.edit`}
                  >
                    {t('common.edit')}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    </>
  );
}
