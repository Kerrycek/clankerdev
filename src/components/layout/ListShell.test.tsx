// i18n-ignore-file

import React from 'react';
import { render, screen } from '@testing-library/react';

import { ListShell } from './ListShell';

describe('ListShell', () => {
  it('renders children without requiring a header', () => {
    render(
      <ListShell>
        <div data-testid="list-shell-child">Child</div>
      </ListShell>,
    );

    expect(screen.getByTestId('list-shell-child')).toHaveTextContent('Child');
  });

  it('renders header and filters when provided', () => {
    render(
      <ListShell
        header={<div data-testid="list-shell-header">Header</div>}
        filters={<div data-testid="list-shell-filters">Filters</div>}
      >
        <div data-testid="list-shell-child">Child</div>
      </ListShell>,
    );

    expect(screen.getByTestId('list-shell-header')).toHaveTextContent('Header');
    expect(screen.getByTestId('list-shell-filters')).toHaveTextContent('Filters');
    expect(screen.getByTestId('list-shell-child')).toHaveTextContent('Child');
  });
});
