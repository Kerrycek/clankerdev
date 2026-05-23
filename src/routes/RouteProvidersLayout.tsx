import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { AuthProvider } from '../app/auth';
import { UiSettingsProvider } from '../app/uiSettings';
import { ThemeProvider } from '../app/theme';
import { I18nProvider } from '../app/i18n';
import { ToastsProvider } from '../app/toasts';
import { DocumentTitleManager } from '../components/layout/DocumentTitleManager';

function currentBrowserPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search + window.location.hash;
}

export function RouteProvidersLayout() {
  // Re-render on navigation so auth/login/logout URLs always use the full browser path,
  // including any configured router basename.
  useLocation();

  return (
    <AuthProvider nextPath={currentBrowserPath()}>
      <UiSettingsProvider>
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
