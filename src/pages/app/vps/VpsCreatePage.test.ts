import { buildVpsCreatePayload, defaultForm, validateForm, type FormState } from './VpsCreatePage';

function validForm(overrides: Partial<FormState> = {}): FormState {
  return {
    ...defaultForm(),
    locationId: '3',
    nodeId: '5',
    osTemplateId: '6',
    userId: '1',
    hostname: 'test-vps',
    ...overrides,
  };
}

describe('VpsCreatePage payload guardrails', () => {
  it('builds a user create payload with location and without admin-only fields', () => {
    const payload = buildVpsCreatePayload(validForm({ info: 'ignored' }), {
      isAdminMode: false,
      needsAdminPayload: false,
    });

    expect(payload).toEqual({
      mode: 'user',
      hostname: 'test-vps',
      os_template: 6,
      start: true,
      cpu: 8,
      memory: 4096,
      diskspace: 122880,
      swap: 0,
      ipv4: 1,
      ipv6: 1,
      ipv4_private: 0,
      location: 3,
    });
    expect(payload).not.toHaveProperty('user');
    expect(payload).not.toHaveProperty('node');
    expect(payload).not.toHaveProperty('info');
  });

  it('builds an explicit admin create payload without location/environment fields', () => {
    const payload = buildVpsCreatePayload(validForm({ info: 'admin note' }), {
      isAdminMode: true,
      needsAdminPayload: true,
    });

    expect(payload).toEqual({
      mode: 'admin',
      hostname: 'test-vps',
      os_template: 6,
      start: true,
      cpu: 8,
      memory: 4096,
      diskspace: 122880,
      swap: 0,
      ipv4: 1,
      ipv6: 1,
      ipv4_private: 0,
      user: 1,
      node: 5,
      info: 'admin note',
    });
    expect(payload).not.toHaveProperty('location');
    expect(payload).not.toHaveProperty('environment');
  });

  it('builds admin-account app view payload for current user without leaking location to the API', () => {
    const payload = buildVpsCreatePayload(validForm({ userId: '', nodeId: '', info: 'ignored' }), {
      isAdminMode: false,
      needsAdminPayload: true,
      hiddenAdminTarget: { userId: 21, nodeId: 7 },
    });

    expect(payload).toEqual({
      mode: 'admin',
      hostname: 'test-vps',
      os_template: 6,
      start: true,
      cpu: 8,
      memory: 4096,
      diskspace: 122880,
      swap: 0,
      ipv4: 1,
      ipv6: 1,
      ipv4_private: 0,
      user: 21,
      node: 7,
      info: '',
    });
    expect(payload).not.toHaveProperty('location');
    expect(payload).not.toHaveProperty('environment');
  });

  it('requires hidden admin target only for admin accounts in app view', () => {
    expect(validateForm(validForm({ userId: '', nodeId: '' }), false)).toEqual([]);

    expect(validateForm(validForm({ userId: '', nodeId: '' }), false, { userId: 21 })).toContain(
      'vps.create.validation.auto_node_required'
    );

    expect(validateForm(validForm({ userId: '', nodeId: '' }), false, { nodeId: 7 })).toContain(
      'vps.create.validation.user_required'
    );
  });
});
