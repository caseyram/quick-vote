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
  test_mode: boolean;
  timer_expires_at: string | null;
  created_by: string;
  created_at: string;
  default_template_id: string | null;
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
  template_id: string | null;
}

export interface ResponseTemplate {
  id: string;
  name: string;
  options: string[];
  created_at: string;
  updated_at: string;
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

export type SessionItemType = 'batch' | 'slide';

export interface SessionItem {
  id: string;
  session_id: string;
  item_type: SessionItemType;
  position: number;
  batch_id: string | null;
  slide_image_path: string | null;
  slide_caption: string | null;
  created_at: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  blueprint: SessionBlueprint;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface SessionBlueprint {
  version: 1;
  globalTemplateId?: string | null;
  backgroundColor?: string | null;
  sessionItems: SessionBlueprintItem[];
}

export interface SessionBlueprintItem {
  item_type: 'batch' | 'slide';
  position: number;
  batch?: {
    name: string;
    timer_duration?: number | null;
    template_id?: string | null;
    questions: QuestionBlueprint[];
  };
  slide?: {
    image_path: string;
    caption: string | null;
  };
}

export interface QuestionBlueprint {
  text: string;
  type: VoteType;
  options: string[] | null;
  anonymous: boolean;
  position: number;
  template_id: string | null;
}
