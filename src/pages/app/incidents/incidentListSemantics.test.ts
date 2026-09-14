import { describe, expect, it } from 'vitest';

import type { Mailbox } from '../../../lib/api/mailer';
import {
  canonicalKey,
  resolveMailboxId,
  UNSUPPORTED_INCIDENT_SEARCH_KEY,
} from './incidentListSemantics';

const mailboxes: Mailbox[] = [
  { id: 11, label: 'Operations Prague' },
  { id: 12, label: 'Operations Brno' },
  { id: 13, label: 'Support' },
];

describe('canonicalKey', () => {
  it.each([
    ['id', 'id'],
    ['#', 'id'],
    ['incident', 'id'],
    ['report', 'id'],
    ['vps', 'vps'],
    ['vm', 'vps'],
    ['host', 'vps'],
    ['user', 'user'],
    ['owner', 'user'],
    ['login', 'user'],
    ['filed_by', 'filed_by'],
    ['filed', 'filed_by'],
    ['reporter', 'filed_by'],
    ['ip', 'ip'],
    ['ip_addr', 'ip'],
    ['addr', 'ip'],
    ['assignment', 'assignment'],
    ['ip_assignment', 'assignment'],
    ['ip_address_assignment', 'assignment'],
    ['assign', 'assignment'],
    ['ipa', 'assignment'],
    ['codename', 'codename'],
    ['code', 'codename'],
    ['mailbox', 'mailbox'],
    ['mb', 'mailbox'],
  ])('preserves the supported alias %s as %s', (input, expected) => {
    expect(canonicalKey(input)).toBe(expected);
  });

  it.each(['q', 'query', 'search', 'text'])('recognizes unsupported full-text alias %s', (input) => {
    expect(canonicalKey(input)).toBe(UNSUPPORTED_INCIDENT_SEARCH_KEY);
  });

  it('keeps unknown and empty keys distinct from unsupported full-text aliases', () => {
    expect(canonicalKey('subject')).toBeNull();
    expect(canonicalKey('')).toBeNull();
    expect(canonicalKey('   ')).toBeNull();
  });
});

describe('resolveMailboxId', () => {
  it('prefers an exact numeric id and resolves a unique label fragment', () => {
    expect(resolveMailboxId(mailboxes, '12')).toEqual({ id: 12 });
    expect(resolveMailboxId(mailboxes, 'prague')).toEqual({ id: 11 });
  });

  it('rejects ambiguous and unknown labels instead of silently choosing one', () => {
    expect(resolveMailboxId(mailboxes, 'operations')).toEqual({ err: 'ambiguous' });
    expect(resolveMailboxId(mailboxes, 'billing')).toEqual({ err: 'none' });
  });
});
