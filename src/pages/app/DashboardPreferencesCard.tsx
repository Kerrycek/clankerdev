import React, { useState } from 'react';

import {
  DEFAULT_DASHBOARD_SETTINGS,
  isDashboardEssentialWidget,
  moveDashboardWidget,
  setDashboardDensity,
  toggleDashboardWidgetCollapsed,
  toggleDashboardWidgetHidden,
  type DashboardDensity,
  type DashboardWidgetId,
} from '../../app/dashboardSettingsModel';
import { useI18n } from '../../app/i18n';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { SwitchRow } from '../../components/ui/SwitchRow';

import { useDashboardSettingsState } from './useDashboardSettings';

function widgetLabelKey(id: DashboardWidgetId): string {
  return `dashboard.preferences.widget.${id}.label`;
}

function widgetDescriptionKey(id: DashboardWidgetId): string {
  return `dashboard.preferences.widget.${id}.description`;
}

export function DashboardPreferencesCard() {
  const { t } = useI18n();
  const { dashboardSettings, setDashboardSettings } = useDashboardSettingsState();
  const [open, setOpen] = useState(false);

  const hiddenCount = dashboardSettings.hiddenWidgets.length;
  const collapsedCount = dashboardSettings.collapsedWidgets.length;

  const updateDensity = (density: DashboardDensity) => {
    setDashboardSettings(setDashboardDensity(dashboardSettings, density));
  };

  const reset = () => setDashboardSettings(DEFAULT_DASHBOARD_SETTINGS);

  return (
    <Card testId="app.dashboard.preferences.card">
      <CardHeader
        title={t('dashboard.preferences.title')}
        subtitle={t('dashboard.preferences.summary', {
          density: t(`dashboard.preferences.density.${dashboardSettings.density}`),
          hidden: hiddenCount,
          collapsed: collapsedCount,
        })}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            testId="app.dashboard.preferences.toggle"
          >
            {open ? t('dashboard.preferences.close') : t('dashboard.preferences.open')}
          </Button>
        }
      />

      {open ? (
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">{t('dashboard.preferences.density.label')}</span>
                <Select
                  value={dashboardSettings.density}
                  onChange={(event) => updateDensity(event.target.value === 'compact' ? 'compact' : 'comfortable')}
                  testId="app.dashboard.preferences.density"
                  ariaLabel={t('dashboard.preferences.density.label')}
                  options={[
                    { value: 'comfortable', label: t('dashboard.preferences.density.comfortable') },
                    { value: 'compact', label: t('dashboard.preferences.density.compact') },
                  ]}
                />
              </label>
              <div className="text-xs text-muted">{t('dashboard.preferences.density.help')}</div>
              <Button variant="secondary" size="sm" onClick={reset} testId="app.dashboard.preferences.reset">
                {t('dashboard.preferences.reset')}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">{t('dashboard.preferences.widgets.title')}</div>
                <div className="text-xs text-muted">{t('dashboard.preferences.widgets.description')}</div>
              </div>

              <div className="space-y-2">
                {dashboardSettings.widgetOrder.map((id, index) => {
                  const hidden = dashboardSettings.hiddenWidgets.includes(id);
                  const collapsed = dashboardSettings.collapsedWidgets.includes(id);
                  const essential = isDashboardEssentialWidget(id);

                  return (
                    <div
                      key={id}
                      className="grid gap-2 rounded-md border border-border bg-surface-2 p-3 md:grid-cols-[1fr_auto]"
                      data-testid={`app.dashboard.preferences.widget.${id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{t(widgetLabelKey(id))}</div>
                          {essential ? <Badge variant="info">{t('dashboard.preferences.widget.always_visible')}</Badge> : null}
                          {hidden ? <Badge variant="neutral">{t('dashboard.preferences.widget.hidden')}</Badge> : null}
                          {collapsed ? <Badge variant="neutral">{t('dashboard.preferences.widget.collapsed')}</Badge> : null}
                        </div>
                        <div className="text-xs text-muted">{t(widgetDescriptionKey(id))}</div>
                        <SwitchRow
                          label={t('dashboard.preferences.widget.visible')}
                          description={
                            essential
                              ? t('dashboard.preferences.widget.essential_visibility_help')
                              : t('dashboard.preferences.widget.visibility_help')
                          }
                          checked={!hidden}
                          disabled={essential}
                          onChange={(checked) => setDashboardSettings(toggleDashboardWidgetHidden(dashboardSettings, id, !checked))}
                          testId={`app.dashboard.preferences.widget.${id}.visible`}
                        />
                      </div>

                      <div className="flex flex-wrap items-start gap-2 md:justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => setDashboardSettings(moveDashboardWidget(dashboardSettings, id, 'up'))}
                          testId={`app.dashboard.preferences.widget.${id}.up`}
                        >
                          {t('dashboard.preferences.widget.move_up')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={index === dashboardSettings.widgetOrder.length - 1}
                          onClick={() => setDashboardSettings(moveDashboardWidget(dashboardSettings, id, 'down'))}
                          testId={`app.dashboard.preferences.widget.${id}.down`}
                        >
                          {t('dashboard.preferences.widget.move_down')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setDashboardSettings(toggleDashboardWidgetCollapsed(dashboardSettings, id, !collapsed))
                          }
                          testId={`app.dashboard.preferences.widget.${id}.collapse`}
                        >
                          {collapsed ? t('dashboard.preferences.widget.expand') : t('dashboard.preferences.widget.collapse')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardBody>
      ) : null}
    </Card>
  );
}
