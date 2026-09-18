import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { VpsActionsMenu, VpsTabsNav } from './VpsNavigation';

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('VPS detail navigation context', () => {
  it('puts the member context into every VPS tab href', () => {
    render(
      <MemoryRouter>
        <VpsTabsNav basePath="/admin" vpsId={14} contextSearch="?user=1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'vps.tabs.overview' })).toHaveAttribute('href', '/admin/vps/14?user=1');
    expect(screen.getByRole('link', { name: 'vps.tabs.access' })).toHaveAttribute('href', '/admin/vps/14/access?user=1');
    expect(screen.getByRole('link', { name: 'vps.tabs.console' })).toHaveAttribute('href', '/admin/vps/14/console?user=1');
  });

  it('puts the member context into section and lifecycle menu destinations', () => {
    render(
      <VpsActionsMenu
        basePath="/admin"
        vpsId={14}
        canMutateVps
        primaryHeaderAction="access"
        startAllowed
        restartAllowed
        stopAllowed
        passwordAllowed
        showTasks={false}
        showSupportActions
        showAdminActions
        ownerUserId={1}
        contextSearch="?user=1"
        onSelect={() => undefined}
      />,
    );

    const menu = screen.getByTestId('vps.actions.menu');
    expect(menu.querySelector('option[value="/admin/vps/14/config?user=1"]')).not.toBeNull();
    expect(menu.querySelector('option[value="/admin/vps/14/lifecycle?user=1"]')).not.toBeNull();
    expect(menu.querySelector('option[value="/admin/vps/14/lifecycle/delete?user=1"]')).not.toBeNull();
    expect(menu.querySelector('option[value="/admin/vps/14/lifecycle/migrate?user=1"]')).not.toBeNull();
  });
});
