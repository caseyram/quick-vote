export type VoteType = 'agree_disagree' | 'multiple_choice';
export type SessionStatus = 'draft' | 'lobby' | 'active' | 'ended';
export type QuestionStatus = 'pending' | 'active' | 'closed' | 'revealed';

export interface Session {
  id: string;
  session_id: string;
  admin_token: string;
  title: string;
  status: SessionStatus;
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
}

export interface Vote {
  id: string;
  question_id: string;
  session_id: string;
  participant_id: string;
  value: string;
  display_name: string | null;
  locked_in: boolean;
  created_at: string;
  updated_at: string;
}
