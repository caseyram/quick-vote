# Phase 11: Template Database & CRUD - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can create, edit, and manage reusable response templates with full CRUD operations. Templates are stored globally in Supabase and available across all sessions. Template assignment to questions and consistent rendering are separate phases (12, 13).

</domain>

<decisions>
## Implementation Decisions

### Template editor experience
- Editor style: Claude's discretion — pick approach that fits existing UI patterns
- Option reordering via drag and drop
- Adding options must be consistent with the existing question creation interface (same interaction pattern)
- Template name editing: Claude's discretion

### Option configuration
- Options are text only — colors assigned automatically based on position (not stored in template)
- Option limit matches whatever limit exists for question options today — consistent behavior
- Minimum 2 options required per template
- No duplicate option text allowed within the same template

### Template list & management
- Accessed as a tab or section within the admin session view
- Each template shows: name + preview of option labels (e.g., "Agree, Neutral, Disagree")
- Simple flat list — no search/filter needed
- Unique template names required (enforced)

### Delete & safety behavior
- Deleting a template in use detaches linked questions (they keep their current options but lose the template link)
- Delete confirmation shows simple usage count warning (e.g., "This template is used by 3 questions"), not a list of individual questions
- Editing a template shows a confirmation before propagating changes to linked questions (e.g., "5 questions will be updated")
- If any linked question has received votes, template option edits are blocked — protects data integrity

### Claude's Discretion
- Editor style (modal, slide-out, or inline — whatever fits existing patterns)
- Template name editing approach (inline rename vs editor form)
- Loading skeleton design
- Exact spacing, typography, and layout details
- Error state handling

</decisions>

<specifics>
## Specific Ideas

- Option adding/editing should match the existing question creation interface for consistency
- Drag and drop for reordering options (tactile feel consistent with the app's overall "immersive and tactile" value)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-template-database-crud*
*Context gathered: 2026-02-09*
