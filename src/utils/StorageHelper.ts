export interface MeetingDetails {
  durationOk?: boolean;
  recurrenceNeeded?: boolean;
  agendaRespected?: boolean;
  efficiencyProductive?: boolean;
  preferredAlternative?: string;
  durationVal?: string;
  recurrenceVal?: string;
  agendaVal?: string;
  efficiencyVal?: string;
  formatVal?: string;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  participantCount: number;
  isOrganizer: boolean;
  rating?: number; // 1-5
  comment?: string;
  details?: MeetingDetails;
  meetingHash?: string;
}

export interface ActiveMeetingState {
  id: string;
  title: string;
  startTime: number;
  participantCount: number;
  isHost: boolean;
  pollStatus: 'idle' | 'active' | 'submitted';
}

export interface HostedMeeting {
  meetingHash: string;
  title: string;
  date: number;
}

export interface FinishedMeetingState {
  id: string;
  title: string;
  startTime: number;
  participantCount: number;
  isHost: boolean;
  endedAt: number;
}

const STORAGE_KEYS = {
  MEETINGS: 'opti_meetings',
  HOSTED_MEETINGS: 'opti_hosted_meetings',
  ACTIVE_MEETING: 'opti_active_meeting',
  SUBMITTED_OCCURRENCES: 'opti_submitted_occurrences',
  READ_REVIEWS_COUNTS: 'opti_read_reviews_counts',
  EXIT_POLL_SILENCED_UNTIL: 'opti_exit_poll_silenced_until',
  LAST_FINISHED_MEETING: 'opti_last_finished_meeting',
};

const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && chrome.storage?.local !== undefined;

const getStorage = async <T>(key: string, defaultVal: T): Promise<T> => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([key], (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve(defaultVal);
          } else {
            resolve(res[key] !== undefined ? (res[key] as T) : defaultVal);
          }
        });
      } catch {
        resolve(defaultVal);
      }
    });
  }
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const setStorage = async <T>(key: string, val: T): Promise<void> => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: val }, () => resolve());
      } catch {
        resolve();
      }
    });
  }
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('opti_storage_changed'));
  } catch {}
};

const removeStorage = async (key: string): Promise<void> => {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove([key], () => resolve());
      } catch {
        resolve();
      }
    });
  }
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('opti_storage_changed'));
  } catch {}
};

export const StorageHelper = {
  getMeetings: (): Promise<Meeting[]> => getStorage(STORAGE_KEYS.MEETINGS, []),
  saveMeetings: (meetings: Meeting[]): Promise<void> => setStorage(STORAGE_KEYS.MEETINGS, meetings),

  async addMeeting(meeting: Meeting): Promise<void> {
    const list = (await this.getMeetings()).filter((m) => m.id !== meeting.id);
    list.push(meeting);
    await this.saveMeetings(list);
  },

  getHostedMeetings: (): Promise<HostedMeeting[]> => getStorage(STORAGE_KEYS.HOSTED_MEETINGS, []),

  async addHostedMeeting(meeting: HostedMeeting): Promise<void> {
    const list = (await this.getHostedMeetings()).filter((m) => m.meetingHash !== meeting.meetingHash);
    list.unshift(meeting);
    await setStorage(STORAGE_KEYS.HOSTED_MEETINGS, list);
  },

  getActiveMeeting: (): Promise<ActiveMeetingState | null> => getStorage(STORAGE_KEYS.ACTIVE_MEETING, null),

  saveActiveMeeting: (state: ActiveMeetingState | null): Promise<void> =>
    state === null ? removeStorage(STORAGE_KEYS.ACTIVE_MEETING) : setStorage(STORAGE_KEYS.ACTIVE_MEETING, state),

  getSubmittedOccurrences: (): Promise<Record<string, boolean>> =>
    getStorage(STORAGE_KEYS.SUBMITTED_OCCURRENCES, {}),

  async markOccurrenceSubmitted(occurrenceId: string): Promise<void> {
    const map = await this.getSubmittedOccurrences();
    map[occurrenceId] = true;
    await setStorage(STORAGE_KEYS.SUBMITTED_OCCURRENCES, map);
  },

  async isOccurrenceSubmitted(occurrenceId: string): Promise<boolean> {
    const map = await this.getSubmittedOccurrences();
    return Boolean(map[occurrenceId]);
  },

  getReadReviewsCounts: (): Promise<Record<string, number>> =>
    getStorage(STORAGE_KEYS.READ_REVIEWS_COUNTS, {}),

  async markReviewsAsRead(counts: Record<string, number>): Promise<void> {
    const current = await this.getReadReviewsCounts();
    const updated = { ...current, ...counts };
    await setStorage(STORAGE_KEYS.READ_REVIEWS_COUNTS, updated);
  },

  async isExitPollSilenced(): Promise<boolean> {
    const until = await getStorage<number>(STORAGE_KEYS.EXIT_POLL_SILENCED_UNTIL, 0);
    return Date.now() < until;
  },

  async silenceExitPollForToday(): Promise<void> {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    await setStorage(STORAGE_KEYS.EXIT_POLL_SILENCED_UNTIL, endOfDay.getTime());
  },

  async unsilenceExitPoll(): Promise<void> {
    await removeStorage(STORAGE_KEYS.EXIT_POLL_SILENCED_UNTIL);
  },

  getLastFinishedMeeting: (): Promise<FinishedMeetingState | null> =>
    getStorage<FinishedMeetingState | null>(STORAGE_KEYS.LAST_FINISHED_MEETING, null),

  saveLastFinishedMeeting: (m: FinishedMeetingState | null): Promise<void> =>
    m === null
      ? removeStorage(STORAGE_KEYS.LAST_FINISHED_MEETING)
      : setStorage(STORAGE_KEYS.LAST_FINISHED_MEETING, m),

  subscribeToChanges(callback: () => void): () => void {
    if (hasChromeStorage()) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes[STORAGE_KEYS.MEETINGS] || changes[STORAGE_KEYS.HOSTED_MEETINGS] || changes[STORAGE_KEYS.ACTIVE_MEETING]) {
          callback();
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    const listener = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('opti_')) callback();
    };
    window.addEventListener('storage', listener);
    window.addEventListener('opti_storage_changed', callback);
    return () => {
      window.removeEventListener('storage', listener);
      window.removeEventListener('opti_storage_changed', callback);
    };
  },

  triggerLocalStorageChangeNotification() {
    if (!hasChromeStorage()) {
      window.dispatchEvent(new Event('opti_storage_changed'));
    }
  },

  async clearAll(): Promise<void> {
    if (hasChromeStorage()) {
      await new Promise<void>((resolve) => {
        try {
          chrome.storage.local.clear(() => resolve());
        } catch {
          resolve();
        }
      });
    }
    try {
      localStorage.clear();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('opti_storage_changed'));
    } catch {}
  },
};
