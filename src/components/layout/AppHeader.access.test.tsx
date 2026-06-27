// i18n-ignore-file

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { AppHeader } from './AppHeader';

const t = (key: string, vars?: Record<string, unknown>) => {
  let out = key;
  for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, String(v));
  return out;
};

function renderHeader(opts: {
  mode?: 'user' | 'admin';
  canSwitchMode: boolean;
  userMenuOpen?: boolean;
  tasksOpen?: boolean;
  showSyncIndicator?: boolean;
  syncOpen?: boolean;
}) {
  const syncRef = React.createRef<HTMLDivElement>();
  const userMenuRef = React.createRef<HTMLDivElement>();

  return render(
    <AppHeader
      t={t}
      mode={opts.mode ?? 'user'}
      canSwitchMode={opts.canSwitchMode}
      shortcutHint="Ctrl K"
      mobileNavOpen={false}
      onOpenMobileNav={vi.fn()}
      onOpenPalette={vi.fn()}
      showSyncIndicator={opts.showSyncIndicator ?? false}
      syncRef={syncRef}
      syncOpen={opts.syncOpen ?? false}
      setSyncOpen={vi.fn()}
      syncStatus="error"
      syncTitle="sync.title"
      syncBody="sync.body"
      syncError={undefined}
      onRetrySync={vi.fn()}
      tasksFailedCount={0}
      tasksActiveCount={0}
      tasksOpen={opts.tasksOpen ?? false}
      onOpenTasks={vi.fn()}
      userMenuRef={userMenuRef}
      userMenuOpen={opts.userMenuOpen ?? true}
      setUserMenuOpen={vi.fn()}
      authLogin="alice"
      authRole={opts.canSwitchMode ? 'admin' : 'user'}
      theme="system"
      language="en"
      onSetTheme={vi.fn()}
      onSetLanguage={vi.fn()}
      onGoToOtherMode={vi.fn()}
      onGoToProfile={vi.fn()}
      onGoToPublicStatus={vi.fn()}
      loginLogoutHref="/logout"
    />
  );
}

describe('AppHeader admin scope affordances', () => {
  test('hides scope indicator and scope switch controls for users without admin UI access', () => {
    renderHeader({ canSwitchMode: false, userMenuOpen: true });

    expect(screen.queryByTestId('scope.indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell.user-menu')).toBeVisible();
    expect(screen.queryByTestId('shell.user-menu.scope.mine')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell.user-menu.scope.all')).not.toBeInTheDocument();
  });

  test('shows scope indicator and scope switch controls for users with admin UI access', () => {
    renderHeader({ mode: 'admin', canSwitchMode: true, userMenuOpen: true });

    expect(screen.getByTestId('scope.indicator')).toBeVisible();
    expect(screen.getByTestId('shell.user-menu.scope.mine')).toBeVisible();
    expect(screen.getByTestId('shell.user-menu.scope.all')).toBeVisible();
  });

  test('exposes expanded state, controlled popovers and selected settings to assistive technology', () => {
    renderHeader({
      mode: 'admin',
      canSwitchMode: true,
      userMenuOpen: true,
      tasksOpen: true,
      showSyncIndicator: true,
      syncOpen: true,
    });

    expect(screen.getByTestId('shell.user-menu-button')).toHaveAttribute('aria-controls', 'shell-user-menu');
    expect(screen.getByTestId('shell.user-menu-button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('shell.user-menu')).toHaveAttribute('role', 'dialog');
    expect(screen.getByTestId('shell.user-menu.scope.all')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('shell.user-menu.scope.mine')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('shell.user-menu.theme.system')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('shell.user-menu.language.en')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('shell.user-menu.language.en')).toHaveAttribute('aria-label', 'settings.language.en');

    expect(screen.getByTestId('tasks.open-button')).toHaveAttribute('aria-controls', 'app-tasks-drawer');
    expect(screen.getByTestId('tasks.open-button')).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByTestId('shell.sync-indicator')).toHaveAttribute('aria-controls', 'shell-sync-panel');
    expect(screen.getByTestId('shell.sync-indicator')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('shell.sync-panel')).toHaveAttribute('role', 'dialog');
  });

});
