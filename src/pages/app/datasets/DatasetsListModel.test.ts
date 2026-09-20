import { describe, expect, it } from 'vitest';

import type { Dataset } from '../../../lib/api/datasets';
import { filterDatasetPage } from './DatasetsListModel';

const rows: Dataset[] = [
  {
    id: 101,
    name: 'root',
    full_name: 'tank/vps/mail/root',
    label: 'System disk',
    vps: { id: 7, hostname: 'mail.example.test' },
    user: { id: 42, login: 'alice' },
  },
  {
    id: 202,
    name: 'archive',
    full_name: 'tank/nas/archive',
    user: { id: 43, login: 'bob' },
  },
];

describe('filterDatasetPage', () => {
  it.each([
    ['MAIL.EXAMPLE', [101]],
    ['system disk', [101]],
    ['alice', [101]],
    ['#202', [202]],
    ['tank/nas', [202]],
  ])('filters the loaded API page by %s', (query, expectedIds) => {
    expect(filterDatasetPage(rows, query).map((dataset) => dataset.id)).toEqual(expectedIds);
  });

  it('returns the original loaded page for a blank query', () => {
    expect(filterDatasetPage(rows, '   ')).toBe(rows);
  });

  it('never invents a match outside the supplied page', () => {
    expect(filterDatasetPage(rows.slice(0, 1), 'archive')).toEqual([]);
  });
});
