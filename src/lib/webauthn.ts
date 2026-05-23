function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeAuthenticatorAttachment(value: unknown): AuthenticatorAttachment | null | undefined {
  return value === 'cross-platform' || value === 'platform' ? value : value == null ? null : undefined;
}

function normalizeTransports(value: unknown): AuthenticatorTransport[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const out = value.filter(
    (v): v is AuthenticatorTransport =>
      v === 'ble' || v === 'cable' || v === 'hybrid' || v === 'internal' || v === 'nfc' || v === 'smart-card' || v === 'usb'
  );

  return out.length > 0 ? out : undefined;
}

function cloneExcludeCredentials(
  value: unknown
): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const out: PublicKeyCredentialDescriptor[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;

    const rawId = (entry as { id?: unknown }).id;
    if (typeof rawId !== 'string') continue;

    const type = (entry as { type?: unknown }).type;
    const transportsRaw = (entry as { transports?: unknown }).transports;
    const transports = normalizeTransports(transportsRaw);

    out.push({
      ...(entry as Record<string, unknown>),
      id: uint8ArrayToArrayBuffer(base64UrlToUint8Array(rawId)),
      type: type === 'public-key' ? type : 'public-key',
      transports,
    } satisfies PublicKeyCredentialDescriptor);
  }

  return out;
}

export function isWebauthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.PublicKeyCredential && navigator.credentials?.create);
}

export function creationOptionsFromJson(raw: unknown): PublicKeyCredentialCreationOptions {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid WebAuthn creation options');
  }

  const options = { ...(raw as Record<string, unknown>) } as Record<string, unknown>;
  const challenge = options['challenge'];
  const user = options['user'];

  if (typeof challenge !== 'string') {
    throw new Error('WebAuthn creation options are missing a challenge');
  }

  if (!user || typeof user !== 'object') {
    throw new Error('WebAuthn creation options are missing a user');
  }

  const userRecord = { ...(user as Record<string, unknown>) };
  const userId = userRecord['id'];
  if (typeof userId !== 'string') {
    throw new Error('WebAuthn creation options are missing user.id');
  }

  return {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: uint8ArrayToArrayBuffer(base64UrlToUint8Array(challenge)),
    user: {
      ...(userRecord as unknown as PublicKeyCredentialUserEntity),
      id: uint8ArrayToArrayBuffer(base64UrlToUint8Array(userId)),
    },
    excludeCredentials: cloneExcludeCredentials(options['excludeCredentials']),
  };
}

export async function credentialToJson(credential: PublicKeyCredential): Promise<{
  id: string;
  rawId: string;
  type: PublicKeyCredential['type'];
  authenticatorAttachment?: AuthenticatorAttachment | null;
  response: {
    attestationObject: string;
    clientDataJSON: string;
    transports?: AuthenticatorTransport[];
  };
}> {
  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse)) {
    throw new Error('Expected an attestation response from navigator.credentials.create()');
  }

  const transports = typeof response.getTransports === 'function' ? normalizeTransports(response.getTransports()) : undefined;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: normalizeAuthenticatorAttachment(credential.authenticatorAttachment),
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      transports,
    },
  };
}
