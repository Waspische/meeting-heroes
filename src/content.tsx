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
  const titleEl = document.querySelector('[data-meeting-title]') ||
    document.querySelector('.PDvu7') ||
    document.querySelector('.rGqgbe');
  if (titleEl && titleEl.textContent?.trim()) {
    title = titleEl.textContent.trim();
  } else if (document.title && document.title.includes('Meet -')) {
    title = document.title.replace('Meet - ', '').trim();
  }

  if (meetingStartTime) {
    const d = new Date(meetingStartTime);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    title = `${title} (${dateStr} ${timeStr})`;
  }

  let participants = 1;
  const badge = document.querySelector('.uG74Mc') ||
    document.querySelector('.xWla1b') ||
    document.querySelector('.knivn');
  if (badge && badge.textContent?.trim()) {
    const num = parseInt(badge.textContent.trim().replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) participants = num;
  } else {
    const gridItems = document.querySelectorAll('[data-requested-participant-id]');
    if (gridItems.length > 0) participants = gridItems.length;
  }

  const hostControlsBtn = document.querySelector('[aria-label*="Organisateur"], [aria-label*="Host controls"], [aria-label*="Commandes de l\'organisateur"]');
  isHostUser = !!hostControlsBtn;

  return { title, participants, isHost: isHostUser };
};

