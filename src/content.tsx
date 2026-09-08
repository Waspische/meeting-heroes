import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RatingForm } from './components/RatingForm';
import { StorageHelper } from './utils/StorageHelper';
import { SheetsHelper } from './utils/SheetsHelper';
import { hashMeetingId, getOccurrenceId, parseMeetingId } from './utils/CryptoHelper';
import type { ActiveMeetingState, Meeting } from './utils/StorageHelper';
import { t } from './i18n';

// ─── Config ───────────────────────────────────────────────────────────────────

const EXTENSION_SHARE_URL = 'https://chromewebstore.google.com/detail/ofbfcnphgmibhdleifkegljmlgpmdlgp';
const SHARE_TEXT = t.shareMessage(EXTENSION_SHARE_URL);

// ─── Local State Variables ───────────────────────────────────────────────────

let meetingId = '';
let meetingStartTime = 0;
let isHostUser = false;
let exitPollDismissed = false;

// Parse Meeting ID from URL — live room pattern: /abc-defg-hij
const updateMeetingId = () => {
  meetingId = parseMeetingId(window.location.pathname);
};

// Scrape meeting metadata
const scrapeMeetMetrics = () => {
  let title = 'Réunion Google Meet';

  // 1. Priorité à document.title (API native navigateur, stable et jamais minifiée)
  if (document.title) {
    const cleaned = document.title
      .replace(/^Meet\s*[-–—:]\s*/i, '')
      .replace(/\s*[-–—:]\s*Google Meet$/i, '')
      .replace(/\s*[-–—:]\s*Meet$/i, '')
      .trim();
    if (cleaned && !cleaned.toLowerCase().includes('google meet')) {
      title = cleaned;
    }
  }

  // 2. Attribut data standard ou balise de titre sémantique
  if (title === 'Réunion Google Meet') {
    const titleEl = document.querySelector('[data-meeting-title], [role="heading"]');
    if (titleEl && titleEl.textContent?.trim()) {
      title = titleEl.textContent.trim();
    }
  }

  // Seule une réunion sans titre réel hérite de la date/heure pour la distinguer
  if (meetingStartTime && (title === 'Réunion Google Meet' || title === 'Google Meet')) {
    const d = new Date(meetingStartTime);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    title = `${title} (${dateStr} ${timeStr})`;
  }

  // Décompte participants sans classe minifiée
  let participants = 1;
  const allButtons = document.querySelectorAll('button');
  for (let i = 0; i < allButtons.length; i++) {
    const b = allButtons[i];
    const text = b.textContent || '';
    const label = (b.getAttribute('aria-label') || '').toLowerCase();
    const hasPeopleIcon = text.includes('people') || text.includes('group') || text.includes('person');
    const hasParticipantWord = label.includes('participant') || label.includes('personne') || label.includes('people');
    if (hasPeopleIcon || hasParticipantWord) {
      const match = (label + ' ' + text).match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > 0) {
          participants = num;
          break;
        }
      }
    }
  }

  if (participants === 1) {
    const attrEl = document.querySelector('[data-participant-count]');
    if (attrEl) {
      const val = parseInt(attrEl.getAttribute('data-participant-count') || '', 10);
      if (!isNaN(val) && val > 0) participants = val;
    }
  }

  if (participants === 1) {
    const gridItems = document.querySelectorAll('[data-requested-participant-id], [data-participant-id], [data-allocation-index]');
    if (gridItems.length > 0) participants = gridItems.length;
  }

  // Détection animateur/hôte via icône bouclier/sécurité standard Google ou aria-label
  let isHost = false;
  for (let i = 0; i < allButtons.length; i++) {
    const b = allButtons[i];
    const text = b.textContent || '';
    const label = (b.getAttribute('aria-label') || '').toLowerCase();
    if (
      text.includes('admin_panel_settings') ||
      text.includes('security') ||
      text.includes('shield') ||
      label.includes('organisat') ||
      label.includes('host control') ||
      label.includes('anfitrión') ||
      label.includes('moderator')
    ) {
      isHost = true;
      break;
    }
  }
  isHostUser = isHost;

  return { title, participants, isHost: isHostUser };
};

