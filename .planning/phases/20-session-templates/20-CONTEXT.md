# Phase 20: Session Templates - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can save a complete session structure as a reusable template in Supabase and load it into new sessions. Templates capture content structure (sequence items, slides, batches, questions, response template assignments) — not session-level settings or historical responses. Managing templates (list, rename, delete) happens within the session view.

</domain>

<decisions>
## Implementation Decisions

### Save workflow
- Save action lives inside a dedicated template panel (sidebar/drawer), not in the session header
- Admin must name the template at save time (name required upfront)
- If a template with the same name exists, prompt: "Template 'X' exists. Overwrite or save as new?"
- Save confirmation uses inline success state on the save button (checkmark/green state), not a toast

### Load workflow
- Templates can be loaded both when creating a new session AND within an existing session
- When loading into a session with existing content, prompt: "Replace current content or append template items?"
- Show a summary preview before loading (item count, sequence overview, slide thumbnails)
- Templates capture structure only — no historical responses/votes are included

### Template management UI
- Template panel is a sidebar/drawer within the session editing screen
- Templates displayed as a simple list: name, last modified date, item count (compact rows)
- Delete requires typing the template name to confirm (GitHub-style safety)
- Rename is inline — click the template name to edit in-place, press Enter to save

### Template scope
- Slide images are referenced by original Storage paths (no duplication)
- Response template assignments are captured — questions re-link to their response templates on load
- If a referenced response template no longer exists, warn: "N response templates no longer exist — questions loaded without assignments"
- Content structure only — session title and join code are always fresh per session

### Claude's Discretion
- Sidebar/drawer animation and width
- Exact preview layout for template summary
- Loading spinner/progress patterns
- Empty state when no templates exist yet

</decisions>

<specifics>
## Specific Ideas

- Overwrite-or-rename prompt for duplicate names mirrors familiar "Save As" patterns
- Type-to-confirm delete is intentionally high-friction — templates represent significant setup effort
- Inline rename keeps the list compact and avoids modal fatigue

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-session-templates*
*Context gathered: 2026-02-11*
