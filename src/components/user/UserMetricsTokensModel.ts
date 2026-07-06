import type { MetricsAccessToken } from '../../lib/api/userDossier';

export type MetricsTokenState = 'active' | 'unused' | 'stale' | 'unknown';

export const METRICS_TOKEN_STALE_AFTER_DAYS = 90;
export const METRICS_TOKEN_REVOKE_CONFIRMATION = 'REVOKE';

const METRICS_TOKEN_STALE_AFTER_MS = METRICS_TOKEN_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
const SAFE_PROMETHEUS_PREFIX_RE = /^[A-Za-z_:][A-Za-z0-9_:]*$/;

export interface MetricPrefixReview {
  raw: string;
  normalized: string;
  canSubmit: boolean;
  validationKey?: string;
  warningKeys: string[];
}

export interface MetricsTokenSummary {
  total: number;
  active: number;
  unused: number;
  stale: number;
  unknown: number;
}

export interface MetricsTokenStateDescriptor {
  state: MetricsTokenState;
  labelKey: string;
  descriptionKey: string;
  badgeTone: 'ok' | 'warn' | 'neutral';
}

export function buildMetricPrefixReview(rawValue: string): MetricPrefixReview {
  const raw = String(rawValue ?? '');
  const normalized = raw.trim();
  const warningKeys: string[] = [];

  if (!normalized) {
    return {
      raw,
      normalized,
      canSubmit: false,
      validationKey: 'profile.metrics.validation.prefix_required',
      warningKeys,
    };
  }

  if (raw !== normalized) {
    warningKeys.push('profile.metrics.review.warning.trimmed');
  }

  if (!SAFE_PROMETHEUS_PREFIX_RE.test(normalized)) {
    warningKeys.push('profile.metrics.review.warning.characters');
  }

  return {
    raw,
    normalized,
    canSubmit: true,
    warningKeys,
  };
}

function parseUseCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortMetricsAccessTokens(tokens: readonly MetricsAccessToken[]): MetricsAccessToken[] {
  return [...tokens].sort((a, b) => {
    const aid = Number(a.id);
    const bid = Number(b.id);
    if (Number.isFinite(aid) && Number.isFinite(bid) && aid !== bid) return bid - aid;

    const ac = parseTimestampMs(a.created_at) ?? 0;
    const bc = parseTimestampMs(b.created_at) ?? 0;
    return bc - ac;
  });
}

export function metricsAccessTokenState(token: MetricsAccessToken, nowMs = Date.now()): MetricsTokenState {
  const useCount = parseUseCount(token.use_count);
  const lastUseRaw = token.last_use;
  const lastUseMs = parseTimestampMs(lastUseRaw);

  if (useCount === 0 && !lastUseRaw) return 'unused';
  if (typeof lastUseRaw === 'string' && lastUseRaw.trim() && lastUseMs === null) return 'unknown';
  if (lastUseMs !== null && nowMs - lastUseMs > METRICS_TOKEN_STALE_AFTER_MS) return 'stale';
  return 'active';
}

export function metricsAccessTokenStateDescriptor(
  token: MetricsAccessToken,
  nowMs = Date.now()
): MetricsTokenStateDescriptor {
  const state = metricsAccessTokenState(token, nowMs);

  if (state === 'unused') {
    return {
      state,
      labelKey: 'profile.metrics.state.unused',
      descriptionKey: 'profile.metrics.state.unused_desc',
      badgeTone: 'warn',
    };
  }

  if (state === 'stale') {
    return {
      state,
      labelKey: 'profile.metrics.state.stale',
      descriptionKey: 'profile.metrics.state.stale_desc',
      badgeTone: 'warn',
    };
  }

  if (state === 'unknown') {
    return {
      state,
      labelKey: 'profile.metrics.state.unknown',
      descriptionKey: 'profile.metrics.state.unknown_desc',
      badgeTone: 'neutral',
    };
  }

  return {
    state,
    labelKey: 'profile.metrics.state.active',
    descriptionKey: 'profile.metrics.state.active_desc',
    badgeTone: 'ok',
  };
}

export function buildMetricsTokenSummary(
  tokens: readonly MetricsAccessToken[] | undefined,
  nowMs = Date.now()
): MetricsTokenSummary {
  const rows = tokens ?? [];
  const summary: MetricsTokenSummary = {
    total: rows.length,
    active: 0,
    unused: 0,
    stale: 0,
    unknown: 0,
  };

  for (const token of rows) {
    summary[metricsAccessTokenState(token, nowMs)] += 1;
  }

  return summary;
}

export function metricsUrlForAccessToken(apiUrl: string | undefined, token: string): string {
  const base = String(apiUrl ?? '').replace(/\/$/, '');
  return `${base}/metrics?access_token=${encodeURIComponent(token)}`;
}

export function metricsAccessTokenDisplayName(token: MetricsAccessToken): string {
  const prefix = String(token.metric_prefix ?? '').trim();
  return prefix || `#${token.id}`;
}

export function hasMetricsAccessTokenSecret(token: MetricsAccessToken | null | undefined): boolean {
  return typeof token?.access_token === 'string' && token.access_token.trim().length > 0;
}
