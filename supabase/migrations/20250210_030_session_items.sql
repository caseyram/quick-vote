-- ============================================
-- QuickVote Phase 16: Image Slides
-- ============================================
-- Unified sequence table for batches and image slides in presentation mode.
-- Storage RLS policies for session-images bucket.

-- Session items table (unified sequence)
CREATE TABLE session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('batch', 'slide')),
  position INTEGER NOT NULL DEFAULT 0,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  slide_image_path TEXT,
  slide_caption TEXT,
  CONSTRAINT valid_batch_item CHECK (
    item_type != 'batch' OR (batch_id IS NOT NULL AND slide_image_path IS NULL)
  ),
  CONSTRAINT valid_slide_item CHECK (
    item_type != 'slide' OR (batch_id IS NULL AND slide_image_path IS NOT NULL)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index foreign keys for query performance
CREATE INDEX idx_session_items_session_id ON session_items(session_id);
CREATE INDEX idx_session_items_position ON session_items(session_id, position);

-- ============================================
-- RLS Policies for session_items
-- ============================================

ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read session items"
  ON session_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creator can insert items"
  ON session_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Session creator can update items"
  ON session_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Session creator can delete items"
  ON session_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = session_items.session_id
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

-- ============================================
-- Storage RLS Policies for session-images bucket
-- ============================================

CREATE POLICY "Anyone can view session images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'session-images');

CREATE POLICY "Session creators can upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-images'
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.session_id = (storage.foldername(name))[1]
      AND sessions.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Session creators can delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-images'
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.session_id = (storage.foldername(name))[1]
      AND sessions.created_by = (SELECT auth.uid())
    )
  );
