// ============================================================
// ExPOS — api.js
// GitHub Pages → GAS API Bridge
// ============================================================

const API = (() => {
  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbxzhmzdRjKESMtNuUvt9lgYYZ_pT6WobGVnjBQ_dWxfUjyop-lMOimCE5nNPF-VDDLO/exec';
  const AUTH_TOKEN = '90170e57-8858-450d-9282-a489808e1f86';

  async function call(action, payload = {}) {
    const body = {
      action,
      payload: { ...payload, _token: AUTH_TOKEN }
    };

    try {
      const resp = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow'
      });

      if (!resp.ok) throw new Error('Network error: ' + resp.status);

      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Unknown GAS error');
      return data.data;

    } catch (err) {
      // GAS sometimes redirects — retry with no-cors as fallback diagnostic
      console.error('[ExPOS API]', action, err.message);
      throw err;
    }
  }

  return { call };
})();
