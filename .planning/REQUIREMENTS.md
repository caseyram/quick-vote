# Requirements: QuickVote

**Defined:** 2026-02-09
**Core Value:** Participants can instantly vote on questions in a way that feels immersive and tactile -- not like filling out a form.

## v1.2 Requirements

Requirements for milestone v1.2: Response Templates.

### Response Template CRUD

- [ ] **TMPL-01**: Admin can create a named response template with an ordered list of options
- [ ] **TMPL-02**: Admin can edit a template (rename, reorder options, add/remove options)
- [ ] **TMPL-03**: Admin can delete a template (with confirmation if in use by questions)
- [ ] **TMPL-04**: Templates are stored globally in Supabase and available across all sessions
- [ ] **TMPL-05**: Admin can set a session-level default template that auto-applies to new MC questions

### Template Assignment

- [ ] **ASGN-01**: Admin can select a template from a dropdown when creating a multiple choice question
- [ ] **ASGN-02**: Selecting a template auto-populates the question's options from the template
- [ ] **ASGN-03**: Options are locked while a template is assigned (cannot edit per-question)
- [ ] **ASGN-04**: Admin can detach a question from its template to customize options independently
- [ ] **ASGN-05**: Admin can change the template assignment on an existing question

### Consistent Rendering

- [ ] **REND-01**: All questions using the same template display options in identical order
- [ ] **REND-02**: Same color mapping applied consistently across all template-linked questions
- [ ] **REND-03**: Identical button layout and sizing in participant voting view for template-linked questions

### Export/Import

- [ ] **EXPT-01**: Response templates included in JSON session export
- [ ] **EXPT-02**: Templates restored when importing JSON (deduplicated by name if template already exists)
- [ ] **EXPT-03**: Template-question associations preserved through export/import round-trip

## Future Requirements

Deferred to later milestones.

### Collections

- **COLL-01**: Admin can create named collections of questions
- **COLL-02**: Admin can load a collection into a session
- **COLL-03**: Admin can export/import collections as JSON
- **COLL-04**: Admin can share collections across sessions
- **COLL-05**: Collections preserve template assignments

### Other

- **BATCH-F01**: Mobile swipe gesture navigation for batch voting
- **BATCH-F02**: Hybrid mode (mix live + batch in one session)
- **EXPRT-F01**: CSV/PDF export of results

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom color picker per template | Current palette sufficient, consistency is the priority |
| Template versioning | Overkill for 2-5 templates |
| Template sharing between users | No user accounts exist |
| Bulk-assign template to multiple questions | Can be added later if needed |
| Template categories/folders | Too few templates to need organization |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 | - | Pending |
| TMPL-02 | - | Pending |
| TMPL-03 | - | Pending |
| TMPL-04 | - | Pending |
| TMPL-05 | - | Pending |
| ASGN-01 | - | Pending |
| ASGN-02 | - | Pending |
| ASGN-03 | - | Pending |
| ASGN-04 | - | Pending |
| ASGN-05 | - | Pending |
| REND-01 | - | Pending |
| REND-02 | - | Pending |
| REND-03 | - | Pending |
| EXPT-01 | - | Pending |
| EXPT-02 | - | Pending |
| EXPT-03 | - | Pending |

**Coverage:**
- v1.2 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after initial definition*
