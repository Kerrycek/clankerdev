import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchNodes } from '../../../lib/api/nodes';
import { fetchMigrationNodes } from './VpsMigrationNodes';

vi.mock('../../../lib/api/nodes', () => ({ fetchNodes: vi.fn() }));
const fetchMock = vi.mocked(fetchNodes);
const page = (ids: number[]) => ({ data: ids.map(id => ({ id })) }) as Awaited<ReturnType<typeof fetchNodes>>;

beforeEach(() => vi.resetAllMocks());

describe('migration destination inventory', () => {
  it('reads through short server-capped pages to the empty end and keeps the hypervisor scope', async () => {
    fetchMock.mockResolvedValueOnce(page([2, 8])).mockResolvedValueOnce(page([19])).mockResolvedValueOnce(page([]));
    expect((await fetchMigrationNodes()).map(node => node.id)).toEqual([2, 8, 19]);
    expect(fetchMock.mock.calls.map(([opts]) => opts?.fromId)).toEqual([0, 8, 19]);
    for (const [opts] of fetchMock.mock.calls) expect(opts).toMatchObject({ state: 'active', type: 'node', includes: 'location__environment' });
  });

  it('fails instead of showing a partial list if a later page fails', async () => {
    fetchMock.mockResolvedValueOnce(page([1])).mockRejectedValueOnce(new Error('offline'));
    await expect(fetchMigrationNodes()).rejects.toThrow('offline');
  });

  it('stops on a repeated cursor instead of looping forever', async () => {
    fetchMock.mockResolvedValue(page([1]));
    await expect(fetchMigrationNodes()).rejects.toThrow('did not advance');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
