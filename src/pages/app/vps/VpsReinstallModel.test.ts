import {
  buildVpsReinstallPayload,
  defaultReinstallForm,
  type ReinstallForm,
} from './VpsReinstallModel';

function form(overrides: Partial<ReinstallForm> = {}): ReinstallForm {
  return {
    ...defaultReinstallForm(6),
    ...overrides,
  };
}

describe('VPS reinstall model', () => {
  it('builds the legacy reinstall payload when user data is disabled', () => {
    expect(buildVpsReinstallPayload(form({ osTemplate: '7' }))).toEqual({
      os_template: 7,
    });
  });

  it('adds inline user data only when enabled and non-empty', () => {
    expect(
      buildVpsReinstallPayload(
        form({
          osTemplate: '8',
          userDataEnabled: true,
          userDataFormat: 'cloudinit_script',
          userDataContent: '  #cloud-config\npackages: []\n  ',
        })
      )
    ).toEqual({
      os_template: 8,
      user_data_format: 'cloudinit_script',
      user_data_content: '#cloud-config\npackages: []',
    });

    expect(
      buildVpsReinstallPayload(
        form({
          osTemplate: '8',
          userDataEnabled: true,
          userDataContent: '   ',
        })
      )
    ).toEqual({ os_template: 8 });
  });

  it('rejects missing or invalid template IDs', () => {
    expect(() => buildVpsReinstallPayload(form({ osTemplate: '' }))).toThrow('required-id');
    expect(() => buildVpsReinstallPayload(form({ osTemplate: '#7' }))).toThrow('required-id');
    expect(() => buildVpsReinstallPayload(form({ osTemplate: '0' }))).toThrow('required-id');
  });
});
