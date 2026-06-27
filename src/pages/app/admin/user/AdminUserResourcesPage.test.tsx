// i18n-ignore-file

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AdminUserResourcesPage } from './AdminUserResourcesPage';

const mocks = vi.hoisted(() => ({
  pushToast: vi.fn(),
  useAdminUserContext: vi.fn(),
  fetchUserClusterResourcePackages: vi.fn(),
  createUserClusterResourcePackage: vi.fn(),
  updateUserClusterResourcePackage: vi.fn(),
  deleteUserClusterResourcePackage: vi.fn(),
  fetchClusterResourcePackages: vi.fn(),
  fetchUserClusterResources: vi.fn(),
  fetchEnvironments: vi.fn(),
}));

vi.mock('../../../../app/i18n', () => ({
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

vi.mock('../../../../app/toasts', () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

vi.mock('./AdminUserLayout', () => ({
  useAdminUserContext: mocks.useAdminUserContext,
}));

vi.mock('../../../../lib/api/infra', () => ({
  fetchEnvironments: mocks.fetchEnvironments,
}));

vi.mock('../../../../lib/api/clusterResources', () => ({
  fetchUserClusterResources: mocks.fetchUserClusterResources,
}));

vi.mock('../../../../lib/api/clusterResourcePackages', () => ({
  createUserClusterResourcePackage: mocks.createUserClusterResourcePackage,
  deleteUserClusterResourcePackage: mocks.deleteUserClusterResourcePackage,
  fetchClusterResourcePackages: mocks.fetchClusterResourcePackages,
  fetchUserClusterResourcePackages: mocks.fetchUserClusterResourcePackages,
  updateUserClusterResourcePackage: mocks.updateUserClusterResourcePackage,
}));

function renderPage(path = '/admin/users/7/resources') {
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
          <Route path="/admin/users/:userId/resources" element={<AdminUserResourcesPage />} />
          <Route path="/admin/cluster/resource-packages/:packageId" element={<div data-testid="admin.cluster.package.detail" />} />
          <Route path="/admin/cluster/resource-packages" element={<div data-testid="admin.cluster.packages" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();

  mocks.useAdminUserContext.mockReturnValue({
    userId: 7,
    user: { id: 7, login: 'alice' },
    refetch: vi.fn(),
  });

  mocks.fetchUserClusterResourcePackages.mockResolvedValue({
    data: [
      {
        id: 55,
        environment: { id: 1, label: 'Production' },
        cluster_resource_package: { id: 20, label: 'Default resources' },
        comment: 'current quota',
        added_by: { id: 1, login: 'admin' },
        created_at: '2026-06-24T10:00:00Z',
      },
    ],
    meta: { total_count: 1 },
  });

  mocks.fetchUserClusterResources.mockResolvedValue({
    data: [
      {
        id: 501,
        environment: { id: 1, label: 'Production' },
        cluster_resource: { id: 2, label: 'CPU', name: 'cpu' },
        value: 4,
      },
    ],
  });

  mocks.fetchEnvironments.mockResolvedValue({
    data: [
      { id: 1, label: 'Production' },
      { id: 2, label: 'Staging' },
    ],
  });

  mocks.fetchClusterResourcePackages.mockResolvedValue({
    data: [
      { id: 20, label: 'Default resources', is_personal: false },
      { id: 21, label: 'Extra resources', is_personal: false },
    ],
  });

  mocks.createUserClusterResourcePackage.mockResolvedValue({ data: { id: 77 } });
  mocks.updateUserClusterResourcePackage.mockResolvedValue({ data: { id: 55 } });
  mocks.deleteUserClusterResourcePackage.mockResolvedValue({ data: null });
});

describe('AdminUserResourcesPage', () => {
  test('renders assigned packages and effective user resources', async () => {
    renderPage();

    expect(await screen.findByTestId('admin.user.resources.assignment.row.55')).toBeVisible();
    expect(screen.getByText('Default resources')).toBeVisible();
    expect(screen.getByText('current quota')).toBeVisible();

    expect(await screen.findByTestId('admin.user.resources.effective.row.501')).toBeVisible();
    expect(screen.getByText('CPU (cpu)')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();

    await waitFor(() => {
      expect(mocks.fetchUserClusterResourcePackages).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, limit: 50 }));
      expect(mocks.fetchUserClusterResources).toHaveBeenCalledWith(7, { limit: 500 });
    });
  });

  test('creates a new user resource package assignment', async () => {
    renderPage();

    await userEvent.click(await screen.findByTestId('admin.user.resources.assign.open'));

    expect(await screen.findByTestId('admin.user.resources.assign.modal')).toBeVisible();

    await userEvent.selectOptions(screen.getByTestId('admin.user.resources.assign.environment'), '1');
    await userEvent.selectOptions(screen.getByTestId('admin.user.resources.assign.package'), '20');
    await userEvent.type(screen.getByTestId('admin.user.resources.assign.comment'), 'base quota');
    await userEvent.click(screen.getByTestId('admin.user.resources.assign.save'));

    await waitFor(() => {
      expect(mocks.createUserClusterResourcePackage).toHaveBeenCalledWith({
        environmentId: 1,
        userId: 7,
        clusterResourcePackageId: 20,
        comment: 'base quota',
        fromPersonal: false,
      });
    });

    expect(mocks.pushToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'ok' }));
  });
});
