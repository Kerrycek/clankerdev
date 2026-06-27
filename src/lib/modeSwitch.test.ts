import { describe, expect, it } from 'vitest';

import { computeOtherModeUrl, extractAppModeRestPath } from './modeSwitch';

describe('modeSwitch', () => {
  it('extracts the path suffix after the app scope prefix', () => {
    expect(extractAppModeRestPath('/app')).toBe('');
    expect(extractAppModeRestPath('/app/vps/123')).toBe('/vps/123');
    expect(extractAppModeRestPath('/admin')).toBe('');
    expect(extractAppModeRestPath('/admin/nodes')).toBe('/nodes');
  });

  it('preserves shared routes when switching from user to admin scope', () => {
    expect(
      computeOtherModeUrl({
        mode: 'user',
        pathname: '/app/vps/123',
        search: '?tab=network',
        hash: '#top',
      })
    ).toBe('/admin/vps/123?tab=network#top');

    expect(
      computeOtherModeUrl({
        mode: 'user',
        pathname: '/app/requests/details',
        search: '?state=open',
      })
    ).toBe('/admin/requests/details?state=open');
  });

  it('rewrites user-only route shapes to their admin counterparts', () => {
    expect(
      computeOtherModeUrl({
        mode: 'user',
        pathname: '/app/payments',
        search: '?year=2026',
      })
    ).toBe('/admin/payments/incoming?year=2026');

    expect(
      computeOtherModeUrl({
        mode: 'user',
        pathname: '/app/profile/user-namespaces/maps/55',
        hash: '#entries',
      })
    ).toBe('/admin/user-namespaces/maps/55#entries');
  });

  it('rewrites admin-only routes to the closest safe user route', () => {
    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/payments/incoming/42',
        search: '?page=2',
      })
    ).toBe('/app/payments?page=2');

    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/user-namespaces/namespaces/7',
      })
    ).toBe('/app/profile/user-namespaces/namespaces/7');

    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/incidents/new',
        hash: '#draft',
      })
    ).toBe('/app/incidents#draft');
  });

  it('keeps admin triage and admin outage deep links out of the user scope', () => {
    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/requests/registration/31',
        search: '?state=awaiting',
      })
    ).toBe('/app');

    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/outages/7',
        hash: '#events',
      })
    ).toBe('/app#events');
  });

  it('falls back to the user dashboard for admin-only areas with no user equivalent', () => {
    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/cluster/summary',
        search: '?filter=issues',
      })
    ).toBe('/app');

    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/users/123/security',
      })
    ).toBe('/app');

    expect(
      computeOtherModeUrl({
        mode: 'admin',
        pathname: '/admin/mailer/log/999',
        hash: '#delivery',
      })
    ).toBe('/app#delivery');
  });
});