// State for the specific tab/room
const getTabMeetingState = (pollStatus: 'idle' | 'active' | 'submitted' = 'idle'): ActiveMeetingState => {
  const metrics = scrapeMeetMetrics();
  return {
    id: meetingId,
    title: metrics.title,
    startTime: meetingStartTime || Date.now(),
    participantCount: metrics.participants,
    isHost: metrics.isHost,
    pollStatus,
  };
};

// Sync meeting details to storage
const syncMeetingState = async () => {
  if (!meetingId) return;

  const metrics = scrapeMeetMetrics();
  const startTime = meetingStartTime || Date.now();
  const occurrenceId = getOccurrenceId(meetingId, startTime);
  const isSubmittedForThisMeeting = await StorageHelper.isOccurrenceSubmitted(occurrenceId);

  const state: ActiveMeetingState = {
    id: meetingId,
    title: metrics.title,
    startTime,
    participantCount: metrics.participants,
    isHost: metrics.isHost,
    pollStatus: isSubmittedForThisMeeting ? 'submitted' : 'idle',
  };

  await StorageHelper.saveActiveMeeting(state);

  // Mémorise aussi comme dernière réunion pour la page d'atterrissage /exit
  await StorageHelper.saveLastFinishedMeeting({
    id: meetingId,
    title: metrics.title,
    startTime,
    participantCount: metrics.participants,
    isHost: metrics.isHost,
    endedAt: Date.now(),
  });

  if (metrics.isHost && meetingId) {
    const meetingHash = await hashMeetingId(occurrenceId);
    await StorageHelper.addHostedMeeting({
      meetingHash,
      title: metrics.title,
      date: startTime,
    });
  }
};

// ─── Clipboard/Chat Toast ─────────────────────────────────────────────────────

