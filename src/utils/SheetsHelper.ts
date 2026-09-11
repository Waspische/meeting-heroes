/**
 * SheetsHelper — Sends and fetches anonymous evaluation data via Google Apps Script.
 * 100% POST based, 0 PII: uses SHA-256 meeting hashes.
 */

import { getAnonymousVoterToken } from './CryptoHelper';

export const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/adeo.com/s/AKfycbwDpEnI1J8Oya9c1cOCsiYM3bdWRaPMJ29Pm_hcarZ2QmjrFqb591uEgbAoazb_hrWW/exec';

export interface AnonymousEvaluation {
  action?: 'submit_evaluation';
  meetingHash: string;
  voterToken?: string;
  participant_count: number;
  rating: number;
  comment: string;
  duration_feedback: string;
  recurrence_feedback: string;
  agenda_feedback: string;
  efficiency_feedback: string;
  format_feedback: string;
}

export interface RemoteEvaluation {
  timestamp: string;
  meetingHash: string;
  rating: number;
  comment: string;
  duration_feedback: string;
  recurrence_feedback: string;
  agenda_feedback: string;
  efficiency_feedback: string;
  format_feedback: string;
}

const isConfigured = () => !!APPS_SCRIPT_URL;

declare const google: any;

const executeRequest = async (url: string, bodyObj: any): Promise<any> => {
  // 1. Contexte Google Apps Script WebApp (iframe native)
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((response: any) => {
          resolve(response);
        })
        .withFailureHandler((err: any) => {
          reject(new Error(err?.message || String(err)));
        })
        .submitEvaluationWeb(bodyObj);
    });
  }

  const jsonString = JSON.stringify(bodyObj);

  // 2. Contexte Extension Chrome (popup ou content script sur Google Meet)
  const isExtensionContext =
    typeof window !== 'undefined' &&
    typeof chrome !== 'undefined' &&
    !!chrome.runtime?.id &&
    (window.location.protocol === 'chrome-extension:' || window.location.hostname === 'meet.google.com');

  if (isExtensionContext && chrome.runtime.sendMessage) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_SHEETS',
            method: 'POST',
            url,
            body: jsonString,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'Unknown background fetch error'));
            }
          }
        );
      });
    } catch (bgErr) {
      console.warn('Meeting Heroes: Background fetch failed, attempting direct fetch:', bgErr);
    }
  }

  // 3. Contexte web standard, tests ou fallback popup : fetch direct
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: jsonString,
    credentials: 'include',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
};

export const SheetsHelper = {
  /**
   * Sends an anonymous evaluation payload to Google Sheets (POST).
   */
  async sendAnonymousEvaluation(payload: AnonymousEvaluation): Promise<boolean> {
    if (!isConfigured()) {
      console.warn('Meeting Heroes: Google Sheets URL not configured. Skipping remote save.');
      return false;
    }
    try {
      const token = await getAnonymousVoterToken(payload.meetingHash);
      const res = await executeRequest(APPS_SCRIPT_URL, {
        ...payload,
        action: 'submit_evaluation',
        voterToken: token,
      });
      if (res && res.status === 'already_submitted') {
        console.warn('Meeting Heroes: Server security notice:', res.error);
        return false;
      }
      if (res && res.status === 'success') {
        console.log('Meeting Heroes: Anonymous evaluation sent to Google Sheets ✓');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Meeting Heroes: Failed to send evaluation:', err);
      return false;
    }
  },

  /**
   * Fetches all evaluations matching the given SHA-256 meeting hashes (POST).
   */
  async fetchEvaluationsByHashes(hashes: string[]): Promise<RemoteEvaluation[]> {
    if (!isConfigured() || !hashes || hashes.length === 0) return [];
    try {
      const data = await executeRequest(APPS_SCRIPT_URL, {
        action: 'fetch_evaluations',
        meetingHashes: hashes,
      });
      if (Array.isArray(data)) return data as RemoteEvaluation[];
      return [];
    } catch (err) {
      console.error('Meeting Heroes: Failed to fetch evaluations:', err);
      return [];
    }
  },

  /**
   * Fetches all evaluations submitted by the current user (via WebApp or Extension).
   */
  async fetchMyEvaluations(voterTokens: string[] = []): Promise<any[]> {
    if (!isConfigured()) return [];
    try {
      const data = await executeRequest(APPS_SCRIPT_URL, {
        action: 'fetch_my_evaluations',
        voterTokens,
      });
      if (Array.isArray(data)) return data;
      return [];
    } catch (err) {
      console.error('Meeting Heroes: Failed to fetch my evaluations:', err);
      return [];
    }
  },
};
