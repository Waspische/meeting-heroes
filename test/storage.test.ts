import { describe, it, expect, beforeEach } from 'vitest';
import { StorageHelper } from '../src/utils/StorageHelper';
import type { ActiveMeetingState, HostedMeeting, Meeting } from '../src/utils/StorageHelper';

describe('Integration Test: StorageHelper & State Persistence', () => {
  beforeEach(async () => {
    await (globalThis as any).chrome.storage.local.clear();
  });

  it('correctly persists and retrieves active meeting state', async () => {
    const active: ActiveMeetingState = {
      id: 'meet-123',
      title: 'Comité Architecture ADEO',
      startTime: 1700000000000,
      participantCount: 5,
      isHost: true,
      pollStatus: 'idle',
    };

    await StorageHelper.saveActiveMeeting(active);
    const retrieved = await StorageHelper.getActiveMeeting();

    expect(retrieved).toEqual(active);
  });

  it('updates pollStatus to submitted and preserves state', async () => {
    const active: ActiveMeetingState = {
      id: 'meet-123',
      title: 'Comité Architecture ADEO',
      startTime: 1700000000000,
      participantCount: 5,
      isHost: false,
      pollStatus: 'idle',
    };

    await StorageHelper.saveActiveMeeting(active);
    const updated = { ...active, pollStatus: 'submitted' as const };
    await StorageHelper.saveActiveMeeting(updated);

    const check = await StorageHelper.getActiveMeeting();
    expect(check?.pollStatus).toBe('submitted');
  });

  it('deduplicates hosted meetings by meetingHash', async () => {
    const m1: HostedMeeting = {
      meetingHash: 'hash-abc',
      title: 'Daily Standup',
      date: 1700000000000,
    };
    const m2: HostedMeeting = {
      meetingHash: 'hash-abc',
      title: 'Daily Standup Renamed',
      date: 1700000000000,
    };

    await StorageHelper.addHostedMeeting(m1);
    await StorageHelper.addHostedMeeting(m2);

    const hosted = await StorageHelper.getHostedMeetings();
    expect(hosted.length).toBe(1);
    expect(hosted[0].meetingHash).toBe('hash-abc');
  });

  it('saves completed meetings to evaluation history', async () => {
    const meeting: Meeting = {
      id: 'meet-abc',
      title: 'Review Sprint',
      startTime: 1700000000000,
      endTime: 1700001800000,
      participantCount: 6,
      isOrganizer: false,
      rating: 5,
      comment: 'Top !',
    };

    await StorageHelper.addMeeting(meeting);
    const meetings = await StorageHelper.getMeetings();

    expect(meetings.length).toBe(1);
    expect(meetings[0].rating).toBe(5);
    expect(meetings[0].comment).toBe('Top !');
  });

  it('tracks submitted occurrences persistently to avoid re-evaluations', async () => {
    const occId = 'abc-defg-hij_2026-09-03';
    expect(await StorageHelper.isOccurrenceSubmitted(occId)).toBe(false);

    await StorageHelper.markOccurrenceSubmitted(occId);
    expect(await StorageHelper.isOccurrenceSubmitted(occId)).toBe(true);
    expect(await StorageHelper.isOccurrenceSubmitted('other-occurrence')).toBe(false);
  });

  it('silences exit poll for the rest of the day', async () => {
    expect(await StorageHelper.isExitPollSilenced()).toBe(false);
    await StorageHelper.silenceExitPollForToday();
    expect(await StorageHelper.isExitPollSilenced()).toBe(true);
    await StorageHelper.unsilenceExitPoll();
    expect(await StorageHelper.isExitPollSilenced()).toBe(false);
  });

  it('saves and retrieves last finished meeting', async () => {
    expect(await StorageHelper.getLastFinishedMeeting()).toBeNull();
    const meeting = {
      id: 'abc-defg-hij',
      title: 'Standup Tech',
      startTime: 1000,
      participantCount: 4,
      isHost: false,
      endedAt: 2000,
    };
    await StorageHelper.saveLastFinishedMeeting(meeting);
    expect(await StorageHelper.getLastFinishedMeeting()).toEqual(meeting);
    await StorageHelper.saveLastFinishedMeeting(null);
    expect(await StorageHelper.getLastFinishedMeeting()).toBeNull();
  });
});
