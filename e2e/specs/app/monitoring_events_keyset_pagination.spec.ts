import { expect, test } from '@playwright/test';

import { mockHaveApi } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

type MonitoredEventRow = {
  id: number;
  monitor: string;
  label: string;
  issue: string;
  object_name: string;
  object_id: number;
  state: string;
  duration: number;
  created_at: string;
  updated_at: string;
  saved_until: string | null;
  user: { id: number; login: string };
};

function makeEvent(id: number, duration: number, state: string): MonitoredEventRow {
  const now = new Date('2026-02-14T10:00:00Z');
  return {
    id,
    monitor: 'vpsadmin.monitoring:example',
    label: `Example monitor ${id}`,
    issue: `Example issue ${id}`,
    object_name: 'Vps',
    object_id: 101,
    state,
    duration,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    saved_until: null,
    user: { id: 1, login: 'admin' },
  };
}

function makePage(startId: number, startDuration: number, count: number): MonitoredEventRow[] {
  const rows: MonitoredEventRow[] = [];
  for (let i = 0; i < count; i++) {
    const id = startId - i;
    const duration = startDuration - i;
    // Mix states so we verify RowTone is always set.
    const state = i % 3 === 0 ? 'confirmed' : i % 3 === 1 ? 'acknowledged' : 'closed';
    rows.push(makeEvent(id, duration, state));
  }
  return rows;
}

test.describe('Monitoring events keyset pagination', () => {
  mockHaveApi(test);

  test('uses from_duration cursor for duration-sorted orders', async ({ page, haveApiMock }) => {
    // Page 1: durations 1000..951 (50 rows)
    const page1 = makePage(300, 1000, 50);
    // Cursor for next page should be the smallest duration on the page.
    const expectedCursor = 951;
    // Page 2: durations 950..901 (50 rows)
    const page2 = makePage(250, 950, 50);

    haveApiMock.addHandlers({
      'GET monitored_events': async ({ searchParams }) => {
        expect(searchParams.get('monitored_event[order]')).toBe('longest');
        const fromDuration = searchParams.get('monitored_event[from_duration]');
        if (!fromDuration) {
          return { status: true, response: { monitored_events: page1 } };
        }

        expect(fromDuration).toBe(String(expectedCursor));
        return { status: true, response: { monitored_events: page2 } };
      },
    });

    await page.goto(withAppUrl('/app/monitoring?order=longest'));

    // RowTone Full: a row must always have an explicit variant.
    await expect(page.getByTestId('monitoring.events.row.300')).toHaveAttribute('data-row-variant', /\w+/);

    await page.getByTestId('monitoring.events.pagination.next').click();

    await expect(page).toHaveURL(/from_duration=951/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=2/);

    // Page 2 row should render.
    await expect(page.getByTestId('monitoring.events.row.250')).toBeVisible();
  });
});
