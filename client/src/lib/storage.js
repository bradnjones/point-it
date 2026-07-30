/**
 * Persists just enough to rehydrate the current session after a refresh: the
 * session code, this browser's participant id, display name, and (only if the
 * facilitator) the facilitator token.
 */
const KEY = 'point-it:membership';

export function saveMembership(membership) {
  localStorage.setItem(KEY, JSON.stringify(membership));
}

export function loadMembership() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function clearMembership() {
  localStorage.removeItem(KEY);
}
