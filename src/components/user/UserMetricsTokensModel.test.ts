import { describe, expect, it } from 'vitest';

import type { MetricsAccessToken } from '../../lib/api/userDossier';

import {
  buildMetricPrefixReview,
  buildMetricsTokenSummary,
  hasMetricsAccessTokenSecret,
  metricsAccessTokenDisplayName,
  metricsAccessTokenState,
  metricsAccessTokenStateDescriptor,
  metricsUrlForAccessToken,
  sortMetricsAccessTokens,
} from './UserMetricsTokensModel';

const now = Date.parse('2026-07-06T12:00:00Z');

const tokens: MetricsAccessToken[] = [
  {
    id: 1,
    metric_prefix: 'old_',
    use_count: 12,
    last_use: '2026-02-01T12:00:00Z',
    created_at: '2026-01-01T12:00:00Z',
  },
  {
    id: 3,
    metric_prefix: 'new_',
    use_count: 0,
    created_at: '2026-07-01T12:00:00Z',
  },
  {
    id: 2,
    metric_prefix: 'active_',
    use_count: 2,
    last_use: '2026-07-05T12:00:00Z',
    created_at: '2026-06-01T12:00:00Z',
  },
  {
    id: 4,
    metric_prefix: 'unknown_',
    use_count: 3,
    last_use: 'not-a-date',
    created_at: '2026-07-02T12:00:00Z',
  },
];

describe('UserMetricsTokensModel', () => {
  it('reviews metric prefixes without blocking backend-compatible values', () => {
    expect(buildMetricPrefixReview('')).toEqual({
      raw: '',
      normalized: '',
      canSubmit: false,
      validationKey: 'profile.metrics.validation.prefix_required',
      warningKeys: [],
    });

    expect(buildMetricPrefixReview(' vpsadmin_ ')).toEqual({
      raw: ' vpsadmin_ ',
      normalized: 'vpsadmin_',
      canSubmit: true,
      warningKeys: ['profile.metrics.review.warning.trimmed'],
    });

    expect(buildMetricPrefixReview('bad prefix')).toMatchObject({
      normalized: 'bad prefix',
      canSubmit: true,
      warningKeys: ['profile.metrics.review.warning.characters'],
    });
  });

  it('sorts tokens newest first and classifies token health states', () => {
    expect(sortMetricsAccessTokens(tokens).map((token) => token.id)).toEqual([4, 3, 2, 1]);

    expect(metricsAccessTokenState(tokens[0]!, now)).toBe('stale');
    expect(metricsAccessTokenState(tokens[1]!, now)).toBe('unused');
    expect(metricsAccessTokenState(tokens[2]!, now)).toBe('active');
    expect(metricsAccessTokenState(tokens[3]!, now)).toBe('unknown');

    expect(metricsAccessTokenStateDescriptor(tokens[0]!, now)).toMatchObject({
      labelKey: 'profile.metrics.state.stale',
      badgeTone: 'warn',
    });
  });

  it('builds summaries and safe display helpers', () => {
    expect(buildMetricsTokenSummary(tokens, now)).toEqual({
      total: 4,
      active: 1,
      unused: 1,
      stale: 1,
      unknown: 1,
    });

    expect(metricsUrlForAccessToken('/api/', 'a token+/=')).toBe('/api/metrics?access_token=a%20token%2B%2F%3D');
    expect(metricsAccessTokenDisplayName({ id: 77, metric_prefix: '  ' })).toBe('#77');
    expect(hasMetricsAccessTokenSecret({ id: 1, access_token: 'secret' })).toBe(true);
    expect(hasMetricsAccessTokenSecret({ id: 1, access_token: '  ' })).toBe(false);
  });
});
