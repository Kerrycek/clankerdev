// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';

import { CardHeader } from './Card';

describe('CardHeader', () => {
  it('stacks copy and wrapping actions on mobile while retaining the desktop row', () => {
    render(
      <CardHeader
        title="A deliberately long card title"
        subtitle="Supporting context"
        actions={
          <>
            <button type="button">Collapse</button>
            <button type="button">Open</button>
          </>
        }
      />
    );

    const copy = screen.getByText('A deliberately long card title').parentElement;
    const actions = screen.getByRole('button', { name: 'Collapse' }).parentElement;
    const header = copy?.parentElement;

    expect(header).toHaveClass('flex-col', 'sm:flex-row');
    expect(copy).toHaveClass('w-full', 'sm:w-auto', 'sm:flex-1');
    expect(actions).toHaveClass('w-full', 'min-w-0', 'flex-wrap', 'sm:w-auto', 'sm:shrink-0');
  });
});
