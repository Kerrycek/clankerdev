import React from 'react';

import { DatasetsListPage } from './DatasetsListPage';

export function NasDatasetsPage() {
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
    />
  );
}
