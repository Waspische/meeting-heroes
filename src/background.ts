// Chrome Extension Service Worker (background.ts)
import { SheetsHelper } from './utils/SheetsHelper';

const STORAGE_KEYS = {
  ACTIVE_MEETING: 'opti_active_meeting',
  HOSTED_MEETINGS: 'opti_hosted_meetings',
  READ_REVIEWS_COUNTS: 'opti_read_reviews_counts',
};

// Met à jour l'icône et le badge avec priorité absolue à la réunion active (zéro superposition)
const refreshBadgeStatus = async () => {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.ACTIVE_MEETING,
      STORAGE_KEYS.HOSTED_MEETINGS,
      STORAGE_KEYS.READ_REVIEWS_COUNTS,
    ]);

    const activeMeeting = data[STORAGE_KEYS.ACTIVE_MEETING] as { id?: string } | undefined;

    // RÈGLE ANTI-SUPERPOSITION : Si une réunion est en direct, icône active ONLY, AUCUN badge texte.
    if (activeMeeting && activeMeeting.id) {
      chrome.action.setIcon({
        path: {
          16: 'icon-active16.png',
          48: 'icon-active48.png',
          128: 'icon-active128.png',
        },
      });
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    // Hors réunion : icône normale
    chrome.action.setIcon({
      path: {
        16: 'icon16.png',
        48: 'icon48.png',
        128: 'icon128.png',
      },
    });

    // Vérification des avis non lus pour l'organisateur
    const hosted = (data[STORAGE_KEYS.HOSTED_MEETINGS] || []) as Array<{ meetingHash: string }>;
    const readCounts = (data[STORAGE_KEYS.READ_REVIEWS_COUNTS] || {}) as Record<string, number>;

    if (!hosted || hosted.length === 0) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const hashes = hosted.map((h) => h.meetingHash);
    const remoteData = await SheetsHelper.fetchEvaluationsByHashes(hashes);
    const countsByHash: Record<string, number> = {};
    for (const item of remoteData) {
      countsByHash[item.meetingHash] = (countsByHash[item.meetingHash] || 0) + 1;
    }

    let unreadCount = 0;
    for (const h of hosted) {
      const remoteTotal = countsByHash[h.meetingHash] || 0;
      const readTotal = readCounts[h.meetingHash] || 0;
      unreadCount += Math.max(0, remoteTotal - readTotal);
    }

    if (unreadCount > 0) {
      chrome.action.setBadgeText({ text: unreadCount > 99 ? '99+' : String(unreadCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Gold Meeting Heroes
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('Erreur refreshBadgeStatus:', err);
  }
};

// Initial sync
refreshBadgeStatus();

// Sync sur changement de stockage
chrome.storage.onChanged.addListener((changes) => {
  if (
    changes[STORAGE_KEYS.ACTIVE_MEETING] ||
    changes[STORAGE_KEYS.HOSTED_MEETINGS] ||
    changes[STORAGE_KEYS.READ_REVIEWS_COUNTS]
  ) {
    refreshBadgeStatus();
  }
});

// Alarme périodique (toutes les 10 minutes) pour relever les avis
chrome.alarms.create('check_new_reviews', { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check_new_reviews') {
    refreshBadgeStatus();
  }
});

// Nettoie l'état actif quand tous les onglets Google Meet sont fermés
chrome.tabs.onRemoved.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: '*://meet.google.com/*' });
    if (!tabs || tabs.length === 0) {
      await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_MEETING);
    }
  } catch {}
});

const ALLOWED_APPS_SCRIPT_PREFIX = 'https://script.google.com/a/macros/adeo.com/s/';

// Listener for messages: Google Sheets fetches & open dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reject messages from unauthorized senders
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'UNAUTHORIZED_SENDER' });
    return;
  }

  if (message && message.action === 'refresh_badge') {
    refreshBadgeStatus();
    return;
  }
  if (message && message.action === 'open_dashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }).catch(() => {});
    return;
  }

  if (message && message.type === 'FETCH_SHEETS') {
    const { method, url, body } = message;

    if (typeof url !== 'string' || !url.startsWith(ALLOWED_APPS_SCRIPT_PREFIX)) {
      sendResponse({ success: false, error: 'FORBIDDEN_DESTINATION_URL' });
      return;
    }

    const options: RequestInit = { method: method === 'POST' ? 'POST' : 'GET' };
    if (options.method === 'POST') {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers = { 'Content-Type': 'text/plain' };
    }
    fetch(url, options)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.toString() }));
    return true; // Keep message channel open for async response
  }
});

// ─── Auto-injection dans les onglets existants à l'installation / mise à jour ──

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    // 0. Ouvre la page d'accueil avec le manifeste de bienveillance (uniquement à la 1re installation)
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
    }

    // 1. Onglets Google Meet déjà ouverts
    const meetTabs = await chrome.tabs.query({ url: '*://meet.google.com/*' });
    for (const tab of meetTabs) {
      if (tab.id) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css'],
        }).catch(() => {});

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Erreur injection dynamique dans les onglets existants:', err);
  }
});
