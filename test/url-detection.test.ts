import { describe, it, expect } from 'vitest';
import { parseMeetingId } from '../src/utils/CryptoHelper';

describe('Integration Test: Google Meet URL Pattern Parsing', () => {
  it('correctly extracts meeting room code from standard URL', () => {
    expect(parseMeetingId('/abc-defg-hij')).toBe('abc-defg-hij');
  });

  it('tolerates trailing slash at end of URL', () => {
    expect(parseMeetingId('/abc-defg-hij/')).toBe('abc-defg-hij');
  });

  it('tolerates query parameters such as authuser or hs', () => {
    expect(parseMeetingId('/abc-defg-hij?authuser=1')).toBe('abc-defg-hij');
    expect(parseMeetingId('/abc-defg-hij/?authuser=2&hs=179')).toBe('abc-defg-hij');
  });

  it('rejects landing, lookup, and non-room paths', () => {
    expect(parseMeetingId('/')).toBe('');
    expect(parseMeetingId('/landing')).toBe('');
    expect(parseMeetingId('/lookup/something')).toBe('');
    expect(parseMeetingId('/not-a-code')).toBe('');
  });
});
