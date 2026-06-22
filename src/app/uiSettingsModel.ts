import {
  DEFAULT_DASHBOARD_SETTINGS,
  cloneDashboardSettings,
  normalizeDashboardSettings,
  type DashboardDensity,
  type DashboardSettings,
  type DashboardWidgetId,
} from './dashboardSettingsModel';

export type { DashboardDensity, DashboardSettings, DashboardWidgetId };

export type UiThemePreference = 'system' | 'light' | 'dark';
export type UiLanguagePreference = 'system' | 'en' | 'cs';
export type UiTipLifecycleState = 'visible' | 'dismissed' | 'accepted';

export interface UiTipSettings {
  sidebarTimeZone: UiTipLifecycleState;
}

/**
 * Unified UI settings.
 *
 * Note: older builds stored an additional UI-mode field. The current UI ignores
 * that obsolete field for backwards compatibility when reading persisted settings.
 */
export interface UiSettings {
  sidebarCollapsed: boolean;
  theme: UiThemePreference;
  language: UiLanguagePreference;
  tips: UiTipSettings;
  dashboard: DashboardSettings;
}

export const DEFAULT_SETTINGS: UiSettings = {
  sidebarCollapsed: false,
  theme: 'system',
  language: 'system',
  tips: {
    sidebarTimeZone: 'visible',
  },
  dashboard: cloneDashboardSettings(DEFAULT_DASHBOARD_SETTINGS),
};

export const STORAGE_KEY = 'vpsadmin.uiSettings.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Coerce unknown input into a valid UiSettings object.
 *
 * - Unknown fields are ignored.
 * - Missing fields fall back to DEFAULT_SETTINGS.
 * - Obsolete legacy mode fields are accepted but ignored.
 */
export function normalizeUiSettings(input: unknown): UiSettings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS };

  // Backward compatibility: ignore any obsolete stored mode field.
  // - legacy values: classic/novice

  const sidebarCollapsedRaw = input['sidebarCollapsed'];
  const sidebarCollapsed =
    typeof sidebarCollapsedRaw === 'boolean' ? sidebarCollapsedRaw : DEFAULT_SETTINGS.sidebarCollapsed;

  const themeRaw = input['theme'];
  const theme: UiThemePreference = themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : 'system';

  const languageRaw = input['language'];
  const language: UiLanguagePreference = languageRaw === 'en' || languageRaw === 'cs' ? languageRaw : 'system';

  const tipsRaw = input['tips'];
  const tipsRecord = isRecord(tipsRaw) ? tipsRaw : {};
  const sidebarTimeZoneRaw = tipsRecord['sidebarTimeZone'];
  const sidebarTimeZone: UiTipLifecycleState =
    sidebarTimeZoneRaw === 'dismissed' || sidebarTimeZoneRaw === 'accepted'
      ? sidebarTimeZoneRaw
      : DEFAULT_SETTINGS.tips.sidebarTimeZone;

  return {
    sidebarCollapsed,
    theme,
    language,
    tips: {
      sidebarTimeZone,
    },
    dashboard: normalizeDashboardSettings(input['dashboard']),
  };
}

export function resetUiSettingsPreferences(settings: UiSettings, opts?: { includeTips?: boolean }): UiSettings {
  const normalized = normalizeUiSettings(settings);

  return {
    ...DEFAULT_SETTINGS,
    tips: opts?.includeTips ? { ...DEFAULT_SETTINGS.tips } : normalized.tips,
  };
}

export function isUiTipVisible(settings: UiSettings, tip: keyof UiTipSettings): boolean {
  return normalizeUiSettings(settings).tips[tip] === 'visible';
}

export function parseUiSettingsJson(raw: string): UiSettings {
  try {
    return normalizeUiSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function toUiSettingsJson(settings: UiSettings): string {
  // Store the normalized form only.
  return JSON.stringify(normalizeUiSettings(settings));
}

export function loadUiSettingsFromLocalStorage(storage?: Storage): UiSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  return parseUiSettingsJson(raw);
}

export function saveUiSettingsToLocalStorage(storage: Storage | undefined, settings: UiSettings): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, toUiSettingsJson(settings));
}
