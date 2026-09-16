import React from 'react';
// i18n-ignore-file -- adversarial test fixtures intentionally use literal long labels.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ObjectHeader } from './ObjectHeader';

describe('ObjectHeader responsive containment', () => {
  it('lets long titles and action groups wrap within a mobile viewport', () => {
    render(
      <MemoryRouter>
        <ObjectHeader
          testId="header"
          title="an-uninterrupted-object-identifier-that-must-not-widen-the-document"
          titleAfter={<span>status badges</span>}
          actions={<><button>First long action</button><button>Second long action</button></>}
        />
      </MemoryRouter>
    );

    const header = screen.getByTestId('header');
    const heading = screen.getByRole('heading');
    const actionGroup = screen.getByRole('button', { name: 'First long action' }).parentElement;
    const responsiveRightColumn = actionGroup?.parentElement;

    expect(heading).toHaveClass('min-w-0', 'break-words', '[overflow-wrap:anywhere]');
    expect(actionGroup).toHaveClass('min-w-0', 'w-full', 'flex-wrap', 'sm:w-auto');
    expect(responsiveRightColumn).toHaveClass('min-w-0', 'w-full', 'sm:w-auto', 'sm:shrink-0');
  });

  it('can keep dense headers stacked until a desktop-width breakpoint', () => {
    render(
      <MemoryRouter>
        <ObjectHeader
          testId="header"
          horizontalAt="xl"
          title="VPS"
          actions={<button>Console</button>}
        />
      </MemoryRouter>
    );

    const header = screen.getByTestId('header');
    const layout = header.querySelector('[data-document-title-root] > div');
    const actionGroup = screen.getByRole('button', { name: 'Console' }).parentElement;
    const responsiveRightColumn = actionGroup?.parentElement;

    expect(layout).toHaveClass('flex-col', 'xl:flex-row');
    expect(layout).not.toHaveClass('sm:flex-row');
    expect(actionGroup).toHaveClass('w-full', 'xl:w-auto', 'xl:justify-end');
    expect(responsiveRightColumn).toHaveClass('w-full', 'xl:w-auto', 'xl:shrink-0');
  });
});
