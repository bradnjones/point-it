/** Thin wrapper over the session REST API. Throws Error(message) on failure. */

async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export function createSession({ name, displayName, mode }) {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name, displayName, mode }),
  });
}

export function joinSession({ code, displayName }) {
  return request(`/api/sessions/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function getSession(code) {
  return request(`/api/sessions/${encodeURIComponent(code)}`);
}
