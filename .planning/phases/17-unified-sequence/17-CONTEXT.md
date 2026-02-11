# Phase 17: Unified Sequence - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can arrange slides and batches in a single ordered list (session_items) that defines the session flow. Includes CRUD for session_items, on-demand backfill from existing batch ordering, and drag-and-drop reordering in the admin UI. Presentation advancement and projection are separate phases (18+).

</domain>

<decisions>
## Implementation Decisions

### List presentation
- Color-coded cards distinguish slides from batches (different background tints — e.g., blue for batches, purple for slides — with type icon)
- Each card shows summary info: icon, title, plus thumbnail (slides) or question count (batches)
- Sequence list replaces the current batch list on the session edit view — slides are interleaved among batches in the same area
- Items show a position number (1, 2, 3...) making order explicit

### Drag-and-drop behavior
- Fully free ordering — slides and batches can be placed anywhere in the sequence, no constraints
- New items insert after the currently selected/focused item; if nothing selected, append to end
- Reordering auto-saves on drop — order persists to database immediately when an item lands
- Items are deletable directly from the sequence list via an inline delete button (with confirmation)

### Backfill strategy
- On-demand lazy backfill — when a session is opened and has no session_items, generate them from existing batch sort_order
- Batches keep their current display order as the sequence position; slides (if any) append after batches
- Creating a new batch or slide auto-appends it to the sequence (or inserts after selected item)
- Deleting an underlying batch or slide auto-removes its session_item and re-numbers remaining items

### Empty & edge states
- Empty sequence shows a prompt: "No items yet. Add a batch or slide to get started." with action buttons
- Sessions with only batches (no slides) use the same unified color-coded, numbered sequence cards — no special treatment
- No maximum item limit — sequence is unbounded
- Drag handles always visible, even with a single item (consistent UI)

### Claude's Discretion
- Exact color palette for batch vs slide card tints
- Card spacing, typography, and shadow treatment
- Drag animation and drop zone indicator styling
- Thumbnail size and aspect ratio in slide cards
- Error/loading states during auto-save

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Existing @dnd-kit patterns in BatchList and TemplateEditor should be extended for the unified sequence.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-unified-sequence*
*Context gathered: 2026-02-10*
