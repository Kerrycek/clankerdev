import { describe, expect, it, vi } from 'vitest';
import {
  fetchNodeKernelEvidence, fetchNodeKernelHistory, fetchNodeKernelParameters,
  fetchNodeSoftwareVersions, fetchNodeSysctls, fetchNodeSystemHistory,
} from './nodeHistory';

describe('node history API contracts', () => {
  it.each([
    [fetchNodeKernelHistory, '/nodes/5/kernel_history', 'kernel_history', 'kernel_histories', false],
    [fetchNodeSystemHistory, '/node_system_states', 'node_system_state', 'node_system_states', false],
    [fetchNodeKernelParameters, '/node_kernel_parameters', 'node_kernel_parameter', 'node_kernel_parameters', true],
    [fetchNodeSysctls, '/node_sysctls', 'node_sysctl', 'node_sysctls', true],
    [fetchNodeSoftwareVersions, '/node_software_versions', 'node_software_version', 'node_software_versions', true],
  ] as const)('scopes and paginates %s using its declared namespace', async (load, path, namespace, responseKey, current) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response: { [responseKey]: [{ id: 7 }] } }) }));
    const controller = new AbortController();
    expect(await load(5, { fromId: 12, signal: controller.signal })).toEqual([{ id: 7 }]);
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe(`/v7.0${path}`);
    expect(parsed.searchParams.get(`${namespace}[from_id]`)).toBe('12');
    expect(parsed.searchParams.get(`${namespace}[limit]`)).toBe('50');
    if (namespace !== 'kernel_history') expect(parsed.searchParams.get(`${namespace}[node]`)).toBe('5');
    expect(parsed.searchParams.get(`${namespace}[source]`)).toBe(current ? 'current' : null);
    expect(init?.signal).toBe(controller.signal);
  });

  it('keeps an absent command line distinct from an empty one', async () => {
    const mocked = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response: { node_kernel_evidences: [] } }) });
    vi.stubGlobal('fetch', mocked);
    expect(await fetchNodeKernelEvidence(5)).toBeNull();
    mocked.mockResolvedValue({ ok: true, json: async () => ({ status: true, response: { node_kernel_evidences: [{ id: 4, kernel_command_line: '' }] } }) });
    expect(await fetchNodeKernelEvidence(5)).toEqual({ id: 4, kernel_command_line: '' });
  });

  it('rejects malformed successful responses rather than showing an empty history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, response: { invalid: 'not an array' } }) }));
    await expect(fetchNodeKernelHistory(5)).rejects.toThrow();
  });
});
