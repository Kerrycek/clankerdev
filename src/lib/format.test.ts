import { describe, expect, it } from 'vitest';

import { compactText } from './format';

describe('compactText', () => {
  it('keeps short values intact', () => {
    expect(compactText('vpsadmin')).toBe('vpsadmin');
  });

  it('shortens long technical values in the middle', () => {
    const text = '/system.slice/docker-27e26778a19d9c3d6c60d7bc75414347162074d25326604348b9abb4877da037.scope';

    expect(compactText(text, 32)).toBe('/system.slice/dock…77da037.scope');
  });

  it('uses an empty dash for missing values', () => {
    expect(compactText('')).toBe('—');
    expect(compactText(null)).toBe('—');
  });
});
