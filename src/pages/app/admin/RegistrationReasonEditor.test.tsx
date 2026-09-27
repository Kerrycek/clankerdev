import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegistrationReasonEditor } from './RegistrationReasonEditor';

vi.mock('../../../app/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

function Editor({ language }: { language: unknown }) {
  const [value, setValue] = useState('');
  return <RegistrationReasonEditor action="request_correction" language={language} value={value}
    onChange={setValue} invalid={false} disabled={false} testIdPrefix="reason" />;
}

describe('RegistrationReasonEditor', () => {
  it('updates an untouched preset when the registration language changes, but preserves custom text', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    const view = (language: string) => <QueryClientProvider client={client}><Editor language={language} /></QueryClientProvider>;
    const { rerender } = render(view('en'));
    await user.selectOptions(screen.getByTestId('reason.reason_preset'), 'name_incomplete');
    expect(screen.getByTestId('reason.reason')).toHaveValue('Your name is missing or incomplete in the application. Please provide your full first and last name.');
    rerender(view('cs'));
    expect(screen.getByTestId('reason.reason')).toHaveValue('V přihlášce chybí jméno nebo není úplné. Doplň prosím své celé jméno a příjmení.');
    await user.clear(screen.getByTestId('reason.reason'));
    await user.type(screen.getByTestId('reason.reason'), 'Vlastní důvod.');
    rerender(view('en'));
    expect(screen.getByTestId('reason.reason')).toHaveValue('Vlastní důvod.');
  });

  it('requires an explicit message language for presets when the application language is unknown', async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><Editor language={undefined} /></QueryClientProvider>);
    expect(screen.getByTestId('reason.reason_preset')).toBeDisabled();
    expect(screen.getByTestId('reason.reason')).toBeEnabled();
    await user.selectOptions(screen.getByTestId('reason.reason_language_choice'), 'cs');
    await user.selectOptions(screen.getByTestId('reason.reason_preset'), 'address_incomplete');
    expect(screen.getByTestId('reason.reason')).toHaveValue('Doplň prosím úplnou adresu: ulici (pokud existuje), číslo domu, obec, PSČ a zemi.');
  });
});
