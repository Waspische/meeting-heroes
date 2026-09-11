import { describe, it, expect } from 'vitest';
import { hashMeetingId, getOccurrenceId } from '../src/utils/CryptoHelper';

describe('Integration Test: Crypto Hashing & UTC Timezone Consistency', () => {
  it('generates a 64-character SHA-256 hex hash from a meeting occurrence', async () => {
    const hash = await hashMeetingId('abc-defg-hij_2026-09-03');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic check
    const hash2 = await hashMeetingId('abc-defg-hij_2026-09-03');
    expect(hash).toBe(hash2);
  });

  it('guarantees identical occurrenceId and hash across timezones using UTC', async () => {
    // A meeting taking place on 2026-09-03 at 16:00 UTC
    const meetingTimestamp = Date.UTC(2026, 8, 3, 16, 0, 0); // 16h UTC (which is 01:00 AM on 04/09 in Tokyo UTC+9)

    const occurrence = getOccurrenceId('adeo-sync-room', meetingTimestamp);
    expect(occurrence).toBe('adeo-sync-room_2026-09-03');

    const hash = await hashMeetingId(occurrence);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('generates different hashes for different daily occurrences of recurring meetings', async () => {
    const day1 = getOccurrenceId('daily-standup', Date.UTC(2026, 8, 3, 9, 0, 0));
    const day2 = getOccurrenceId('daily-standup', Date.UTC(2026, 8, 4, 9, 0, 0));

    expect(day1).toBe('daily-standup_2026-09-03');
    expect(day2).toBe('daily-standup_2026-09-04');

    const hashDay1 = await hashMeetingId(day1);
    const hashDay2 = await hashMeetingId(day2);

    expect(hashDay1).not.toBe(hashDay2);
  });

  it('generates a secure, non-guessable a posteriori vote link with signature', async () => {
    const { getVoteLink } = await import('../src/utils/CryptoHelper');
    const link = await getVoteLink('abc-defg-hij', Date.UTC(2026, 8, 10, 14, 0, 0));
    expect(link).toContain('https://script.google.com/a/macros/adeo.com/s/');
    expect(link).toContain('?m=');
    expect(link).toContain('&key=');

    const url = new URL(link);
    const m = url.searchParams.get('m');
    const key = url.searchParams.get('key');
    expect(m).toHaveLength(64);
    expect(key).toHaveLength(16);

    // Verify key signature is reproducible
    const expectedKey = (await hashMeetingId(`vote_${m}`)).slice(0, 16);
    expect(key).toBe(expectedKey);

    // Verify title param encoding
    const linkWithTitle = await getVoteLink('abc-defg-hij', Date.UTC(2026, 8, 10, 14, 0, 0), 'Sync Hebdo ADEO ⚡');
    expect(linkWithTitle).toContain('&t=Sync%20Hebdo%20ADEO%20%E2%9A%A1');
  });
});

