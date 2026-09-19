import React, { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchUserObjects } from '../../lib/search/userGlobalSearch';
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

vi.mock('../../lib/search/userGlobalSearch', () => ({
  searchUserObjects: vi.fn(),
}));

function t(key: any, vars?: Record<string, unknown>): string {
  const translations: Record<string, string> = {
    'auth.session_idle.menu_label': 'Inactivity limit',
    'auth.session_remaining.minutes': `${vars?.['minutes'] ?? ''} min`,
    'common.open_tasks': 'Open tasks',
    'nav.open': 'Open navigation',
    'palette.placeholder.user': 'Search VPS',
    'palette.group.vps': 'VPS',
    'palette.loading': 'Loading…',
    'palette.error_prefix': 'Search failed',
    'palette.empty.no_results': 'No results',
    'palette.empty.type_to_search': 'Type to search',
    'palette.shortcut_title': 'Shortcut',
    'search.inline.aria': 'Search objects',
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

function HeaderHarness(props: { onOpenPalette?: () => void } = {}) {
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
        onOpenPalette={props.onOpenPalette ?? (() => undefined)}
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
  beforeEach(() => {
    vi.mocked(searchUserObjects).mockReset();
  });

  it('opens the command palette from the mobile search trigger', () => {
    const onOpenPalette = vi.fn();
    render(<HeaderHarness onOpenPalette={onOpenPalette} />);

    fireEvent.click(screen.getByTestId('palette.open'));

    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

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

  it('exposes inline results as a keyboard-controlled combobox and collapses cleanly on Escape', async () => {
    vi.mocked(searchUserObjects).mockResolvedValue([
      {
        key: 'vps:11',
        group: 'vps',
        primary: 'mail.example',
        secondary: 'VPS #11',
        href: '/app/vps/11',
        id: 11,
        resource: 'Vps',
        raw: {},
      },
      {
        key: 'vps:12',
        group: 'vps',
        primary: 'web.example',
        secondary: 'VPS #12',
        href: '/app/vps/12',
        id: 12,
        resource: 'Vps',
        raw: {},
      },
    ]);
    render(<HeaderHarness />);

    const input = screen.getByRole('combobox', { name: 'Search objects' });
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-controls', 'global-search-inline-listbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    input.focus();
    fireEvent.change(input, { target: { value: 'example' } });

    const pendingStatus = screen.getByTestId('shell.inline-search.status');
    expect(pendingStatus).toHaveTextContent('Loading…');
    expect(pendingStatus).not.toHaveTextContent('No results');
    expect(input).toHaveAttribute('aria-busy', 'true');

    const listbox = await screen.findByRole('listbox', { name: 'Search objects' });
    expect(listbox).toHaveAttribute('id', 'global-search-inline-listbox');

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('id', 'global-search-inline-listbox-option-0');
    expect(options[1]).toHaveAttribute('id', 'global-search-inline-listbox-option-1');
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('example');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox', { name: 'Search objects' })).not.toBeInTheDocument();
  });

  it('announces loading, empty, and error states without exposing an empty listbox', async () => {
    let resolveSearch!: (value: Awaited<ReturnType<typeof searchUserObjects>>) => void;
    vi.mocked(searchUserObjects)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSearch = resolve;
      }))
      .mockRejectedValueOnce(new Error('offline'));
    render(<HeaderHarness />);

    const input = screen.getByRole('combobox', { name: 'Search objects' });
    input.focus();
    fireEvent.change(input, { target: { value: 'pending' } });

    const loadingStatus = screen.getByTestId('shell.inline-search.status');
    expect(loadingStatus).toHaveTextContent('Loading…');
    expect(loadingStatus).not.toHaveTextContent('No results');
    expect(searchUserObjects).not.toHaveBeenCalled();
    expect(loadingStatus).toHaveAttribute('id', 'global-search-inline-status');
    expect(loadingStatus).toHaveAttribute('role', 'status');
    expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
    expect(loadingStatus).not.toHaveAttribute('aria-busy');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'global-search-inline-status');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await waitFor(() => expect(searchUserObjects).toHaveBeenCalledTimes(1));
    expect(loadingStatus).toHaveTextContent('Loading…');
    expect(input).toHaveAttribute('aria-busy', 'true');

    await act(async () => resolveSearch([]));

    await waitFor(() => expect(loadingStatus).toHaveTextContent('No results'));
    expect(loadingStatus).not.toHaveAttribute('aria-busy');
    expect(input).not.toHaveAttribute('aria-busy');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'failure' } });

    expect(loadingStatus).toHaveTextContent('Loading…');
    expect(loadingStatus).not.toHaveTextContent('No results');
    expect(loadingStatus).not.toHaveTextContent('Search failed');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(searchUserObjects).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(loadingStatus).toHaveTextContent('Search failed: offline'));
    expect(loadingStatus).toHaveAttribute('role', 'status');
    expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
    expect(input).toHaveAttribute('aria-describedby', 'global-search-inline-status');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
