import { describe, expect, test } from 'vitest';

import { explicitUserNamespaceOwnerId } from '../../lib/api/userNamespaces';
import {
  canFilterUserNamespaceOwners,
  normalizeUserNamespaceUrl,
} from './userNamespaceFilterSemantics';

describe('user namespace owner scope', () => {
  test('ordinary and support viewers rely on the API owner restriction', () => {
    for (const viewerRole of ['user', 'support'] as const) {
      expect(explicitUserNamespaceOwnerId({ viewerRole, fixedOwnerId: 42 })).toBeUndefined();
      expect(
        explicitUserNamespaceOwnerId({
          viewerRole,
          requestedOwnerId: 84,
          allowRequestedOwner: true,
        })
      ).toBeUndefined();
      expect(canFilterUserNamespaceOwners({ viewerRole, showAdminFields: true })).toBe(false);
    }
  });

  test('administrator fixed-owner views win over arbitrary URL scopes', () => {
    expect(
      explicitUserNamespaceOwnerId({
        viewerRole: 'admin',
        fixedOwnerId: 42,
        requestedOwnerId: 84,
        allowRequestedOwner: true,
      })
    ).toBe(42);
    expect(
      canFilterUserNamespaceOwners({ viewerRole: 'admin', showAdminFields: true, fixedOwnerId: 42 })
    ).toBe(false);
  });

  test('administrator list views send only an explicitly enabled valid owner filter', () => {
    expect(
      explicitUserNamespaceOwnerId({
        viewerRole: 'admin',
        requestedOwnerId: 84,
        allowRequestedOwner: true,
      })
    ).toBe(84);
    expect(
      explicitUserNamespaceOwnerId({
        viewerRole: 'admin',
        requestedOwnerId: 84,
        allowRequestedOwner: false,
      })
    ).toBeUndefined();
    expect(canFilterUserNamespaceOwners({ viewerRole: 'admin', showAdminFields: true })).toBe(true);
  });
});

describe('user namespace URL normalization', () => {
  test('ordinary namespace views remove unsupported and unauthorized fields before pagination', () => {
    const searchParams = new URLSearchParams(
      'q=legacy&user=84&size=65536&block_count=3&limit=25&from_id=900&page=4'
    );
    const original = searchParams.toString();

    expect(
      normalizeUserNamespaceUrl({
        kind: 'namespace',
        pathname: '/app/profile/user-namespaces/namespaces',
        searchParams,
        viewerRole: 'user',
        fixedOwnerId: 42,
      })
    ).toEqual({
      changed: true,
      href: '/app/profile/user-namespaces/namespaces?size=65536&limit=25',
    });
    expect(searchParams.toString()).toBe(original);
  });

  test('ordinary map views preserve the real namespace filter', () => {
    expect(
      normalizeUserNamespaceUrl({
        kind: 'map',
        pathname: '/app/profile/user-namespaces/maps',
        searchParams: new URLSearchParams(
          'q=default&user=84&user_namespace=101&limit=25&from_id=900&page=4'
        ),
        viewerRole: 'user',
        fixedOwnerId: 42,
      })
    ).toEqual({
      changed: true,
      href: '/app/profile/user-namespaces/maps?user_namespace=101&limit=25',
    });
  });

  test('administrator global view keeps exact owner, size and block filters while dropping q', () => {
    expect(
      normalizeUserNamespaceUrl({
        kind: 'namespace',
        pathname: '/admin/user-namespaces/namespaces',
        searchParams: new URLSearchParams(
          'q=legacy&user=84&size=65536&block_count=3&limit=25&from_id=900&page=4'
        ),
        viewerRole: 'admin',
        showAdminFields: true,
      })
    ).toEqual({
      changed: true,
      href: '/admin/user-namespaces/namespaces?user=84&size=65536&block_count=3&limit=25',
    });
  });

  test('administrator fixed-owner view removes a stale URL owner but keeps supported filters', () => {
    expect(
      normalizeUserNamespaceUrl({
        kind: 'map',
        pathname: '/app/profile/user-namespaces/maps',
        searchParams: new URLSearchParams('user=84&user_namespace=101&limit=25&from_id=900&page=4'),
        viewerRole: 'admin',
        fixedOwnerId: 42,
      })
    ).toEqual({
      changed: true,
      href: '/app/profile/user-namespaces/maps?user_namespace=101&limit=25',
    });
  });

  test('supported administrator filters leave the existing cursor untouched', () => {
    expect(
      normalizeUserNamespaceUrl({
        kind: 'map',
        pathname: '/admin/user-namespaces/maps',
        searchParams: new URLSearchParams('user=84&user_namespace=101&limit=25&from_id=900&page=4'),
        viewerRole: 'admin',
        showAdminFields: true,
      })
    ).toEqual({
      changed: false,
      href: '/admin/user-namespaces/maps?user=84&user_namespace=101&limit=25&from_id=900&page=4',
    });
  });

  test('malformed and cross-resource filters cannot survive as misleading URL state', () => {
    expect(
      normalizeUserNamespaceUrl({
        kind: 'namespace',
        pathname: '/admin/user-namespaces/namespaces',
        searchParams: new URLSearchParams(
          'user=not-an-id&size=-1&block_count=1.5&user_namespace=101&search=old&label=default&limit=25&from_id=900&page=4'
        ),
        viewerRole: 'admin',
        showAdminFields: true,
      })
    ).toEqual({
      changed: true,
      href: '/admin/user-namespaces/namespaces?limit=25',
    });

    expect(
      normalizeUserNamespaceUrl({
        kind: 'map',
        pathname: '/admin/user-namespaces/maps',
        searchParams: new URLSearchParams(
          'user=42&user_namespace=bad&size=65536&block_count=3&label=default&limit=25&from_id=900&page=4'
        ),
        viewerRole: 'admin',
        showAdminFields: true,
      })
    ).toEqual({
      changed: true,
      href: '/admin/user-namespaces/maps?user=42&limit=25',
    });
  });
});
