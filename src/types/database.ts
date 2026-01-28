export type VoteType = 'agree_disagree' | 'multiple_choice';
export type SessionStatus = 'draft' | 'lobby' | 'active' | 'ended';
export type QuestionStatus = 'pending' | 'active' | 'closed' | 'revealed';
export type BatchStatus = 'pending' | 'active' | 'closed';

export interface Batch {
  id: string;
  session_id: string;
  name: string;
  position: number;
  status: BatchStatus;
  created_at: string;
}

export interface Session {
  id: string;
  session_id: string;
  admin_token: string;
  title: string;
  status: SessionStatus;
  reasons_enabled: boolean;
  created_by: string;
  created_at: string;
}

export interface Question {
  id: string;
  session_id: string;
  text: string;
  type: VoteType;
  options: string[] | null;
  position: number;
  anonymous: boolean;
  status: QuestionStatus;
  created_at: string;
  batch_id: string | null;
}

export interface Vote {
  id: string;
  question_id: string;
  session_id: string;
  participant_id: string;
  value: string;
  reason: string | null;
  display_name: string | null;
  locked_in: boolean;
  created_at: string;
  updated_at: string;
}
