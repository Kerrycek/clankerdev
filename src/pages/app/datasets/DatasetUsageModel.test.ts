import { describe, expect, it } from 'vitest';

import { datasetUsageBreakdown } from './DatasetUsageModel';

describe('datasetUsageBreakdown', () => {
  it('uses the reference quota when one is configured', () => {
    expect(datasetUsageBreakdown({ used: 1_900, refquota: 2_000, avail: 1_400 })).toEqual({
      used: 1_900,
      free: 100,
      ratio: 0.95,
    });
  });

  it('uses used plus available space for an unlimited dataset', () => {
    const usage = datasetUsageBreakdown({ used: 1_900, avail: 1_400 });

    expect(usage).toEqual({
      used: 1_900,
      free: 1_400,
      ratio: 1_900 / 3_300,
    });
    expect(usage?.ratio).toBeCloseTo(0.576, 3);
  });

  it('reports a full bar when no space is available', () => {
    expect(datasetUsageBreakdown({ used: 1_900, avail: 0 })).toEqual({
      used: 1_900,
      free: 0,
      ratio: 1,
    });
  });

  it('returns an unknown state without enough capacity data', () => {
    expect(datasetUsageBreakdown({ used: 1_900 })).toBeNull();
    expect(datasetUsageBreakdown({ avail: 1_400 })).toBeNull();
    expect(datasetUsageBreakdown({ used: 0, avail: 0 })).toBeNull();
  });
});
