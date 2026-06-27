// i18n-ignore-file

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { RequestDetailPage } from './RequestDetailPage';
import { RequestsPage } from './RequestsPage';

const mocks = vi.hoisted(() => ({
  appMode: { mode: 'admin' as 'admin' | 'user', basePath: '/admin' },
  fetchRegistrationRequests: vi.fn(),
  fetchChangeRequests: vi.fn(),
  fetchRegistrationRequest: vi.fn(),
  fetchChangeRequest: vi.fn(),
  resolveRegistrationRequest: vi.fn(),
  resolveChangeRequest: vi.fn(),
  searchUsers: vi.fn(),
  pushToast: vi.fn(),
  chrome: {
    trackActionState: vi.fn(),
  },
}));

vi.mock('../../../app/appMode', () => ({
  useAppMode: () => mocks.appMode,
}));

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    lang: 'en',
    preference: 'en',
    preferredLanguageCodes: ['en', 'cs'],
    t: (key: string, vars?: Record<string, unknown>) => {
      let out = key;
      for (const [k, v] of Object.entries(vars ?? {})) out = out.replace(`{${k}}`, String(v));
      return out;
    },
    tc: (key: string, count: number) => `${key}:${count}`,
  }),
}));

vi.mock('../../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('../../../components/layout/ChromeContext', () => ({
  useChrome: () => mocks.chrome,
}));

vi.mock('../../../lib/api/users', () => ({
  searchUsers: mocks.searchUsers,
}));

vi.mock('../../../lib/api/requests', () => ({
  fetchRegistrationRequests: mocks.fetchRegistrationRequests,
  fetchChangeRequests: mocks.fetchChangeRequests,
  fetchRegistrationRequest: mocks.fetchRegistrationRequest,
  fetchChangeRequest: mocks.fetchChangeRequest,
  resolveRegistrationRequest: mocks.resolveRegistrationRequest,
  resolveChangeRequest: mocks.resolveChangeRequest,
}));

function renderPage(path = '/admin/requests') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/requests" element={<RequestsPage />} />
          <Route path="/app/requests" element={<RequestsPage />} />
          <Route path="/app" element={<div data-testid="app.home" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderDetail(path = '/admin/requests/registration/31') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/requests/:type/:requestId" element={<RequestDetailPage />} />
          <Route path="/app/requests/:type/:requestId" element={<RequestDetailPage />} />
          <Route path="/app" element={<div data-testid="app.home" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function installListMocks() {
  mocks.fetchRegistrationRequests.mockResolvedValue({
    data: [
      {
        id: 31,
        state: 'awaiting',
        label: 'RegistrationRequest #31',
        login: 'alice',
        full_name: 'Alice Example',
        email: 'alice@example.test',
        address: 'Spec Street 1',
        api_ip_addr: '192.0.2.10',
        client_ip_addr: '198.51.100.10',
        user: { id: 71, login: 'alice' },
        created_at: '2026-06-20T10:00:00Z',
      },
    ],
  });
  mocks.fetchChangeRequests.mockResolvedValue({
    data: [
      {
        id: 30,
        state: 'awaiting',
        label: 'ChangeRequest #30',
        full_name: 'Bob Example',
        email: 'bob@example.test',
        address: 'Other Street 2',
        change_reason: 'Moved',
        api_ip_addr: '192.0.2.11',
        client_ip_addr: '198.51.100.11',
        user: { id: 72, login: 'bob' },
        created_at: '2026-06-19T10:00:00Z',
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appMode.mode = 'admin';
  mocks.appMode.basePath = '/admin';
  mocks.searchUsers.mockResolvedValue({ data: [] });
  mocks.resolveRegistrationRequest.mockResolvedValue({ meta: { action_state_id: 701 } });
  mocks.resolveChangeRequest.mockResolvedValue({ meta: { action_state_id: 702 } });
});

describe('RequestsPage admin triage', () => {
  test('defaults to the actionable awaiting queue', async () => {
    installListMocks();

    renderPage('/admin/requests');

    await screen.findByTestId('admin.requests.row.registration.31');

    await waitFor(() => {
      expect(mocks.fetchRegistrationRequests).toHaveBeenCalledWith(expect.objectContaining({ state: 'awaiting' }));
      expect(mocks.fetchChangeRequests).toHaveBeenCalledWith(expect.objectContaining({ state: 'awaiting' }));
    });
  });

  test('expands all rows and resolves a row action without leaving the list', async () => {
    installListMocks();

    renderPage('/admin/requests');

    await screen.findByTestId('admin.requests.row.registration.31');

    fireEvent.click(screen.getByTestId('admin.requests.expand_all'));

    expect((await screen.findAllByTestId('admin.requests.row.registration.31.expanded')).length).toBeGreaterThan(0);
    expect((await screen.findAllByTestId('admin.requests.row.change.30.expanded')).length).toBeGreaterThan(0);

    const denyButtons = await screen.findAllByTestId('admin.requests.row.change.30.action.deny');
    await userEvent.click(denyButtons[0]!);

    await waitFor(() => {
      expect(mocks.resolveChangeRequest).toHaveBeenCalledWith(30, { action: 'deny' });
    });
    expect(mocks.chrome.trackActionState).toHaveBeenCalledWith(702);
    expect(mocks.pushToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'ok' }));
  });

  test('redirects the user-mode deep link away from admin requests', async () => {
    mocks.appMode.mode = 'user';
    mocks.appMode.basePath = '/app';

    renderPage('/app/requests');

    expect(await screen.findByTestId('app.home')).toBeVisible();
    expect(mocks.fetchRegistrationRequests).not.toHaveBeenCalled();
    expect(mocks.fetchChangeRequests).not.toHaveBeenCalled();
  });

  test('redirects the user-mode request detail deep link before loading admin-only data', async () => {
    mocks.appMode.mode = 'user';
    mocks.appMode.basePath = '/app';

    renderDetail('/app/requests/registration/31');

    expect(await screen.findByTestId('app.home')).toBeVisible();
    expect(mocks.fetchRegistrationRequest).not.toHaveBeenCalled();
    expect(mocks.fetchChangeRequest).not.toHaveBeenCalled();
  });
});
