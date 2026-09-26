import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.hoisted(() => vi.fn());
vi.mock('./haveapi', () => ({
  HaveApiError: class extends Error {},
  haveApiCall: call,
}));
vi.mock('../../app/config', () => ({
  getRuntimeConfig: () => ({ uiSettings: { server: { path: '/webui_user_settings' } } }),
}));

import { saveWebuiUserSetting } from './webuiUserSettings';

beforeEach(() => { call.mockReset(); });

describe('webui settings upstream Set contract', () => {
  it('upserts the keyed resource with only the value in the body', async () => {
    call.mockResolvedValue({});
    await saveWebuiUserSetting('ui', 'settings', { theme: 'dark' });
    expect(call).toHaveBeenCalledExactlyOnceWith({
      method: 'PUT', path: '/webui_user_settings/ui/settings',
      namespace: 'webui_user_setting', params: { value: '{"theme":"dark"}' },
    });
  });

  it('encodes namespace and key as separate path segments', async () => {
    call.mockResolvedValue({});
    await saveWebuiUserSetting('ui prefs', 'theme/key', 'dark');
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ path: '/webui_user_settings/ui%20prefs/theme%2Fkey' }));
  });

  it('reports rejected saves without retrying an unsupported collection POST', async () => {
    const failure = new Error('save failed');
    call.mockRejectedValue(failure);
    await expect(saveWebuiUserSetting('ui', 'settings', {})).rejects.toBe(failure);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
