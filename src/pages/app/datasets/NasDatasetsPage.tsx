import React from 'react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { DatasetsListPage } from './DatasetsListPage';

export function NasDatasetsPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();

  return (
    <DatasetsListPage
      rolePreset="primary"
      titleKey="nas.list.title"
      descriptionKey="nas.list.description"
      searchPlaceholderKey="nas.list.search.placeholder"
      loadErrorTitleKey="nas.list.load_error.title"
      emptyTitleKey="nas.list.empty.title"
      emptyBodyKey="nas.list.empty.body"
      showVpsFilter={false}
      showOwnerColumn
      headerActions={
        <Button to={`${basePath}/nas/new`} testId="nas.create.open">
          {t('nas.create.open')}
        </Button>
      }
    />
  );
}
