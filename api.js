// ============================================================
// ExPOS — api.js
// JSONP bridge — bypasses CORS and GAS redirect entirely
// ============================================================

const API = (() => {
  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbxzhmzdRjKESMtNuUvt9lgYYZ_pT6WobGVnjBQ_dWxfUjyop-lMOimCE5nNPF-VDDLO/exec';
  const AUTH_TOKEN = '90170e57-8858-450d-9282-a489808e1f86';
  let   _cbIndex   = 0;

  function call(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const cbName = '__expos_cb_' + (++_cbIndex);
      const fullPayload = { ...payload, _token: AUTH_TOKEN };

      const url = GAS_URL
        + '?callback=' + cbName
        + '&action='   + encodeURIComponent(action)
        + '&payload='  + encodeURIComponent(JSON.stringify(fullPayload));

      // Timeout after 30 seconds
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Request timed out'));
      }, 30000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        const el = document.getElementById(cbName);
        if (el) el.remove();
      }

      // JSONP callback — GAS will call this with the response
      window[cbName] = function(data) {
        cleanup();
        if (!data.success) reject(new Error(data.error || 'GAS error'));
        else resolve(data.data);
      };

      // Inject script tag — no CORS, follows redirects natively
      const script = document.createElement('script');
      script.id  = cbName;
      script.src = url;
      script.onerror = () => {
        cleanup();
        reject(new Error('Script load failed'));
      };
      document.head.appendChild(script);
    });
  }

  return { call };
})();
