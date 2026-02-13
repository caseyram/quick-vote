-- ============================================
-- QuickVote Phase 22: Template Image Storage
-- ============================================
-- Allow authenticated users to upload images to the templates/ folder
-- in the session-images bucket. Template images are uploaded during
-- template editing before any session exists.

CREATE POLICY "Authenticated users can upload template images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-images'
    AND (storage.foldername(name))[1] = 'templates'
  );

CREATE POLICY "Authenticated users can delete template images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-images'
    AND (storage.foldername(name))[1] = 'templates'
  );
