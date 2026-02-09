# Phase 12: Template Assignment & Defaults - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can assign response templates to multiple choice questions and set a per-session default template. Selecting a template auto-populates options and locks them. Admin can detach to customize independently, or switch templates. Session default auto-applies to new MC questions. Template CRUD (Phase 11) and consistent participant rendering (Phase 13) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Assignment workflow
- Template selector appears as a separate row above the options list in the question form, acting as a mode toggle between "use template" and "custom options"
- Selector available in both create and edit flows
- When a template is selected and manual options already exist, show a confirmation: "Replace current options with template?"
- Block template assignment on questions that already have recorded votes (prevent data invalidation)

### Locked state & detach
- When a template is assigned, options display as a grayed-out read-only list with no drag handles or delete buttons
- A small "Template: [name]" badge is shown above/near the locked options
- Detaching copies template options as editable (fork) — no data loss
- Detach requires confirmation dialog: "Detach from template? Options will become editable."
- Detach is accessible from two places: a "Detach" link near the template badge AND a "None (custom options)" choice in the template dropdown — both trigger the same behavior

### Default template scope
- Default template setting lives in the session settings panel as a "Default Template" dropdown
- Default is per-session (each session can have its own default template)
- Default only pre-selects the template when creating new MC questions
- When setting a default, offer to also apply it to existing templateless MC questions in the session
- Admin can clear the default (mechanism at Claude's discretion)

### Claude's Discretion
- Clear default mechanism (dropdown "None" option vs clear button)
- Exact placement and styling of the template badge
- Loading skeleton design
- Error state handling for template fetch failures

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches that fit the existing admin UI patterns from Phase 11.

</specifics>

<deferred>
## Deferred Ideas

- Template switching on questions with existing votes (currently blocked — could revisit with vote migration in a future phase)

</deferred>

---

*Phase: 12-template-assignment-defaults*
*Context gathered: 2026-02-09*
