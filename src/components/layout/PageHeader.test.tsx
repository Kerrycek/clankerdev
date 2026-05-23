// i18n-ignore-file

import React from 'react';
import { render, screen } from '@testing-library/react';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('uses the page title typography contract (mobile lg, desktop xl)', () => {
    render(<PageHeader title="My title" description="Desc" />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('text-lg');
    expect(h1).toHaveClass('md:text-xl');
    expect(h1).not.toHaveClass('text-2xl');
  });
});
