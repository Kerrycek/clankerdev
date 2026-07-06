import { describe, expect, it } from 'vitest';

import { creationOptionsFromJson, credentialToJson } from './webauthn';

function bufferFromBytes(bytes: readonly number[]): ArrayBuffer {
  const out = new Uint8Array(bytes);
  return out.buffer;
}

function bufferSourceBytes(source: BufferSource): number[] {
  if (source instanceof ArrayBuffer) return Array.from(new Uint8Array(source));
  return Array.from(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
}

describe('webauthn helpers', () => {
  it('converts creation options from base64url JSON into browser BufferSource values', () => {
    const options = creationOptionsFromJson({
      challenge: 'AQID',
      rp: { name: 'vpsAdmin' },
      user: { id: 'BAUG', name: 'alice', displayName: 'Alice' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ id: 'BwgJ', type: 'public-key', transports: ['usb', 'invalid', 'internal'] }],
    });

    expect(bufferSourceBytes(options.challenge)).toEqual([1, 2, 3]);
    expect(bufferSourceBytes(options.user.id)).toEqual([4, 5, 6]);
    expect(options.excludeCredentials).toHaveLength(1);
    expect(bufferSourceBytes(options.excludeCredentials![0]!.id)).toEqual([7, 8, 9]);
    expect(options.excludeCredentials![0]!.type).toBe('public-key');
    expect(options.excludeCredentials![0]!.transports).toEqual(['usb', 'internal']);
  });

  it('rejects incomplete creation options before touching the browser API', () => {
    expect(() => creationOptionsFromJson(null)).toThrow('Invalid WebAuthn creation options');
    expect(() => creationOptionsFromJson({ user: { id: 'AQID' } })).toThrow('missing a challenge');
    expect(() => creationOptionsFromJson({ challenge: 'AQID' })).toThrow('missing a user');
    expect(() => creationOptionsFromJson({ challenge: 'AQID', user: {} })).toThrow('missing user.id');
  });

  it('serializes attestation credentials into API-safe JSON', async () => {
    const original = globalThis.AuthenticatorAttestationResponse;

    class FakeAttestationResponse {
      readonly attestationObject: ArrayBuffer;
      readonly clientDataJSON: ArrayBuffer;

      constructor(attestationObject: ArrayBuffer, clientDataJSON: ArrayBuffer) {
        this.attestationObject = attestationObject;
        this.clientDataJSON = clientDataJSON;
      }

      getTransports() {
        return ['usb', 'invalid', 'internal'];
      }
    }

    Object.defineProperty(globalThis, 'AuthenticatorAttestationResponse', {
      configurable: true,
      value: FakeAttestationResponse,
    });

    try {
      const response = new FakeAttestationResponse(bufferFromBytes([1, 2, 3]), bufferFromBytes([4, 5, 6]));
      const credential = {
        id: 'credential-id',
        rawId: bufferFromBytes([9, 10, 11]),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response,
      } as unknown as PublicKeyCredential;

      await expect(credentialToJson(credential)).resolves.toEqual({
        id: 'credential-id',
        rawId: 'CQoL',
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          attestationObject: 'AQID',
          clientDataJSON: 'BAUG',
          transports: ['usb', 'internal'],
        },
      });
    } finally {
      Object.defineProperty(globalThis, 'AuthenticatorAttestationResponse', {
        configurable: true,
        value: original,
      });
    }
  });
});
