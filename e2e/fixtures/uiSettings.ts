import type { Page } from '@playwright/test';

export interface UiSettingsFixture {
  sidebarCollapsed?: boolean;
  theme?: 'system' | 'light' | 'dark';
  language?: 'system' | 'en' | 'cs';
}

export async function setUiSettingsLocalStorage(page: Page, settings: UiSettingsFixture) {
  await page.addInitScript((s: UiSettingsFixture) => {
    localStorage.setItem('vpsadmin.uiSettings.v1', JSON.stringify(s));
  }, settings);
}
