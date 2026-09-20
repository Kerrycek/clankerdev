import React from 'react';

import { DatasetsListPage } from './DatasetsListPage';

/** User-facing list of datasets mounted from the hypervisor/VPS storage pool. */
export function VpsDatasetsPage() {
  return (
    <DatasetsListPage
      rolePreset="hypervisor"
      titleKey="vps_datasets.list.title"
      descriptionKey="vps_datasets.list.description"
      searchPlaceholderKey="vps_datasets.list.search.placeholder"
      loadErrorTitleKey="vps_datasets.list.load_error.title"
      emptyTitleKey="vps_datasets.list.empty.title"
      emptyBodyKey="vps_datasets.list.empty.body"
    />
  );
}
