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
  window.vpsAdmin.webuiNext.loginUrl = '/oauth/login';
  window.vpsAdmin.webuiNext.logoutUrl = '/oauth/logout';
  window.vpsAdmin.webuiNext.basePath = '';
  window.vpsAdmin.webuiNext.haveApi = {
    authHeader: 'X-HaveAPI-OAuth2-Token',
    metaNamespace: '_meta'
  };

  window.vpsAdmin.webuiNext.uiSettings = window.vpsAdmin.webuiNext.uiSettings || {
    persistence: 'local'
  };
})();
