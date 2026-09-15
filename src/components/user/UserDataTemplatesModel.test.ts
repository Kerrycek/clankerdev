import { describe, expect, test } from 'vitest';

import {
  buildUserDataPageWindow,
  buildUserDataCreatePayload,
  buildUserDataUpdatePayload,
  buildUserDataValidationHints,
  canSaveUserDataForm,
  initUserDataForm,
  isShebangScript,
  looksLikeFlakeUri,
  looksLikeNixAttrSet,
  resolveUserDataFormat,
  safeUserDataId,
  safeUserDataString,
  userDataContentOverLimit,
  userDataFormatHintKey,
  userDataFormatLabelKey,
  userDataUpdatedTimestamp,
  MAX_USER_DATA_CONTENT_LEN,
} from './UserDataTemplatesModel';

import type { VpsUserData } from '../../lib/api/vpsUserData';

describe('UserDataTemplatesModel', () => {
  test('hides the lookahead row and derives the ascending cursor from visible rows', () => {
    const rawRows = Array.from({ length: 26 }, (_, index) => ({ id: index + 1 }));

    expect(buildUserDataPageWindow(rawRows, 25)).toEqual({
      rows: rawRows.slice(0, 25),
      cursor: 25,
      hasMore: true,
    });
  });

  test('recognizes an exact-size terminal page', () => {
    const rawRows = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));

    expect(buildUserDataPageWindow(rawRows, 25)).toEqual({
      rows: rawRows,
      cursor: 25,
      hasMore: false,
    });
  });

  test('fails closed when visible rows contain no valid cursor ID', () => {
    const rawRows = [
      { id: 'invalid' },
      { id: 0 },
      { id: -1 },
      { id: 1.5 },
      { id: Number.MAX_SAFE_INTEGER + 1 },
    ];

    expect(buildUserDataPageWindow(rawRows, 5)).toEqual({
      rows: rawRows,
      cursor: null,
      hasMore: false,
    });
    expect(buildUserDataPageWindow([], 25)).toEqual({ rows: [], cursor: null, hasMore: false });
  });

  test('uses the greatest valid visible ID for an unsorted page', () => {
    const rawRows = [{ id: 9 }, { id: 3 }, { id: 7 }, { id: 100 }];

    expect(buildUserDataPageWindow(rawRows, 3)).toEqual({
      rows: rawRows.slice(0, 3),
      cursor: 9,
      hasMore: true,
    });
  });

  test('normalizes template fields and IDs', () => {
    const item: VpsUserData = {
      id: 42.9,
      label: 'Provision app',
      format: 'script',
      content: '#!/bin/sh\necho ok',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    expect(initUserDataForm(item)).toEqual({ label: 'Provision app', format: 'script', content: '#!/bin/sh\necho ok' });
    expect(safeUserDataId(item.id)).toBe(42);
    expect(safeUserDataId('bad')).toBe(0);
    expect(safeUserDataString('x')).toBe('x');
    expect(safeUserDataString(null)).toBe('');
    expect(userDataUpdatedTimestamp(item)).toBe('2026-01-02T00:00:00Z');
    expect(userDataUpdatedTimestamp({ ...item, updated_at: undefined })).toBe('2026-01-01T00:00:00Z');
  });

  test('resolves formats, labels and hints', () => {
    expect(resolveUserDataFormat('script')).toBe('script');
    expect(resolveUserDataFormat('cloudinit_s')).toBe('cloudinit_script');
    expect(resolveUserDataFormat('cloudinit')).toBeNull();
    expect(resolveUserDataFormat('')).toBe('');
    expect(userDataFormatLabelKey('script')).toBe('user_data.format.script');
    expect(userDataFormatLabelKey('custom')).toBe('user_data.format.unknown');
    expect(userDataFormatHintKey('nixos_flake_uri')).toBe('user_data.hint.nixos_flake_uri');
    expect(userDataFormatHintKey('custom')).toBeNull();
  });

  test('validates format-specific content hints', () => {
    expect(isShebangScript('#!/bin/sh\necho ok')).toBe(true);
    expect(isShebangScript('#cloud-config')).toBe(false);
    expect(looksLikeNixAttrSet('{ config, ... }: {}')).toBe(true);
    expect(looksLikeNixAttrSet('let x = 1;')).toBe(false);
    expect(looksLikeFlakeUri('github:vpsfreecz/template')).toBe(true);
    expect(looksLikeFlakeUri('github:vpsfreecz/template main')).toBe(false);
  });

  test('builds validation hints and save gating', () => {
    expect(canSaveUserDataForm({ label: '', format: 'script', content: '#!/bin/sh' })).toBe(false);
    expect(canSaveUserDataForm({ label: 'Boot', format: 'script', content: '#!/bin/sh' })).toBe(true);
    expect(userDataContentOverLimit('x'.repeat(MAX_USER_DATA_CONTENT_LEN + 1))).toBe(true);

    const hints = buildUserDataValidationHints({ label: 'Boot', format: 'script', content: 'echo ok' });
    expect(hints.map((hint) => [hint.labelKey, hint.ok])).toContainEqual(['user_data.validation.shebang', false]);
  });

  test('builds backend-compatible create and update payloads', () => {
    const form = { label: '  Provision app  ', format: ' script ', content: '#!/bin/sh\necho ok\n' };

    expect(buildUserDataCreatePayload(form, 7)).toEqual({
      user: 7,
      label: 'Provision app',
      format: 'script',
      content: '#!/bin/sh\necho ok\n',
    });

    expect(buildUserDataUpdatePayload(form)).toEqual({
      label: 'Provision app',
      format: 'script',
      content: '#!/bin/sh\necho ok\n',
    });
  });
});
