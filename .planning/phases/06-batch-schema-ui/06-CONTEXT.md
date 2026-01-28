# Phase 6: Batch Schema & UI - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can create questions on-the-fly and organize them into named batches within a session. Batches are containers for grouping questions; activation and participant experience are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Batch creation flow
- "+ New Batch" button in session view initiates batch creation
- Clicking button causes inline expansion — new batch section appears with name field and question area
- Batch name is optional with "Untitled Batch" placeholder — admin can name anytime
- Accordion behavior: only one batch expanded at a time (expanding one collapses others)

### Question-to-batch assignment
- Questions are created inside batches via "+ Add Question" button within each batch section
- Inline form expands within the batch — question appears immediately after saving
- Questions CAN exist outside batches (unbatched) — preserves v1.0 live-push functionality
- Unbatched questions appear interleaved with batch cards in creation order (not separated)

### Batch list visualization
- Card-based list layout — each batch is a card showing name + first few question previews (truncated)
- Batches and unbatched questions appear interleaved by creation order
- Subtle visual differentiation — small icon or indent distinguishes batch cards from standalone questions, but overall look is cohesive

### Batch editing & reordering
- Drag-and-drop to reorder questions within a batch (drag handle on each question)
- No cross-batch moving — if question needs to be in different batch, delete and recreate
- Click batch name to edit inline (rename)
- Deleting a batch moves its questions to unbatched (doesn't delete the questions)

### Claude's Discretion
- Exact visual styling (spacing, colors, shadows on cards)
- Drag-and-drop library/implementation approach
- Empty batch state messaging
- Question preview truncation length

</decisions>

<specifics>
## Specific Ideas

- Batches and unbatched questions share the same list space, interleaved by creation order — this maintains a unified timeline feel
- Accordion UX (one batch expanded at a time) keeps the view focused
- Deleting batch preserves questions as unbatched — non-destructive by default

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-batch-schema-ui*
*Context gathered: 2026-01-28*
