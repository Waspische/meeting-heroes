import React, { useState, useEffect } from 'react';
import type { ActiveMeetingState } from '../utils/StorageHelper';
import { t } from '../i18n';

// Options dynamiques multilingues
const CRITERIA_SECTIONS = [
  {
    key: 'durationVal',
    label: 'Durée',
    options: [
      { val: 'perfect', label: t.critDuration.perfect },
      { val: 'too_long', label: t.critDuration.tooLong },
      { val: 'too_short', label: t.critDuration.tooShort },
    ],
  },
  {
    key: 'recurrenceVal',
    label: 'Récurrence',
    options: [
      { val: 'right_pace', label: t.critRecurrence.rightPace },
      { val: 'too_frequent', label: t.critRecurrence.tooFrequent },
      { val: 'rare', label: t.critRecurrence.rare },
    ],
  },
  {
    key: 'agendaVal',
    label: 'Ordre du jour',
    options: [
      { val: 'clear', label: t.critAgenda.clear },
      { val: 'partial', label: t.critAgenda.partial },
      { val: 'no_agenda', label: t.critAgenda.noAgenda },
    ],
  },
  {
    key: 'efficiencyVal',
    label: 'Efficacité',
    options: [
      { val: 'productive', label: t.critEfficiency.productive },
      { val: 'actionable', label: t.critEfficiency.actionable },
      { val: 'off_track', label: t.critEfficiency.offTrack },
    ],
  },
  {
    key: 'formatVal',
    label: 'Format',
    options: [
      { val: 'good_format', label: t.critFormat.goodFormat },
      { val: 'email_better', label: t.critFormat.emailBetter },
      { val: 'in_person_better', label: t.critFormat.inPersonBetter },
    ],
  },
] as const;

interface RatingFormProps {
  activeMeeting: ActiveMeetingState | null;
  onSubmit: (data: {
    rating: number;
    comment: string;
    durationVal: string;
    recurrenceVal: string;
    agendaVal: string;
    efficiencyVal: string;
    formatVal: string;
  }) => void;
  isSubmitted: boolean;
  onClose?: () => void;
  onCopyInvite?: () => void;
  onChatInvite?: () => void;
}

