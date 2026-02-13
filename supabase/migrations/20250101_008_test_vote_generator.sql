-- ============================================
-- Dev/Test: Fake Vote Generator
-- ============================================
-- RPC function to insert fake votes for testing.
-- Uses SECURITY DEFINER to bypass RLS (participant_id won't match auth.uid()).

CREATE OR REPLACE FUNCTION insert_test_votes(
  p_session_id TEXT,
  p_question_id UUID,
  p_count INT DEFAULT 10
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  q RECORD;
  i INT;
  fake_pid UUID;
  vote_value TEXT;
  vote_reason TEXT;
  roll FLOAT;
  opt_count INT;
  opt_index INT;
  inserted INT := 0;
  reasons_pool TEXT[] := ARRAY[
    'I feel strongly about this',
    'Based on my experience',
    'This aligns with our goals',
    'I have concerns about the alternative',
    'The data supports this view',
    'From a practical standpoint',
    'I think we should consider all angles',
    'This is the pragmatic choice',
    'I''ve seen this work before',
    'Not fully convinced yet',
    'This could have unintended consequences',
    'I agree with the general direction',
    'We need more information',
    'This is a step in the right direction',
    'I have reservations but overall support this'
  ];
BEGIN
  -- Fetch question details
  SELECT * INTO q FROM questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', p_question_id;
  END IF;

  FOR i IN 1..p_count LOOP
    fake_pid := gen_random_uuid();

    -- Pick vote value based on question type
    IF q.type = 'agree_disagree' THEN
      roll := random();
      IF roll < 0.50 THEN
        vote_value := 'Agree';
      ELSIF roll < 0.70 THEN
        vote_value := 'Sometimes';
      ELSE
        vote_value := 'Disagree';
      END IF;
    ELSE
      -- Multiple choice: pick random option from JSONB array
      opt_count := jsonb_array_length(q.options);
      IF opt_count > 0 THEN
        opt_index := floor(random() * opt_count);
        vote_value := q.options->>opt_index;
      ELSE
        vote_value := 'Option A';
      END IF;
    END IF;

    -- ~40% chance of including a reason
    IF random() < 0.4 THEN
      vote_reason := reasons_pool[1 + floor(random() * array_length(reasons_pool, 1))::int];
    ELSE
      vote_reason := NULL;
    END IF;

    INSERT INTO votes (question_id, session_id, participant_id, value, display_name, locked_in, reason)
    VALUES (
      p_question_id,
      p_session_id,
      fake_pid,
      vote_value,
      NULL,
      false,
      vote_reason
    );

    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;
