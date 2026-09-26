import {
  defaultDeleteForm,
  buildVpsDeleteOptions,
  deleteExpirationValid,
  isVpsDeleteConfirmationSatisfied,
  vpsDeleteConfirmationTarget,
  vpsDeleteObjectLabel,
} from './VpsDeleteModel';

describe('VPS delete confirmation model', () => {
  it('uses the VPS hostname as the typed confirmation target', () => {
    const target = vpsDeleteConfirmationTarget({ id: 123, hostname: 'vps123.example' });

    expect(target).toBe('vps123.example');
    expect(isVpsDeleteConfirmationSatisfied('vps123.example', target)).toBe(true);
    expect(isVpsDeleteConfirmationSatisfied('VPS123.EXAMPLE', target)).toBe(false);
  });

  it('falls back to #id when the hostname is missing', () => {
    expect(vpsDeleteConfirmationTarget({ id: 123, hostname: '' })).toBe('#123');
    expect(vpsDeleteObjectLabel({ id: 123, hostname: null })).toBe('#123');
  });

  it('keeps lazy delete enabled by default', () => {
    expect(defaultDeleteForm()).toEqual({ lazy: true });
  });
});


describe('VPS delete options', () => {
  it('never sends administrative options in member view', () => {
    expect(buildVpsDeleteOptions({ lazy: false, customExpiration: true, expirationLocal: 'invalid' }, false)).toBeUndefined();
  });

  it('requires a future deadline only for custom soft delete', () => {
    for (const expirationLocal of ['', 'invalid', '2000-01-01T12:00']) {
      const form = { lazy: true, customExpiration: true, expirationLocal };
      expect(deleteExpirationValid(form)).toBe(false);
      expect(() => buildVpsDeleteOptions(form, true)).toThrow('invalid-date');
    }
    expect(buildVpsDeleteOptions({ lazy: false, customExpiration: true, expirationLocal: '' }, true)).toEqual({ lazy: false });
    expect(buildVpsDeleteOptions({ lazy: true }, true)).toEqual({ lazy: true });
  });

  it('converts the local retention deadline to an API timestamp', () => {
    expect(buildVpsDeleteOptions({ lazy: true, customExpiration: true, expirationLocal: '2099-01-02T12:30' }, true)).toEqual({
      lazy: true, expiration_date: new Date(2099, 0, 2, 12, 30).toISOString(),
    });
  });
});
