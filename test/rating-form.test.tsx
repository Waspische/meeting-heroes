import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RatingForm } from '../src/components/RatingForm';
import { t } from '../src/i18n';
import type { ActiveMeetingState } from '../src/utils/StorageHelper';

describe('Integration Test: RatingForm Submission & Validation Flow', () => {
  const mockMeeting: ActiveMeetingState = {
    id: 'abc-defg-hij',
    title: 'Sprint Review ADEO',
    startTime: Date.now() - 1800000,
    participantCount: 8,
    isHost: false,
    pollStatus: 'idle',
  };

  it('blocks submission and shows error if user tries to submit without selecting a rating', () => {
    const onSubmit = vi.fn();
    render(
      <RatingForm
        activeMeeting={mockMeeting}
        onSubmit={onSubmit}
        isSubmitted={false}
      />
    );

    const submitBtn = screen.getByRole('button', { name: new RegExp(t.submitReview, 'i') });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('allows full heroic feedback submission with stars, comment and criteria chips', () => {
    const onSubmit = vi.fn();
    render(
      <RatingForm
        activeMeeting={mockMeeting}
        onSubmit={onSubmit}
        isSubmitted={false}
      />
    );

    // 1. Select 5 stars
    const starButtons = screen.getAllByRole('radio');
    fireEvent.click(starButtons[4]);

    // 2. Add hero comment
    const commentInput = screen.getByPlaceholderText(new RegExp(t.commentPlaceholder.slice(0, 15), 'i'));
    fireEvent.change(commentInput, { target: { value: 'Super animation de réunion !' } });

    // 3. Open details accordion
    const toggleDetails = screen.getByRole('button', { name: new RegExp(t.missionDetailsToggle.slice(0, 10), 'i') });
    fireEvent.click(toggleDetails);

    // Vérifie que les titres des sections de critères sont bien affichés
    expect(screen.getByText('Durée')).toBeDefined();
    expect(screen.getByText('Récurrence')).toBeDefined();
    expect(screen.getByText('Ordre du jour')).toBeDefined();
    expect(screen.getByText('Efficacité')).toBeDefined();
    expect(screen.getByText('Format')).toBeDefined();

    // 4. Select criteria chips
    const timingChip = screen.getByRole('radio', { name: new RegExp(t.critDuration.perfect, 'i') });
    fireEvent.click(timingChip);

    // 5. Submit
    const submitBtn = screen.getByRole('button', { name: new RegExp(t.submitReview, 'i') });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedData = onSubmit.mock.calls[0][0];

    expect(submittedData.rating).toBe(5);
    expect(submittedData.comment).toBe('Super animation de réunion !');
    expect(submittedData.durationVal).toBe('perfect');
  });

  it('renders mission accomplished screen with sharing actions when isSubmitted is true', () => {
    const onCopy = vi.fn();
    const onChat = vi.fn();

    render(
      <RatingForm
        activeMeeting={mockMeeting}
        onSubmit={vi.fn()}
        isSubmitted={true}
        onCopyInvite={onCopy}
        onChatInvite={onChat}
      />
    );

    expect(screen.getByText(new RegExp(t.missionAccomplished, 'i'))).toBeDefined();

    const copyBtn = screen.getByRole('button', { name: new RegExp(t.shareCopyBtn, 'i') });
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledTimes(1);

    const chatBtn = screen.getByRole('button', { name: new RegExp(t.shareChatBtn, 'i') });
    fireEvent.click(chatBtn);
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it('renders App component and displays evaluated meetings tab with criteria tags', async () => {
    const { default: App } = await import('../src/App');
    const { StorageHelper } = await import('../src/utils/StorageHelper');

    await StorageHelper.addMeeting({
      id: 'test-meet-1',
      title: 'Point d’équipe Synchro',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      participantCount: 5,
      isOrganizer: false,
      rating: 4,
      comment: 'Très efficace !',
      details: {
        durationVal: 'too_long',
        recurrenceVal: 'right_pace',
        agendaVal: 'clear',
        efficiencyVal: 'actionable',
        formatVal: 'in_person_better',
      }
    });

    render(<App />);

    // Switch to Evals tab (waits for async storage load)
    const evalsTab = await screen.findByRole('tab', { name: /super.*1/i });
    fireEvent.click(evalsTab);

    expect(await screen.findByText('Point d’équipe Synchro')).toBeDefined();
    expect(screen.getByText('★ 4/5')).toBeDefined();
    // Verify tags are rendered properly using the active keys
    expect(screen.getByText(t.critDuration.tooLong)).toBeDefined();
    expect(screen.getByText(t.critRecurrence.rightPace)).toBeDefined();
    expect(screen.getByText(t.critAgenda.clear)).toBeDefined();
    expect(screen.getByText(t.critEfficiency.actionable)).toBeDefined();
    expect(screen.getByText(t.critFormat.inPersonBetter)).toBeDefined();
  });
});
