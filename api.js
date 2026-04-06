// ============================================================
// ExPOS — api.js
// GitHub Pages → GAS Bridge (GET-only, no CORS preflight)
// ============================================================

const API = (() => {
  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbxzhmzdRjKESMtNuUvt9lgYYZ_pT6WobGVnjBQ_dWxfUjyop-lMOimCE5nNPF-VDDLO/exec';
  const AUTH_TOKEN = '90170e57-8858-450d-9282-a489808e1f86';

  async function call(action, payload = {}) {
    const fullPayload = { ...payload, _token: AUTH_TOKEN };

    // Use GET + URL params — avoids CORS preflight entirely
    // GAS handles GET natively with no OPTIONS request needed
    const url = GAS_URL
      + '?action=' + encodeURIComponent(action)
      + '&payload=' + encodeURIComponent(JSON.stringify(fullPayload));

    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!resp.ok) throw new Error('Network error: ' + resp.status);

    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'GAS error');
    return data.data;
  }

  return { call };
})();
