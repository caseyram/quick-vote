import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';
import type { Question, Vote, Session } from '../types/database';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: crypto.randomUUID(),
    session_id: 's1',
    text: 'Test question',
    type: 'agree_disagree',
    options: null,
    position: 0,
    anonymous: true,
    status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: crypto.randomUUID(),
    session_id: 'session-1',
    admin_token: crypto.randomUUID(),
    title: 'Test Session',
    status: 'draft',
    reasons_enabled: false,
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeVote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: crypto.randomUUID(),
    question_id: 'q1',
    session_id: 's1',
    participant_id: 'p1',
    value: 'agree',
    reason: null,
    display_name: null,
    locked_in: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useSessionStore.getState();
      expect(state.session).toBeNull();
      expect(state.questions).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentVote).toBeNull();
      expect(state.questionVotes).toEqual([]);
      expect(state.submitting).toBe(false);
      expect(state.participantCount).toBe(0);
      expect(state.connectionStatus).toBe('connecting');
      expect(state.activeQuestionId).toBeNull();
      expect(state.timerEndTime).toBeNull();
    });
  });

  describe('session management', () => {
    it('setSession stores the session', () => {
      const session = makeSession();
      useSessionStore.getState().setSession(session);
      expect(useSessionStore.getState().session).toEqual(session);
    });

    it('setSession can clear session with null', () => {
      useSessionStore.getState().setSession(makeSession());
      useSessionStore.getState().setSession(null);
      expect(useSessionStore.getState().session).toBeNull();
    });
  });

  describe('question management', () => {
    it('setQuestions sorts by position', () => {
      const q1 = makeQuestion({ id: 'a', position: 2 });
      const q2 = makeQuestion({ id: 'b', position: 0 });
      const q3 = makeQuestion({ id: 'c', position: 1 });
      useSessionStore.getState().setQuestions([q1, q2, q3]);
      const questions = useSessionStore.getState().questions;
      expect(questions.map((q) => q.id)).toEqual(['b', 'c', 'a']);
    });

    it('addQuestion inserts and sorts', () => {
      const q1 = makeQuestion({ id: 'a', position: 0 });
      const q2 = makeQuestion({ id: 'b', position: 2 });
      useSessionStore.getState().setQuestions([q1, q2]);
      useSessionStore.getState().addQuestion(makeQuestion({ id: 'c', position: 1 }));
      const ids = useSessionStore.getState().questions.map((q) => q.id);
      expect(ids).toEqual(['a', 'c', 'b']);
    });

    it('updateQuestion applies partial updates', () => {
      const q = makeQuestion({ id: 'q1', text: 'Original' });
      useSessionStore.getState().setQuestions([q]);
      useSessionStore.getState().updateQuestion('q1', { text: 'Updated' });
      expect(useSessionStore.getState().questions[0].text).toBe('Updated');
    });

    it('updateQuestion ignores unknown id', () => {
      const q = makeQuestion({ id: 'q1' });
      useSessionStore.getState().setQuestions([q]);
      useSessionStore.getState().updateQuestion('nonexistent', { text: 'X' });
      expect(useSessionStore.getState().questions).toHaveLength(1);
      expect(useSessionStore.getState().questions[0].text).toBe(q.text);
    });

    it('removeQuestion filters by id', () => {
      const q1 = makeQuestion({ id: 'q1' });
      const q2 = makeQuestion({ id: 'q2' });
      useSessionStore.getState().setQuestions([q1, q2]);
      useSessionStore.getState().removeQuestion('q1');
      expect(useSessionStore.getState().questions).toHaveLength(1);
      expect(useSessionStore.getState().questions[0].id).toBe('q2');
    });

    it('reorderQuestions assigns new positions', () => {
      const q1 = makeQuestion({ id: 'a', position: 0 });
      const q2 = makeQuestion({ id: 'b', position: 1 });
      const q3 = makeQuestion({ id: 'c', position: 2 });
      useSessionStore.getState().setQuestions([q1, q2, q3]);
      useSessionStore.getState().reorderQuestions(['c', 'a', 'b']);
      const questions = useSessionStore.getState().questions;
      expect(questions.map((q) => q.id)).toEqual(['c', 'a', 'b']);
      expect(questions.map((q) => q.position)).toEqual([0, 1, 2]);
    });

    it('reorderQuestions skips unknown ids', () => {
      const q1 = makeQuestion({ id: 'a', position: 0 });
      useSessionStore.getState().setQuestions([q1]);
      useSessionStore.getState().reorderQuestions(['nonexistent', 'a']);
      const questions = useSessionStore.getState().questions;
      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe('a');
    });
  });

  describe('loading and error', () => {
    it('setLoading updates loading state', () => {
      useSessionStore.getState().setLoading(true);
      expect(useSessionStore.getState().loading).toBe(true);
    });

    it('setError updates error state', () => {
      useSessionStore.getState().setError('Something failed');
      expect(useSessionStore.getState().error).toBe('Something failed');
    });
  });

  describe('voting state', () => {
    it('setCurrentVote stores a vote', () => {
      const vote = makeVote();
      useSessionStore.getState().setCurrentVote(vote);
      expect(useSessionStore.getState().currentVote).toEqual(vote);
    });

    it('setQuestionVotes stores votes', () => {
      const votes = [makeVote(), makeVote()];
      useSessionStore.getState().setQuestionVotes(votes);
      expect(useSessionStore.getState().questionVotes).toHaveLength(2);
    });

    it('setSubmitting updates submitting state', () => {
      useSessionStore.getState().setSubmitting(true);
      expect(useSessionStore.getState().submitting).toBe(true);
    });
  });

  describe('realtime state', () => {
    it('setParticipantCount updates count', () => {
      useSessionStore.getState().setParticipantCount(5);
      expect(useSessionStore.getState().participantCount).toBe(5);
    });

    it('setConnectionStatus updates status', () => {
      useSessionStore.getState().setConnectionStatus('connected');
      expect(useSessionStore.getState().connectionStatus).toBe('connected');
    });

    it('setActiveQuestionId updates id', () => {
      useSessionStore.getState().setActiveQuestionId('q1');
      expect(useSessionStore.getState().activeQuestionId).toBe('q1');
    });

    it('setTimerEndTime updates end time', () => {
      useSessionStore.getState().setTimerEndTime(12345);
      expect(useSessionStore.getState().timerEndTime).toBe(12345);
    });
  });

  describe('reset', () => {
    it('resets all state to defaults', () => {
      const store = useSessionStore.getState();
      store.setSession(makeSession());
      store.setQuestions([makeQuestion()]);
      store.setLoading(true);
      store.setError('err');
      store.setCurrentVote(makeVote());
      store.setSubmitting(true);
      store.setParticipantCount(10);
      store.setConnectionStatus('connected');
      store.setActiveQuestionId('q1');
      store.setTimerEndTime(999);

      store.reset();

      const state = useSessionStore.getState();
      expect(state.session).toBeNull();
      expect(state.questions).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentVote).toBeNull();
      expect(state.submitting).toBe(false);
      expect(state.participantCount).toBe(0);
      expect(state.connectionStatus).toBe('connecting');
      expect(state.activeQuestionId).toBeNull();
      expect(state.timerEndTime).toBeNull();
    });
  });
});
