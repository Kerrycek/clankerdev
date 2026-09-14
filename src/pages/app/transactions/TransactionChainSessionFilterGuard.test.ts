import { describe, expect, it } from 'vitest';

import {
  normalizeTransactionChainSessionParams,
  parseTransactionChainSessionId,
} from './TransactionChainSessionFilterGuard';

describe('transaction chain session URL contract', () => {
  it('accepts only positive, safely representable session IDs', () => {
    expect(parseTransactionChainSessionId('42')).toBe(42);
    expect(parseTransactionChainSessionId(' 42 ')).toBe(42);
    expect(parseTransactionChainSessionId('0')).toBeUndefined();
    expect(parseTransactionChainSessionId('-1')).toBeUndefined();
    expect(parseTransactionChainSessionId('1.5')).toBeUndefined();
    expect(parseTransactionChainSessionId('9007199254740993')).toBeUndefined();
  });

  it('leaves an already canonical session URL unchanged', () => {
    expect(normalizeTransactionChainSessionParams(new URLSearchParams('user_session=42&limit=50'))).toBeNull();
  });

  it('canonicalizes a valid session and resets stale pagination', () => {
    const normalized = normalizeTransactionChainSessionParams(
      new URLSearchParams('user_session=0042&from_id=900&page=2&limit=50&state=failed')
    );

    expect(normalized?.get('user_session')).toBe('42');
    expect(normalized?.get('limit')).toBe('50');
    expect(normalized?.get('state')).toBe('failed');
    expect(normalized?.get('from_id')).toBeNull();
    expect(normalized?.get('page')).toBeNull();
  });

  it.each(['user_session=bad', 'user_session=0', 'user_session=1&user_session=2'])(
    'removes malformed or ambiguous input before the list can mount: %s',
    (query) => {
      const normalized = normalizeTransactionChainSessionParams(
        new URLSearchParams(`${query}&from_id=900&page=2&limit=50&state=failed`)
      );

      expect(normalized?.get('user_session')).toBeNull();
      expect(normalized?.get('from_id')).toBeNull();
      expect(normalized?.get('page')).toBeNull();
      expect(normalized?.get('limit')).toBe('50');
      expect(normalized?.get('state')).toBe('failed');
    }
  );
});
