import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MainContent, SkipToMainContentLink } from './MainContentAccessibility';

describe('main content accessibility', () => {
  it('connects the skip link to a keyboard-focusable main landmark', () => {
    render(
      <>
        <SkipToMainContentLink label="Skip to main content" testId="skip" />
        <MainContent className="flex-1" data-testid="main">
          Dashboard
        </MainContent>
      </>,
    );

    expect(screen.getByTestId('skip')).toHaveAttribute('href', '#main-content');
    expect(screen.getByTestId('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByTestId('main')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('main')).toHaveClass('scroll-mt-24', 'flex-1');
  });
});
