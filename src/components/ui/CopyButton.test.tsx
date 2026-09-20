// i18n-ignore-file
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { CopyButton } from './CopyButton';

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../lib/clipboard', () => ({
  copyTextToClipboard: clipboard.copy,
}));

describe('CopyButton', () => {
  it('keeps compact copy actions accessible and confirms success', async () => {
    clipboard.copy.mockResolvedValueOnce(true);

    render(<CopyButton text="node5.example" iconOnly testId="copy-node" />);

    const button = screen.getByTestId('copy-node');
    expect(button).toHaveAccessibleName('common.copy');
    expect(button).toHaveAttribute('title', 'common.copy');

    fireEvent.click(button);

    await waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith('node5.example'));
    await waitFor(() => expect(button).toHaveAccessibleName('common.copied'));
    expect(screen.getByRole('status')).toHaveTextContent('common.copied');
  });

  it.each([
    ['success', true, 'common.copied'],
    ['failure', false, 'common.copy_failed'],
  ])('keeps a contextual accessible name while announcing copy %s', async (_case, copied, status) => {
    clipboard.copy.mockResolvedValueOnce(copied);

    render(<CopyButton text="ops@example.test" ariaLabel="Copy effective recipients for Operations" testId="copy-context" />);

    const button = screen.getByTestId('copy-context');
    expect(button).toHaveAccessibleName('Copy effective recipients for Operations');
    expect(button).toHaveTextContent('common.copy');

    fireEvent.click(button);

    await waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith('ops@example.test'));
    await waitFor(() => expect(button).toHaveTextContent(status));
    expect(button).toHaveAccessibleName('Copy effective recipients for Operations');
    expect(screen.getByRole('status')).toHaveTextContent(status);
  });
});
