import { expectArray, haveApiCall, requireActionStateResult } from './haveapi';
import type { ResourceRef } from './app';

export type VpsUserDataFormat =
  | 'script'
  | 'cloudinit_config'
  | 'cloudinit_script'
  | 'nixos_configuration'
  | 'nixos_flake_configuration'
  | 'nixos_flake_uri';

export interface VpsUserData {
  id: number;
  user?: ResourceRef;
  label: string;
  format: VpsUserDataFormat | string;
  content?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

const DEFAULT_VPS_USER_DATA_LIST_LIMIT = 50;
const VPS_USER_DATA_INDEX_MAX_LIMIT = 1_000;
export const VPS_USER_DATA_SCAN_BATCH_SIZE = 100;
export const VPS_USER_DATA_SCAN_MAX_ROWS = 1_000;

export type VpsUserDataScanFailureReason =
  | 'invalid_id'
  | 'invalid_page'
  | 'cursor_stalled'
  | 'scan_limit';

export class VpsUserDataScanIncompleteError extends Error {
  public readonly code = 'VPS_USER_DATA_SCAN_INCOMPLETE';

  constructor(
    public readonly reason: VpsUserDataScanFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'VpsUserDataScanIncompleteError';
  }
}

interface RawVpsUserDataListOptions {
  user?: number;
  format?: string;
  limit?: number;
  fromId?: number;
}

function positiveSafeId(value: number | null | undefined, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new VpsUserDataScanIncompleteError(
      'invalid_id',
      `Cannot scan VPS user data with an invalid ${field}`,
    );
  }
  return value;
}

function requestedListLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_VPS_USER_DATA_LIST_LIMIT;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > VPS_USER_DATA_INDEX_MAX_LIMIT) {
    throw new RangeError(`VPS user data limit must be between 1 and ${VPS_USER_DATA_INDEX_MAX_LIMIT}`);
  }
  return limit;
}

async function fetchRawVpsUserDataList(
  opts: RawVpsUserDataListOptions,
): Promise<{ data: VpsUserData[]; meta?: Record<string, unknown> }> {
  const res = await haveApiCall<unknown>({
    method: 'GET',
    path: '/vps_user_data',
    namespace: 'vps_user_data',
    params: {
      user: opts.user,
      format: opts.format,
      limit: opts.limit,
      from_id: opts.fromId,
    },
  });

  return {
    data: expectArray<VpsUserData>(res.data as any, 'vps_user_data.index'),
    meta: res.meta,
  };
}

type UserDataSearchNeedle =
  | { kind: 'id'; id: number }
  | { kind: 'label'; label: string };

