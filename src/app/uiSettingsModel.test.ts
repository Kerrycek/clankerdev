import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  normalizeUiSettings,
  parseUiSettingsJson,
  toUiSettingsJson,
} from './uiSettingsModel';

describe('uiSettingsModel', () => {
  it('normalizes unknown values to defaults', () => {
    expect(normalizeUiSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes partial objects', () => {
    expect(normalizeUiSettings({ sidebarCollapsed: true })).toEqual({
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
    });

    expect(normalizeUiSettings({ theme: 'dark' })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
    });

    expect(normalizeUiSettings({ language: 'cs' })).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'cs',
    });
  });

  it('ignores legacy ui mode fields (basic/advanced/classic/novice)', () => {
    expect(normalizeUiSettings({ mode: 'basic' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings({ mode: 'advanced' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings({ mode: 'novice' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings({ mode: 'classic' })).toEqual(DEFAULT_SETTINGS);

    // But it must still accept other fields next to legacy mode.
    expect(normalizeUiSettings({ mode: 'basic', theme: 'dark' })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
    });
  });

  it('rejects invalid enum values', () => {
    expect(normalizeUiSettings({ theme: 'midnight' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeUiSettings({ language: 'de' })).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through JSON helpers', () => {
    const json = toUiSettingsJson({
      sidebarCollapsed: true,
      theme: 'dark',
      language: 'cs',
    });
    expect(parseUiSettingsJson(json)).toEqual({
      sidebarCollapsed: true,
      theme: 'dark',
      language: 'cs',
    });
  });

  it('parses invalid JSON safely', () => {
    expect(parseUiSettingsJson('{')).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts legacy stored mode values in JSON', () => {
    expect(parseUiSettingsJson('{"mode":"novice"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseUiSettingsJson('{"mode":"classic","theme":"dark"}')).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
    });
  });
});
