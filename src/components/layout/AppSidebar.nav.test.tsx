// i18n-ignore-file

import React from 'react';
import { describe, expect, test } from 'vitest';

import { buildSidebarNavItems } from './AppSidebar';

const t = (key: string) => key;
const ids = (items: ReturnType<typeof buildSidebarNavItems>) => items.map((item) => item.id);

describe('buildSidebarNavItems access surface', () => {
  test('keeps admin-only navigation out of the user scope sidebar', () => {
    const items = buildSidebarNavItems({ basePath: '/app', appMode: 'user', t });
    const itemIds = ids(items);

    expect(itemIds).toContain('payments');
    expect(itemIds).toContain('account');
    expect(itemIds).toContain('status');

    expect(itemIds).not.toContain('audit');
    expect(itemIds).not.toContain('users');
    expect(itemIds).not.toContain('user-namespaces');
    expect(itemIds).not.toContain('networking');
    expect(itemIds).not.toContain('requests');
    expect(itemIds).not.toContain('mailer');
    expect(itemIds).not.toContain('content');
    expect(itemIds).not.toContain('payments-incoming');
    expect(itemIds).not.toContain('cluster');
    expect(itemIds).not.toContain('nodes');
    expect(itemIds).not.toContain('migration-plans');
    expect(itemIds).not.toContain('admin-info');

    expect(items.filter((item) => item.to.startsWith('/admin'))).toHaveLength(0);
  });

  test('shows admin navigation only in the admin scope sidebar', () => {
    const items = buildSidebarNavItems({ basePath: '/admin', appMode: 'admin', t });
    const itemIds = ids(items);

    expect(itemIds).toContain('audit');
    expect(itemIds).toContain('users');
    expect(itemIds).toContain('user-namespaces');
    expect(itemIds).toContain('networking');
    expect(itemIds).toContain('requests');
    expect(itemIds).toContain('mailer');
    expect(itemIds).toContain('content');
    expect(itemIds).toContain('payments-incoming');
    expect(itemIds).toContain('cluster');
    expect(itemIds).toContain('nodes');
    expect(itemIds).toContain('migration-plans');
    expect(itemIds).toContain('admin-info');

    expect(itemIds).not.toContain('payments');
    expect(items.filter((item) => item.to.startsWith('/app'))).toHaveLength(0);
  });
});
