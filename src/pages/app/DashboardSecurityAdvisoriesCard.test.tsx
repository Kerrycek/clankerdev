// i18n-ignore-file
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SecurityAdvisoriesCard } from './DashboardSecurityAdvisoriesCard';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, preferredLanguageCodes: ['en'] }),
}));

describe('SecurityAdvisoriesCard', () => {
  it('links the list and rows to native advisory routes', () => {
    render(
      <MemoryRouter>
        <SecurityAdvisoriesCard
          isLoading={false}
          isError={false}
          advisories={[{ id: 5, name: 'Native advisory', state: 'published' }]}
          listPath="/admin/security-advisories"
          detailBasePath="/admin/security-advisories"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'dashboard.section.security.open' })).toHaveAttribute('href', '/admin/security-advisories');
    expect(screen.getByRole('link', { name: 'Native advisory' })).toHaveAttribute('href', '/admin/security-advisories/5');
  });

  it('keeps advisory context grouped for the responsive row layout', () => {
    render(
      <MemoryRouter>
        <SecurityAdvisoriesCard
          isLoading={false}
          isError={false}
          advisories={[{
            id: 9,
            name: 'Kernel advisory',
            state: 'published',
            affected: true,
            published_at: '2026-09-19T08:00:00Z',
            affected_node_count: 12,
            affected_user_count: 34,
            affected_vps_count: 56,
            en_summary: 'Install the fixed kernel.',
            security_advisory_cves: [
              { id: 1, cve_id: 'CVE-2026-0001' },
              { id: 2, cve_id: 'CVE-2026-0002' },
            ],
          }]}
          listPath="/security-advisories"
          detailBasePath="/security-advisories"
        />
      </MemoryRouter>,
    );

    const primary = screen.getByTestId('app.dashboard.security.item.primary');
    const details = screen.getByTestId('app.dashboard.security.item.details');
    expect(primary).toContainElement(screen.getByRole('link', { name: 'Kernel advisory' }));
    expect(primary).toHaveTextContent('dashboard.section.security.affects_me');
    expect(screen.getByTestId('app.dashboard.security.item.summary')).toHaveTextContent('Install the fixed kernel.');
    expect(details).toHaveTextContent('dashboard.section.security.published');
    expect(details).toHaveTextContent('dashboard.section.security.affected_nodes');
    expect(details).toHaveTextContent('dashboard.section.security.affected_users_vps');
    expect(screen.getByTestId('app.dashboard.security.item.cves')).toHaveTextContent('CVE-2026-0001');
    expect(screen.getByTestId('app.dashboard.security.item.cves')).toHaveTextContent('CVE-2026-0002');
  });
});
