import React from 'react';

import { DatasetsListPage } from './DatasetsListPage';

export function NasDatasetsPage() {
  return (
    <DatasetsListPage
      rolePreset="primary"
      titleKey="nas.list.title"
      descriptionKey="nas.list.description"
      searchPlaceholderKey="nas.list.search.placeholder"
      showVpsFilter={false}
      showOwnerColumn
    />
  );
}
