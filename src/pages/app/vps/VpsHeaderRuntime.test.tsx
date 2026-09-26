import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Vps } from '../../../lib/api/vps';
import { VpsHeaderRuntime } from './VpsHeaderRuntime';

vi.mock('../../../app/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const running: Vps = {
  id: 123, hostname: 'example.test', is_running: true,
  uptime: 3026523, loadavg1: 0.06, loadavg5: 0.04, loadavg15: 0,
  process_count: 64, cpu_idle: 99.87,
};
function value(key: string) {
  return screen.getByTestId(`vps.header.runtime.${key}`).querySelector('dd')!.textContent;
}

describe('VPS header current runtime', () => {
  it('uses API load intervals and legacy 100 minus idle CPU calculation', () => {
    render(<VpsHeaderRuntime vps={running} />);
    expect(value('uptime')).toBe('35d 0h');
    expect(value('load')).toBe('0.06 / 0.04 / 0.00');
    expect(value('processes')).toBe('64');
    expect(value('cpu')).toBe('0.13 %');
  });

  it.each([false, undefined])('hides retained metrics when running is %s', (is_running) => {
    render(<VpsHeaderRuntime vps={{ ...running, is_running }} />);
    for (const key of ['uptime', 'load', 'processes', 'cpu']) expect(value(key)).toBe('—');
  });

  it('keeps valid zeros distinct from absent load intervals', () => {
    render(<VpsHeaderRuntime vps={{ ...running, uptime: 0, process_count: 0, cpu_idle: 100, loadavg1: 0, loadavg5: undefined }} />);
    expect(value('uptime')).toBe('0s');
    expect(value('processes')).toBe('0');
    expect(value('cpu')).toBe('0.00 %');
    expect(value('load')).toBe('0.00 / — / 0.00');
  });

  it('does not present missing or invalid measurements as real values', () => {
    render(<VpsHeaderRuntime vps={{ ...running, uptime: NaN, process_count: 1.5, cpu_idle: 101, loadavg1: Infinity, loadavg5: -1, loadavg15: undefined }} />);
    for (const key of ['uptime', 'load', 'processes', 'cpu']) expect(value(key)).toBe('—');
  });
});
