import { useI18n } from '../../../../app/i18n';
import type { OsTemplate } from '../../../../lib/api/osTemplates';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { TableCard } from '../../../../components/ui/TableCard';

type Props = {
  templates: OsTemplate[];
  onEdit: (template: OsTemplate) => void;
  onDelete: (template: OsTemplate) => void;
};

type TemplateRow = {
  template: OsTemplate;
  label: string;
  detail: string;
  family: string;
  usesCount: number | undefined;
  canDelete: boolean;
};

function osFamilyLabel(template: OsTemplate): string {
  const family: unknown = template.os_family;
  if (!family) return '—';
  if (typeof family === 'string') return family;
  if (typeof family === 'number') return `#${family}`;
  if (typeof family === 'object' && 'id' in family && typeof family.id === 'number') {
    const label = 'label' in family && typeof family.label === 'string' ? family.label.trim() : '';
    return label || `#${family.id}`;
  }
  return '—';
}

function toRow(template: OsTemplate): TemplateRow {
  const label = typeof template.label === 'string' ? template.label : `#${template.id}`;
  const distribution = typeof template.distribution === 'string' ? template.distribution : '';
  const version = typeof template.version === 'string' ? template.version : '';
  const name = typeof template.name === 'string' ? template.name : '';
  const usesCount = typeof template.uses_count === 'number' ? template.uses_count : undefined;

  return {
    template,
    label,
    detail: distribution && version ? `${distribution} ${version}` : name || '—',
    family: osFamilyLabel(template),
    usesCount,
    canDelete: usesCount === undefined || usesCount <= 0,
  };
}

export function OsTemplatesList({ templates, onEdit, onDelete }: Props) {
  const { t } = useI18n();
  const rows = templates.map(toRow);

  const statusBadge = (value: boolean | undefined, onKey: string, offKey: string) => ({
    label: value ? t(onKey) : t(offKey),
    variant: value ? ('ok' as const) : ('warn' as const),
  });

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="admin.cluster.os_templates.cards">
        {rows.map((row) => {
          const enabled = statusBadge(row.template.enabled, 'common.enabled', 'common.disabled');
          const supported = statusBadge(row.template.supported, 'common.supported', 'common.unsupported');

          return (
            <Card key={row.template.id} testId={`admin.cluster.os_templates.card.${row.template.id}`}>
              <div className="min-w-0 p-4">
                <div className="min-w-0">
                  <div className="break-words text-base font-semibold text-fg">{row.label}</div>
                  <div className="mt-1 break-all text-xs text-muted">{row.detail}</div>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.os_templates.col.family')}</dt>
                    <dd className="min-w-0 break-words text-right text-fg">{row.family}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.os_templates.col.enabled')}</dt>
                    <dd><Badge variant={enabled.variant}>{enabled.label}</Badge></dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.os_templates.col.supported')}</dt>
                    <dd><Badge variant={supported.variant}>{supported.label}</Badge></dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.os_templates.col.uses')}</dt>
                    <dd className="tabular-nums text-fg">{row.usesCount ?? '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-faint">{t('admin.cluster.os_templates.col.order')}</dt>
                    <dd className="tabular-nums text-fg">{row.template.order ?? '—'}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button
                    testId={`admin.cluster.os_templates.card.${row.template.id}.edit`}
                    variant="secondary"
                    size="lg"
                    className="w-full min-w-0"
                    ariaLabel={`${t('common.edit')}: ${row.label}`}
                    onClick={() => onEdit(row.template)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    testId={`admin.cluster.os_templates.card.${row.template.id}.delete`}
                    variant="danger"
                    size="lg"
                    className="w-full min-w-0"
                    ariaLabel={`${t('common.delete')}: ${row.label}`}
                    disabled={!row.canDelete}
                    title={!row.canDelete ? t('admin.cluster.os_templates.delete.blocked') : undefined}
                    onClick={() => onDelete(row.template)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <TableCard className="hidden md:block" testId="admin.cluster.os_templates.table">
        <thead>
          <tr>
            <th className="w-1/3">{t('admin.cluster.os_templates.col.label')}</th>
            <th className="w-48">{t('admin.cluster.os_templates.col.family')}</th>
            <th className="w-24">{t('admin.cluster.os_templates.col.enabled')}</th>
            <th className="w-24">{t('admin.cluster.os_templates.col.supported')}</th>
            <th className="w-20">{t('admin.cluster.os_templates.col.uses')}</th>
            <th className="w-20">{t('admin.cluster.os_templates.col.order')}</th>
            <th className="w-44" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const enabled = statusBadge(row.template.enabled, 'common.enabled', 'common.disabled');
            const supported = statusBadge(row.template.supported, 'common.supported', 'common.unsupported');

            return (
              <tr key={row.template.id}>
                <td className="min-w-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.label}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">{row.detail}</div>
                  </div>
                </td>
                <td>{row.family}</td>
                <td><Badge variant={enabled.variant}>{enabled.label}</Badge></td>
                <td><Badge variant={supported.variant}>{supported.label}</Badge></td>
                <td className="tabular-nums">{row.usesCount ?? '—'}</td>
                <td className="tabular-nums">{row.template.order ?? '—'}</td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      testId={`admin.cluster.os_templates.row.${row.template.id}.edit`}
                      variant="secondary"
                      size="sm"
                      onClick={() => onEdit(row.template)}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      testId={`admin.cluster.os_templates.row.${row.template.id}.delete`}
                      variant="danger"
                      size="sm"
                      disabled={!row.canDelete}
                      title={!row.canDelete ? t('admin.cluster.os_templates.delete.blocked') : undefined}
                      onClick={() => onDelete(row.template)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    </>
  );
}
