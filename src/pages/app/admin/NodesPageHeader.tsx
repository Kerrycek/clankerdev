import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';

import type { NodesPageTranslator } from './NodesFilters';

interface NodesPageHeaderProps {
  t: NodesPageTranslator;
  filtersActive: boolean;
  listHint?: string;
  showCreateAction: boolean;
  createDisabled: boolean;
  createLoading: boolean;
  createDisabledReason?: string;
  onCreate: () => void;
}

export function NodesPageHeader({
  t,
  filtersActive,
  listHint,
  showCreateAction,
  createDisabled,
  createLoading,
  createDisabledReason,
  onCreate,
}: NodesPageHeaderProps) {
  return (
    <PageHeader
      title={t('admin.nodes.title')}
      description={t('admin.nodes.subtitle')}
      meta={filtersActive ? <span className="text-xs text-faint">{listHint ?? t('list.meta.filters_active')}</span> : null}
      actions={
        showCreateAction ? (
          <Button
            variant="primary"
            disabled={createDisabled}
            loading={createLoading}
            disabledReason={createDisabledReason}
            onClick={onCreate}
            testId="admin.nodes.create"
          >
            {t('admin.node.editor.action.create')}
          </Button>
        ) : null
      }
      testId="admin.nodes.list.header"
    />
  );
}
