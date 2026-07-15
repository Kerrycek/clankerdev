// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';

import { Modal } from './Modal';

describe('Modal', () => {
  it('keeps the page visible behind an opaque dialog surface', () => {
    render(
      <Modal open title="Edit settings" onClose={() => undefined} testId="modal">
        Content
      </Modal>
    );

    expect(screen.getByTestId('modal')).toHaveClass('bg-overlay-surface');
    expect(screen.getByTestId('modal')).toHaveClass('z-10');
    expect(screen.getByTestId('modal')).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector('[data-overlay-backdrop="true"]')).toHaveClass(
      'bg-backdrop/45'
    );
  });
});
