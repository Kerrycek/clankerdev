import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { RequestAddressMapLink } from './RequestAddressMapLink';

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }));

vi.mock('../../../lib/clipboard', () => ({
  copyTextToClipboard: clipboard.copy,
}));

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) => (
      values?.['address'] ? `${key}: ${String(values['address'])}` : key
    ),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: null,
    isFetching: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
}));

describe('registration address map actions', () => {
  beforeEach(() => {
    clipboard.copy.mockReset();
  });

  test('copies the exact submitted address and confirms the action', async () => {
    clipboard.copy.mockResolvedValueOnce(true);
    const address = 'Calle General Espartero 10, 13240 La Solana, Spain';

    render(<RequestAddressMapLink address={`  ${address}  `} testId="request-address" />);

    const copy = screen.getByTestId('request-address.copy');
    expect(copy).toHaveAccessibleName(`requests.detail.address_map.copy_aria: ${address}`);
    expect(copy).toHaveTextContent('requests.detail.address_map.copy');

    fireEvent.click(copy);

    await waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(address));
    await waitFor(() => expect(copy).toHaveTextContent('common.copied'));
    expect(screen.getByRole('status')).toHaveTextContent('common.copied');
  });

  test('keeps the map action separate from the copy action', () => {
    const address = 'Stodolní 138/44, Ostrava';
    render(<RequestAddressMapLink address={address} testId="request-address" />);

    expect(screen.getByTestId('request-address.link')).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/search?query=Stodoln%C3%AD+138%2F44%2C+Ostrava',
    );
    expect(screen.getByTestId('request-address.copy').tagName).toBe('BUTTON');
  });
});
