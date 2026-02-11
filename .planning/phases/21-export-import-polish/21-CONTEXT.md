# Phase 21: Export/Import + Polish - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend JSON export/import to capture slides and sequence order alongside existing batches/questions/votes. Add slide preview thumbnails in the sequence editor and QR code overlay on content slides in the presentation view. No new capabilities beyond what's scoped in ROADMAP.md requirements EXP-01, EXP-02, EXP-03, POL-01, POL-02.

</domain>

<decisions>
## Implementation Decisions

### Export/import format
- Slide images represented as **relative Storage paths** (e.g. `slides/abc.jpg`), not full URLs
- Slides **interleaved in the existing batches array** as special entries (e.g. `{type:'slide', image_path:'...', position: 3}`) rather than a separate top-level sequence array
- v1.2 backward compatibility: old importers **silently skip** unknown slide entries -- batches import fine, slides are dropped without error
- Session template reference: include the **template name only** in the export (provenance tracking, not content duplication)

### Missing image handling
- **Validate image existence upfront** before starting import -- check all image paths exist in Storage first
- If some images are missing: **require user confirmation** ("X of Y slides have missing images and will be skipped. Proceed anyway?")
- If all slide images are missing: **allow import anyway** -- proceeds with batches/questions only (essentially a v1.2-style import)
- Missing-image slides are **skipped entirely** (not created with broken refs)

### Slide thumbnails
- **Medium preview size (60-80px)** in the sequence editor
- Use **CSS-resized full image** (existing Storage URL with `object-fit`) -- no separate thumbnail generation or Supabase transforms
- **Thumbnail + title beside it** -- image thumbnail on the left, slide title/label text to the right
- Batch item visual treatment: **Claude's discretion** (may add small icons for visual consistency)

### QR overlay on content slides
- QR code positioned in **bottom-right corner** of slide in presentation view
- Uses the **existing QR toggle** from Phase 19 -- one toggle controls QR across all content types (batches and slides)
- **Same size as existing** QR overlay -- consistent across batches and slides
- **Semi-transparent card** behind QR code to ensure scannability against any slide image background

### Claude's Discretion
- Batch item icons/visual treatment in sequence editor alongside slide thumbnails
- Exact slide entry schema shape in the JSON export format
- QR card opacity level and styling details
- Import progress/loading UX during upfront validation

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 21-export-import-polish*
*Context gathered: 2026-02-11*
