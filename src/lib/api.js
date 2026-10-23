// Cliente del backend en Cloudflare Pages Functions (/functions/api).

const call = async (method, path, body) => {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
};

export const api = {
  // Sin backend (por ejemplo `npm run dev` solo) la herramienta funciona como "sin cuenta".
  me: () => call('GET', '/me').catch(() => ({ user: null })),
  login: () => { window.location.href = `/api/auth/login?return=${encodeURIComponent(window.location.pathname)}`; },
  logout: () => call('POST', '/auth/logout'),
  saveCurrent: text => call('PUT', '/current', { text }),
  addDraft: draft => call('POST', '/drafts', draft),
  deleteDraft: id => call('DELETE', `/drafts/${encodeURIComponent(id)}`),
  addTagSet: set => call('POST', '/tagsets', set),
  deleteTagSet: id => call('DELETE', `/tagsets/${encodeURIComponent(id)}`),
  deleteAccount: () => call('DELETE', '/account'),
};

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
