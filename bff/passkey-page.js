'use strict';

const { setOAuthRecoverySecurityHeaders } = require('./oauth-error-page');

function passkeyDestinations(authorizeUrl, redirectUri) {
  const auth = new URL(authorizeUrl);
  const web = new URL(redirectUri);
  if (auth.protocol !== 'https:' || web.protocol !== 'https:') {
    throw new Error('WebAuthn handoff requires HTTPS authentication and UI origins');
  }
  return {
    origin: auth.origin,
    action: new URL('/webauthn/registration/new', auth.origin).href,
    returnUrl: new URL('/app/profile/mfa', web.origin).href,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function setPasskeyHeaders(res, authOrigin) {
  setOAuthRecoverySecurityHeaders(res);
  res.setHeader('content-security-policy',
    `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action ${authOrigin}; frame-ancestors 'none'`);
}

function renderPasskeyPage(language, token, destinations) {
  const cs = language === 'cs';
  const title = cs ? 'Přidat bezpečnostní klíč' : 'Add a security key';
  const message = cs
    ? 'Pokračujte na přihlašovací službu, kde klíč pojmenujete a zaregistrujete. Poté se vrátíte do profilu. Registrační stránka je v angličtině.'
    : 'Continue to the sign-in service to name and register your key. You will then return to your profile. The registration page is in English.';
  return `<!doctype html>
<html lang="${cs ? 'cs' : 'en'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>vpsAdmin · ${title}</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; padding: 1.5rem; min-height: 100vh; display: grid; place-items: center; }
main { max-width: 34rem; width: 100%; overflow-wrap: anywhere; }
h1 { font-size: 1.75rem; } p { line-height: 1.6; }
button, a { display: inline-block; padding: .8rem 1rem; margin: .5rem .5rem .5rem 0; font: inherit; }
button { cursor: pointer; } :focus-visible { outline: 3px solid #f28c28; outline-offset: 3px; }
</style></head><body><main><strong>vpsAdmin</strong><h1>${title}</h1><p>${message}</p>
<form method="post" action="${escapeHtml(destinations.action)}">
<input type="hidden" name="access_token" value="${escapeHtml(token)}">
<input type="hidden" name="redirect_uri" value="${escapeHtml(destinations.returnUrl)}">
<button type="submit" data-testid="passkey.continue">${cs ? 'Pokračovat' : 'Continue'}</button>
<a href="/app/profile/mfa">${cs ? 'Zrušit' : 'Cancel'}</a>
</form></main></body></html>`;
}

module.exports = { passkeyDestinations, renderPasskeyPage, setPasskeyHeaders };
