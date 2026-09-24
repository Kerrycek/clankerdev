import { expectArray, haveApiCall } from './haveapi';

export interface KernelHistoryEvent {
  id: number;
  event_type: string;
  livepatch_action?: string | null;
  booted_release?: string | null;
  reported_release?: string | null;
  effective_at?: string | null;
  observed_after?: string | null;
  observed_before: string;
  source: string;
  confidence: string;
  current: boolean;
}

export interface NodeSystemState {
  id: number;
  cpus?: number | null;
  total_memory?: number | null;
  total_swap?: number | null;
  cgroup_version?: string | null;
  first_observed_at: string;
  last_observed_at: string;
  current: boolean;
}

export interface KernelParameter { id: number; position: number; name: string; value: string | null }
export interface NodeSysctl {
  id: number;
  name: string;
  configured_value: string | null;
  effective_value: string | null;
  available: boolean;
}
export interface NodeSoftwareVersion {
  id: number;
  generation: string;
  component: string;
  version: string | null;
  revision: string | null;
  revision_dirty: boolean;
}
export interface KernelEvidence { id: number; kernel_command_line: string | null; observed_at?: string | null }

export interface NodeHistoryPageOptions { fromId?: number; signal?: AbortSignal }
export const NODE_HISTORY_PAGE_SIZE = 50;

async function list<T>(path: string, namespace: string, params: Record<string, unknown>, options: NodeHistoryPageOptions) {
  const result = await haveApiCall<T[]>({
    method: 'GET', path, namespace,
    params: { ...params, limit: NODE_HISTORY_PAGE_SIZE, from_id: options.fromId },
    signal: options.signal,
  });
  return expectArray<T>(result.data, path);
}

export function fetchNodeKernelHistory(nodeId: number, options: NodeHistoryPageOptions = {}) {
  return list<KernelHistoryEvent>(`/nodes/${nodeId}/kernel_history`, 'kernel_history', {}, options);
}
export function fetchNodeSystemHistory(nodeId: number, options: NodeHistoryPageOptions = {}) {
  return list<NodeSystemState>('/node_system_states', 'node_system_state', { node: nodeId }, options);
}
export function fetchNodeKernelParameters(nodeId: number, options: NodeHistoryPageOptions = {}) {
  return list<KernelParameter>('/node_kernel_parameters', 'node_kernel_parameter', { node: nodeId, source: 'current' }, options);
}
export function fetchNodeSysctls(nodeId: number, options: NodeHistoryPageOptions = {}) {
  return list<NodeSysctl>('/node_sysctls', 'node_sysctl', { node: nodeId, source: 'current' }, options);
}
export function fetchNodeSoftwareVersions(nodeId: number, options: NodeHistoryPageOptions = {}) {
  return list<NodeSoftwareVersion>('/node_software_versions', 'node_software_version', { node: nodeId, source: 'current' }, options);
}
export async function fetchNodeKernelEvidence(nodeId: number, signal?: AbortSignal) {
  const result = await haveApiCall<KernelEvidence[]>({
    method: 'GET', path: '/node_kernel_evidences', namespace: 'node_kernel_evidence',
    params: { node: nodeId, limit: 1 }, signal,
  });
  return expectArray<KernelEvidence>(result.data, 'node_kernel_evidences')[0] ?? null;
}
