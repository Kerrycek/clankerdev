import { useCallback } from 'react';

import { useUiSettings } from '../../app/uiSettings';
import { normalizeDashboardSettings, type DashboardSettings } from '../../app/dashboardSettingsModel';

export function useDashboardSettingsState() {
  const ui = useUiSettings();
  const dashboardSettings = normalizeDashboardSettings(ui.settings.dashboard);

  const setDashboardSettings = useCallback(
    (nextDashboardSettings: DashboardSettings) => {
      ui.setSettings({
        ...ui.settings,
        dashboard: normalizeDashboardSettings(nextDashboardSettings),
      });
    },
    [ui],
  );

  return {
    dashboardSettings,
    setDashboardSettings,
  };
}
