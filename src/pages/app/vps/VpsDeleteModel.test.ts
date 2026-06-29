import {
  defaultDeleteForm,
  vpsDeleteConfirmationTarget,
  vpsDeleteObjectLabel,
} from './VpsDeleteModel';

describe('VPS delete confirmation model', () => {
  it('uses the VPS hostname as the target label', () => {
    const target = vpsDeleteConfirmationTarget({ id: 123, hostname: 'vps123.example' });

    expect(target).toBe('vps123.example');
  });

  it('falls back to #id when the hostname is missing', () => {
    expect(vpsDeleteConfirmationTarget({ id: 123, hostname: '' })).toBe('#123');
    expect(vpsDeleteObjectLabel({ id: 123, hostname: null })).toBe('#123');
  });

  it('keeps lazy delete enabled by default', () => {
    expect(defaultDeleteForm()).toEqual({ lazy: true });
  });
});
