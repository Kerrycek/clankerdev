import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { AuthProvider } from '../app/auth';
import { getRuntimeConfig } from '../app/config';
import { UiSettingsProvider } from '../app/uiSettings';
import { ThemeProvider } from '../app/theme';
import { I18nProvider } from '../app/i18n';
import { ToastsProvider } from '../app/toasts';
import { DocumentTitleManager } from '../components/layout/DocumentTitleManager';
import { sanitizePostLoginPath, withRouterBasename } from '../lib/routerPaths';

function currentRouterPath(location: ReturnType<typeof useLocation>): string {
  const cfg = getRuntimeConfig();
  const localPath = sanitizePostLoginPath(`${location.pathname}${location.search}${location.hash}`);
  return withRouterBasename(localPath, cfg.routerBasename);
}

function stripRouterBasename(pathname: string): string {
  const basename = getRuntimeConfig().routerBasename;
  if (!basename) return pathname;
  if (pathname === basename) return '/';
  if (pathname.startsWith(`${basename}/`)) return pathname.slice(basename.length) || '/';
  return pathname;
}

function shouldSyncUiSettings(pathname: string): boolean {
  const path = stripRouterBasename(pathname);
  return path === '/app' || path.startsWith('/app/') || path === '/admin' || path.startsWith('/admin/');
}

export function RouteProvidersLayout() {
  // Re-render on navigation so auth/login/logout URLs always use the full browser path,
  // including any configured router basename.
  const location = useLocation();
  const shouldSyncSettings = shouldSyncUiSettings(location.pathname);

  return (
    <AuthProvider nextPath={currentRouterPath(location)} redirectExpiredSessions={shouldSyncSettings}>
      <UiSettingsProvider serverSyncEnabled={shouldSyncSettings}>
        <ThemeProvider>
          <I18nProvider>
            <DocumentTitleManager />
            <ToastsProvider>
              <Outlet />
            </ToastsProvider>
          </I18nProvider>
        </ThemeProvider>
      </UiSettingsProvider>
    </AuthProvider>
  );
}
