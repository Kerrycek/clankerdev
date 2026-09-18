import type { Dataset } from '../../../lib/api/datasets';

function resourceFields(value: unknown, keys: string[]): unknown[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  return keys.map((key) => row[key]);
}

/**
 * Dataset#index has no free-text query input. Keep text filtering explicitly
 * local to the API page that the keyset list has already loaded.
 */
export function filterDatasetPage(rows: Dataset[], query: string): Dataset[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return rows;

  return rows.filter((dataset) => {
    const fields: unknown[] = [
      dataset.id,
      `#${dataset.id}`,
      dataset.name,
      dataset.full_name,
      dataset.label,
      ...resourceFields(dataset.vps, ['id', 'hostname']),
      ...resourceFields(dataset.user, ['id', 'login']),
    ];

    return fields.some((value) =>
      value !== undefined
      && value !== null
      && String(value).toLocaleLowerCase().includes(needle)
    );
  });
}
