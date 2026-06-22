import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  isUiTipVisible,
  normalizeUiSettings,
  parseUiSettingsJson,
  resetUiSettingsPreferences,
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
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
      theme: 'dark',
      language: 'cs',
      tips: {
        sidebarTimeZone: 'dismissed',
      },
      dashboard: {
        ...DEFAULT_SETTINGS.dashboard,
        density: 'compact',
        hiddenWidgets: ['news'],
      },
    });
    expect(parseUiSettingsJson(json)).toEqual({
      ...DEFAULT_SETTINGS,
      sidebarCollapsed: true,
      theme: 'dark',
      language: 'cs',
      tips: {
        sidebarTimeZone: 'dismissed',
      },
      dashboard: {
        ...DEFAULT_SETTINGS.dashboard,
        density: 'compact',
        hiddenWidgets: ['news'],
      },
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



  it('normalizes dashboard preferences alongside global UI preferences', () => {
    expect(
      normalizeUiSettings({
        dashboard: {
          density: 'compact',
          widgetOrder: ['news', 'security'],
          hiddenWidgets: ['outages', 'security'],
          collapsedWidgets: ['cluster'],
        },
      }).dashboard,
    ).toEqual({
      density: 'compact',
      widgetOrder: ['news', 'security', 'outages', 'cluster'],
      hiddenWidgets: ['outages'],
      collapsedWidgets: ['cluster'],
    });
  });

  it('makes sidebar time zone tip lifecycle explicit', () => {
    expect(isUiTipVisible(DEFAULT_SETTINGS, 'sidebarTimeZone')).toBe(true);

    const dismissed = normalizeUiSettings({
      tips: {
        sidebarTimeZone: 'dismissed',
      },
    });

    expect(dismissed.tips.sidebarTimeZone).toBe('dismissed');
    expect(isUiTipVisible(dismissed, 'sidebarTimeZone')).toBe(false);

    const accepted = normalizeUiSettings({
      tips: {
        sidebarTimeZone: 'accepted',
      },
    });

    expect(accepted.tips.sidebarTimeZone).toBe('accepted');
    expect(isUiTipVisible(accepted, 'sidebarTimeZone')).toBe(false);
  });

  it('resets preferences without clearing tips unless requested', () => {
    const settings = normalizeUiSettings({
      sidebarCollapsed: true,
      theme: 'dark',
      language: 'cs',
      tips: {
        sidebarTimeZone: 'dismissed',
      },
    });

    expect(resetUiSettingsPreferences(settings)).toEqual({
      ...DEFAULT_SETTINGS,
      tips: {
        sidebarTimeZone: 'dismissed',
      },
    });

    expect(resetUiSettingsPreferences(settings, { includeTips: true })).toEqual(DEFAULT_SETTINGS);
  });
});
