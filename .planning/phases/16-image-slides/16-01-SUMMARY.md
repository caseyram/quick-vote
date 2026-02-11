# Plan 16-01: Database Schema, Storage Bucket, TypeScript Types, Slide API

## Status: Complete

## What Was Built

Established the full data layer for image slides:
- **session_items table** with inline slide data (no separate slides table), CHECK constraints for item_type integrity, indexes for query performance, and RLS policies for session-creator access control
- **Storage RLS policies** for session-images bucket enforcing session-creator ownership via `storage.foldername(name)[1]` path convention
- **TypeScript types** — SessionItem and SessionItemType matching the SQL schema exactly
- **slide-api module** — 6 exported functions: fetchSessionItems, createSlide, updateSlideCaption, deleteSlide, getSlideImageUrl, uploadSlideImage

## Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create session_items migration and Storage RLS policies | add03a7 | supabase/migrations/20250210_030_session_items.sql |
| 2 | Add TypeScript types and create slide-api module | 3d1397a | src/types/database.ts, src/lib/slide-api.ts |
| 3 | Apply migration and create Storage bucket (manual) | — | Supabase Dashboard |

## Key Decisions

- Inline slide data in session_items (not a separate slides table) — simpler for 2 fields
- Storage path convention: `{session_id}/{uuid}.{ext}` — enables RLS ownership verification
- session_items NOT added to supabase_realtime publication (use Broadcast instead)
- Storage delete before DB delete to prevent orphaned files

## Deviations

None.

## Artifacts

- `supabase/migrations/20250210_030_session_items.sql` — 97 lines
- `src/types/database.ts` — SessionItem, SessionItemType types added
- `src/lib/slide-api.ts` — 161 lines, 6 exported functions
