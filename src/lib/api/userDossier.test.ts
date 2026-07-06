import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmUserTotpDevice, createUserTotpDevice } from './userDossier';

function setMockRuntime() {
  window.vpsAdmin = {
    api: { url: 'https://api.example.test', version: 'v7.0' },
    description: { meta: { namespace: '_meta' } },
  };
}

function mockFetchOk(response: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(JSON.stringify({ status: true, response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.vpsAdmin = undefined;
});

describe('user dossier TOTP wrappers', () => {
  it('validates create response shape and preserves provisioning data', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({
      totp_device: {
        id: 7,
        label: 'Phone',
        secret: 'SECRET123',
        provisioning_uri: 'otpauth://totp/example',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await createUserTotpDevice(42, { label: 'Phone' });

    expect(res.data).toMatchObject({ id: 7, secret: 'SECRET123', provisioning_uri: 'otpauth://totp/example' });

    const [, init] = fetchMock.mock.calls[0]! as Parameters<typeof fetch>;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ totp_device: { label: 'Phone' } });
  });

  it('normalizes confirm recovery code from object or scalar responses', async () => {
    setMockRuntime();
    const fetchMock = mockFetchOk({ recovery_code: 'RECOVERY-1' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(confirmUserTotpDevice(42, 7, { code: '123456' })).resolves.toMatchObject({ data: 'RECOVERY-1' });

    vi.stubGlobal('fetch', mockFetchOk('RECOVERY-2'));
    await expect(confirmUserTotpDevice(42, 7, { code: '654321' })).resolves.toMatchObject({ data: 'RECOVERY-2' });
  });

  it('rejects create and confirm responses with missing TOTP fields', async () => {
    setMockRuntime();
    vi.stubGlobal('fetch', mockFetchOk({ totp_device: { id: 7, secret: 'SECRET123' } }));

    await expect(createUserTotpDevice(42, { label: 'Phone' })).rejects.toThrow('missing secret/provisioning_uri');

    vi.stubGlobal('fetch', mockFetchOk({ recovery_code: null }));
    await expect(confirmUserTotpDevice(42, 7, { code: '123456' })).rejects.toThrow('expected recovery_code');
  });
});
