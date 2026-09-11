import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  GENERATED_PASSWORD_LENGTH,
  PASSWORD_ALPHABET,
  generateSecurePassword,
  type PasswordRandomSource,
} from './passwordGeneration';

function sequenceRandomSource(values: number[]): PasswordRandomSource {
  let index = 0;
  return (target) => {
    target[0] = values[index] ?? 0;
    index += 1;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('generateSecurePassword', () => {
  test('uses the exact 64-character safe alphabet and includes every required group', () => {
    const randomSource = sequenceRandomSource(Array.from({ length: 64 }, (_, index) => index));
    const password = generateSecurePassword({ randomSource });

    expect(PASSWORD_ALPHABET).toBe(
      'abcdefghijkmnpqrstuvwxyz' +
        'ABCDEFGHJKLMNPQRSTUVWXYZ' +
        '23456789' +
        '!@#$%&*-'
    );
    expect(PASSWORD_ALPHABET).toHaveLength(64);
    expect(new Set(PASSWORD_ALPHABET)).toHaveProperty('size', 64);
    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect([...password].every((character) => PASSWORD_ALPHABET.includes(character))).toBe(true);
    expect([...password].some((character) => 'abcdefghijkmnpqrstuvwxyz'.includes(character))).toBe(true);
    expect([...password].some((character) => 'ABCDEFGHJKLMNPQRSTUVWXYZ'.includes(character))).toBe(true);
    expect([...password].some((character) => '23456789'.includes(character))).toBe(true);
    expect([...password].some((character) => '!@#$%&*-'.includes(character))).toBe(true);
  });

  test('uses crypto.getRandomValues and never calls Math.random', () => {
    let nextByte = 0;
    const getRandomValues = vi.fn((target: Uint8Array) => {
      target[0] = nextByte;
      nextByte = (nextByte + 1) % 240;
      return target;
    });
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for password generation');
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(generateSecurePassword()).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(getRandomValues).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
  });

  test('fails closed when Web Crypto is unavailable', () => {
    const mathRandom = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', undefined);

    expect(() => generateSecurePassword()).toThrow(/crypto\.getRandomValues/);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  test.each([0, 3, 4.5, 257, Number.NaN])('rejects invalid password length %s', (length) => {
    const randomSource = vi.fn<PasswordRandomSource>();

    expect(() => generateSecurePassword({ length, randomSource })).toThrow(RangeError);
    expect(randomSource).not.toHaveBeenCalled();
  });

  test('rejects out-of-range bytes instead of introducing modulo bias', () => {
    const values = [
      255,
      0, // lower-case group: 255 is outside the 0..239 acceptance range
      255,
      0, // upper-case group: same rejection boundary
      0, // digit
      0, // symbol
      0, // Fisher-Yates, bound 4
      255,
      0, // Fisher-Yates, bound 3: 255 is rejected
      0, // Fisher-Yates, bound 2
    ];
    const source = sequenceRandomSource(values);
    const randomSource = vi.fn(source);

    const password = generateSecurePassword({ length: 4, randomSource });

    expect(password).toHaveLength(4);
    expect(randomSource).toHaveBeenCalledTimes(values.length);
    expect([...password].some((character) => 'abcdefghijkmnpqrstuvwxyz'.includes(character))).toBe(true);
    expect([...password].some((character) => 'ABCDEFGHJKLMNPQRSTUVWXYZ'.includes(character))).toBe(true);
    expect([...password].some((character) => '23456789'.includes(character))).toBe(true);
    expect([...password].some((character) => '!@#$%&*-'.includes(character))).toBe(true);
  });
});
