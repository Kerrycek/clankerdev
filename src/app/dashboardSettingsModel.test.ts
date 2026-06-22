import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_WIDGET_IDS,
  DEFAULT_DASHBOARD_SETTINGS,
  isDashboardEssentialWidget,
  moveDashboardWidget,
  normalizeDashboardSettings,
  setDashboardDensity,
  toggleDashboardWidgetCollapsed,
  toggleDashboardWidgetHidden,
  visibleDashboardWidgets,
} from './dashboardSettingsModel';

describe('dashboardSettingsModel', () => {
  it('normalizes unknown dashboard settings to defaults', () => {
    expect(normalizeDashboardSettings(undefined)).toEqual(DEFAULT_DASHBOARD_SETTINGS);
    expect(normalizeDashboardSettings({ density: 'tiny' })).toEqual(DEFAULT_DASHBOARD_SETTINGS);
  });

  it('normalizes density, order and duplicate widget lists', () => {
    expect(
      normalizeDashboardSettings({
        density: 'compact',
        widgetOrder: ['news', 'security', 'news', 'unknown'],
        hiddenWidgets: ['news', 'cluster', 'bad'],
        collapsedWidgets: ['cluster', 'outages', 'cluster'],
      }),
    ).toEqual({
      density: 'compact',
      widgetOrder: ['news', 'security', 'outages', 'cluster'],
      hiddenWidgets: ['news'],
      collapsedWidgets: ['cluster', 'outages'],
    });
  });

  it('keeps security and cluster available even if old preferences tried to hide them', () => {
    const normalized = normalizeDashboardSettings({ hiddenWidgets: ['outages', 'security', 'cluster'] });

    expect(isDashboardEssentialWidget('security')).toBe(true);
    expect(isDashboardEssentialWidget('cluster')).toBe(true);
    expect(visibleDashboardWidgets(normalized)).toEqual(['security', 'news', 'cluster']);
  });

  it('updates density and visibility without losing normalized order', () => {
    const compact = setDashboardDensity(DEFAULT_DASHBOARD_SETTINGS, 'compact');
    const hidden = toggleDashboardWidgetHidden(compact, 'news', true);

    expect(hidden.density).toBe('compact');
    expect(hidden.widgetOrder).toEqual([...DASHBOARD_WIDGET_IDS]);
    expect(visibleDashboardWidgets(hidden)).toEqual(['outages', 'security', 'cluster']);

    expect(toggleDashboardWidgetHidden(hidden, 'security', true).hiddenWidgets).toEqual(['news']);
  });

  it('collapses widgets independently from visibility', () => {
    const collapsed = toggleDashboardWidgetCollapsed(DEFAULT_DASHBOARD_SETTINGS, 'cluster', true);
    expect(collapsed.collapsedWidgets).toEqual(['cluster']);

    const expanded = toggleDashboardWidgetCollapsed(collapsed, 'cluster', false);
    expect(expanded.collapsedWidgets).toEqual([]);
  });

  it('moves widgets up and down within the normalized order', () => {
    const movedUp = moveDashboardWidget(DEFAULT_DASHBOARD_SETTINGS, 'news', 'up');
    expect(movedUp.widgetOrder).toEqual(['outages', 'news', 'security', 'cluster']);

    const movedDown = moveDashboardWidget(movedUp, 'outages', 'down');
    expect(movedDown.widgetOrder).toEqual(['news', 'outages', 'security', 'cluster']);

    expect(moveDashboardWidget(movedDown, 'cluster', 'down').widgetOrder).toEqual(movedDown.widgetOrder);
  });
});
