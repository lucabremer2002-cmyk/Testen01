/* Start der Anwendung */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui;

  UI.boot = function () {
    var theme = 'auto';
    try { theme = localStorage.getItem('matchplan.theme') || 'auto'; } catch (e) { /* egal */ }
    UI.theme(theme);
    if (FM.state) UI.go('dashboard');
    else UI.renderStart();
  };

  window.addEventListener('beforeunload', function () {
    if (FM.state && !(UI.liveActive && UI.liveActive())) FM.save(UI.slot || 1);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', UI.boot);
  else UI.boot();
})();
