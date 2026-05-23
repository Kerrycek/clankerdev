import React from 'react';

import { ExportsListPage } from './ExportsListPage';
import { useDatasetContext } from '../datasets/DatasetContext';

export function DatasetExportsPage() {
  const { dataset } = useDatasetContext();
  return <ExportsListPage fixedDatasetId={dataset.id} embedded />;
}
