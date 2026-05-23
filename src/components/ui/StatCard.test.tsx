import React from 'react';
import { render, screen } from '@testing-library/react';

import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('maps variants to the expected value typography classes', () => {
    render(
      <div>
        <StatCard title="Featured" value="111" variant="featured" />
        <StatCard title="Standard" value="222" variant="standard" />
        <StatCard title="Compact" value="333" variant="compact" />
      </div>
    );

    expect(screen.getByText('111')).toHaveClass('text-3xl');
    expect(screen.getByText('222')).toHaveClass('text-2xl');
    expect(screen.getByText('333')).toHaveClass('text-xl');

    // Numeric scanability: always use tabular numerals for stat values.
    expect(screen.getByText('111')).toHaveClass('tabular-nums');
    expect(screen.getByText('222')).toHaveClass('tabular-nums');
    expect(screen.getByText('333')).toHaveClass('tabular-nums');
  });
});
