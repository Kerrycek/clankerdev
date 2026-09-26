import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSessionIdleLimitSeconds, startIdleSession } from './idleSession';

const key = 'vpsadmin.idle.test-session';
let cleanup: () => void;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-26T12:00:00Z')); localStorage.clear(); });
afterEach(() => { cleanup?.(); vi.restoreAllMocks(); vi.useRealTimers(); });
function start(seconds = 2400, sessionKey = 'test-session') {
  const onDeadline = vi.fn();
  const onExpire = vi.fn();
  cleanup = startIdleSession({ seconds, sessionKey, onDeadline, onExpire });
  return { onDeadline, onExpire };
}
describe('browser inactivity deadline', () => {
  it('expires once after 40 minutes even while synthetic/background events continue', () => {
    const { onDeadline, onExpire } = start();
    const deadline = onDeadline.mock.lastCall?.[0];
    vi.advanceTimersByTime(39 * 60_000);
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('focus'));
    expect(onDeadline.mock.lastCall?.[0]).toBe(deadline);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it('retains the deadline through remount/reload of the same BFF session', () => {
    const first = start();
    const deadline = first.onDeadline.mock.lastCall?.[0];
    vi.advanceTimersByTime(10 * 60_000);
    cleanup();
    expect(start().onDeadline.mock.lastCall?.[0]).toBe(deadline);
  });
  it('picks up activity from another tab without the background tab renewing it', () => {
    const { onDeadline, onExpire } = start();
    vi.advanceTimersByTime(30 * 60_000);
    localStorage.setItem(key, String(Date.now()));
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(onDeadline.mock.lastCall?.[0]).toBe(Date.now() + 40 * 60_000);
    vi.advanceTimersByTime(39 * 60_000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it('checks elapsed wall time after sleep and does not revive an expired session', () => {
    const { onExpire } = start();
    vi.setSystemTime(Date.now() + 41 * 60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onExpire).toHaveBeenCalledTimes(1);
    cleanup();
    expect(start().onExpire).toHaveBeenCalledTimes(1);
  });
  it('starts a fresh deadline after a different login', () => {
    start(); cleanup();
    vi.setSystemTime(Date.now() + 41 * 60_000);
    expect(start(2400, 'new-session').onExpire).not.toHaveBeenCalled();
  });
  it('honors disabled timeout and removes listeners on cleanup', () => {
    const disabled = start(0);
    vi.advanceTimersByTime(60 * 60_000);
    expect(disabled.onDeadline).not.toHaveBeenCalled();
    expect(disabled.onExpire).not.toHaveBeenCalled();
    const active = start(1); cleanup();
    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('focus'));
    expect(active.onExpire).not.toHaveBeenCalled();
  });
  it('still expires if browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { onExpire } = start(2);
    vi.advanceTimersByTime(2000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it('validates configured limits without guessing one', () => {
    expect(readSessionIdleLimitSeconds('2400')).toBe(2400);
    expect(readSessionIdleLimitSeconds(0)).toBe(0);
    for (const value of [null, undefined, '', -1, Infinity, 'bad']) expect(readSessionIdleLimitSeconds(value)).toBeNull();
  });
});
