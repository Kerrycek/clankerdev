// i18n-ignore-file
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordBox } from './VpsAccessPrimitives';

const translations: Record<string, string> = {
  'vps.access.generated.title': 'Generated root password',
  'vps.access.secret.reveal': 'Reveal',
  'vps.access.secret.hide': 'Hide',
  'vps.access.secret.copy': 'Copy',
  'vps.access.secret.copied': 'Copied',
  'vps.access.secret.clear': 'Clear',
  'vps.access.secret.once': 'The generated password is shown only in this browser state.',
};

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({ t: (key: string) => translations[key] ?? key }),
}));

describe('PasswordBox accessibility', () => {
  it('associates the localized label and one-time security note with the password field', () => {
    render(<PasswordBox password="Root-123!" onClear={() => undefined} />);

    const field = screen.getByLabelText('Generated root password');
    expect(field).toHaveAccessibleName('Generated root password');
    expect(field).toHaveAccessibleDescription('The generated password is shown only in this browser state.');
  });

  it('keeps the accessible name when the password is revealed as text', () => {
    render(<PasswordBox password="Root-123!" onClear={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(screen.getByRole('textbox', { name: 'Generated root password' })).toHaveValue('Root-123!');
  });
});
