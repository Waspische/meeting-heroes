import { useState, useEffect, useCallback } from 'react';
import { StorageHelper } from './utils/StorageHelper';
import type { Meeting, ActiveMeetingState, HostedMeeting } from './utils/StorageHelper';
import { SheetsHelper } from './utils/SheetsHelper';
import type { RemoteEvaluation } from './utils/SheetsHelper';
import { hashMeetingId, getOccurrenceId, APPS_SCRIPT_URL } from './utils/CryptoHelper';
import { t } from './i18n';

// ─── Sub-components & Tag Helpers ───────────────────────────────────────────

const TAG_DEFS: Record<string, { label: string; cls: string }> = {
  perfect: { label: t.critDuration.perfect, cls: 'success' },
  too_long: { label: t.critDuration.tooLong, cls: 'warning' },
  too_short: { label: t.critDuration.tooShort, cls: 'warning' },
  right_pace: { label: t.critRecurrence.rightPace, cls: 'success' },
  too_frequent: { label: t.critRecurrence.tooFrequent, cls: 'warning' },
  rare: { label: t.critRecurrence.rare, cls: 'info' },
  clear: { label: t.critAgenda.clear, cls: 'success' },
  partial: { label: t.critAgenda.partial, cls: 'warning' },
  no_agenda: { label: t.critAgenda.noAgenda, cls: 'danger' },
  actionable: { label: t.critEfficiency.actionable, cls: 'success' },
  productive: { label: t.critEfficiency.productive, cls: 'success' },
  off_track: { label: t.critEfficiency.offTrack, cls: 'danger' },
  good_format: { label: t.critFormat.goodFormat, cls: 'info' },
  email_better: { label: t.critFormat.emailBetter, cls: 'info' },
  in_person_better: { label: t.critFormat.inPersonBetter, cls: 'info' },
  // Legacy keys
  slight_overrun: { label: t.critDuration.tooLong, cls: 'warning' },
  hostage: { label: t.critDuration.tooLong, cls: 'danger' },
  indispensable: { label: t.critRecurrence.rightPace, cls: 'success' },
  space_out: { label: t.critRecurrence.tooFrequent, cls: 'warning' },
  delete: { label: t.critRecurrence.tooFrequent, cls: 'danger' },
  sight: { label: t.critAgenda.partial, cls: 'warning' },
  fog: { label: t.critAgenda.noAgenda, cls: 'danger' },
  victories: { label: t.critEfficiency.actionable, cls: 'success' },
  endless: { label: t.critEfficiency.offTrack, cls: 'warning' },
  nothing: { label: t.critEfficiency.offTrack, cls: 'danger' },
  ideal: { label: t.critFormat.goodFormat, cls: 'info' },
  async_email: { label: t.critFormat.emailBetter, cls: 'info' },
  doc_better: { label: t.critFormat.emailBetter, cls: 'info' },
};

