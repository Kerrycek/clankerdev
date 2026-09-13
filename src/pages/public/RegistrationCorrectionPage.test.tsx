// i18n-ignore-file

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchLocations } from '../../lib/api/infra';
import { fetchLanguages } from '../../lib/api/languages';
import { fetchOsTemplates } from '../../lib/api/osTemplates';
import {
  previewRegistrationRequest,
  updateRegistrationRequestByToken,
} from '../../lib/api/requests';
import { RegistrationCorrectionPage } from './RegistrationCorrectionPage';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tc: (key: string, count: number) => `${key}:${count}`,
    preferredLanguageCodes: ['en', 'cs'],
  }),
}));

vi.mock('../../lib/api/infra', () => ({
  fetchLocations: vi.fn(),
}));

vi.mock('../../lib/api/languages', () => ({
  fetchLanguages: vi.fn(),
}));

vi.mock('../../lib/api/osTemplates', () => ({
  fetchOsTemplates: vi.fn(),
}));

vi.mock('../../lib/api/requests', () => ({
  previewRegistrationRequest: vi.fn(),
  updateRegistrationRequestByToken: vi.fn(),
}));

function renderPage(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter basename="/ui-next" initialEntries={[`/ui-next${pathname}`]}>
        <Routes>
          <Route path="/requests/registrations/:requestId/:token" element={<RegistrationCorrectionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function installHappyPathMocks(timeZone: string | null = 'Europe/Prague') {
  vi.mocked(previewRegistrationRequest).mockResolvedValue({
    data: {
      id: 17,
      admin_response: 'Please fix the registration details.',
      login: 'alice',
      full_name: 'Alice Example',
      org_name: 'Example Org',
      org_id: 'EX-42',
      email: 'alice@example.test',
      address: 'Spec Street 1',
      year_of_birth: 1990,
      how: 'From a friend',
      note: 'Needs correction',
      os_template: { id: 5, label: 'Debian 12' },
      location: { id: 9, label: 'Prague' },
      currency: 'eur',
      language: { id: 1, label: 'English' },
      time_zone: timeZone,
    },
  } as any);
  vi.mocked(fetchLocations).mockResolvedValue({ data: [{ id: 9, label: 'Prague' }] } as any);
  vi.mocked(fetchOsTemplates).mockResolvedValue({ data: [{ id: 5, label: 'Debian 12' }] } as any);
  vi.mocked(fetchLanguages).mockResolvedValue({ data: [{ id: 1, label: 'English' }] } as any);
}

function installSuccessfulUpdateMock() {
  vi.mocked(updateRegistrationRequestByToken).mockResolvedValue({
    data: { id: 17 },
    envelope: { status: true, response: { registration: { id: 17 } } },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

async function waitForPopulatedForm() {
  await waitFor(() => {
    expect(screen.getByTestId('public.requests.correction.login')).toHaveValue('alice');
  });

  await waitFor(() => {
    expect(screen.getByTestId('public.requests.correction.submit')).not.toBeDisabled();
  });
}

describe('RegistrationCorrectionPage', () => {
  it('shows invalid-id state without issuing API calls', async () => {
    renderPage('/requests/registrations/not-a-number/fix-token');

    expect(await screen.findByText('requests.correction.invalid.title')).toBeVisible();
    expect(previewRegistrationRequest).not.toHaveBeenCalled();
    expect(fetchLocations).not.toHaveBeenCalled();
    expect(fetchOsTemplates).not.toHaveBeenCalled();
    expect(fetchLanguages).not.toHaveBeenCalled();
  });

  it('renders the form with a basename-aware back link', async () => {
    installHappyPathMocks();

    renderPage('/requests/registrations/17/fix-token');

    expect(await screen.findByTestId('public.requests.correction.page')).toBeVisible();
    await waitForPopulatedForm();

    expect(screen.getByRole('link', { name: /common.back/i })).toHaveAttribute('href', '/ui-next');
    expect(screen.getByLabelText('requests.field.time_zone')).toBe(
      screen.getByTestId('public.requests.correction.time_zone')
    );
    expect(screen.getByTestId('public.requests.correction.time_zone')).toHaveValue('Europe/Prague');
    expect(screen.getByTestId('public.requests.correction.time_zone.help')).toHaveTextContent(
      'requests.correction.field.time_zone.help'
    );
    expect(previewRegistrationRequest).toHaveBeenCalledWith(17, 'fix-token');
  });

  it('keeps the success alert visible after the post-submit preview refetch', async () => {
    installHappyPathMocks();
    installSuccessfulUpdateMock();

    renderPage('/requests/registrations/17/fix-token');

    expect(await screen.findByTestId('public.requests.correction.page')).toBeVisible();
    await waitForPopulatedForm();

    fireEvent.click(screen.getByTestId('public.requests.correction.submit'));

    expect(await screen.findByText('requests.correction.success.title')).toBeVisible();

    await waitFor(() => {
      expect(previewRegistrationRequest).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('requests.correction.success.title')).toBeVisible();
    expect(updateRegistrationRequestByToken).toHaveBeenCalledWith(17, 'fix-token', {
      login: 'alice',
      full_name: 'Alice Example',
      org_name: 'Example Org',
      org_id: 'EX-42',
      email: 'alice@example.test',
      address: 'Spec Street 1',
      year_of_birth: 1990,
      how: 'From a friend',
      note: 'Needs correction',
      os_template: 5,
      location: 9,
      currency: 'eur',
      language: 1,
      time_zone: 'Europe/Prague',
    });
  });

  it('submits a changed valid IANA time zone', async () => {
    installHappyPathMocks();
    installSuccessfulUpdateMock();

    renderPage('/requests/registrations/17/fix-token');
    await waitForPopulatedForm();

    fireEvent.change(screen.getByTestId('public.requests.correction.time_zone'), {
      target: { value: 'America/New_York' },
    });
    fireEvent.click(screen.getByTestId('public.requests.correction.submit'));

    await waitFor(() => {
      expect(updateRegistrationRequestByToken).toHaveBeenCalledWith(
        17,
        'fix-token',
        expect.objectContaining({ time_zone: 'America/New_York' })
      );
    });
  });

  it('keeps a nullable preview on server default instead of auto-selecting the browser zone', async () => {
    installHappyPathMocks(null);

    renderPage('/requests/registrations/17/fix-token');
    await waitForPopulatedForm();

    expect(screen.getByTestId('public.requests.correction.time_zone')).toHaveValue('');
    expect(screen.getByTestId('public.requests.correction.time_zone')).not.toHaveValue(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });

  it('maps the server-default choice to an explicit nullable clear', async () => {
    installHappyPathMocks();
    installSuccessfulUpdateMock();

    renderPage('/requests/registrations/17/fix-token');
    await waitForPopulatedForm();

    const select = screen.getByTestId('public.requests.correction.time_zone');
    expect(select).toHaveValue('Europe/Prague');
    fireEvent.change(select, { target: { value: '' } });
    expect(select).toHaveValue('');
    fireEvent.click(screen.getByTestId('public.requests.correction.submit'));

    await waitFor(() => {
      expect(updateRegistrationRequestByToken).toHaveBeenCalledWith(
        17,
        'fix-token',
        expect.objectContaining({ time_zone: null })
      );
    });
  });

  it('keeps an invalid legacy preview visible and blocks resubmission until it is corrected', async () => {
    installHappyPathMocks(' Legacy/Invalid ');

    renderPage('/requests/registrations/17/fix-token');
    await waitFor(() => {
      expect(screen.getByTestId('public.requests.correction.login')).toHaveValue('alice');
    });

    const select = screen.getByTestId('public.requests.correction.time_zone');
    expect(select).toHaveValue(' Legacy/Invalid ');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('public.requests.correction.time_zone.error')).toBeVisible();
    expect(screen.getByTestId('public.requests.correction.submit')).toBeDisabled();
    expect(updateRegistrationRequestByToken).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: '' } });
    expect(select).toHaveValue('');
    expect(screen.queryByTestId('public.requests.correction.time_zone.error')).not.toBeInTheDocument();
    expect(screen.getByTestId('public.requests.correction.submit')).not.toBeDisabled();
  });
});
