import React, { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from './AppHeader';

vi.mock('../../app/auth', () => ({
  useAuth: () => ({
    canUseAdminUi: false,
    user: { preferred_session_length: 40 * 60 },
  }),
}));

vi.mock('../../app/appMode', () => ({
  useAppMode: () => ({ basePath: '/app' }),
}));

vi.mock('../../app/objectScope', () => ({
  useObjectScope: () => ({ mineUserId: 53 }),
}));

function t(key: any, vars?: Record<string, unknown>): string {
  const translations: Record<string, string> = {
    'auth.session_idle.menu_label': 'Inactivity limit',
    'auth.session_remaining.minutes': `${vars?.['minutes'] ?? ''} min`,
    'common.open_tasks': 'Open tasks',
    'nav.open': 'Open navigation',
    'palette.placeholder.user': 'Search VPS',
    'palette.shortcut_title': 'Shortcut',
    'settings.language.cs': 'CS',
    'settings.language.en': 'EN',
    'settings.language.label': 'Language',
    'settings.language.system': 'System',
    'settings.scope.label': 'Scope',
    'settings.scope.mine': 'Mine',
    'settings.scope.all': 'All',
    'settings.theme.dark': 'Dark',
    'settings.theme.label': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.system': 'System',
    'tasks.title': 'Tasks',
    'user_menu.account': 'Account',
    'user_menu.logout': 'Logout',
    'user_menu.open': 'Open user menu',
    'user_menu.public_status': 'Public status',
  };

  return translations[String(key)] ?? String(key);
}

function HeaderHarness() {
  const syncRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <MemoryRouter>
      <AppHeader
        t={t}
        mode="user"
        canSwitchMode={false}
        shortcutHint="⌘K"
        onOpenMobileNav={() => undefined}
        showSyncIndicator={false}
        syncRef={syncRef}
        syncOpen={syncOpen}
        setSyncOpen={setSyncOpen}
        syncStatus="offline"
        syncTitle="Offline"
        syncBody="Offline"
        syncError={null}
        onRetrySync={() => undefined}
        tasksFailedCount={0}
        tasksActiveCount={0}
        onOpenTasks={() => undefined}
        userMenuRef={userMenuRef}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        authLogin="KerryCZE"
        authRole="admin"
        theme="light"
        language="cs"
        onSetTheme={() => undefined}
        onSetLanguage={() => undefined}
        onGoToOtherMode={() => undefined}
        onGoToProfile={() => undefined}
        onGoToPublicStatus={() => undefined}
        loginLogoutHref="/logout"
      />
    </MemoryRouter>
  );
}

describe('AppHeader', () => {
  it('anchors the user menu below the top-right trigger', () => {
    render(<HeaderHarness />);

    fireEvent.click(screen.getByTestId('shell.user-menu-button'));

    const menu = screen.getByTestId('shell.user-menu');
    expect(menu).toHaveClass('right-0');
    expect(menu).toHaveClass('top-[calc(100%+0.5rem)]');
    expect(menu.className).not.toContain('top-full');
    expect(menu.className).not.toContain('mt-2');
  });

  it('keeps session time informational and out of the user menu', () => {
    render(<HeaderHarness />);

    fireEvent.click(screen.getByTestId('shell.session-remaining'));
    expect(screen.queryByTestId('shell.user-menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shell.user-menu-button'));
    expect(screen.getByTestId('shell.user-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('shell.user-menu.session-remaining')).not.toBeInTheDocument();
  });
});
