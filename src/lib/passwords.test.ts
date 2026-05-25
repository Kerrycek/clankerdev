import { describe, expect, it } from 'vitest';

import { buildMailtoUrl, buildTemporaryPasswordMail, generateTemporaryPassword } from './passwords';

describe('generateTemporaryPassword', () => {
  it('generates a 20 character password by default', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(20);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('enforces a minimum length of 8 characters', () => {
    expect(generateTemporaryPassword(3)).toHaveLength(8);
  });
});

describe('buildTemporaryPasswordMail', () => {
  it('includes login, temporary password and app URL', () => {
    const mail = buildTemporaryPasswordMail({
      login: 'kerry',
      password: 'abc123ABC456',
      appUrl: 'https://dev.crucio.cz/admin/users/1/security',
    });

    expect(mail.subject).toContain('vpsAdmin');
    expect(mail.body).toContain('kerry');
    expect(mail.body).toContain('abc123ABC456');
    expect(mail.body).toContain('https://dev.crucio.cz/admin/users/1/security');
  });
});

describe('buildMailtoUrl', () => {
  it('builds a mailto URL with encoded subject and body', () => {
    const url = buildMailtoUrl({
      to: 'user@example.test',
      subject: 'Temporary password',
      body: 'Line 1\nLine 2',
    });

    expect(url).toContain('mailto:user%40example.test?');
    expect(url).toContain('subject=Temporary+password');
    expect(url).toContain('body=Line+1%0ALine+2');
  });
});
