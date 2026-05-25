const DEFAULT_TEMPORARY_PASSWORD_LENGTH = 20;
const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function getCrypto(): Crypto | undefined {
  return globalThis.crypto;
}

export function generateTemporaryPassword(length = DEFAULT_TEMPORARY_PASSWORD_LENGTH): string {
  const safeLength = Number.isFinite(length) ? Math.max(8, Math.floor(length)) : DEFAULT_TEMPORARY_PASSWORD_LENGTH;
  const bytes = new Uint8Array(safeLength);
  const crypto = getCrypto();

  if (!crypto?.getRandomValues) {
    throw new Error('Secure random generator is not available');
  }

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => TEMPORARY_PASSWORD_ALPHABET[byte % TEMPORARY_PASSWORD_ALPHABET.length]).join('');
}

export function buildTemporaryPasswordMail(opts: {
  login: string;
  password: string;
  appUrl?: string;
}): { subject: string; body: string } {
  const subject = 'vpsAdmin temporary password';
  const appUrl = opts.appUrl?.trim() || 'https://dev.crucio.cz/';
  const body = [
    `Hi ${opts.login},`,
    '',
    'a new temporary vpsAdmin password has been generated for your account.',
    '',
    `Login: ${opts.login}`,
    `Temporary password: ${opts.password}`,
    '',
    `Sign in at: ${appUrl}`,
    '',
    'You will be asked to change this password after signing in.',
    '',
    'If you did not request this change, contact support before using the account.',
  ].join('\n');

  return { subject, body };
}

export function buildMailtoUrl(opts: {
  to?: string;
  subject: string;
  body: string;
}): string {
  const to = encodeURIComponent(opts.to?.trim() ?? '');
  const params = new URLSearchParams({
    subject: opts.subject,
    body: opts.body,
  });

  return `mailto:${to}?${params.toString()}`;
}
