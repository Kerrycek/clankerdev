export const GENERATED_PASSWORD_LENGTH = 20;

export const PASSWORD_ALPHABET =
  'abcdefghijkmnpqrstuvwxyz' +
  'ABCDEFGHJKLMNPQRSTUVWXYZ' +
  '23456789' +
  '!@#$%&*-';

const PASSWORD_CHARACTER_GROUPS = [
  'abcdefghijkmnpqrstuvwxyz',
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%&*-',
] as const;

const RANDOM_BYTE_CARDINALITY = 256;

export type PasswordRandomSource = (target: Uint8Array) => void;

export interface GenerateSecurePasswordOptions {
  length?: number;
  randomSource?: PasswordRandomSource;
}

function fillWithWebCrypto(target: Uint8Array): void {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Web Crypto API with crypto.getRandomValues is required to generate a password');
  }

  globalThis.crypto.getRandomValues(target);
}

function randomInteger(maxExclusive: number, randomSource: PasswordRandomSource): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > RANDOM_BYTE_CARDINALITY) {
    throw new RangeError(`Random integer bound must be between 1 and ${RANDOM_BYTE_CARDINALITY}`);
  }

  const acceptanceLimit = Math.floor(RANDOM_BYTE_CARDINALITY / maxExclusive) * maxExclusive;
  const randomByte = new Uint8Array(1);

  for (;;) {
    randomSource(randomByte);
    const value = randomByte[0];
    if (value !== undefined && value < acceptanceLimit) {
      return value % maxExclusive;
    }
  }
}

function pickCharacter(characters: string, randomSource: PasswordRandomSource): string {
  const character = characters[randomInteger(characters.length, randomSource)];
  if (character === undefined) {
    throw new Error('Password character selection failed');
  }
  return character;
}

export function generateSecurePassword(options: GenerateSecurePasswordOptions = {}): string {
  const length = options.length ?? GENERATED_PASSWORD_LENGTH;
  if (
    !Number.isInteger(length) ||
    length < PASSWORD_CHARACTER_GROUPS.length ||
    length > RANDOM_BYTE_CARDINALITY
  ) {
    throw new RangeError(
      `Password length must be an integer between ${PASSWORD_CHARACTER_GROUPS.length} and ${RANDOM_BYTE_CARDINALITY}`
    );
  }

  const randomSource = options.randomSource ?? fillWithWebCrypto;
  const password = PASSWORD_CHARACTER_GROUPS.map((group) => pickCharacter(group, randomSource));

  while (password.length < length) {
    password.push(pickCharacter(PASSWORD_ALPHABET, randomSource));
  }

  // Fisher-Yates with the same rejection-sampled source keeps every permutation unbiased.
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1, randomSource);
    const current = password[index];
    const replacement = password[swapIndex];
    if (current === undefined || replacement === undefined) {
      throw new Error('Password shuffle failed');
    }
    password[index] = replacement;
    password[swapIndex] = current;
  }

  return password.join('');
}