// Sync meeting details to storage
const syncMeetingState = async () => {
  if (!meetingId) return;

  const metrics = scrapeMeetMetrics();
  const occurrenceId = getOccurrenceId(meetingId, meetingStartTime || Date.now());
  const isSubmittedForThisMeeting = await StorageHelper.isOccurrenceSubmitted(occurrenceId);

  const state: ActiveMeetingState = {
    id: meetingId,
    title: metrics.title,
    startTime: meetingStartTime || Date.now(),
    participantCount: metrics.participants,
    isHost: metrics.isHost,
    pollStatus: isSubmittedForThisMeeting ? 'submitted' : 'idle',
  };

  await StorageHelper.saveActiveMeeting(state);

  if (metrics.isHost && meetingId) {
    const occurrenceId = getOccurrenceId(meetingId, meetingStartTime || Date.now());
    const meetingHash = await hashMeetingId(occurrenceId);
    await StorageHelper.addHostedMeeting({
      meetingHash,
      title: metrics.title,
      date: meetingStartTime || Date.now(),
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
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button[aria-label*="chat" i], button[aria-label*="discut" i], button[aria-label*="message" i], ' +
      '[role="button"][aria-label*="chat" i], [role="button"][aria-label*="discut" i], [role="button"][aria-label*="message" i], ' +
      '[data-panel-id="2"], [data-panel-id="3"]'
    )
  );
  const genuine = candidates.filter(
    (el) => !el.closest('#opti-meet-sidebar-ctrl') && !el.closest('.opti-meet-exit-overlay')
  );
  return genuine[0] || null;
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

function useMeetingReview(onClose: () => void) {
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const check = async () => {
      const active = await StorageHelper.getActiveMeeting();
      setActiveMeeting(active);
      const rawId = meetingId || active?.id;
      if (rawId) {
        const occurrenceId = getOccurrenceId(rawId, active?.startTime || meetingStartTime || Date.now());
        const submitted = await StorageHelper.isOccurrenceSubmitted(occurrenceId);
        setIsSubmitted(submitted);
      } else {
        setIsSubmitted(false);
      }
    };
    check();
    return StorageHelper.subscribeToChanges(check);
  }, []);

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
            {activeMeeting.title} ({t.guestsCount(activeMeeting.participantCount)})
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

function ExitOverlayContainer({ onClose }: { onClose: () => void }) {
  const { activeMeeting, isSubmitted, handleFormSubmit } = useMeetingReview(onClose);

  return (
    <div
      className="opti-meet-exit-card"
      role="dialog"
      aria-modal="true"
      aria-label="Mission accomplie - Bilan de réunion"
      style={{ maxWidth: '420px', width: '100%', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-3)', position: 'relative' }}
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
        <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
      </button>

      {!isSubmitted && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: '#202124' }}>
            {t.exitModalTitle}
          </h2>
          <p style={{ fontSize: '13px', color: '#5f6368', margin: 0 }}>
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
    </div>
  );
}

// ─── Injection Anchors ────────────────────────────────────────────────────────

// ─── In-Call Detection & Header Positioning ──────────────────────────────────

let callEverStarted = false;

const isCallActive = (): boolean => {
  // 1. Doit impérativement être sur une URL de réunion Google Meet valide (/xxx-xxxx-xxx)
  // et JAMAIS sur la page d'accueil meet.google.com/ ni /landing ni /exit
  const isMeetingUrl = /^\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i.test(window.location.pathname);
  if (!isMeetingUrl) {
    callEverStarted = false;
    return false;
  }

  if (
    window.location.pathname.includes('/landing') ||
    window.location.pathname.includes('/exit') ||
    document.body.textContent?.includes('Vous avez quitté la réunion') ||
    document.body.textContent?.includes('You left the meeting')
  ) {
    callEverStarted = false;
    return false;
  }

  // 2. Si l'écran d'attente (lobby / green room) est présent, l'appel N'EST PAS actif
  const isLobby = Array.from(document.querySelectorAll('button')).some((b) => {
    const t = (b.textContent || '').trim().toLowerCase();
    return (
      t === 'participer' ||
      t === 'participer à la réunion' ||
      t === 'join now' ||
      t === 'demander à participer' ||
      t === 'ask to join' ||
      t === 'rejoindre' ||
      t === 'join'
    );
  }) || !!document.querySelector('button[jsname="Qx7uuf"], [data-join-button]');

  if (isLobby) {
    return false;
  }

  // 3. Preuves irréfutables qu'on est DANS l'appel :
  const inCallElement = document.querySelector(
    'button[aria-label*="quitter" i], button[aria-label*="leave" i], button[aria-label*="raccrocher" i], button[data-call-ended], ' +
    '.X3H8c, .ND08le, .gjvSDd, .YDkhgc, .B0Ihcb, section[aria-label="Presentation"], ' +
    'button[aria-label*="Stop presenting" i], button[aria-label*="Arrêter la présentation" i]'
  );

  if (inCallElement) {
    callEverStarted = true;
    return true;
  }

  if (callEverStarted) {
    return true;
  }

  return false;
};

const updateTogglePosition = (toggle: HTMLElement): boolean => {
  // Le bouton doit TOUJOURS rester dans document.body pour que Google Meet ne puisse jamais le détruire
  if (toggle.parentElement !== document.body) {
    document.body.appendChild(toggle);
  }

  // Cherche l'ensemble du groupe titre (.X3H8c) et ses composants
  const titleBox = (
    document.querySelector('.X3H8c') ||
    document.querySelector('div[jscontroller="OFnRNd"]')
  ) as HTMLElement | null;

  const titleText = document.querySelector('.ND08le') as HTMLElement | null;
  const infoBtn = document.querySelector('.r6xAKc button, .r6xAKc [role="button"]') as HTMLElement | null;
  const clockText = document.querySelector('.MQKmmc') as HTMLElement | null;

  let rightBoundary = 0;

  if (titleBox) {
    const r = titleBox.getBoundingClientRect();
    if (r.right > 0) rightBoundary = Math.max(rightBoundary, r.right);
  }

  if (titleText) {
    const r = titleText.getBoundingClientRect();
    if (r.right > 0) rightBoundary = Math.max(rightBoundary, r.right);
  }

  if (infoBtn) {
    const r = infoBtn.getBoundingClientRect();
    if (r.right > 0) rightBoundary = Math.max(rightBoundary, r.right);
  }

  // Référence verticale ultra-précise : le bouton info (i) ou l'horloge
  const vRef = infoBtn || clockText || titleText || titleBox;

  if (rightBoundary > 50 && vRef) {
    const vRect = vRef.getBoundingClientRect();
    if (vRect.top >= 0 && vRect.top <= 80 && vRect.height > 0) {
      const centerY = vRect.top + vRect.height / 2;
      const topPos = Math.round(centerY - 16); // 16 = 32px / 2
      const leftPos = Math.round(rightBoundary + 10);

      toggle.style.setProperty('position', 'fixed', 'important');
      toggle.style.setProperty('top', `${Math.max(4, topPos)}px`, 'important');
      toggle.style.setProperty('left', `${leftPos}px`, 'important');
      toggle.style.setProperty('right', 'auto', 'important');
      toggle.style.setProperty('bottom', 'auto', 'important');
      toggle.style.setProperty('height', '32px', 'important');
      toggle.style.setProperty('line-height', '32px', 'important');
      toggle.style.setProperty('border-radius', '16px', 'important');
      toggle.style.setProperty('z-index', '9999', 'important');
      return true;
    }
  }

  return false;
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

const injectExitOverlay = async () => {
  if (document.getElementById('opti-exit-dialog')) return;
  if (exitPollDismissed) return;

  const active = await StorageHelper.getActiveMeeting();
  const rawId = meetingId || active?.id;
  if (rawId) {
    const occurrenceId = getOccurrenceId(rawId, active?.startTime || meetingStartTime || Date.now());
    if (await StorageHelper.isOccurrenceSubmitted(occurrenceId)) {
      return; // Déjà soumis : ne jamais ré-afficher l'overlay de sortie !
    }
  }
  if (active && active.pollStatus === 'submitted') {
    return;
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

  root.render(<ExitOverlayContainer onClose={handleClose} />);
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

  injectFonts();
  updateMeetingId();
  if (!meetingId) {
    const wasLanding = window.location.pathname.includes('/landing') ||
      window.location.pathname.includes('/exit') ||
      document.body.textContent?.includes('Vous avez quitté la réunion') ||
      document.body.textContent?.includes('You left the meeting');
    if (wasLanding) {
      await injectExitOverlay();
    }
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

  setInterval(async () => {
    if (exitPollDismissed) return;
    const currentId = meetingId || (await StorageHelper.getActiveMeeting())?.id;
    if (currentId) {
      const occurrenceId = getOccurrenceId(currentId, meetingStartTime || Date.now());
      if (await StorageHelper.isOccurrenceSubmitted(occurrenceId)) {
        return; // Déjà voté pour cette réunion spécifique
      }
    }
    const wasLanding = window.location.pathname.includes('/landing') ||
      window.location.pathname.includes('/exit') ||
      document.body.textContent?.includes('Vous avez quitté la réunion') ||
      document.body.textContent?.includes('You left the meeting');
    if (wasLanding) {
      await injectExitOverlay();
    }
  }, 2000);

  // Nettoie l'état actif quand l'utilisateur quitte la page de réunion
  window.addEventListener('pagehide', () => {
    StorageHelper.saveActiveMeeting(null);
  });
};

init();
