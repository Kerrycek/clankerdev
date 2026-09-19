import { describe, expect, it } from 'vitest';

import { shouldNotifyFinishedAction, shouldReplayFinishedLockCallback } from './useTaskCompletionToasts';

describe('shouldNotifyFinishedAction', () => {
  it('does not replay a terminal action restored when the layout mounts', () => {
    expect(shouldNotifyFinishedAction({
      finished: true,
      isTracked: true,
      wasTrackedAtMount: true,
      notifyOnInitialFinished: true,
    })).toBe(false);
  });

  it('notifies when a freshly tracked action is terminal on its first observation', () => {
    expect(shouldNotifyFinishedAction({
      finished: true,
      isTracked: true,
      wasTrackedAtMount: false,
      notifyOnInitialFinished: true,
    })).toBe(true);
  });

  it('does not report a historical terminal action that was manually tracked', () => {
    expect(shouldNotifyFinishedAction({
      finished: true,
      isTracked: true,
      wasTrackedAtMount: false,
      notifyOnInitialFinished: false,
    })).toBe(false);
  });

  it('does not notify while an action is still running', () => {
    expect(shouldNotifyFinishedAction({
      finished: false,
      isTracked: true,
      wasTrackedAtMount: false,
      notifyOnInitialFinished: true,
    })).toBe(false);
  });

  it('does not notify a completed action more than once', () => {
    expect(shouldNotifyFinishedAction({
      finished: true,
      previouslyFinished: true,
      isTracked: true,
      wasTrackedAtMount: false,
      notifyOnInitialFinished: true,
    })).toBe(false);
  });

  it('notifies on the usual running to finished transition', () => {
    expect(shouldNotifyFinishedAction({
      finished: true,
      previouslyFinished: false,
      isTracked: true,
      wasTrackedAtMount: true,
      notifyOnInitialFinished: false,
    })).toBe(true);
  });
});

describe('shouldReplayFinishedLockCallback', () => {
  it('replays exactly once when a finished action id is bound by a late local lock', () => {
    const delivered = new Set<number>();
    expect(shouldReplayFinishedLockCallback(901, true, [], delivered)).toBe(false);
    expect(shouldReplayFinishedLockCallback(901, true, [901], delivered)).toBe(true);
    delivered.add(901);
    expect(shouldReplayFinishedLockCallback(901, true, [901], delivered)).toBe(false);
  });

  it('does not replay unfinished or unrelated action states', () => {
    expect(shouldReplayFinishedLockCallback(901, false, [901], new Set())).toBe(false);
    expect(shouldReplayFinishedLockCallback(901, true, [902], new Set())).toBe(false);
  });

  it('leaves the normal unfinished-to-finished transition to the transition callback', () => {
    expect(shouldReplayFinishedLockCallback(901, true, [901], new Set(), false)).toBe(false);
    expect(shouldReplayFinishedLockCallback(901, true, [901], new Set(), true)).toBe(true);
  });
});