export function RatingForm({ activeMeeting, onSubmit, isSubmitted, onClose, onCopyInvite, onChatInvite }: RatingFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-expand "Détails de la mission" if rating <= 3 & > 0
  useEffect(() => {
    if (rating > 0 && rating <= 3) {
      setIsOpen(true);
    }
  }, [rating]);

  // Reset all states when activeMeeting ID changes or upon submission
  useEffect(() => {
    setRating(0);
    setComment('');
    setIsOpen(false);
    setDetails({});
    setRatingError(null);
    setIsSubmitting(false);
  }, [activeMeeting?.id, isSubmitted]);

  const handleStarClick = (num: number) => {
    setRating(num);
    if (ratingError) setRatingError(null);
  };

  const toggleDetail = (key: string, val: string) => {
    setDetails((prev) => ({ ...prev, [key]: prev[key] === val ? '' : val }));
  };

  const handleSubmitVal = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setRatingError('Choisis une note de 1 à 5 étoiles pour valider la mission !');
      return;
    }
    setIsSubmitting(true);
    onSubmit({
      rating,
      comment,
      durationVal: details.durationVal || '',
      recurrenceVal: details.recurrenceVal || '',
      agendaVal: details.agendaVal || '',
      efficiencyVal: details.efficiencyVal || '',
      formatVal: details.formatVal || '',
    });
  };

  if (isSubmitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="hero-success-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '36px 16px',
          minHeight: '280px',
          gap: '10px',
          textAlign: 'center',
        }}
      >
        <div className="hero-badge-burst">
          <span className="material-icons-outlined hero-burst-icon" style={{ fontSize: '44px', color: '#f59e0b' }}>verified</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '6px 0 0', color: '#202124' }}>{t.missionAccomplished}</h3>
        <p style={{ fontSize: '13px', color: '#5f6368', margin: 0, lineHeight: 1.5, maxWidth: '260px', whiteSpace: 'pre-line' }}>{t.successMsg}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="hero-submit-btn"
            style={{
              marginTop: '14px',
              padding: '8px 24px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.closeBtn}
          </button>
        )}

        {(onCopyInvite || onChatInvite) && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', width: '100%' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 500, textAlign: 'center' }}>
              {t.inviteTeamPrompt}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {onCopyInvite && (
                <button
                  type="button"
                  onClick={onCopyInvite}
                  className="hero-share-btn"
                  style={{ fontSize: '11px', padding: '5px 10px', flex: 'none' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                  <span>{t.shareCopyBtn}</span>
                </button>
              )}
              {onChatInvite && (
                <button
                  type="button"
                  onClick={onChatInvite}
                  className="hero-share-btn secondary"
                  style={{ fontSize: '11px', padding: '5px 10px', flex: 'none' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '13px' }}>chat</span>
                  <span>{t.shareChatBtn}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitVal} className="rating-form-component" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Note Globale */}
      <div>
        <label id="star-rating-label" style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          {t.missionScore}
        </label>
        <div
          role="radiogroup"
          aria-labelledby="star-rating-label"
          className="star-rating"
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          {[1, 2, 3, 4, 5].map(num => {
            const starLabels = [
              '1 / 5',
              '2 / 5',
              '3 / 5',
              '4 / 5',
              '5 / 5',
            ];
            return (
              <button
                key={num}
                type="button"
                role="radio"
                aria-checked={num === rating}
                aria-label={starLabels[num - 1]}
                className={`star-btn ${num <= rating ? 'active' : ''}`}
                onClick={() => handleStarClick(num)}
                style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                ★
              </button>
            );
          })}
        </div>

        {ratingError && (
          <div
            role="alert"
            aria-live="polite"
            className="hero-error-banner"
            style={{
              fontSize: '12px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>error_outline</span>
            <span>{ratingError}</span>
          </div>
        )}
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="hero-comment-textarea" style={{ fontWeight: 500, display: 'block', marginBottom: '6px', cursor: 'pointer' }}>
          {t.heroComment}
        </label>
        <textarea
          id="hero-comment-textarea"
          name="hero-comment"
          className="google-textarea"
          placeholder={t.commentPlaceholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ width: '100%', minHeight: '64px', maxHeight: '150px', resize: 'vertical' }}
        />
      </div>

      {/* Section dépliante moderne : Détails de la mission */}
      <div className="hero-details-divider">
        <button
          type="button"
          className={`hero-details-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="hero-details-panel"
        >
          <span className="hero-details-icon">⚡</span>
          <span>{t.missionDetailsToggle}</span>
          <span className="material-icons-outlined hero-chevron-icon">
            expand_more
          </span>
        </button>

        {/* Collapsible Content */}
        <div
          id="hero-details-panel"
          className={`hero-details-panel ${isOpen ? 'open' : ''}`}
        >
          {rating > 0 && rating <= 3 && (
            <div style={{
              fontSize: '12px', padding: '8px 10px', borderRadius: '6px',
              background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#f59e0b' }}>shield</span>
              Aide l'organisateur à sauver la prochaine réunion !
            </div>
          )}

          {CRITERIA_SECTIONS.map(({ key, label, options }) => (
            <fieldset key={key} className="checklist-group" role="radiogroup" aria-label={label}>
              <legend className="checklist-group-title">{label}</legend>
              <div className="checklist-options">
                {options.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    role="radio"
                    aria-checked={details[key] === opt.val}
                    className={`chip-select ${details[key] === opt.val ? 'active' : ''}`}
                    onClick={() => toggleDetail(key, opt.val)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {/* Submit Button (Seul tout en bas!) */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn btn-primary hero-submit-btn"
        style={{
          width: '100%',
          marginTop: '8px',
          opacity: isSubmitting ? 0.75 : 1,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? '... ⚡' : t.submitReview}
      </button>

      {/* Mention de confidentialité et anonymat */}
      <div
        className="hero-privacy-note"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '11px',
          color: '#5f6368',
          textAlign: 'center',
          marginTop: '2px',
          lineHeight: 1.3,
        }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '13px', color: '#188038', flexShrink: 0 }}>
          lock
        </span>
        <span>{t.anonymousNotice}</span>
      </div>
    </form>
  );
}