const showCopyToast = (msg = 'Lien copié dans le presse-papier !') => {
  const existing = document.getElementById('opti-copy-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'opti-copy-toast';
  toast.className = 'opti-copy-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span class="material-icons-outlined" style="font-size:16px;vertical-align:middle" aria-hidden="true">check_circle</span>&nbsp; ${msg}`;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// ─── Share Extension Logic (Transparent & Non-Invasive) ───────────────────────

// Action 1 : Copie propre dans le presse-papier sans effet de bord
const copyShareInvite = async () => {
  try {
    await navigator.clipboard.writeText(SHARE_TEXT);
  } catch {
    const el = document.createElement('textarea');
    el.value = SHARE_TEXT;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  showCopyToast(t.shareCopiedToast);
};

// Trouve le véritable champ de saisie du chat Google Meet (en excluant nos propres formulaires)
const findMeetChatInput = (): HTMLTextAreaElement | HTMLElement | null => {
  const allInputs = Array.from(
    document.querySelectorAll<HTMLTextAreaElement | HTMLElement>(
      'textarea[name="chatTextInput"], textarea[aria-label*="message" i], textarea[aria-label*="chat" i], ' +
      '[contenteditable="true"][aria-label*="message" i], [contenteditable="true"][aria-label*="chat" i], ' +
      '[contenteditable="true"][role="textbox"], textarea'
    )
  );
  // Exclut tout élément appartenant à notre extension (sidebar ou popups)
  const genuine = allInputs.filter(
    (el) => !el.closest('#opti-meet-sidebar-ctrl') && !el.closest('.opti-meet-exit-overlay') && !el.closest('.opti-meet-exit-card')
  );
  return genuine[0] || null;
};

// Trouve le bouton pour ouvrir le chat Google Meet
const findMeetChatButton = (): HTMLElement | null => {
  const allButtons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
  const genuine = allButtons.filter(
    (el) => !el.closest('#opti-meet-sidebar-ctrl') && !el.closest('.opti-meet-exit-overlay')
  );
  for (const b of genuine) {
    const text = (b.textContent || '').trim();
    const label = (b.getAttribute('aria-label') || '').toLowerCase();
    if (
      text.includes('chat') ||
      text.includes('chat_bubble') ||
      text.includes('forum') ||
      text.includes('speaker_notes') ||
      label.includes('chat') ||
      label.includes('discut') ||
      label.includes('message') ||
      label.includes('charla')
    ) {
      return b;
    }
  }
  return null;
};

// Action 2 : Prépare le message dans le chat Google Meet SANS l'envoyer automatiquement
const pasteIntoMeetChat = async () => {
  let chatInput = findMeetChatInput();

  if (!chatInput) {
    const chatBtn = findMeetChatButton();
    if (chatBtn) {
      chatBtn.click();
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 100));
        chatInput = findMeetChatInput();
        if (chatInput) break;
      }
    }
  }

  if (chatInput) {
    chatInput.focus();
    if (chatInput.tagName === 'TEXTAREA') {
      (chatInput as HTMLTextAreaElement).value = SHARE_TEXT;
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      document.execCommand('insertText', false, SHARE_TEXT);
      if (chatInput.textContent !== SHARE_TEXT) {
        chatInput.textContent = SHARE_TEXT;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    showCopyToast(t.shareChatReadyToast);
  } else {
    await copyShareInvite();
  }
};

// ─── Evaluation Submission Helper (DRY) ──────────────────────────────────────

interface EvaluationFormData {
  rating: number;
  comment: string;
  durationVal: string;
  recurrenceVal: string;
  agendaVal: string;
  efficiencyVal: string;
  formatVal: string;
}

const submitEvaluation = async (
  activeMeeting: ActiveMeetingState,
  data: EvaluationFormData
): Promise<void> => {
  const rawId = meetingId || activeMeeting.id;
  const occurrenceId = getOccurrenceId(rawId, activeMeeting.startTime || meetingStartTime || Date.now());
  const meetingHash = await hashMeetingId(occurrenceId);

  const newMeeting: Meeting = {
    id: activeMeeting.id,
    meetingHash,
    title: activeMeeting.title,
    startTime: activeMeeting.startTime,
    endTime: Date.now(),
    participantCount: activeMeeting.participantCount,
    isOrganizer: activeMeeting.isHost,
    rating: data.rating,
    comment: data.comment,
    details: {
      durationVal: data.durationVal,
      recurrenceVal: data.recurrenceVal,
      agendaVal: data.agendaVal,
      efficiencyVal: data.efficiencyVal,
      formatVal: data.formatVal,
      durationOk: data.durationVal ? data.durationVal === 'perfect' : undefined,
      recurrenceNeeded: data.recurrenceVal ? data.recurrenceVal === 'right_pace' : undefined,
      agendaRespected: data.agendaVal ? data.agendaVal === 'clear' : undefined,
      efficiencyProductive: data.efficiencyVal
        ? (data.efficiencyVal === 'productive' || data.efficiencyVal === 'actionable')
        : undefined,
      preferredAlternative: data.formatVal || 'none',
    },
  };

  await StorageHelper.addMeeting(newMeeting);
  document.getElementById('opti-meet-sidebar-ctrl')?.classList.add('submitted');

  const updated = { ...activeMeeting, pollStatus: 'submitted' as const };
  await StorageHelper.saveActiveMeeting(updated);

  // Send anonymously to Google Sheets (0 PII, hashed meeting ID, no title, no participant ID)
  await StorageHelper.markOccurrenceSubmitted(occurrenceId);
  await SheetsHelper.sendAnonymousEvaluation({
    meetingHash,
    participant_count: activeMeeting.participantCount,
    rating: data.rating,
    comment: data.comment,
    duration_feedback: data.durationVal,
    recurrence_feedback: data.recurrenceVal,
    agenda_feedback: data.agendaVal,
    efficiency_feedback: data.efficiencyVal,
    format_feedback: data.formatVal,
  });
};

// ─── Sidebar & Exit Overlay Containers (DRY Hook) ────────────────────────────

function useMeetingReview(onClose: () => void, targetMeeting?: ActiveMeetingState | null) {
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(targetMeeting || null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const check = async () => {
      let current = targetMeeting;
      if (!current) {
        if (meetingId) {
          const rawState = getTabMeetingState();
          const occurrenceId = getOccurrenceId(meetingId, rawState.startTime);
          const submitted = await StorageHelper.isOccurrenceSubmitted(occurrenceId);
          current = { ...rawState, pollStatus: submitted ? 'submitted' : 'idle' };
        } else {
          current = await StorageHelper.getActiveMeeting();
        }
      }
      setActiveMeeting(current);
      const rawId = current?.id || meetingId;
      if (rawId) {
        const occurrenceId = getOccurrenceId(rawId, current?.startTime || meetingStartTime || Date.now());
        const submitted = await StorageHelper.isOccurrenceSubmitted(occurrenceId);
        setIsSubmitted(submitted);
      } else {
        setIsSubmitted(false);
      }
    };
    check();
    return StorageHelper.subscribeToChanges(check);
  }, [targetMeeting]);

  const handleFormSubmit = async (data: EvaluationFormData) => {
    if (!activeMeeting) return;
    await submitEvaluation(activeMeeting, data);
    setIsSubmitted(true);
    setTimeout(onClose, 5000);
  };

  return { activeMeeting, isSubmitted, handleFormSubmit };
}

function SidebarContainer({ onClose }: { onClose: () => void }) {
  const { activeMeeting, isSubmitted, handleFormSubmit } = useMeetingReview(onClose);

  return (
    <div className="opti-meet-sidebar-content">
      <div className="opti-meet-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', lineHeight: 1, filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.6))' }}>⚡</span>
          <div className="opti-meet-header-brand">
            <span className="opti-meet-header-title">{t.brandName}</span>
            <span className="opti-meet-header-subtitle">{t.brandTagline}</span>
          </div>
        </div>
      </div>

      <div className="opti-meet-body">
        {activeMeeting && (
          <div className="opti-title-badge">
            <span className="opti-title-badge-title">{activeMeeting.title}</span>
            <span className="opti-title-badge-meta">
              <span className="material-icons-outlined" style={{ fontSize: '13px', verticalAlign: 'middle' }}>group</span>
              {t.guestsCount(activeMeeting.participantCount)}
            </span>
          </div>
        )}

        <RatingForm
          activeMeeting={activeMeeting}
          onSubmit={handleFormSubmit}
          isSubmitted={isSubmitted}
          onClose={onClose}
          onCopyInvite={copyShareInvite}
          onChatInvite={pasteIntoMeetChat}
        />
      </div>
    </div>
  );
}

function ExitOverlayContainer({ onClose, targetMeeting }: { onClose: () => void; targetMeeting?: ActiveMeetingState | null }) {
  const { activeMeeting, isSubmitted, handleFormSubmit } = useMeetingReview(onClose, targetMeeting);
  const [isInteracting, setIsInteracting] = useState(false);

  // Auto-dismiss: ferme le toast après 20s sans interaction
  useEffect(() => {
    if (isSubmitted || isInteracting) return;
    const timer = setTimeout(() => {
      onClose();
    }, 20000);
    return () => clearTimeout(timer);
  }, [isSubmitted, isInteracting, onClose]);

  const handleSilenceToday = async () => {
    await StorageHelper.silenceExitPollForToday();
    onClose();
  };

  return (
    <div
      className="opti-meet-exit-card"
      role="region"
      aria-label="Meeting Heroes - Bilan de fin de réunion"
      onMouseEnter={() => setIsInteracting(true)}
      onFocusCapture={() => setIsInteracting(true)}
      style={{ position: 'relative' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#5f6368',
          padding: '4px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
        aria-label={t.closeBtn}
      >
        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
      </button>

      {!isSubmitted && (
        <div style={{ textAlign: 'center', marginBottom: '14px', paddingRight: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: '#202124' }}>
            {t.exitModalTitle}
          </h2>
          <p style={{ fontSize: '12px', color: '#5f6368', margin: 0 }}>
            {t.exitModalSubtitle}
          </p>
        </div>
      )}
      <RatingForm
        activeMeeting={activeMeeting}
        onSubmit={handleFormSubmit}
        isSubmitted={isSubmitted}
        onClose={onClose}
        onCopyInvite={copyShareInvite}
        onChatInvite={pasteIntoMeetChat}
      />

      {!isSubmitted && (
        <button
          type="button"
          onClick={handleSilenceToday}
          className="opti-silence-today-btn"
        >
          {t.silenceToday}
        </button>
      )}
    </div>
  );
}

// ─── Injection Anchors ────────────────────────────────────────────────────────

// ─── Mode Dev & End-Call Detection ──────────────────────────────────────────

// Détection automatique du mode dev (extension chargée déballée, sans update_url Chrome Web Store)
const isDevMode = (): boolean => {
  const forced = localStorage.getItem('opti_dev_mode');
  if (forced !== null) return forced === 'true';
  try {
    return !chrome.runtime?.getManifest?.()?.update_url;
  } catch {
    return true;
  }
};

// ─── Résilience Invariants Google Meet (Multicouche, Indépendant de la Langue) ──

// Détecte le bouton raccrocher sans dépendre d'un seul sélecteur minifié
const isLeaveCallButton = (el: Element | null): boolean => {
  if (!el) return false;
  const btn = el.closest('button, [role="button"]');
  if (!btn) return false;

  // 1. Attributs directs ou jsname Google Meet
  if (btn.hasAttribute('data-call-ended') || btn.getAttribute('jsname') === 'CQylAd') {
    return true;
  }

  // 2. Icône Material Icons invariant Google ("call_end")
  const content = (btn.textContent || '').trim();
  if (content.includes('call_end')) {
    return true;
  }

  // 3. Fallbacks multilingues de sécurité sur l'aria-label
  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (
    label.includes('leave') ||
    label.includes('quitter') ||
    label.includes('raccrocher') ||
    label.includes('salir') ||
    label.includes('beenden') ||
    label.includes('uscir') ||
    label.includes('opust')
  ) {
    return true;
  }

  return false;
};

// Vérifie si le bouton raccrocher est présent dans le DOM
const hasInCallControlsPresent = (): boolean => {
  const buttons = document.querySelectorAll('button, [role="button"]');
  for (let i = 0; i < buttons.length; i++) {
    if (isLeaveCallButton(buttons[i])) return true;
  }
  return false;
};

// Détecte si l'utilisateur est sur l'écran d'attente / lobby avant de rejoindre l'appel
const isLobby = (): boolean => {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  return buttons.some((b) => {
    if (b.hasAttribute('data-join-button')) return true;
    const txt = (b.textContent || '').trim().toLowerCase();
    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
    return (
      txt === 'participer' ||
      txt === 'participer à la réunion' ||
      txt === 'demander à participer' ||
      txt === 'rejoindre' ||
      txt === 'join now' ||
      txt === 'ask to join' ||
      txt === 'join' ||
      aria.includes('join now') ||
      aria.includes('participer')
    );
  });
};

// Détection 100% indépendante de la langue (basée sur les invariants du DOM Google Meet)
const checkHasLeft = (): boolean => {
  const path = window.location.pathname;
  if (path.includes('/landing') || path.includes('/exit') || path.includes('/_meet')) return true;

  // 1. Textes caractéristiques de sortie
  const bodyText = (document.body.textContent || '').toLowerCase();
  if (
    bodyText.includes('you left') ||
    bodyText.includes('quitté') ||
    bodyText.includes('ended the call') ||
    bodyText.includes('mis fin') ||
    bodyText.includes('has ended') ||
    bodyText.includes('est terminée')
  ) {
    return true;
  }

  // 2. Transition d'état : on était en appel, et le bouton raccrocher a disparu
  if (callEverStarted && !hasInCallControlsPresent()) {
    return true;
  }

  // 3. Bouton réintégrer ou retour accueil sans contrôles d'appel
  const allInteractive = Array.from(document.querySelectorAll('button, [role="button"], a'));
  const hasRejoinOrHome = allInteractive.some((el) => {
    const t = (el.textContent || '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    return (
      t.includes('rejoin') ||
      t.includes('réintégrer') ||
      t.includes('retourner') ||
      t.includes('return to home') ||
      aria.includes('rejoin') ||
      aria.includes('réintégrer')
    );
  });

  if (hasRejoinOrHome && !hasInCallControlsPresent() && !isLobby()) {
    return true;
  }

  return false;
};

// ─── In-Call Detection & Header Positioning ──────────────────────────────────

let callEverStarted = false;

const isCallActive = (): boolean => {
  const isMeetingUrl = /^\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i.test(window.location.pathname);
  if (!isMeetingUrl) {
    callEverStarted = false;
    return false;
  }

  // Jamais actif dans le lobby avant de rejoindre
  if (isLobby()) {
    return false;
  }

  // Jamais actif si l'appel est terminé
  if (checkHasLeft()) {
    callEverStarted = false;
    return false;
  }

  // Actif si le bouton raccrocher est présent
  if (hasInCallControlsPresent()) {
    callEverStarted = true;
    return true;
  }

  return false;
};

let lastPositionedX = -1;
let lastPositionY = -1;

const updateTogglePosition = (toggle: HTMLElement): boolean => {
  if (toggle.parentElement !== document.body) {
    document.body.appendChild(toggle);
  }

  // Cherche les éléments textuels dans la barre d'en-tête gauche (top <= 75px, left <= 600px)
  const headerLeaves = Array.from(document.querySelectorAll<HTMLElement>('div, span, p')).filter((el) => {
    if (el.closest('#opti-meet-toggle-btn') || el.closest('#opti-meet-sidebar-ctrl') || el.closest('#opti-exit-dialog')) return false;
    if (el.children.length > 0) return false;
    const txt = (el.textContent || '').trim();
    if (!txt) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top <= 75 && r.left >= 0 && r.left <= 600 && r.width > 0 && r.height > 0;
  });

  let maxRight = 0;
  let vRef: HTMLElement | null = null;

  for (const el of headerLeaves) {
    const r = el.getBoundingClientRect();
    if (r.right > maxRight) {
      maxRight = r.right;
      vRef = el;
    }
  }

  let targetLeft = 240;
  let targetTop = 14;

  if (maxRight > 50 && vRef) {
    const vRect = vRef.getBoundingClientRect();
    const centerY = vRect.top + vRect.height / 2;
    targetTop = Math.round(centerY - 16);
    targetLeft = Math.round(maxRight + 12);
  }

  // Évite tout recalcul si déjà positionné de manière stable (seuil 6px)
  if (lastPositionedX !== -1 && Math.abs(targetLeft - lastPositionedX) <= 6 && Math.abs(targetTop - lastPositionY) <= 3) {
    return true;
  }

  lastPositionedX = targetLeft;
  lastPositionY = targetTop;

  toggle.style.setProperty('position', 'fixed', 'important');
  toggle.style.setProperty('top', `${targetTop}px`, 'important');
  toggle.style.setProperty('left', `${targetLeft}px`, 'important');
  toggle.style.setProperty('right', 'auto', 'important');
  toggle.style.setProperty('bottom', 'auto', 'important');
  toggle.style.setProperty('height', '32px', 'important');
  toggle.style.setProperty('line-height', '32px', 'important');
  toggle.style.setProperty('border-radius', '16px', 'important');
  toggle.style.setProperty('z-index', '9999', 'important');
  return true;
};

// ─── Injection Anchors ────────────────────────────────────────────────────────

const injectReactUI = () => {
  if (document.getElementById('opti-meet-sidebar-ctrl')) return;

  // 1. Injects Header Button Widget
  const toggle = document.createElement('button');
  toggle.id = 'opti-meet-toggle-btn';
  toggle.className = 'opti-meet-toggle-btn';
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.setAttribute('aria-controls', 'opti-meet-sidebar-ctrl');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `<span class="opti-btn-icon">⚡</span><span class="opti-btn-text">${t.toggleBtnText}</span>`;
  document.body.appendChild(toggle);
  if (isCallActive()) {
    updateTogglePosition(toggle);
    toggle.classList.add('visible');
  }

  // 2. Injects Sidebar Drawer Root HTML Container
  const sidebar = document.createElement('div');
  sidebar.id = 'opti-meet-sidebar-ctrl';
  sidebar.className = 'opti-meet-sidebar collapsed';
  sidebar.setAttribute('role', 'dialog');
  sidebar.setAttribute('aria-label', 'Meeting Heroes - Évaluation');
  sidebar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sidebar);

  const sidebarRoot = createRoot(sidebar);

  const handleClose = () => {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('submitted');
    sidebar.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  };

  sidebarRoot.render(<SidebarContainer onClose={handleClose} />);

  // Hover open/close behavior with intent debounce
  let openTimeout: ReturnType<typeof setTimeout> | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;

  const cancelOpen = () => {
    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = null;
    }
  };

  const cancelClose = () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  };

  const openPanel = () => {
    cancelClose();
    cancelOpen();
    const rect = toggle.getBoundingClientRect();
    const targetLeft = Math.max(16, Math.min(rect.left, window.innerWidth - 360));
    sidebar.style.setProperty('position', 'fixed', 'important');
    sidebar.style.setProperty('top', `${rect.bottom + 8}px`, 'important');
    sidebar.style.setProperty('left', `${targetLeft}px`, 'important');
    sidebar.style.setProperty('right', 'auto', 'important');
    sidebar.classList.remove('collapsed');
    sidebar.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const scheduleOpen = () => {
    cancelClose();
    if (!sidebar.classList.contains('collapsed')) return;
    openTimeout = setTimeout(() => {
      openPanel();
    }, 80);
  };

  const scheduleClose = () => {
    cancelOpen();
    cancelClose();
    // Ne jamais fermer automatiquement sur mouseleave si l'écran de succès est affiché
    if (sidebar.classList.contains('submitted')) return;
    closeTimeout = setTimeout(() => {
      handleClose();
    }, 250);
  };

  toggle.addEventListener('mouseenter', scheduleOpen);
  toggle.addEventListener('mouseleave', scheduleClose);

  sidebar.addEventListener('mouseenter', () => {
    cancelOpen();
    cancelClose();
  });
  sidebar.addEventListener('mouseleave', scheduleClose);

  toggle.addEventListener('click', () => {
    cancelOpen();
    cancelClose();
    if (sidebar.classList.contains('collapsed')) {
      openPanel();
    } else {
      handleClose();
    }
  });

  // Clavier : Fermeture instantanée via Escape (Modern Web Guidance)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sidebar.classList.contains('collapsed')) {
      cancelOpen();
      cancelClose();
      handleClose();
      toggle.focus();
    }
  });
};

