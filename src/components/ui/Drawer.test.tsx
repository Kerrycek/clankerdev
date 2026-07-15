// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';

import { Drawer } from './Drawer';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('Drawer', () => {
  it('renders modal drawers with a page backdrop by default', () => {
    render(
      <Drawer open title="Filters" onClose={() => undefined} testId="drawer">
        Content
      </Drawer>
    );

    expect(screen.getByTestId('drawer')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('drawer')).toHaveClass('z-10');
    expect(document.querySelector('[data-overlay-backdrop="true"]')).toHaveClass(
      'bg-backdrop/45'
    );
  });

  it('renders non-modal drawers without hiding or blocking the page', () => {
    render(
      <>
        <main data-testid="page-content">Page content</main>
        <Drawer open title="Tasks" onClose={() => undefined} testId="tasks.drawer" modal={false}>
          Tasks content
        </Drawer>
      </>
    );

    const drawer = screen.getByTestId('tasks.drawer');

    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer.parentElement).toHaveClass('pointer-events-none');
    expect(drawer).toHaveClass('pointer-events-auto');
    expect(document.querySelector('[data-overlay-backdrop="true"]')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeVisible();
  });
});