function CriteriaTags(props: {
  duration?: string;
  recurrence?: string;
  agenda?: string;
  efficiency?: string;
  format?: string;
}) {
  const tags = Object.values(props)
    .filter((k): k is string => Boolean(k && TAG_DEFS[k]))
    .map((k) => TAG_DEFS[k]);

  if (tags.length === 0) return null;
  return (
    <div className="tag-list" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map((item, idx) => (
        <span key={idx} className={`tag-badge ${item.cls}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating?: number }) {
  if (rating === undefined) return null;
  const cls = rating >= 4 ? 'rating-high' : rating >= 3 ? 'rating-med' : 'rating-low';
  return <span className={`rating-badge ${cls}`}>★ {rating}/5</span>;
}

function formatDate(ts: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<'meetings' | 'evals'>('meetings');
  const [hostedMeetings, setHostedMeetings] = useState<HostedMeeting[]>([]);
  const [myEvals, setMyEvals] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeetingState | null>(null);
  const [copied, setCopied] = useState(false);

  // Expanded meeting items in "Mes Réunions"
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  // Remote evaluations from Sheets, keyed by meetingHash
  const [remoteEvals, setRemoteEvals] = useState<Map<string, RemoteEvaluation[]>>(new Map());
  const [copiedVoteHash, setCopiedVoteHash] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleCopyVoteLink = async (meetingHash: string, title?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const signature = (await hashMeetingId(`vote_${meetingHash}`)).slice(0, 16);
    const titleParam = title ? `&t=${encodeURIComponent(title)}` : '';
    const link = `${APPS_SCRIPT_URL}?m=${meetingHash}&key=${signature}${titleParam}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedVoteHash(meetingHash);
    setTimeout(() => setCopiedVoteHash(null), 2500);
  };

  const handleCopyShare = async () => {
    const text = "⚡ Évaluez nos réunions en 10s et 100% anonymement avec l'extension Meeting Heroes : https://chromewebstore.google.com/detail/ofbfcnphgmibhdleifkegljmlgpmdlgp";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const load = useCallback(async () => {
    const active = await StorageHelper.getActiveMeeting();
    setActiveMeeting(active);

    let hosted = await StorageHelper.getHostedMeetings();

    // Auto-récupération de la réunion hôte active ou récente si pas encore dans hosted
    const lastFinished = await StorageHelper.getLastFinishedMeeting();
    if (lastFinished && lastFinished.isHost && lastFinished.id) {
      const hHash = await hashMeetingId(getOccurrenceId(lastFinished.id, lastFinished.startTime));
      if (!hosted.some((h) => h.meetingHash === hHash)) {
        await StorageHelper.addHostedMeeting({
          meetingHash: hHash,
          title: lastFinished.title,
          date: lastFinished.startTime,
        });
        hosted = await StorageHelper.getHostedMeetings();
      }
    }
    if (active && active.isHost && active.id) {
      const aHash = await hashMeetingId(getOccurrenceId(active.id, active.startTime));
      if (!hosted.some((h) => h.meetingHash === aHash)) {
        await StorageHelper.addHostedMeeting({
          meetingHash: aHash,
          title: active.title,
          date: active.startTime,
        });
        hosted = await StorageHelper.getHostedMeetings();
      }
    }

    setHostedMeetings(hosted);

    // 1. Source de vérité pour "Mes super-avis transmis" : le backend Google Sheets
    let userEvals: Meeting[] = [];
    try {
      const myRemoteEvals = await SheetsHelper.fetchMyEvaluations();
      if (Array.isArray(myRemoteEvals) && myRemoteEvals.length > 0) {
        userEvals = myRemoteEvals.map((rem: any) => {
          const remHash = rem.meetingHash?.trim().toLowerCase();
          const matchedHosted = hosted.find((h) => h.meetingHash.trim().toLowerCase() === remHash);
          if (matchedHosted) {
            rem.title = matchedHosted.title;
          } else if (!rem.title || rem.title === 'Réunion évaluée') {
            const d = new Date(rem.startTime);
            const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            rem.title = `Réunion du ${dateStr}`;
          }
          return rem as Meeting;
        });
        // Remplace les anciens avis locaux par la liste propre du backend
        await StorageHelper.saveMeetings(userEvals);
      } else {
        const local = await StorageHelper.getMeetings();
        userEvals = local.filter((m) => m.rating !== undefined);
      }
    } catch (err) {
      const local = await StorageHelper.getMeetings();
      userEvals = local.filter((m) => m.rating !== undefined);
    }
    userEvals.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    setMyEvals(userEvals);

    // 2. Récupère les avis distants pour les réunions animées ET les réunions évaluées
    try {
      const hashes = Array.from(
        new Set([
          ...hosted.map((h) => h.meetingHash.trim().toLowerCase()),
          ...userEvals.map((m) => m.meetingHash?.trim().toLowerCase()).filter((h): h is string => Boolean(h)),
        ])
      );

      if (hashes.length > 0) {
        const remoteData = await SheetsHelper.fetchEvaluationsByHashes(hashes);
        const evalMap = new Map<string, RemoteEvaluation[]>();
        for (const item of remoteData) {
          const cleanHash = item.meetingHash.trim().toLowerCase();
          const list = evalMap.get(cleanHash) || [];
          list.push(item);
          evalMap.set(cleanHash, list);
        }
        setRemoteEvals(evalMap);

        // Acquitte les avis reçus pour l'organisateur et efface le badge
        if (hosted.length > 0) {
          const currentCounts: Record<string, number> = {};
          for (const h of hosted) {
            const clean = h.meetingHash.trim().toLowerCase();
            currentCounts[h.meetingHash] = (evalMap.get(clean) || []).length;
          }
          await StorageHelper.markReviewsAsRead(currentCounts);
          if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
            chrome.action.setBadgeText({ text: '' });
          }
        }
      } else {
        setRemoteEvals(new Map());
      }
    } catch (err) {
      console.error('Failed to pre-fetch remote evaluations:', err);
    }
  }, []);

  useEffect(() => {
    (window as any).clearMeetingHeroesCache = async () => {
      await StorageHelper.clearAll();
      await load();
      console.log('[Meeting Heroes] Cache local vidé avec succès.');
    };
    load();
    const unsub = StorageHelper.subscribeToChanges(load);
    return () => unsub();
  }, [load]);

  const toggleMeeting = (id: string) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="app-container">
      {/* ── Header : Base des Héros ── */}
      <header className="hero-app-header">
        <div className="logo-container">
          <div className="hero-logo-badge">
            <img src="/icon.svg" alt="Meeting Heroes" style={{ width: 28, height: 28, flexShrink: 0 }} />
            {activeMeeting && (
              <span className="hero-pulse-dot" title="Mission en cours" />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="logo-text" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
              {t.brandName}
            </h1>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.3px' }}>
              {t.brandTagline}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              if (refreshing) return;
              setRefreshing(true);
              load().finally(() => setTimeout(() => setRefreshing(false), 500));
            }}
            className="hero-header-share-btn"
            title="Actualiser les avis depuis Google Sheets"
            aria-label="Actualiser les avis"
            style={{ padding: '0 7px' }}
          >
            <span
              className="material-icons-outlined"
              style={{
                fontSize: 14,
                transition: 'transform 0.5s ease',
                transform: refreshing ? 'rotate(360deg)' : 'none',
              }}
              aria-hidden="true"
            >
              refresh
            </span>
          </button>

          <button
            onClick={handleCopyShare}
            className="hero-header-share-btn"
            title={t.inviteHeroes}
            aria-label={t.inviteHeroes}
          >
            <span className="material-icons-outlined" style={{ fontSize: 13 }} aria-hidden="true">
              {copied ? 'check' : 'share'}
            </span>
            <span>{copied ? t.copied : t.inviteHeroes}</span>
          </button>

          {activeMeeting ? (
            <div className="status-badge active" title={activeMeeting.title}>
              <span className="hero-live-indicator">●</span>
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.liveShort}
              </span>
            </div>
          ) : (
            <div className="status-badge inactive">
              <span className="material-icons-outlined" style={{ fontSize: 13 }} aria-hidden="true">
                shield
              </span>
              <span>{t.standbyShort}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Tabs (Accessible Tablist) ── */}
      <div className="tabs-navigation" role="tablist" aria-label="Navigation des réunions">
        <button
          id="tab-meetings"
          role="tab"
          aria-selected={activeTab === 'meetings'}
          aria-controls="tabpanel-meetings"
          className={`tab-btn ${activeTab === 'meetings' ? 'active' : ''}`}
          onClick={() => setActiveTab('meetings')}
        >
          <span className="material-icons-outlined" aria-hidden="true">shield</span>
          <span>{t.tabHosted(hostedMeetings.length)}</span>
        </button>
        <button
          id="tab-evals"
          role="tab"
          aria-selected={activeTab === 'evals'}
          aria-controls="tabpanel-evals"
          className={`tab-btn ${activeTab === 'evals' ? 'active' : ''}`}
          onClick={() => setActiveTab('evals')}
        >
          <span className="material-icons-outlined" aria-hidden="true">bolt</span>
          <span>{t.tabEvals(myEvals.length)}</span>
        </button>
      </div>

      {/* ── Content ── */}
      <main className="tab-content">
        {/* ══ Tab 1 : Mes réunions organisées ════════════════════════════════════ */}
        {activeTab === 'meetings' && (
          <section
            id="tabpanel-meetings"
            role="tabpanel"
            aria-labelledby="tab-meetings"
            tabIndex={0}
            className="card"
          >
            <h2 className="card-title">
              <span className="material-icons-outlined" aria-hidden="true">shield</span>
              Missions sous ton commandement ({hostedMeetings.length})
            </h2>

            {hostedMeetings.length === 0 ? (
              <div className="empty-view">
                <span className="material-icons-outlined empty-icon" aria-hidden="true">shield</span>
                <div className="empty-text">{t.emptyHostedTitle}</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 320 }}>
                  {t.emptyHostedDesc}
                </p>
              </div>
            ) : (
              <div className="timeline">
                {hostedMeetings.map((h) => {
                  const expanded = expandedMeetings.has(h.meetingHash);
                  const cleanHash = h.meetingHash.trim().toLowerCase();
                  const remote = remoteEvals.get(cleanHash) ?? remoteEvals.get(h.meetingHash) ?? [];
                  const ratings = remote.map((r) => r.rating);
                  const globalAvg =
                    ratings.length > 0
                      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
                      : 0;
                  const avgClass =
                    globalAvg >= 4 ? 'rating-high' : globalAvg >= 3 ? 'rating-med' : globalAvg > 0 ? 'rating-low' : '';

                  return (
                    <div
                      key={h.meetingHash}
                      className="timeline-item"
                    >
                      <button
                        type="button"
                        className="item-header-btn"
                        aria-expanded={expanded}
                        aria-controls={`details-${h.meetingHash}`}
                        onClick={() => toggleMeeting(h.meetingHash)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          padding: 0,
                          font: 'inherit',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div className="item-header" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="item-title">{h.title}</span>
                          <span
                            className="material-icons-outlined"
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: 18,
                              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                            aria-hidden="true"
                          >
                            expand_more
                          </span>
                        </div>
                        <div className="item-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {globalAvg > 0 ? (
                              <span className={`rating-badge ${avgClass}`}>★ {globalAvg} moy.</span>
                            ) : (
                              <span style={{ color: 'var(--text-disabled)', fontSize: 12 }}>En attente de votes</span>
                            )}
                            <span>• {remote.length} avis</span>
                            <span className="item-time">{formatDate(h.date)}</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleCopyVoteLink(h.meetingHash, h.title, e)}
                            className="hero-header-share-btn"
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              background: copiedVoteHash === h.meetingHash ? '#e6f4ea' : '#fef3c7',
                              color: copiedVoteHash === h.meetingHash ? '#137333' : '#b45309',
                              borderColor: copiedVoteHash === h.meetingHash ? '#ceead6' : '#fde68a',
                            }}
                            title={t.reinviteHeroes}
                            aria-label={t.reinviteHeroes}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: 13 }} aria-hidden="true">
                              {copiedVoteHash === h.meetingHash ? 'check' : 'bolt'}
                            </span>
                            <span>{copiedVoteHash === h.meetingHash ? t.copied : t.reinviteHeroesShort}</span>
                          </button>
                        </div>
                      </button>

                      {/* Expanded: all participant reviews */}
                      {expanded && (
                        <div
                          id={`details-${h.meetingHash}`}
                          role="region"
                          aria-label={`Avis pour ${h.title}`}
                          style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase',
                              marginBottom: 2,
                            }}
                          >
                            {remote.length > 0 ? `${remote.length} avis anonyme(s) reçu(s)` : 'Aucun avis'}
                          </div>

                          {remote.map((r, i) => (
                            <div
                              key={`remote-${i}`}
                              style={{
                                background: '#f0f7ff',
                                border: '1px solid #c2e0ff',
                                borderRadius: 6,
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <RatingBadge rating={r.rating} />
                                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>
                                  {formatDate(new Date(r.timestamp).getTime())}
                                </span>
                              </div>
                              {r.comment && (
                                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-secondary)' }}>
                                  "{r.comment}"
                                </div>
                              )}
                              <CriteriaTags
                                duration={r.duration_feedback}
                                recurrence={r.recurrence_feedback}
                                agenda={r.agenda_feedback}
                                efficiency={r.efficiency_feedback}
                                format={r.format_feedback}
                              />
                            </div>
                          ))}

                          {remote.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-disabled)' }}>
                              Aucun avis reçu pour cette réunion pour l'instant.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══ Tab 2 : Mes évaluations ═══════════════════════════════════════════ */}
        {activeTab === 'evals' && (
          <section
            id="tabpanel-evals"
            role="tabpanel"
            aria-labelledby="tab-evals"
            tabIndex={0}
            className="card"
          >
            <h2 className="card-title">
              <span className="material-icons-outlined" aria-hidden="true">bolt</span>
              Mes super-avis transmis ({myEvals.length})
            </h2>

            {myEvals.length === 0 ? (
              <div className="empty-view">
                <span className="material-icons-outlined empty-icon" aria-hidden="true">bolt</span>
                <div className="empty-text">{t.emptyEvalsTitle}</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 320 }}>
                  {t.emptyEvalsDesc}
                </p>
              </div>
            ) : (
              <div className="timeline">
                {myEvals.map((m) => {
                  const rateClass =
                    (m.rating ?? 0) >= 4 ? 'rating-high' : (m.rating ?? 0) >= 3 ? 'rating-med' : 'rating-low';

                  const cleanHash = m.meetingHash ? m.meetingHash.trim().toLowerCase() : '';
                  const remote = cleanHash ? (remoteEvals.get(cleanHash) ?? remoteEvals.get(m.meetingHash!) ?? []) : [];
                  const groupRatings = remote.map((r) => r.rating);
                  const groupAvg =
                    groupRatings.length > 0
                      ? Math.round((groupRatings.reduce((s, r) => s + r, 0) / groupRatings.length) * 10) / 10
                      : 0;
                  const groupAvgClass =
                    groupAvg >= 4 ? 'rating-high' : groupAvg >= 3 ? 'rating-med' : groupAvg > 0 ? 'rating-low' : '';

                  const isExpandedConsensus = expandedMeetings.has(`consensus-${m.id}`);

                  return (
                    <div key={m.id} className="timeline-item">
                      <div className="item-header">
                        <span className="item-title">{m.title}</span>
                        <span className="item-time">{formatDate(m.startTime)}</span>
                      </div>
                      <div className="item-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span className={`rating-badge ${rateClass}`}>★ {m.rating}/5</span>
                        {groupAvg > 0 && (
                          <span className={`rating-badge ${groupAvgClass}`} style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                            ★ {groupAvg} collectif ({remote.length} avis)
                          </span>
                        )}
                        <span>• {m.participantCount} participants</span>
                      </div>

                      {m.comment && (
                        <div
                          style={{
                            fontStyle: 'italic',
                            color: 'var(--text-secondary)',
                            fontSize: 12,
                            margin: '4px 0',
                          }}
                        >
                          "{m.comment}"
                        </div>
                      )}

                      {m.details && (
                        <CriteriaTags
                          duration={m.details.durationVal}
                          recurrence={m.details.recurrenceVal}
                          agenda={m.details.agendaVal}
                          efficiency={m.details.efficiencyVal}
                          format={m.details.formatVal || (m.details.preferredAlternative !== 'none' ? m.details.preferredAlternative : undefined)}
                        />
                      )}

                      {/* Consensus collectif de la réunion si d'autres collègues ont voté */}
                      {remote.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                          <button
                            type="button"
                            onClick={() => toggleMeeting(`consensus-${m.id}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '2px 0',
                              fontSize: 11,
                              fontWeight: 500,
                              color: '#2563eb',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: 14 }}>
                              {isExpandedConsensus ? 'expand_less' : 'groups'}
                            </span>
                            {isExpandedConsensus
                              ? 'Masquer les avis du groupe'
                              : `Voir les avis de l’équipe (${remote.length})`}
                          </button>

                          {isExpandedConsensus && (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {remote.map((r, i) => (
                                <div
                                  key={`remote-eval-${i}`}
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 6,
                                    padding: '6px 10px',
                                    fontSize: 11,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <RatingBadge rating={r.rating} />
                                    <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>
                                      {formatDate(new Date(r.timestamp).getTime())}
                                    </span>
                                  </div>
                                  {r.comment && (
                                    <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: 11 }}>
                                      "{r.comment}"
                                    </div>
                                  )}
                                  <CriteriaTags
                                    duration={r.duration_feedback}
                                    recurrence={r.recurrence_feedback}
                                    agenda={r.agenda_feedback}
                                    efficiency={r.efficiency_feedback}
                                    format={r.format_feedback}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
