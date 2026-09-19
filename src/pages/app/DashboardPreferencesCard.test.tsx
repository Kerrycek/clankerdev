// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardPreferencesCard } from './DashboardPreferencesCard';

const mocks = vi.hoisted(() => ({
  setDashboardSettings: vi.fn(),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./useDashboardSettings', () => ({
  useDashboardSettingsState: () => ({
    dashboardSettings: {
      density: 'compact',
      hiddenWidgets: [],
      collapsedWidgets: [],
      widgetOrder: ['news', 'outages', 'security', 'cluster'],
    },
    setDashboardSettings: mocks.setDashboardSettings,
  }),
}));

describe('DashboardPreferencesCard', () => {
  it('keeps one focused disclosure trigger while the panel opens and closes', async () => {
    const user = userEvent.setup();
    render(<DashboardPreferencesCard />);

    const trigger = screen.getByTestId('app.dashboard.preferences.toggle');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'app-dashboard-preferences-panel');
    expect(document.getElementById('app-dashboard-preferences-panel')).not.toBeVisible();

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('app.dashboard.preferences.toggle')).toBe(trigger);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('app-dashboard-preferences-panel')).toBeVisible();

    await user.keyboard('{Enter}');

    expect(screen.getByTestId('app.dashboard.preferences.toggle')).toBe(trigger);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('app-dashboard-preferences-panel')).not.toBeVisible();
  });
});
