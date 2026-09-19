// i18n-ignore-file
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Drawer } from './Drawer';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('Drawer', () => {
  it('renders modal drawers with a page backdrop by default', () => {
    render(
      <Drawer
        open
        title="Filters"
        onClose={() => undefined}
        testId="drawer"
        footer={<button type="button">Save</button>}
      >
        <div data-testid="tall-content">Content</div>
      </Drawer>
    );

    const drawer = screen.getByTestId('drawer');
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBe(drawer);
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveClass('z-10', 'h-dvh', 'overflow-hidden');
    expect(screen.getByTestId('tall-content').parentElement).toHaveClass(
      'z-0',
      'min-h-0',
      'overflow-y-auto',
      'overscroll-contain'
    );
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass(
      'z-10',
      'shrink-0',
      'bg-overlay-surface'
    );
    expect(document.querySelector('[data-overlay-backdrop="true"]')).toHaveClass(
      'bg-backdrop/45'
    );

    expect(screen.getByRole('button', { name: 'common.close' })).toHaveClass(
      'min-h-11',
      'min-w-11',
      'sm:min-h-8',
      'sm:min-w-8',
      '[@media(any-pointer:coarse)]:min-h-11',
      '[@media(any-pointer:coarse)]:min-w-11'
    );
  });

  it('requests close from Escape and the modal backdrop', () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Filters" onClose={onClose} testId="drawer">
        Content
      </Drawer>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = document.querySelector('[data-overlay-backdrop="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
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
