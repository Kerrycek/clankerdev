import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  status: 'anonymous',
}));

vi.mock('../../app/config', () => ({
  getRuntimeConfig: () => ({
    routerBasename: '',
    loginUrl: undefined,
  }),
}));

vi.mock('../../app/auth', () => ({
  useAuth: () => ({
    status: authState.status,
  }),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

import { PublicLayout } from './PublicLayout';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <LocationProbe />
              <PublicLayout />
            </>
          }
        >
          <Route index element={<div data-testid="public.index" />} />
          <Route path="outages" element={<div data-testid="public.outages" />} />
          <Route path="security-advisories" element={<div data-testid="public.security" />} />
        </Route>
        <Route path="/app" element={<div data-testid="app.index" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicLayout', () => {
  beforeEach(() => {
    authState.status = 'anonymous';
  });

  it('keeps the public index visible for anonymous visitors', () => {
    renderAt('/');

    expect(screen.getByTestId('public.index')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('redirects authenticated visitors from the public index back to the app', async () => {
    authState.status = 'authenticated';

    renderAt('/');

    await waitFor(() => expect(screen.getByTestId('app.index')).toBeVisible());
  });

  it('keeps authenticated visitors on explicit public pages', () => {
    authState.status = 'authenticated';

    renderAt('/outages');

    expect(screen.getByTestId('public.outages')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/outages');
  });

  it('shows security advisories in the public nav instead of news', () => {
    renderAt('/');

    expect(screen.getAllByText('public.nav.security_advisories')).toHaveLength(1);
    expect(screen.queryByText('public.nav.news')).not.toBeInTheDocument();
  });

  it('does not redirect the expired-session public notice URL', () => {
    authState.status = 'authenticated';

    renderAt('/?session=expired');

    expect(screen.getByTestId('public.index')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/?session=expired');
  });
});
