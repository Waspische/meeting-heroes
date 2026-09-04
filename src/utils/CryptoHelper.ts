/**
 * CryptoHelper — Deterministic SHA-256 hashing using the browser's native SubtleCrypto API.
 * Ensures meeting IDs are strictly one-way hashed before leaving the machine.
 */

export async function hashMeetingId(rawId: string): Promise<string> {
  const normalized = (rawId || '').trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates an anonymous, untraceable single-vote token:
 * SHA-256(localClientSalt + meetingHash).
 * Enables the backend to enforce 1 vote per user per meeting occurrence without learning identity.
 */
export async function getAnonymousVoterToken(meetingHash: string): Promise<string> {
  let salt = '';
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const res = await chrome.storage.local.get('optimeeting_voter_salt');
    if (res && res.optimeeting_voter_salt) {
      salt = String(res.optimeeting_voter_salt);
    } else {
      salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      await chrome.storage.local.set({ optimeeting_voter_salt: salt });
    }
  } else {
    salt = 'standalone-salt';
  }
  return hashMeetingId(`${salt}_${meetingHash}`);
}

/**
 * Generates a unique occurrence ID associating the Meet room to the UTC session date (YYYY-MM-DD).
 * UTC ensures all participants across different time zones share the exact same occurrence ID and hash.
 */
export function getOccurrenceId(rawId: string, startTime?: number): string {
  const d = new Date(startTime || Date.now());
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${rawId}_${year}-${month}-${day}`;
}

/**
 * Extracts Google Meet room ID from URL path (e.g. /abc-defg-hij).
 */
export function parseMeetingId(pathname: string): string {
  const match = (pathname || '').match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\/|\?|$)/i);
  return match ? match[1].toLowerCase() : '';
}

