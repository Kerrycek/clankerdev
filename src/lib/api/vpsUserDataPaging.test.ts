import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchVpsUserDataList, type VpsUserData } from './vpsUserData';
import { fetchVpsUserDataPage } from './vpsUserDataPaging';

vi.mock('./vpsUserData', () => ({ fetchVpsUserDataList: vi.fn() }));
const fetchPage = vi.mocked(fetchVpsUserDataList);
const row = (id: number, label = `Template ${id}`): VpsUserData => ({ id, label, format: 'script' });
function source(rows: VpsUserData[]) {
  fetchPage.mockImplementation(async (opts) => ({
    data: rows.filter((r) => r.id > (opts?.fromId ?? 0)).slice(0, opts?.limit),
  }));
}
beforeEach(() => fetchPage.mockReset());

describe('user-data ascending API adapter', () => {
  test('uses a hidden lookahead, a greatest-visible-ID cursor, and an exact terminal page', async () => {
    source(Array.from({ length: 50 }, (_, i) => row((i + 1) * 3)));
    const first = await fetchVpsUserDataPage({ limit: 25 });
    expect(first.data.map((r) => r.id)).toEqual(Array.from({ length: 25 }, (_, i) => (i + 1) * 3));
    expect(first).toMatchObject({ hasNext: true, nextCursor: 75 });
    const last = await fetchVpsUserDataPage({ limit: 25, fromId: first.nextCursor });
    expect(last.data).toHaveLength(25);
    expect(last.data[0]?.id).toBe(78);
    expect(last).toMatchObject({ hasNext: false, nextCursor: null });
  });

  test('scans later batches for label and exact #ID without searching content or sending q', async () => {
    source(Array.from({ length: 240 }, (_, i) => ({ ...row(i + 1, i === 215 ? 'NGINX setup' : 'other'), content: 'nginx' })));
    const signal = new AbortController().signal;
    const opts = { limit: 25, user: 42, format: 'script', signal };
    expect((await fetchVpsUserDataPage({ ...opts, q: ' nginx ' })).data.map((r) => r.id)).toEqual([216]);
    expect((await fetchVpsUserDataPage({ ...opts, q: '#216' })).data.map((r) => r.id)).toEqual([216]);
    for (const [request] of fetchPage.mock.calls) {
      expect(request).toMatchObject({ user: 42, format: 'script', signal });
      expect(request).not.toHaveProperty('q');
    }
  });

  test('accepts nonmonotonic timestamps without using them as a cursor', async () => {
    source([row(2), row(7), row(13)].map((r, i) => ({ ...r, updated_at: ['2026-09-23', '2020-01-01', '2026-01-01'][i] })));
    expect((await fetchVpsUserDataPage({ limit: 2 })).nextCursor).toBe(7);
  });

  test.each([[row(3), row(2)], [row(2), row(2)], [row(0)], [row(NaN)]])('rejects malformed, duplicate, or nonmonotonic ids: %j', async (...data) => {
    fetchPage.mockResolvedValue({ data });
    await expect(fetchVpsUserDataPage({ limit: 25 })).rejects.toMatchObject({ reason: 'invalid_page' });
  });

  test('rejects a repeated cursor page and an oversized response', async () => {
    fetchPage.mockResolvedValue({ data: [row(4)] });
    await expect(fetchVpsUserDataPage({ limit: 25, fromId: 4 })).rejects.toMatchObject({ reason: 'invalid_page' });
    fetchPage.mockResolvedValue({ data: Array.from({ length: 101 }, (_, i) => row(i + 1)) });
    await expect(fetchVpsUserDataPage({ limit: 25 })).rejects.toMatchObject({ reason: 'invalid_page' });
  });

  test.each([1000, 1001])('distinguishes exactly 1000 records from a truncated search (%i)', async (count) => {
    source(Array.from({ length: count }, (_, i) => row(i + 1)));
    const result = fetchVpsUserDataPage({ limit: 25, q: 'absent' });
    if (count === 1000) await expect(result).resolves.toEqual({ data: [], hasNext: false, nextCursor: null });
    else await expect(result).rejects.toMatchObject({ reason: 'scan_limit' });
    expect(fetchPage).toHaveBeenCalledTimes(11);
    expect(fetchPage.mock.lastCall?.[0]).toMatchObject({ limit: 1, fromId: 1000 });
  });

  test('does not turn a later HTTP failure into a partial result', async () => {
    fetchPage.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => row(i + 1)) });
    fetchPage.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(fetchVpsUserDataPage({ limit: 25, q: 'absent' })).rejects.toThrow('HTTP 500');
  });

  test('cancellation stops the scan before another batch', async () => {
    const controller = new AbortController();
    fetchPage.mockImplementation(async () => {
      controller.abort();
      return { data: Array.from({ length: 100 }, (_, i) => row(i + 1)) };
    });
    await expect(fetchVpsUserDataPage({ limit: 25, q: 'absent', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
