export const DASHBOARD_WIDGET_IDS = ['news', 'outages', 'security', 'cluster'] as const;
export const DASHBOARD_ESSENTIAL_WIDGET_IDS = ['security', 'cluster'] as const;
const LEGACY_DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = ['outages', 'security', 'news', 'cluster'];

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];
export type DashboardDensity = 'comfortable' | 'compact';

export interface DashboardSettings {
  density: DashboardDensity;
  hiddenWidgets: DashboardWidgetId[];
  collapsedWidgets: DashboardWidgetId[];
  widgetOrder: DashboardWidgetId[];
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  density: 'compact',
  hiddenWidgets: [],
  collapsedWidgets: [],
  widgetOrder: [...DASHBOARD_WIDGET_IDS],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

export function isDashboardEssentialWidget(id: DashboardWidgetId): boolean {
  return (DASHBOARD_ESSENTIAL_WIDGET_IDS as readonly string[]).includes(id);
}

function uniqueWidgetIds(value: unknown): DashboardWidgetId[] {
  if (!Array.isArray(value)) return [];

  const out: DashboardWidgetId[] = [];
  for (const item of value) {
    if (isDashboardWidgetId(item) && !out.includes(item)) out.push(item);
  }

  return out;
}

function normalizeWidgetOrder(value: unknown): DashboardWidgetId[] {
  const fromInput = uniqueWidgetIds(value);
  if (
    fromInput.length === LEGACY_DEFAULT_WIDGET_ORDER.length &&
    fromInput.every((id, index) => id === LEGACY_DEFAULT_WIDGET_ORDER[index])
  ) {
    return [...DASHBOARD_WIDGET_IDS];
  }

  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !fromInput.includes(id));
  return [...fromInput, ...missing];
}

function normalizeHiddenWidgets(value: unknown): DashboardWidgetId[] {
  return uniqueWidgetIds(value).filter((id) => !isDashboardEssentialWidget(id));
}

export function cloneDashboardSettings(settings: DashboardSettings): DashboardSettings {
  return {
    density: settings.density,
    hiddenWidgets: [...settings.hiddenWidgets],
    collapsedWidgets: [...settings.collapsedWidgets],
    widgetOrder: [...settings.widgetOrder],
  };
}

export function normalizeDashboardSettings(input: unknown): DashboardSettings {
  if (!isRecord(input)) return cloneDashboardSettings(DEFAULT_DASHBOARD_SETTINGS);

  const densityRaw = input['density'];
  const density: DashboardDensity = densityRaw === 'comfortable' ? 'comfortable' : 'compact';

  return {
    density,
    hiddenWidgets: normalizeHiddenWidgets(input['hiddenWidgets']),
    collapsedWidgets: uniqueWidgetIds(input['collapsedWidgets']),
    widgetOrder: normalizeWidgetOrder(input['widgetOrder']),
  };
}

export function visibleDashboardWidgets(settings: DashboardSettings): DashboardWidgetId[] {
  const normalized = normalizeDashboardSettings(settings);
  return normalized.widgetOrder.filter((id) => !normalized.hiddenWidgets.includes(id));
}

export function isDashboardWidgetCollapsed(settings: DashboardSettings, id: DashboardWidgetId): boolean {
  return normalizeDashboardSettings(settings).collapsedWidgets.includes(id);
}

export function setDashboardDensity(settings: DashboardSettings, density: DashboardDensity): DashboardSettings {
  return {
    ...normalizeDashboardSettings(settings),
    density,
  };
}

export function toggleDashboardWidgetHidden(
  settings: DashboardSettings,
  id: DashboardWidgetId,
  hidden: boolean,
): DashboardSettings {
  const normalized = normalizeDashboardSettings(settings);
  const hiddenSet = new Set(normalized.hiddenWidgets);

  if (hidden && !isDashboardEssentialWidget(id)) hiddenSet.add(id);
  else hiddenSet.delete(id);

  return {
    ...normalized,
    hiddenWidgets: DASHBOARD_WIDGET_IDS.filter((widgetId) => hiddenSet.has(widgetId)),
  };
}

export function toggleDashboardWidgetCollapsed(
  settings: DashboardSettings,
  id: DashboardWidgetId,
  collapsed: boolean,
): DashboardSettings {
  const normalized = normalizeDashboardSettings(settings);
  const collapsedSet = new Set(normalized.collapsedWidgets);

  if (collapsed) collapsedSet.add(id);
  else collapsedSet.delete(id);

  return {
    ...normalized,
    collapsedWidgets: DASHBOARD_WIDGET_IDS.filter((widgetId) => collapsedSet.has(widgetId)),
  };
}

export function moveDashboardWidget(
  settings: DashboardSettings,
  id: DashboardWidgetId,
  direction: 'up' | 'down',
): DashboardSettings {
  const normalized = normalizeDashboardSettings(settings);
  const nextOrder = [...normalized.widgetOrder];
  const index = nextOrder.indexOf(id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return normalized;

  const current = nextOrder[index];
  const target = nextOrder[targetIndex];
  if (!current || !target) return normalized;

  nextOrder[index] = target;
  nextOrder[targetIndex] = current;

  return {
    ...normalized,
    widgetOrder: nextOrder,
  };
}
