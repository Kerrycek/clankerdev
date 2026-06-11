import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getRuntimeConfig } from './config';
import { useAuth } from './auth';
import {
  DEFAULT_SETTINGS,
  normalizeUiSettings,
  loadUiSettingsFromLocalStorage,
  saveUiSettingsToLocalStorage,
  type UiLanguagePreference,
  type UiSettings,
  type UiThemePreference,
} from './uiSettingsModel';

import { HaveApiError } from '../lib/api/haveapi';
import { fetchWebuiUserSetting, saveWebuiUserSetting } from '../lib/api/webuiUserSettings';

export type { UiLanguagePreference, UiSettings, UiThemePreference };

export interface UiSettingsSyncState {
  mode: 'local' | 'server';
  status: 'idle' | 'loading' | 'saving' | 'error';
  lastLoadedAt?: string;
  lastSavedAt?: string;
  error?: string;
}

interface UiSettingsCtx {
  settings: UiSettings;
  setSettings: (s: UiSettings) => void;

  // Convenience helpers
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: UiThemePreference) => void;
  setLanguage: (language: UiLanguagePreference) => void;

  // For diagnostics and future UI
  sync: UiSettingsSyncState;
}

const UiSettingsContext = createContext<UiSettingsCtx | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof HaveApiError) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as any).message);
  return String(err);
}

function parseServerSettingsValue(value: unknown): UiSettings {
  // Accept either a JSON string (preferred) or an object.
  if (typeof value === 'string') {
    try {
      return normalizeUiSettings(JSON.parse(value));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  return normalizeUiSettings(value);
}

/**
 * Provider for UI settings.
 *
 * Persistence:
 * - Always persists to localStorage.
 * - Optionally syncs to the API (HaveAPI) when configured.
 */
export function UiSettingsProvider(props: { children: React.ReactNode }) {
  const auth = useAuth();
  const cfg = getRuntimeConfig();

  const localStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

  const [settings, setSettings] = useState<UiSettings>(() => loadUiSettingsFromLocalStorage(localStorage));

  const serverEnabled = cfg.uiSettings.persistence === 'server' && cfg.auth.kind !== 'none';
  const serverPath = cfg.uiSettings.server.path;
  const serverNamespace = cfg.uiSettings.server.namespace;
  const serverField = cfg.uiSettings.server.field;
  const serverUserKey = auth.status === 'authenticated' ? String(auth.user?.id ?? 'current') : null;

  const [sync, setSync] = useState<UiSettingsSyncState>(() => ({
    mode: serverEnabled ? 'server' : 'local',
    status: 'idle',
  }));

  // Server save bookkeeping (also used to avoid unnecessary writes after server load).
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);
  const skipNextServerSaveRef = useRef(false);
  const [loadedServerKey, setLoadedServerKey] = useState<string | null>(null);

  // Keep sync.mode in sync when config changes.
  useEffect(() => {
    setSync((s) => ({
      ...s,
      mode: serverEnabled ? 'server' : 'local',
    }));
  }, [serverEnabled]);

  useEffect(() => {
    lastSavedJsonRef.current = null;
    skipNextServerSaveRef.current = false;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, [serverUserKey]);

  // Local persistence is always enabled.
  useEffect(() => {
    saveUiSettingsToLocalStorage(localStorage, settings);
  }, [localStorage, settings]);

  // Server load (best-effort) after authentication.
  const loadedFromServerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!serverEnabled) return;
    if (auth.status !== 'authenticated') return;
    const loadKey = serverUserKey ?? 'current';
    if (loadedFromServerRef.current === loadKey) return;

    loadedFromServerRef.current = loadKey;
    let cancelled = false;

    (async () => {
      setSync((s) => ({ ...s, status: 'loading', error: undefined }));

      try {
        const value = await fetchWebuiUserSetting(serverNamespace, serverField);

        if (value === undefined) {
          // Missing record or empty payload. Keep local settings.
          if (cancelled) return;
          setLoadedServerKey(loadKey);
          setSync((s) => ({ ...s, status: 'idle', lastLoadedAt: nowIso() }));
          return;
        }

        const fromServer = parseServerSettingsValue(value);
        const json = JSON.stringify(normalizeUiSettings(fromServer));

        if (cancelled) return;

        // Avoid an immediate write-back caused by the state update.
        skipNextServerSaveRef.current = true;
        lastSavedJsonRef.current = json;

        setSettings(fromServer);
        saveUiSettingsToLocalStorage(localStorage, fromServer);
        setLoadedServerKey(loadKey);
        setSync((s) => ({ ...s, status: 'idle', lastLoadedAt: nowIso() }));
      } catch (e) {
        if (cancelled) return;
        setSync((s) => ({
          ...s,
          status: 'error',
          error: safeErrorMessage(e),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.status, localStorage, serverEnabled, serverField, serverNamespace, serverPath, serverUserKey]);

  // Server save (best-effort, debounced) when settings change.
  useEffect(() => {
    if (!serverEnabled) return;
    if (auth.status !== 'authenticated') return;
    if (!serverUserKey || loadedServerKey !== serverUserKey) return;

    // When we set settings from server, we don't want to immediately write back.
    if (skipNextServerSaveRef.current) {
      skipNextServerSaveRef.current = false;
      return;
    }

    const json = JSON.stringify(normalizeUiSettings(settings));
    if (lastSavedJsonRef.current === json) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSync((s) => ({ ...s, status: 'saving', error: undefined }));
        await saveWebuiUserSetting(serverNamespace, serverField, normalizeUiSettings(settings));

        lastSavedJsonRef.current = json;
        setSync((s) => ({ ...s, status: 'idle', lastSavedAt: nowIso() }));
      } catch (e) {
        setSync((s) => ({
          ...s,
          status: 'error',
          error: safeErrorMessage(e),
        }));
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [auth.status, loadedServerKey, serverEnabled, serverField, serverNamespace, serverPath, serverUserKey, settings]);

  const ctx: UiSettingsCtx = useMemo(
    () => ({
      settings,
      setSettings: (s) => {
        // Normalize immediately so we don't store garbage.
        setSettings(normalizeUiSettings(s));
      },
      setSidebarCollapsed: (collapsed) => setSettings((s) => ({ ...s, sidebarCollapsed: collapsed })),
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setLanguage: (language) => setSettings((s) => ({ ...s, language })),
      sync,
    }),
    [settings, sync]
  );

  return <UiSettingsContext.Provider value={ctx}>{props.children}</UiSettingsContext.Provider>;
}

export function useUiSettings(): UiSettingsCtx {
  const ctx = useContext(UiSettingsContext);
  if (!ctx) {
    throw new Error('useUiSettings must be used within UiSettingsProvider');
  }
  return ctx;
}
