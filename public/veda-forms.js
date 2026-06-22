/**
 * Veda form capture for Shreevan Wellness.
 *
 * Sends a copy of any website form submission to the CRM. Add the attribute
 * data-veda-form="<form name>" to each <form> you want captured, and include:
 *   <script src="https://crm.shreevanwellness.com/veda-forms.js"
 *           data-api="https://api.shreevanwellness.com/api/v1" defer></script>
 *
 * Non-intrusive: it does NOT change your form's normal behaviour — it just also
 * posts the fields to the CRM (via fetch keepalive, so it survives navigation).
 */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-api]');
  var cfg = window.VEDA_CHAT || {};
  var API = (cfg.apiUrl || (script && script.getAttribute('data-api')) || 'https://api.shreevanwellness.com/api/v1').replace(/\/$/, '');

  function serialize(form) {
    var data = {};
    try {
      var fd = new FormData(form);
      fd.forEach(function (value, key) {
        if (typeof value !== 'string') return; // skip files
        data[key] = data[key] ? data[key] + ', ' + value : value; // join multi-value fields
      });
    } catch (e) { /* ignore */ }
    return data;
  }

  // Capture phase so we run before the form navigates/submits.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (!form.hasAttribute('data-veda-form')) return; // opt-in per form

    var data = serialize(form);
    if (!data.form && !data.formName) {
      data.form = form.getAttribute('data-veda-form') || 'Website form';
    }

    try {
      fetch(API + '/intake/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true, // lets the request finish even if the page navigates
      }).catch(function () {});
    } catch (e) { /* never block the user's form */ }
  }, true);
})();
