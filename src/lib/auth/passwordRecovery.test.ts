import { describe, expect, it } from 'vitest';

import { buildPasswordRecoveryUrl } from './passwordRecovery';

describe('buildPasswordRecoveryUrl', () => {
  it('keeps a same-origin path and adds the selected locale', () => {
    expect(
      buildPasswordRecoveryUrl(
        '/oauth2/password-reset?client_id=dev.crucio.cz',
        'cs',
        'https://dev.crucio.cz',
      ),
    ).toBe('/oauth2/password-reset?client_id=dev.crucio.cz&ui_locales=cs');
  });

  it('supports a recovery form on the OAuth provider origin', () => {
    expect(
      buildPasswordRecoveryUrl(
        'https://auth.vpsfree.cz/oauth2/password-reset?client_id=clankerdev.vpsfree.cz',
        'en',
      ),
    ).toBe(
      'https://auth.vpsfree.cz/oauth2/password-reset?client_id=clankerdev.vpsfree.cz&ui_locales=en',
    );
  });

  it('replaces a stale locale instead of adding a duplicate', () => {
    expect(
      buildPasswordRecoveryUrl('/oauth2/password-reset?ui_locales=en', 'cs'),
    ).toBe('/oauth2/password-reset?ui_locales=cs');
  });

  it('rejects malformed and executable URLs', () => {
    expect(buildPasswordRecoveryUrl('https://[invalid', 'en')).toBeUndefined();
    expect(buildPasswordRecoveryUrl('javascript:alert(1)', 'en')).toBeUndefined();
  });
});
