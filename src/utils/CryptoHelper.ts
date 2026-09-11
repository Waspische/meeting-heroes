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
    try {
      const res = await chrome.storage.local.get('optimeeting_voter_salt');
      if (res && res.optimeeting_voter_salt) {
        salt = String(res.optimeeting_voter_salt);
      } else {
        salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0')).join('');
        await chrome.storage.local.set({ optimeeting_voter_salt: salt });
      }
    } catch {}
  }

  if (!salt) {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('optimeeting_voter_salt') : null;
      if (local) {
        salt = local;
      } else {
        salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0')).join('');
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('optimeeting_voter_salt', salt);
        }
      }
    } catch {
      salt = 'standalone-salt';
    }
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

export const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/adeo.com/s/AKfycbwDpEnI1J8Oya9c1cOCsiYM3bdWRaPMJ29Pm_hcarZ2QmjrFqb591uEgbAoazb_hrWW/exec';

/**
 * Builds the secure a posteriori vote URL for Google Apps Script WebApp.
 */
export async function getVoteLink(rawMeetingId: string, startTime?: number, title?: string): Promise<string> {
  const occurrence = getOccurrenceId(rawMeetingId, startTime);
  const meetingHash = await hashMeetingId(occurrence);
  const signature = (await hashMeetingId(`vote_${meetingHash}`)).slice(0, 16);
  const titleParam = title ? `&t=${encodeURIComponent(title)}` : '';
  return `${APPS_SCRIPT_URL}?m=${meetingHash}&key=${signature}${titleParam}`;
}


