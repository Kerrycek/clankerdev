(function () {
  window.vpsAdmin = window.vpsAdmin || {};

  window.vpsAdmin.api = {
    url: 'https://dev.crucio.cz',
    version: '7.0'
  };

  window.vpsAdmin.webui = {
    url: 'https://dev.crucio.cz'
  };

  window.vpsAdmin.webuiNext = window.vpsAdmin.webuiNext || {};
  window.vpsAdmin.webuiNext.oauth2 = {
    authorizeUrl: 'https://dev.crucio.cz/_auth/oauth2/authorize',
    tokenUrl: 'https://dev.crucio.cz/_auth/oauth2/token',
    clientId: 'dev.crucio.cz',
    scope: 'all',
    type: 'web_server',
    flow: 'pkce',
    redirectPath: '/oauth/callback',
    storage: 'session'
  };
  window.vpsAdmin.webuiNext.loginUrl = '/oauth/login';
  window.vpsAdmin.webuiNext.logoutUrl = '/oauth/logout';

  window.vpsAdmin.webuiNext.uiSettings = window.vpsAdmin.webuiNext.uiSettings || {
    persistence: 'local'
  };
})();