function parseUserDataSearchNeedle(query: string): UserDataSearchNeedle {
  if (/^#?\d+$/.test(query)) {
    const id = Number(query.replace(/^#/, ''));
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new VpsUserDataScanIncompleteError(
        'invalid_id',
        'Cannot scan VPS user data for an invalid template ID',
      );
    }
    return { kind: 'id', id };
  }

  return { kind: 'label', label: query.toLowerCase() };
}

function validatedAscendingPage(
  rows: VpsUserData[],
  fromId: number | undefined,
  requestLimit?: number,
): VpsUserData[] {
  if (requestLimit !== undefined && rows.length > requestLimit) {
    throw new VpsUserDataScanIncompleteError(
      'invalid_page',
      'VPS user data returned more rows than requested',
    );
  }

  const boundary = fromId ?? 0;
  let previousId = boundary;
  for (const row of rows) {
    const id = positiveSafeId(row.id, 'result ID');
    if (id === undefined || id <= previousId) {
      throw new VpsUserDataScanIncompleteError(
        'cursor_stalled',
        'VPS user data pagination did not advance in strict ascending ID order',
      );
    }
    previousId = id;
  }

  return rows;
}

function matchesUserDataSearch(row: VpsUserData, needle: UserDataSearchNeedle): boolean {
  if (needle.kind === 'id') return row.id === needle.id;
  return String(row.label ?? '').toLowerCase().includes(needle.label);
}

export async function fetchVpsUserDataList(opts?: {
  user?: number;
  format?: string;
  q?: string;
  limit?: number;
  fromId?: number | null;
}): Promise<{ data: VpsUserData[]; meta?: Record<string, unknown> }> {
  const user = positiveSafeId(opts?.user, 'user ID');
  const fromId = positiveSafeId(opts?.fromId, 'from_id');
  const query = String(opts?.q ?? '').trim();

  if (!query) {
    if (opts?.limit !== undefined) requestedListLimit(opts.limit);
    const result = await fetchRawVpsUserDataList({
      user,
      format: opts?.format,
      limit: opts?.limit,
      fromId,
    });
    return {
      ...result,
      data: validatedAscendingPage(result.data, fromId, opts?.limit),
    };
  }

  const limit = requestedListLimit(opts?.limit);
  const needle = parseUserDataSearchNeedle(query);
  if (needle.kind === 'id' && fromId !== undefined && fromId >= needle.id) {
    return { data: [] };
  }
  const matches: VpsUserData[] = [];
  let cursor = fromId;
  let scannedRows = 0;

  while (scannedRows < VPS_USER_DATA_SCAN_MAX_ROWS) {
    const requestLimit = Math.min(
      Math.max(VPS_USER_DATA_SCAN_BATCH_SIZE, limit),
      VPS_USER_DATA_SCAN_MAX_ROWS - scannedRows,
    );
    const result = await fetchRawVpsUserDataList({
      user,
      format: opts?.format,
      limit: requestLimit,
      fromId: cursor,
    });
    const page = validatedAscendingPage(result.data, cursor, requestLimit);
    scannedRows += page.length;

    for (const row of page) {
      if (matchesUserDataSearch(row, needle)) matches.push(row);
    }

    if (needle.kind === 'id' && matches.length === 1) {
      // A full-ID search has cardinality at most one, so the match itself proves
      // the filtered result is complete even when the raw scope has more rows.
      return { data: matches };
    }
    if (needle.kind === 'id' && page.some((row) => row.id > needle.id)) {
      // Strict ascending order proves the target cannot appear on a later page.
      return { data: [] };
    }

    if (matches.length >= limit) {
      // Server metadata describes the raw user/format subset, not this local
      // label/ID search, so do not expose it as filtered metadata.
      return { data: matches.slice(0, limit) };
    }

    if (page.length < requestLimit) return { data: matches };

    const nextCursor = page[page.length - 1]?.id;
    if (nextCursor === undefined || (cursor !== undefined && nextCursor <= cursor)) {
      throw new VpsUserDataScanIncompleteError(
        'cursor_stalled',
        'VPS user data pagination stalled before search was complete',
      );
    }
    cursor = nextCursor;
  }

  throw new VpsUserDataScanIncompleteError(
    'scan_limit',
    'The bounded VPS user data scan ended before search completeness could be established',
  );
}

export async function fetchVpsUserData(id: number): Promise<{ data: VpsUserData; meta?: Record<string, unknown> }> {
  const res = await haveApiCall<VpsUserData>({
    method: 'GET',
    path: `/vps_user_data/${id}`,
  });

  return { data: res.data as any, meta: res.meta };
}

export async function createVpsUserData(payload: {
  user?: number;
  label: string;
  format: string;
  content: string;
}): Promise<{ data: VpsUserData; meta?: Record<string, unknown> }> {
  const res = await haveApiCall<VpsUserData>({
    method: 'POST',
    path: '/vps_user_data',
    namespace: 'vps_user_data',
    params: payload as any,
  });

  return { data: res.data as any, meta: res.meta };
}

export async function updateVpsUserData(
  id: number,
  payload: {
    label?: string;
    format?: string;
    content?: string;
  }
): Promise<{ data: VpsUserData; meta?: Record<string, unknown> }> {
  const res = await haveApiCall<VpsUserData>({
    method: 'PUT',
    path: `/vps_user_data/${id}`,
    namespace: 'vps_user_data',
    params: payload as any,
  });

  return { data: res.data as any, meta: res.meta };
}

export async function deleteVpsUserData(id: number): Promise<void> {
  await haveApiCall<null>({
    method: 'DELETE',
    path: `/vps_user_data/${id}`,
  });
}

export async function deployVpsUserData(id: number, vpsId: number): Promise<{ meta?: Record<string, unknown> }> {
  const res = await haveApiCall<null>({
    method: 'POST',
    path: `/vps_user_data/${id}/deploy`,
    namespace: 'vps_user_data',
    params: {
      vps: vpsId,
    },
  });

  return requireActionStateResult({ meta: res.meta }, 'VPS user-data deployment');
}