const injectExitOverlay = async (force: boolean = false) => {
  if (document.getElementById('opti-exit-dialog')) return;
  if (exitPollDismissed) return;

  // 1. Respecter STRICTEMENT le silence pour aujourd'hui (en prod ET en dev)
  if (await StorageHelper.isExitPollSilenced()) return;

  // 2. Détermine la réunion à évaluer : priorité à la dernière réunion terminée récemment
  let currentMeeting: ActiveMeetingState | null = null;
  const lastFinished = await StorageHelper.getLastFinishedMeeting();
  if (lastFinished && Date.now() - lastFinished.endedAt < 30 * 60 * 1000) {
    currentMeeting = {
      id: lastFinished.id,
      title: lastFinished.title,
      startTime: lastFinished.startTime,
      participantCount: lastFinished.participantCount,
      isHost: lastFinished.isHost,
      pollStatus: 'idle',
    };
  }
  if (!currentMeeting && meetingId) {
    currentMeeting = getTabMeetingState();
  }
  if (!currentMeeting) {
    currentMeeting = await StorageHelper.getActiveMeeting();
  }

  // Ne ré-affiche jamais si déjà soumis pour cette session
  const rawId = currentMeeting?.id || meetingId;
  if (rawId) {
    const occurrenceId = getOccurrenceId(rawId, currentMeeting?.startTime || meetingStartTime || Date.now());
    if (await StorageHelper.isOccurrenceSubmitted(occurrenceId)) {
      return;
    }
  }
  if (currentMeeting && currentMeeting.pollStatus === 'submitted') {
    return;
  }

  const dev = isDevMode();

  // En prod seulement (pas en dev ni en forcé) : vérification des seuils
  if (!force && !dev) {
    const participantCount = currentMeeting?.participantCount || 1;
    if (participantCount < 3) {
      return;
    }

    const startTime = currentMeeting?.startTime || meetingStartTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      if (duration < 5 * 60 * 1000) {
        return;
      }
    }
  }

  const overlay = document.createElement('div');
  overlay.id = 'opti-exit-dialog';
  overlay.className = 'opti-meet-exit-overlay';
  document.body.appendChild(overlay);

  const root = createRoot(overlay);

  const handleClose = () => {
    overlay.remove();
    exitPollDismissed = true;
  };

  root.render(<ExitOverlayContainer onClose={handleClose} targetMeeting={currentMeeting} />);
};

