// ============================================================
// ExPOS — api.js
// GitHub Pages → GAS Bridge (GET-only, no CORS preflight)
// ============================================================

const API = (() => {
  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbxzhmzdRjKESMtNuUvt9lgYYZ_pT6WobGVnjBQ_dWxfUjyop-lMOimCE5nNPF-VDDLO/exec';
  const AUTH_TOKEN = '90170e57-8858-450d-9282-a489808e1f86';

  async function call(action, payload = {}) {
  const fullPayload = { ...payload, _token: AUTH_TOKEN };

  const resp = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({
      action,
      payload: fullPayload
    }),
    headers: {
      "Content-Type": "text/plain"
    }
  });

  if (!resp.ok) throw new Error('Network error: ' + resp.status);

  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'GAS error');

  return data.data;
}

  return { call };
})();