// ─── Font Injection ───────────────────────────────────────────────────────────

const injectFonts = () => {
  const id = 'opti-material-icons-font';
  if (document.getElementById(id)) return;

  const roboto = document.createElement('link');
  roboto.rel = 'stylesheet';
  roboto.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
  document.head.appendChild(roboto);

  const icons = document.createElement('link');
  icons.id = id;
  icons.rel = 'stylesheet';
  icons.href = 'https://fonts.googleapis.com/icon?family=Material+Icons+Outlined';
  document.head.appendChild(icons);
};

// ─── Entry Point Initialization ──────────────────────────────────────────────

const init = async () => {
  if ((window as any).__OPTI_MEETING_INITIALIZED__) return;
  (window as any).__OPTI_MEETING_INITIALIZED__ = true;

  // Helper console pour réinitialiser le silence lors des tests (disponible dans le contexte content script et page top)
  const unsilence = async () => {
    await StorageHelper.unsilenceExitPoll();
    console.log('[Meeting Heroes] Silence désactivé pour aujourd’hui.');
  };
  (window as any).resetMeetingHeroesSilence = unsilence;
  window.addEventListener('opti_meeting_reset_silence', unsilence);

  try {
    const script = document.createElement('script');
    script.textContent = `window.resetMeetingHeroesSilence = () => { window.dispatchEvent(new CustomEvent('opti_meeting_reset_silence')); return "Demande de réinitialisation envoyée à Meeting Heroes."; };`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (err) {
    // Ignore context injection errors
  }

  injectFonts();
  updateMeetingId();

  // Si on est déjà sur l'écran de fin (ex: page rechargée après avoir quitté)
  if (checkHasLeft()) {
    await injectExitOverlay(false);
    return;
  }

  if (!meetingId) {
    return;
  }

  meetingStartTime = Date.now();
  exitPollDismissed = false;
  await syncMeetingState();

  injectReactUI();

  setInterval(syncMeetingState, 5000);

  // Surveille l'état d'appel et positionne le bouton dans l'en-tête
  setInterval(() => {
    const active = isCallActive();
    const toggle = document.getElementById('opti-meet-toggle-btn');
    if (!toggle) return;

    if (active) {
      const positioned = updateTogglePosition(toggle);
      if (positioned) {
        toggle.classList.add('visible');
      }
    } else {
      toggle.classList.remove('visible');
    }
  }, 500);

  // Surveille la sortie d'appel en continu (sans forcer, pour respecter les dismiss et silences)
  setInterval(async () => {
    if (checkHasLeft()) {
      await injectExitOverlay(false);
    }
  }, 500);

  // Capture directe du clic sur le bouton rouge "Quitter l'appel"
  document.addEventListener(
    'click',
    async (e) => {
      const target = (e.target as HTMLElement)?.closest('button, [role="button"]');
      if (target && isLeaveCallButton(target)) {
        exitPollDismissed = false;
        const metrics = scrapeMeetMetrics();
        await StorageHelper.saveLastFinishedMeeting({
          id: meetingId,
          title: metrics.title,
          startTime: meetingStartTime || Date.now(),
          participantCount: metrics.participants,
          isHost: metrics.isHost,
          endedAt: Date.now(),
        });
        setTimeout(() => {
          injectExitOverlay(false);
        }, 300);
      }
    },
    true
  );

  // Nettoie l'état actif quand l'utilisateur quitte la page de réunion et stocke la dernière réunion terminée
  window.addEventListener('pagehide', async () => {
    if (meetingId) {
      const metrics = scrapeMeetMetrics();
      await StorageHelper.saveLastFinishedMeeting({
        id: meetingId,
        title: metrics.title,
        startTime: meetingStartTime || Date.now(),
        participantCount: metrics.participants,
        isHost: metrics.isHost,
        endedAt: Date.now(),
      });
      const active = await StorageHelper.getActiveMeeting();
      if (active && active.id === meetingId) {
        await StorageHelper.saveActiveMeeting(null);
      }
    }
  });
};

init();
